# D:\globus-market\backend\app\security.py

from passlib.context import CryptContext

# Создаём объект для хэширования. Он будет использовать алгоритм bcrypt.
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Проверяет, соответствует ли обычный пароль хэшированному."""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Создаёт хэш из обычного пароля."""
    return pwd_context.hash(password)