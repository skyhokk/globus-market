from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os

# Эта строка читает переменную окружения, которую мы задали на Render
DATABASE_URL = os.getenv("DATABASE_URL")

# Для PostgreSQL убираем connect_args
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()