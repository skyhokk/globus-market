# D:\globus-market\backend\app\models.py

from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, func, Boolean
from sqlalchemy.orm import relationship
from .database import Base

# --- НОВЫЙ КЛАСС: Категория ---
class Category(Base):
    __tablename__ = "categories"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    
    subcategories = relationship("Subcategory", back_populates="category", cascade="all, delete-orphan")

# --- НОВЫЙ КЛАСС: Подкатегория ---
class Subcategory(Base):
    __tablename__ = "subcategories"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    category_id = Column(Integer, ForeignKey("categories.id"))
    
    category = relationship("Category", back_populates="subcategories")
    products = relationship("Product", back_populates="subcategory")

class User(Base):
    # ... (Этот класс без изменений)
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_admin = Column(Boolean, default=False)

class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True, index=True)
    sku = Column(String, unique=True, index=True)
    name = Column(String, index=True)
    price = Column(Float)
    image_url = Column(String, nullable=True)
    stock = Column(Integer, default=0)
    
    # --- ИЗМЕНЕНИЕ: Добавляем связь с подкатегорией ---
    subcategory_id = Column(Integer, ForeignKey("subcategories.id"))
    subcategory = relationship("Subcategory", back_populates="products")
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class Order(Base):
    # ... (Этот класс без изменений)
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True, index=True)
    order_number = Column(String, unique=True, index=True)
    private_key = Column(String, unique=True, index=True)
    status = Column(String, default="new")
    customer_name = Column(String)
    customer_phone = Column(String)
    customer_comment = Column(String, nullable=True) 
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # --- НОВЫЕ ПОЛЯ ДЛЯ ХРАНЕНИЯ ДАТ ---
    processed_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    returned_at = Column(DateTime(timezone=True), nullable=True)
    
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    deletion_reason = Column(String, nullable=True)
    
    # ------------------------------------    
    return_processed_without_discount = Column(Boolean, default=False)
    
    total_returned_amount = Column(Float, nullable=True)    
    
    discount_percent = Column(Float, default=0.0)
    invoice_path_pdf = Column(String, nullable=True)
    invoice_path_xlsx = Column(String, nullable=True)
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")

class OrderItem(Base):
    __tablename__ = "order_items"
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"))
    product_id = Column(Integer, ForeignKey("products.id"))
    quantity = Column(Integer)
    price_per_item = Column(Float)
    comment = Column(String, nullable=True)
    
    # --- ДОБАВЛЕНО НОВОЕ ПОЛЕ ---
    returned_quantity = Column(Integer, default=0)
    # ---------------------------

    order = relationship("Order", back_populates="items")
    product = relationship("Product")
    
# --- НОВАЯ ТАБЛИЦА для хранения настроек ---
class AppSettings(Base):
    __tablename__ = "app_settings"
    id = Column(Integer, primary_key=True)
    key = Column(String, unique=True, index=True, nullable=False)
    value = Column(String, nullable=False)