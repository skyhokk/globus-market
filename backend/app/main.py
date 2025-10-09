# D:\globus-market\backend\app\main.py

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware # <-- НОВЫЙ ИМПОРТ
from sqlalchemy.orm import Session
from fastapi import Depends
from app.dependencies import get_db 

from app.database import engine
from app import models
from app.routers import products, orders, auth, admin, categories

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Globus Market API")

# --- НОВЫЙ БЛОК: Настройка CORS ---
# Этот блок должен идти до подключения роутеров
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Разрешаем доступ с любых источников (для разработки)
    allow_credentials=True,
    allow_methods=["*"], # Разрешаем все методы (GET, POST и т.д.)
    allow_headers=["*"], # Разрешаем все заголовки
)

app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/invoices", StaticFiles(directory="invoices"), name="invoices")

@app.get("/test-login", response_class=HTMLResponse)
async def get_test_login_page():
    try:
        with open("static/index.html", "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    except FileNotFoundError:
        return HTMLResponse(content="<h1>Ошибка: файл static/index.html не найден!</h1>", status_code=404)


# --- НОВЫЙ ЭНДПОИНТ ДЛЯ ПУБЛИЧНЫХ НАСТРОЕК ---
@app.get("/settings/public", tags=["Public"])
def get_public_settings(db: Session = Depends(get_db)):
    """
    Возвращает список публичных настроек (контакты).
    """

    public_keys = [
        "contact_whatsapp", 
        "contact_instagram_1", 
        "contact_instagram_2", 
        "contact_instagram_3", 
        "contact_telegram", 
        "contact_whatsapp_display" 
    ]
    settings = db.query(models.AppSettings).filter(models.AppSettings.key.in_(public_keys)).all()
    # Преобразуем список объектов в словарь вида {"key": "value"}
    return {s.key: s.value for s in settings}



# Подключаем роутеры
app.include_router(categories.router, prefix="/categories", tags=["Categories"])
app.include_router(products.router, prefix="/products", tags=["Products"])
app.include_router(orders.router, prefix="/orders", tags=["Orders"])
app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
app.include_router(admin.router, prefix="/admin", tags=["Admin"])

@app.get("/")
def root():
    return {"message": "Добро пожаловать в Globus Market API!"}