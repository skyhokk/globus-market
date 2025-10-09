# D:\globus-market\backend\app\routers\products.py

from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from sqlalchemy.orm import Session
from typing import List, Optional # <-- Добавили Optional
from sqlalchemy import func, or_
from pathlib import Path
from PIL import Image

from app import models, schemas
from app.dependencies import get_db

router = APIRouter()

BASE_DIR = Path(__file__).resolve().parent.parent.parent
IMAGE_DIR = BASE_DIR / "static" / "images"

# --- Эндпоинт для получения товаров (ОБНОВЛЁН) ---
@router.get("/", response_model=List[schemas.Product])
def get_products(
    db: Session = Depends(get_db), 
    search: Optional[str] = None, 
    subcategory_id: Optional[int] = None,
    category_id: Optional[int] = None
):
    """
    Получает список товаров.
    Поддерживает поиск по названию/артикулу (с учетом регистра) и фильтрацию.
    """
    show_stock_setting = db.query(models.AppSettings).filter(models.AppSettings.key == "show_stock_publicly").first()
    show_stock = show_stock_setting.value == "true" if show_stock_setting else True

    query = db.query(models.Product)
    
    # Показываем только видимые товары
    query = query.filter(models.Product.is_visible == True)
    
    # --- НАЧАЛО УПРОЩЕННОЙ ЛОГИКИ ПОИСКА ---
    if search:
        # Убираем все преобразования в нижний регистр.
        # Поиск будет прямым и чувствительным к регистру.
        search_pattern = f"%{search}%"
        query = query.filter(
            or_(
                models.Product.name.like(search_pattern),
                models.Product.sku.like(search_pattern)
            )
        )
    # --- КОНЕЦ УПРОЩЕННОЙ ЛОГИКИ ПОИСКА ---
        
    if subcategory_id:
        query = query.filter(models.Product.subcategory_id == subcategory_id)

    if category_id:
        subcategory_ids = db.query(models.Subcategory.id).filter(models.Subcategory.category_id == category_id).all()
        subcategory_ids = [id[0] for id in subcategory_ids]
        if subcategory_ids:
            query = query.filter(models.Product.subcategory_id.in_(subcategory_ids))
        
    products = query.all()

    if not show_stock:
        for product in products:
            product.stock = None
            
    return products

# --- Остальные эндпоинты без изменений ---

@router.post("/", response_model=schemas.Product)
def create_product(product: schemas.ProductCreate, db: Session = Depends(get_db)):
    db_product = db.query(models.Product).filter(models.Product.sku == product.sku).first()
    if db_product:
        raise HTTPException(status_code=400, detail="Продукт с таким Артикулом уже существует - введите другое значение в поле Артикул")
    
    new_product = models.Product(**product.dict())
    db.add(new_product)
    db.commit()
    db.refresh(new_product)
    return new_product

@router.post("/{id}/image", response_model=schemas.Product)
async def upload_product_image(id: int, db: Session = Depends(get_db), file: UploadFile = File(...)):
    product = db.query(models.Product).filter(models.Product.id == id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    filename = f"{product.sku}.webp"
    file_path = IMAGE_DIR / filename
    
    try:
        image = Image.open(file.file)
        image.thumbnail((800, 800))
        image.save(file_path, 'webp')
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process and save image: {e}")

    url_path = f"/static/images/{filename}"
    product.image_url = url_path
    
    # --- КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: Явно обновляем время изменения товара ---
    product.updated_at = func.now()
    
    db.commit()
    db.refresh(product)
    
    return product