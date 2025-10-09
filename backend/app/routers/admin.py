# D:\globus-market\backend\app\routers\admin.py

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func, case 
from typing import List, Optional

from app import models, schemas
from app.dependencies import get_db
from app.routers.auth import get_current_user
# Импортируем нашу функцию генерации накладных
from app.routers.orders import generate_invoice_files 
from datetime import date

from fastapi.responses import FileResponse
import tempfile

router = APIRouter()

# --- Новый "охранник", который пропускает только админов (ОТЛАДОЧНАЯ ВЕРСИЯ) ---
def get_current_admin_user(current_user: models.User = Depends(get_current_user)):
    print("\n--- НАЧАЛО ПРОВЕРКИ АДМИНА ---")
    if not current_user:
        print("ОШИБКА: Пользователь по токену не найден.")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to perform this action (user not found)",
        )

    print(f"Найден пользователь: {current_user.username} (ID: {current_user.id})")
    print(f"Значение поля is_admin из базы: {current_user.is_admin}")
    print(f"Тип данных поля is_admin: {type(current_user.is_admin)}")

    if not current_user.is_admin:
        print("ПРОВЕРКА ПРОВАЛЕНА: current_user.is_admin вернул False.")
        print("--- КОНЕЦ ПРОВЕРКИ АДМИНА ---\n")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to perform this action",
        )

    print("ПРОВЕРКА ПРОЙДЕНА: Пользователь является админом.")
    print("--- КОНЕЦ ПРОВЕРКИ АДМИНА ---\n")
    return current_user


# --- Новые Pydantic-схемы для обновления заказа ---
class OrderItemUpdate(BaseModel):
    quantity: int

class OrderUpdate(BaseModel):
    items: dict[int, OrderItemUpdate] # Словарь, где ключ - id товара, значение - новые данные
    items_to_delete: List[int] = [] # Список id товаров для удаления
    discount_percent: Optional[float] = None
    status: Optional[str] = None



# --- НОВЫЙ ЭНДПОИНТ для получения ОДНОГО заказа по ID ---
@router.get("/orders/{order_id}", response_model=schemas.Order)
def get_order_by_id(
    order_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin_user)
):
    """
    Возвращает один заказ по его ID, независимо от статуса (включая удалённые).
    """
    db_order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not db_order:
        raise HTTPException(status_code=404, detail="Заказ с таким ID не найден")
    return db_order


# --- Эндпоинты для администратора ---

@router.get("/orders", response_model=List[schemas.Order])
def get_all_orders(
    date_str: Optional[str] = None,
    status: Optional[str] = None, # <-- Добавили новый фильтр по статусу
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin_user)
):
    """
    Получает список заказов.
    - Если передан 'status', фильтрует по нему.
    - Иначе, отдает все НЕ удалённые заказы.
    - Фильтрует по дате, если она передана.
    """
    query = db.query(models.Order)

    if status:
        # Если явно запрошен статус (например, 'deleted'), фильтруем по нему
        query = query.filter(models.Order.status == status)
    else:
        # По умолчанию, как и раньше, не показываем удалённые
        query = query.filter(models.Order.status != "deleted")
    
    if date_str:
        try:
            filter_date = date.fromisoformat(date_str)
            # В зависимости от статуса, фильтруем по разным датам
            if status == 'deleted':
                query = query.filter(func.date(models.Order.deleted_at) == filter_date)
            else:
                 query = query.filter(func.date(models.Order.created_at) == filter_date)

        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail="Неверный формат даты. Используйте YYYY-MM-DD.")
    
    orders = query.order_by(models.Order.id.asc()).all()
    return orders

