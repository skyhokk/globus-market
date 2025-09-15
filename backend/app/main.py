from fastapi import FastAPI

app = FastAPI(title="Globus Market API")

# Тестовый список товаров
products = [
    {"id": 1, "name": "Товар 1", "price": 1000},
    {"id": 2, "name": "Товар 2", "price": 2000},
]

@app.get("/products")
def get_products():
    return products
