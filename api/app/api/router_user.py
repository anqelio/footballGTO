from fastapi import Depends, APIRouter, HTTPException, status
from app.db.session import get_session
from app.models.models import User
from app.schemas.schemas import UserCreate, UserUpdate
from fastapi_pagination import Page
from fastapi_pagination.ext.sqlmodel import paginate
from app.core.authorization import require_roles
from sqlmodel import Session, select
from sqlalchemy.exc import IntegrityError
from app.core.hashing_password import get_password_hash

router = APIRouter()

@router.get('/user/{user_id}')
def get_user_by_id(
    user_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_roles(["admin"]))
):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.post('/user', status_code=status.HTTP_201_CREATED)
def add_user(
    data: UserCreate,
    session: Session = Depends(get_session)
):
    try:
        obj = User(
            username=data.username,
            password_hash=get_password_hash(data.password),
            role=data.role
        )
        session.add(obj)
        session.commit()
        session.refresh(obj)
        return obj
    except IntegrityError:
        session.rollback()
        raise HTTPException(status_code=400, detail="Ошибка: нарушение целостности данных")
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Внутренняя ошибка сервера: {str(e)}")

@router.delete('/user/{user_id}', status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_roles(["admin"]))
):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    session.delete(user)
    session.commit()
    return

@router.put('/user/{user_id}', status_code=status.HTTP_200_OK)
def update_user(
    user_id: int,
    data: UserUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_roles(["admin"]))
):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if data.username:
        user.username = data.username
    if data.role:
        user.role = data.role
    if data.password:
        user.password_hash = get_password_hash(data.password)
    session.add(user)
    session.commit()
    session.refresh(user)
    return user

@router.get('/user', response_model=Page[User])
def list_users(
    session: Session = Depends(get_session),
    current_user: User = Depends(require_roles(["admin"]))
):
    return paginate(session, select(User))