@router.patch("/orders/{order_id}", response_model=schemas.Order)
def update_order(
    order_id: int,
    order_update: OrderUpdate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin_user)
):
    """Обновляет заказ: количество, удаляет позиции, меняет скидку. Доступно только админам."""
    
    db_order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not db_order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Обновляем количество
    for item_id_str, item_data in order_update.items.items():
        item_id = int(item_id_str)
        item_to_update = next((item for item in db_order.items if item.id == item_id), None)
        if item_to_update:
            item_to_update.quantity = item_data.quantity

    # Удаляем позиции
    for item_id_to_delete in order_update.items_to_delete:
        item_to_delete = next((item for item in db_order.items if item.id == item_id_to_delete), None)
        if item_to_delete:
            db.delete(item_to_delete)
            
    # Обновляем скидку, если она была передана
    if order_update.discount_percent is not None:
        db_order.discount_percent = order_update.discount_percent
        
    # --- ИСПРАВЛЕННАЯ ЛОГИКА СТАТУСА ---
    # Если заказ был "новый", он автоматически становится "обработанным" после первого редактирования.
    if db_order.status == "new":
        db_order.status = "processed"
        db_order.processed_at = func.now()

    # При этом, если админ вручную передал другой статус в этом же запросе, мы используем его.
    if order_update.status is not None:
        db_order.status = order_update.status
    # --- КОНЕЦ ИСПРАВЛЕННОЙ ЛОГИКИ ---
        
    db.commit()
    db.refresh(db_order)

    # ВАЖНО: Перегенерируем накладные с новыми данными
    generate_invoice_files(db_order, db)
    db.commit() # Сохраняем пути к новым файлам
    db.refresh(db_order)

    return db_order


# --- НОВЫЙ ЭНДПОИНТ для изменения статуса и списания остатков ---

class OrderStatusUpdate(BaseModel):
    status: str

@router.patch("/orders/{order_id}/status", response_model=schemas.Order)
def update_order_status(
    order_id: int,
    status_update: OrderStatusUpdate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin_user)
):
    """
    Обновляет статус заказа.
    - При статусе 'completed' - списывает товары со склада.
    - При статусе 'returned' - возвращает товары на склад.
    """
    db_order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not db_order:
        raise HTTPException(status_code=404, detail="Order not found")

    new_status = status_update.status
    old_status = db_order.status

    # --- НОВАЯ РАСШИРЕННАЯ ЛОГИКА ---

    # 1. СЦЕНАРИЙ: ЗАВЕРШЕНИЕ ЗАКАЗА (Списание остатков)
    if new_status == "completed" and old_status != "completed":
        ignore_stock_setting = db.query(models.AppSettings).filter(models.AppSettings.key == "ignore_stock_limits").first()
        ignore_stock = ignore_stock_setting.value == "true" if ignore_stock_setting else False
        
        for item in db_order.items:
            product = db.query(models.Product).filter(models.Product.id == item.product_id).with_for_update().first()
            
            if not ignore_stock and product.stock < item.quantity:
                db.rollback()
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Невозможно завершить заказ. Недостаточно товара '{product.name}' на складе. В наличии: {product.stock}, в заказе: {item.quantity}"
                )
            
            product.stock -= item.quantity
        
        db_order.completed_at = func.now()

    # 2. СЦЕНАРИЙ: ВОЗВРАТ ЗАКАЗА (Возврат остатков на склад)
    elif new_status == "returned" and old_status == "completed":
        # Возврат возможен только для УЖЕ ЗАВЕРШЕННОГО заказа
        for item in db_order.items:
            product = db.query(models.Product).filter(models.Product.id == item.product_id).with_for_update().first()
            if product:
                product.stock += item.quantity # Возвращаем товары на склад

    # 3. СЦЕНАРИЙ: ОТМЕНА ЗАКАЗА (Никаких действий с остатками)
    # Этот сценарий не требует специального блока кода, так как остатки не списывались.
    # Мы просто меняем статус.

    db_order.status = new_status
    db.commit()
    db.refresh(db_order)
    return db_order

# Новая Pydantic-модель для приёма данных для превью
class OrderPreview(schemas.Order):
    pass

@router.post("/orders/preview/pdf", response_class=FileResponse)
def get_pdf_preview(
    order_data: OrderPreview,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin_user)
):
    """Генерирует PDF на лету на основе переданных данных и возвращает его как файл."""
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf", prefix="preview_") as tmp:
        order_data.invoice_path_pdf = tmp.name
        order_data.invoice_path_xlsx = ""
        generate_invoice_files(order_data, db)
        return FileResponse(tmp.name, media_type='application/pdf', filename=f"preview_{order_data.order_number}.pdf")

