import os
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status, APIRouter
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select
from app.db.session import get_session
from app.models.models import User
from app.schemas.schemas import UserLogin, Token
from app.core.hashing_password import verify_password
from app.core.create_token import create_access_token

router = APIRouter()

load_dotenv()
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM")

@router.post("/login", response_model=Token)
def login(login_data: UserLogin, session: Session = Depends(get_session)):
    try:
        sql = select(User).where(User.username == login_data.username)
        user = session.exec(sql).first()

        if not user or not verify_password(login_data.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Некорректный логин или пароль"
            )

        access_token = create_access_token(data={"sub": user.username})
        return Token(access_token=access_token, token_type="bearer")
    except IntegrityError:
        session.rollback()
        raise HTTPException(status_code=400, detail="Ошибка: нарушение целостности данных")
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Внутренняя ошибка сервера: {str(e)}")