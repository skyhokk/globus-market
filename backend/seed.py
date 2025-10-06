# D:\globus-market\backend\seed.py - ОБНОВЛЕННАЯ ВЕРСИЯ

from app.database import SessionLocal, engine
from app import models
from app.security import get_password_hash

def seed_data():
        # +++ НАЧАЛО ДИАГНОСТИКИ +++
    print("-" * 50)
    print(f"--- ПОДКЛЮЧАЮСЬ К БАЗЕ ДАННЫХ: {engine.url} ---")
    print("-" * 50)
    # +++ КОНЕЦ ДИАГНОСТИКИ +++
    print("Создаем все таблицы в базе данных...")
    models.Base.metadata.create_all(bind=engine)
    print("Таблицы успешно созданы.")

    print("Начинаем заполнение базы данных...")
    db = SessionLocal()
    try:
        # --- ОЧИСТКА СТАРЫХ ДАННЫХ ---
        # При первом запуске эти команды ничего не сделают, это нормально
        db.query(models.OrderItem).delete()
        db.query(models.Order).delete()
        db.query(models.Product).delete()
        db.query(models.Subcategory).delete()
        db.query(models.Category).delete()
        db.query(models.User).delete()
        db.query(models.AppSettings).delete() 
        db.commit() # <-- Сохраняем очистку

        # --- СОЗДАНИЕ НАСТРОЕК ПО УМОЛЧАНИЮ ---
        settings_to_create = [
            models.AppSettings(key="show_stock_publicly", value="true"),
            models.AppSettings(key="ignore_stock_limits", value="false"),
            models.AppSettings(key="contact_whatsapp", value=""),
            models.AppSettings(key="contact_whatsapp_display", value=""),
            models.AppSettings(key="contact_instagram", value=""),
            models.AppSettings(key="contact_telegram", value="")
        ]
        db.add_all(settings_to_create)
        db.commit() # <-- Сохраняем настройки
        print("Созданы настройки по умолчанию.")

        # --- СОЗДАНИЕ АДМИНА ---
        ADMIN_USER_DATA = { "username": "admin", "password": "admin" }
        hashed_password = get_password_hash(ADMIN_USER_DATA["password"])
        admin_user = models.User(username=ADMIN_USER_DATA["username"], hashed_password=hashed_password, is_admin=True)
        db.add(admin_user)
        db.commit() # <-- Сохраняем админа
        print("Администратор 'admin' создан.")

        # --- СОЗДАНИЕ КАТЕГОРИЙ ---
        cat_home = models.Category(name="Все для дома")
        cat_tech = models.Category(name="Бытовая техника")
        cat_coffee = models.Category(name="Кофе")
        db.add_all([cat_home, cat_tech, cat_coffee])
        db.commit() # <-- Сохраняем категории

        # --- СОЗДАНИЕ ПОДКАТЕГОРИЙ ---
        sub_chems = models.Subcategory(name="Бытовая химия", category_id=cat_home.id)
        sub_textile = models.Subcategory(name="Домашний текстиль", category_id=cat_home.id)
        sub_audio = models.Subcategory(name="Аудиотехника", category_id=cat_tech.id)
        sub_stands = models.Subcategory(name="Тумбы и кронштейны", category_id=cat_tech.id)
        sub_coffee_bean = models.Subcategory(name="Кофе зерновой", category_id=cat_coffee.id)
        db.add_all([sub_chems, sub_textile, sub_audio, sub_stands, sub_coffee_bean])
        db.commit() # <-- Сохраняем подкатегории
        print("Категории и подкатегории созданы.")

        # --- СОЗДАНИЕ ТОВАРОВ ---
        PRODUCTS_TO_CREATE = [
            { "sku": "01-0001", "name": "Чистящее средство для унитаза - 1.5 литра", "price": 890.00, "stock": 100, "subcategory_id": sub_chems.id },
            { "sku": "01-0002", "name": "Средство для мытья посуды - 5 литров", "price": 2780.00, "stock": 50, "subcategory_id": sub_chems.id },
            { "sku": "01-0003", "name": "Влажные салфетки ECO - 150 штук", "price": 510.00, "stock": 200, "subcategory_id": sub_chems.id },
            { "sku": "01-0004", "name": "Наушники накладные Logitech g755", "price": 7880.00, "image_url": "/static/images/01-0004.webp", "stock": 25, "subcategory_id": sub_audio.id },
            { "sku": "01-0005", "name": "Полотенце банное 70x140", "price": 1520.00, "stock": 80, "subcategory_id": sub_textile.id },
            { "sku": "02-0001", "name": 'Кофе в зёрнах "Лювак" - 500 гр.', "price": 15900.00, "image_url": "/static/images/02-00001.webp", "stock": 5, "subcategory_id": sub_coffee_bean.id },
            { "sku": "03-0007", "name": "Набор полотенец - 6 шт (30*50 см)", "price": 4570.00, "image_url": "/static/images/03-00007.webp", "stock": 56, "subcategory_id": sub_textile.id },
            { "sku": "07-0009", "name": 'Тумба "Командор" с кронштейном для ТВ (от 32" до 78")', "price": 98000.00, "image_url": "/static/images/07-0009.webp", "stock": 15, "subcategory_id": sub_stands.id },
        ]

        for product_data in PRODUCTS_TO_CREATE:
            new_product = models.Product(**product_data)
            db.add(new_product)

        db.commit() # <-- Сохраняем все добавленные товары
        print("Все товары (старые и новые) созданы и распределены по категориям.")

        print("База данных успешно заполнена!")

    except Exception as e:
        print(f"Произошла ошибка: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()