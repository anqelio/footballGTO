from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select, func
from typing import Optional
from app.db.session import get_session
from app.models.models import Feedback, User
from app.core.authorization import require_roles
from app.schemas.schemas import FeedbackCreate, PaginatedResponse

router = APIRouter(prefix="/feedback", tags=["Feedback"])

@router.post("/", response_model=Feedback)
def create_feedback(
    fb: FeedbackCreate,
    session: Session = Depends(get_session)
):
    """
    Публичное создание сообщения обратной связи.
    Доступно без авторизации.
    """
    db_fb = Feedback.model_validate(fb)
    session.add(db_fb)
    session.commit()
    session.refresh(db_fb)
    # TODO: при необходимости отправить email администратору
    return db_fb

@router.get("/", response_model=PaginatedResponse[Feedback])
def list_feedback(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_roles(["admin"]))
):
    """
    Получение списка сообщений (только для администраторов).
    """
    offset = (page - 1) * size
    query = select(Feedback)
    if status:
        query = query.where(Feedback.status == status)
    total = session.exec(select(func.count()).select_from(query.subquery())).one()
    items = session.exec(query.offset(offset).limit(size)).all()
    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        size=size,
        pages=(total + size - 1) // size
    )

@router.get("/{feedback_id}", response_model=Feedback)
def get_feedback(
    feedback_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_roles(["admin"]))
):
    fb = session.get(Feedback, feedback_id)
    if not fb:
        raise HTTPException(status_code=404, detail="Feedback not found")
    return fb

@router.patch("/{feedback_id}", response_model=Feedback)
def update_feedback_status(
    feedback_id: int,
    status: str = Query(..., pattern="^(new|read|replied)$"),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_roles(["admin"]))
):
    fb = session.get(Feedback, feedback_id)
    if not fb:
        raise HTTPException(status_code=404, detail="Feedback not found")
    fb.status = status
    session.add(fb)
    session.commit()
    session.refresh(fb)
    return fb

@router.delete("/{feedback_id}")
def delete_feedback(
    feedback_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_roles(["admin"]))
):
    fb = session.get(Feedback, feedback_id)
    if not fb:
        raise HTTPException(status_code=404, detail="Feedback not found")
    session.delete(fb)
    session.commit()
    return {"ok": True}