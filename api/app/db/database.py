from sqlmodel import SQLModel
from sqlalchemy import create_engine, URL
from dotenv import load_dotenv
import os

load_dotenv()
secret_key = os.getenv('SECRET_KEY')

DATABASE_URL = URL.create(
    drivername="postgresql+psycopg2",
    username=os.getenv("POSTGRES_USER"),
    password=os.getenv("POSTGRES_PASSWORD"),
    host=os.getenv("POSTGRES_HOST", "db"),
    port=int(os.getenv("POSTGRES_PORT", "5432")),
    database=os.getenv("POSTGRES_DB"),
)

engine = create_engine(DATABASE_URL, echo=True)

def init_db():
    '''
    Инициализация БД при запуске приложения
    '''
    SQLModel.metadata.create_all(engine)

def get_engine():
    '''
    Получение engine для миграций
    :return: engine
    '''
    return engine

def close_db():
    '''
    Освобождение ресурсов
    '''
    engine.dispose()