@router.post("/orders/preview/excel", response_class=FileResponse)
def get_excel_preview(
    order_data: OrderPreview,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin_user)
):
    """Генерирует Excel на лету и возвращает его как файл."""
    with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx", prefix="preview_") as tmp:
        order_data.invoice_path_pdf = ""
        order_data.invoice_path_xlsx = tmp.name
        generate_invoice_files(order_data, db)
        return FileResponse(tmp.name, media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', filename=f"preview_{order_data.order_number}.xlsx")


# --- НОВЫЙ ЭНДПОИНТ для получения данных для страницы Ревизии ---
@router.get("/inventory/revision-list", response_model=List[schemas.RevisionProduct])
def get_revision_list(
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin_user)
):
    """
    Возвращает полный список товаров с указанием текущих остатков
    и количества товаров в заказах, которые еще не завершены.
    """
    reserved_stock_query = db.query(
        models.OrderItem.product_id,
        func.sum(case((models.Order.status == 'new', models.OrderItem.quantity), else_=0)).label('new'),
        func.sum(case((models.Order.status == 'processed', models.OrderItem.quantity), else_=0)).label('processed')
    ).join(models.Order).group_by(models.OrderItem.product_id).subquery()

    products_with_reserved_stock = db.query(
        models.Product,
        reserved_stock_query.c.new,
        reserved_stock_query.c.processed
    ).outerjoin(
        reserved_stock_query, models.Product.id == reserved_stock_query.c.product_id
    ).order_by(models.Product.name).all()

    result = []
    for product, new_qty, processed_qty in products_with_reserved_stock:
        revision_item = schemas.RevisionProduct(
            product_id=product.id,
            sku=product.sku,
            name=product.name,
            price=product.price,
            db_stock=product.stock,
            reserved=schemas.ReservedStock(
                new=new_qty or 0,
                processed=processed_qty or 0
            )
        )
        result.append(revision_item)
    return result

    
# --- НОВЫЙ ЭНДПОИНТ для обновления остатков после ревизии ---
@router.post("/inventory/update", status_code=status.HTTP_200_OK)
def update_inventory(
    inventory_data: schemas.InventoryUpdate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin_user)
):
    """
    Массово обновляет количество товаров на складе.
    Принимает список ID товаров и их новые остатки.
    """
    updated_products = []
    not_found_products = []
    for item in inventory_data.updates:
        product = db.query(models.Product).filter(models.Product.id == item.product_id).first()
        if product:
            product.stock = item.new_stock
            updated_products.append(item.product_id)
        else:
            not_found_products.append(item.product_id)
    if updated_products:
        db.commit()
    if not_found_products:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Не удалось найти товары с ID: {not_found_products}. Остатки для остальных товаров обновлены."
        )
    return {"message": f"Остатки успешно обновлены для {len(updated_products)} товаров."}    


# === НОВЫЙ РАЗДЕЛ: УПРАВЛЕНИЕ НАСТРОЙКАМИ ===

@router.get("/settings", response_model=List[schemas.AppSetting])
def get_all_settings(
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin_user)
):
    """Получает все глобальные настройки."""
    settings = db.query(models.AppSettings).all()
    return settings

@router.put("/settings/{key}", response_model=schemas.AppSetting)
def update_setting(
    key: str,
    setting_data: schemas.AppSettingUpdate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin_user)
):
    """Обновляет значение конкретной настройки."""
    db_setting = db.query(models.AppSettings).filter(models.AppSettings.key == key).first()
    if not db_setting:
        raise HTTPException(status_code=404, detail="Настройка не найдена")
    db_setting.value = setting_data.value
    db.commit()
    db.refresh(db_setting)
    return db_setting


