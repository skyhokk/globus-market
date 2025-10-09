# D:\globus-market\backend\app\schemas.py

from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

# --- Схемы для Пользователей ---
# ... (Этот блок без изменений)
class UserBase(BaseModel):
    first_name: str
    telegram_id: int

class UserCreate(UserBase):
    pass

class User(UserBase):
    id: int
    discount: float
    is_admin: bool
    class Config:
        orm_mode = True

# --- Схемы для Товаров (ОБНОВЛЕНО) ---
class ProductBase(BaseModel):
    name: str
    price: float
    sku: str
    stock: Optional[int] = None # <-- ИЗМЕНЕНИЕ

class ProductCreate(ProductBase):
    subcategory_id: int # <-- Добавлено поле для создания

class Product(ProductBase):
    id: int
    image_url: Optional[str] = None
    subcategory_id: int 
    updated_at: Optional[datetime] = None
    is_visible: bool    
    class Config:
        orm_mode = True

# --- НОВЫЕ СХЕМЫ для Категорий и Подкатегорий ---
class SubcategoryBase(BaseModel):
    name: str

class SubcategoryCreate(SubcategoryBase):
    category_id: int

class Subcategory(SubcategoryBase):
    id: int
    # Поле для вывода количества товаров, которое мы будем вычислять
    product_count: int = 0
    class Config:
        orm_mode = True

class CategoryBase(BaseModel):
    name: str

class CategoryCreate(CategoryBase):
    pass

class Category(CategoryBase):
    id: int
    subcategories: List[Subcategory] = []
    class Config:
        orm_mode = True

# --- Схемы для Заказов ---
class OrderItem(BaseModel):
    id: int
    quantity: int
    price_per_item: float
    product: Product
    comment: Optional[str] = None
    
    # --- ДОБАВЛЕНО НОВОЕ ПОЛЕ ---
    returned_quantity: int = 0
    # ---------------------------

    class Config:
        orm_mode = True

class OrderItemCreate(BaseModel):
    product_id: int
    quantity: int
    comment: Optional[str] = None

class OrderCreate(BaseModel):
    customer_name: str
    customer_phone: str
    items: List[OrderItemCreate]
    customer_comment: Optional[str] = None

class Order(BaseModel):
    id: int
    order_number: str
    status: str
    created_at: datetime

    # --- ДОБАВЛЯЕМ НОВЫЕ ПОЛЯ ---
    processed_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    returned_at: Optional[datetime] = None
    # ----------------------------    
    
    deleted_at: Optional[datetime] = None
    deletion_reason: Optional[str] = None
    
    return_processed_without_discount: bool = False
    
    total_returned_amount: Optional[float] = None    
    
    items: List[OrderItem]
    discount_percent: float
    # ... и другие поля заказа
    customer_name: str
    customer_phone: str
    customer_comment: Optional[str] = None    
    invoice_path_pdf: Optional[str] = None
    invoice_path_xlsx: Optional[str] = None
    private_key: str
    class Config:
        orm_mode = True
        

# --- НОВЫЕ СХЕМЫ для Ревизии ---
class StockUpdate(BaseModel):
    product_id: int
    new_stock: int

class InventoryUpdate(BaseModel):
    updates: List[StockUpdate]
    

# --- НОВЫЕ СХЕМЫ для ответа от эндпоинта Ревизии ---
class ReservedStock(BaseModel):
    new: int = 0
    processed: int = 0


class RevisionProduct(BaseModel):
    product_id: int
    sku: str
    name: str
    price: float
    db_stock: int
    reserved: ReservedStock

    class Config:
        orm_mode = True
        
# --- НОВЫЕ СХЕМЫ для Настроек ---
class AppSetting(BaseModel):
    key: str
    value: str
    class Config:
        orm_mode = True

class AppSettingUpdate(BaseModel):
    value: str
    
    
# --- НОВЫЕ СХЕМЫ для частичного возврата ---
class ReturnItem(BaseModel):
    order_item_id: int # Используем ID позиции в заказе, а не ID товара
    quantity: int

class OrderReturnRequest(BaseModel):
    items_to_return: List[ReturnItem]
    final_return_amount: float
    return_without_discount: bool
    

# --- НОВЫЕ СХЕМЫ ДЛЯ РЕДАКТОРА ТОВАРОВ ---

class ProductUpdate(BaseModel):
    id: int  # ID товара, который мы меняем
    # Все поля ниже необязательные, так как пользователь может менять что-то одно
    sku: Optional[str] = None
    name: Optional[str] = None
    price: Optional[float] = None
    stock: Optional[int] = None
    is_visible: Optional[bool] = None 

class ProductBulkUpdate(BaseModel):
    updates: List[ProductUpdate]