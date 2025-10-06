# D:\globus-market\backend\app\routers\categories.py

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List

from app import models, schemas
from app.dependencies import get_db
# Импортируем "охранника" для админов
from app.routers.admin import get_current_admin_user

router = APIRouter()

@router.get("/", response_model=List[schemas.Category])
def get_categories(db: Session = Depends(get_db)):
    """
    Возвращает полное дерево категорий с подкатегориями
    и посчитанным количеством товаров в каждой.
    """
    categories = db.query(models.Category).all()
    
    for cat in categories:
        for subcat in cat.subcategories:
            count = db.query(func.count(models.Product.id)).filter(models.Product.subcategory_id == subcat.id).scalar()
            subcat.product_count = count
            
    return categories

# --- НОВЫЙ ЭНДПОИНТ для создания категории ---
@router.post("/", response_model=schemas.Category, status_code=status.HTTP_201_CREATED)
def create_category(
    category: schemas.CategoryCreate, 
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin_user)
):
    """Создает новую категорию. Доступно только администраторам."""
    db_category = db.query(models.Category).filter(func.lower(models.Category.name) == func.lower(category.name)).first()
    if db_category:
        raise HTTPException(status_code=400, detail="Категория с таким названием уже существует")
    
    new_category = models.Category(name=category.name)
    db.add(new_category)
    db.commit()
    db.refresh(new_category)
    return new_category

# --- НОВЫЙ ЭНДПОИНТ для создания подкатегории ---
@router.post("/subcategories/", response_model=schemas.Subcategory, status_code=status.HTTP_201_CREATED)
def create_subcategory(
    subcategory: schemas.SubcategoryCreate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin_user)
):
    """Создает новую подкатегорию в рамках существующей категории. Доступно только администраторам."""
    # Проверяем, существует ли родительская категория
    parent_category = db.query(models.Category).filter(models.Category.id == subcategory.category_id).first()
    if not parent_category:
        raise HTTPException(status_code=404, detail=f"Категория с ID {subcategory.category_id} не найдена")

    # Проверяем, нет ли уже такой подкатегории в этой категории
    db_subcategory = db.query(models.Subcategory).filter(
        models.Subcategory.category_id == subcategory.category_id,
        func.lower(models.Subcategory.name) == func.lower(subcategory.name)
    ).first()
    if db_subcategory:
        raise HTTPException(status_code=400, detail="Подкатегория с таким названием уже существует в этой категории")

    new_subcategory = models.Subcategory(name=subcategory.name, category_id=subcategory.category_id)
    db.add(new_subcategory)
    db.commit()
    db.refresh(new_subcategory)
    # Дополняем поле product_count для консистентности ответа
    new_subcategory.product_count = 0
    return new_subcategory