# --- НОВЫЙ ЭНДПОИНТ для обработки частичных возвратов ---
@router.post("/orders/{order_id}/return", response_model=schemas.Order)
def process_order_return(
    order_id: int,
    return_data: schemas.OrderReturnRequest,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin_user)
):
    """
    Обрабатывает частичный или полный возврат товаров по заказу.
    Товары возвращаются на склад. Статус заказа меняется.
    """
    db_order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not db_order:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    if db_order.status != "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Возврат можно оформить только для заказа со статусом 'completed'. Текущий статус: '{db_order.status}'"
        )
    total_items_in_order = len(db_order.items)
    returned_items_count = 0
    for item_to_return in return_data.items_to_return:
        order_item = db.query(models.OrderItem).filter(
            models.OrderItem.id == item_to_return.order_item_id,
            models.OrderItem.order_id == order_id
        ).first()
        if not order_item:
            db.rollback()
            raise HTTPException(status_code=404, detail=f"Позиция с ID {item_to_return.order_item_id} не найдена в этом заказе.")
        
        # Проверяем, что общее количество возвратов не превышает заказанное
        if (order_item.returned_quantity + item_to_return.quantity) > order_item.quantity:
            db.rollback()
            raise HTTPException(status_code=400, detail=f"Невозможно вернуть {item_to_return.quantity} ед. товара '{order_item.product.name}', так как общее количество возврата превысит заказанное.")

        product = db.query(models.Product).filter(models.Product.id == order_item.product_id).with_for_update().first()
        if product:
            product.stock += item_to_return.quantity
        
        # --- ДОБАВЛЕНО ИЗМЕНЕНИЕ ---
        # Записываем, сколько единиц этой позиции было возвращено в этой операции
        order_item.returned_quantity += item_to_return.quantity
        
        if order_item.returned_quantity == order_item.quantity:
            returned_items_count += 1
    
    # Считаем, сколько всего позиций в заказе было полностью возвращено
    total_fully_returned_items = sum(1 for item in db_order.items if item.quantity == item.returned_quantity)

    if total_fully_returned_items == total_items_in_order:
        db_order.status = "returned"
    else:
        db_order.status = "partially_returned"
    
    db_order.returned_at = func.now()
    db_order.total_returned_amount = return_data.final_return_amount    
    
    db_order.return_processed_without_discount = return_data.return_without_discount 
    
    db.commit()
    db.refresh(db_order)
    return db_order


# --- НОВЫЙ ЭНДПОИНТ ДЛЯ МАССОВОГО РЕДАКТИРОВАНИЯ ТОВАРОВ ---

@router.patch("/products/bulk-update", status_code=status.HTTP_200_OK)
def bulk_update_products(
    bulk_data: schemas.ProductBulkUpdate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin_user)
):
    """
    Массово обновляет данные товаров.
    Принимает список ID товаров и их новые данные.
    """
    updated_count = 0
    errors = []

    for item_update in bulk_data.updates:
        # Находим товар в базе по ID
        product = db.query(models.Product).filter(models.Product.id == item_update.id).first()
        
        if not product:
            errors.append(f"Товар с ID {item_update.id} не найден.")
            continue

        # Проверяем уникальность артикула, если он был изменен
        if item_update.sku is not None and item_update.sku != product.sku:
            existing_product = db.query(models.Product).filter(
                models.Product.sku == item_update.sku,
                models.Product.id != item_update.id # Исключаем текущий товар из проверки
            ).first()
            if existing_product:
                errors.append(f"Артикул '{item_update.sku}' уже используется для товара '{existing_product.name}'. Изменения для товара '{product.name}' не сохранены.")
                continue # Пропускаем обновление этого товара

        # Обновляем поля, только если они были переданы
        if item_update.sku is not None:
            product.sku = item_update.sku
        if item_update.name is not None:
            product.name = item_update.name
        if item_update.price is not None:
            product.price = item_update.price
        if item_update.stock is not None:
            product.stock = item_update.stock
        if item_update.is_visible is not None:
            product.is_visible = item_update.is_visible        
        
        updated_count += 1

    if errors:
        # Если были ошибки, откатываем все изменения, чтобы избежать частичного сохранения
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=". ".join(errors)
        )

    # Если ошибок не было, сохраняем все изменения
    db.commit()
    
    return {"message": f"Успешно обновлено {updated_count} товаров."}



# Для удаления заказов
class OrderDeleteRequest(BaseModel):
    reason: str

# --- НОВЫЙ ЭНДПОИНТ для "мягкого" удаления заказа ---
@router.delete("/orders/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_order(
    order_id: int,
    delete_data: OrderDeleteRequest,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin_user)
):
    """
    "Мягко" удаляет заказ, меняя его статус на 'deleted'.
    Доступно только для статусов 'new' и 'processed'.
    """
    db_order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not db_order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Заказ не найден")

    if db_order.status not in ["new", "processed"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Нельзя удалить заказ со статусом '{db_order.status}'"
        )

    db_order.status = "deleted"
    db_order.deleted_at = func.now() # Устанавливаем текущее время
    db_order.deletion_reason = delete_data.reason # Сохраняем причину
    db.commit()
    return
