# D:\globus-market\backend\app\routers\auth.py

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel
import hmac
import hashlib
import json
import time
from typing import Optional
import base64

# --- ИЗМЕНЕНИЕ: Используем новую библиотеку PyJWT ---
import jwt
import os

from app import models, schemas
from app.dependencies import get_db
from app.security import verify_password

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
router = APIRouter()

SECRET_KEY = "your-super-secret-key"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440 

oauth2_scheme = HTTPBearer(auto_error=False)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = int(time.time()) + ACCESS_TOKEN_EXPIRE_MINUTES * 60
    to_encode.update({"exp": expire})
    # --- ИЗМЕНЕНИЕ: Используем функцию encode из PyJWT ---
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

@router.post("/login")
def login_for_access_token(db: Session = Depends(get_db), form_data: OAuth2PasswordRequestForm = Depends()):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(data={"sub": str(user.id)})
    return {"access_token": access_token, "token_type": "bearer"}

# --- ФИНАЛЬНАЯ ИСПРАВЛЕННАЯ ВЕРСИЯ ---
async def get_current_user(token: Optional[HTTPAuthorizationCredentials] = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    if token is None:
        return None

    # "Очищаем" токен от возможного префикса "Bearer "
    token_data = token.credentials
    if token_data.lower().startswith("bearer "):
        token_data = token_data[7:]

    try:
        # Используем "очищенный" токен для расшифровки
        payload = jwt.decode(token_data, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            return None
    except jwt.PyJWTError:
        return None

    user = db.query(models.User).filter(models.User.id == int(user_id)).first()
    return user



# --- Код для Telegram остаётся для совместимости, но мы его сейчас не используем ---
# ... (весь оставшийся код для Telegram остаётся без изменений) ...
def verify_telegram_data(data_from_telegram: dict):
    received_hash = data_from_telegram.get('hash')
    data_keys = sorted([key for key in data_from_telegram if key != 'hash'])
    data_check_string = "\n".join(f"{key}={data_from_telegram[key]}" for key in data_keys)
    secret_key = hashlib.sha256(TELEGRAM_BOT_TOKEN.encode()).digest()
    calculated_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
    if calculated_hash == received_hash:
        if (time.time() - int(data_from_telegram.get('auth_date', 0))) < 86400:
            return True
    return False

class TelegramLoginData(BaseModel):
    id: int; first_name: str; auth_date: int; hash: str; last_name: Optional[str] = None; username: Optional[str] = None; photo_url: Optional[str] = None

@router.post("/telegram", response_model=dict)
def login_via_telegram(login_data: TelegramLoginData, db: Session = Depends(get_db)):
    if not verify_telegram_data(login_data.dict(exclude_unset=True)):
        raise HTTPException(status_code=401, detail="Invalid data from Telegram")
    user = db.query(models.User).filter(models.User.telegram_id == login_data.id).first()
    if not user:
        user = models.User(telegram_id=login_data.id, first_name=login_data.first_name); db.add(user); db.commit(); db.refresh(user)
    else:
        db.refresh(user)
    access_token = create_access_token(data={"sub": str(user.id)})
    return {"access_token": access_token, "token_type": "bearer", "user": schemas.User.from_orm(user)}