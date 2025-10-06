from fastapi import APIRouter
from app.database import SessionLocal

router = APIRouter()

cart = []  # пока просто список в памяти

@router.post("/add")
def add_to_cart(product_id: int, quantity: int):
    cart.append({"product_id": product_id, "quantity": quantity})
    return {"message": "Товар добавлен в корзину", "cart": cart}

@router.get("/")
def get_cart():
    return cart
