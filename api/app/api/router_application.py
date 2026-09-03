from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select, func
from typing import Optional
from app.db.session import get_session
from app.models.models import Application
from app.core.authorization import require_roles
from app.models.models import User
from app.schemas.schemas import PaginatedResponse, ApplicationCreate

router = APIRouter(prefix="/applications", tags=["Applications"])

@router.post("/", response_model=Application)
def create_application(app: ApplicationCreate, session: Session = Depends(get_session)):
    db_app = Application.model_validate(app)
    session.add(db_app)
    session.commit()
    session.refresh(db_app)
    return db_app

@router.get("/", response_model=PaginatedResponse[Application])
def list_applications(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_roles(["admin", "operator"]))
):
    offset = (page - 1) * size
    query = select(Application)
    if status:
        query = query.where(Application.status == status)
    total = session.exec(select(func.count()).select_from(query.subquery())).one()
    apps = session.exec(query.offset(offset).limit(size)).all()
    return PaginatedResponse(
        items=apps,
        total=total,
        page=page,
        size=size,
        pages=(total + size - 1) // size
    )

@router.get("/{app_id}", response_model=Application)
def get_application(app_id: int, session: Session = Depends(get_session)):
    app = session.get(Application, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    return app

@router.patch("/{app_id}", response_model=Application)
def update_application(app_id: int, app_update: ApplicationCreate, session: Session = Depends(get_session), current_user: User = Depends(require_roles(["admin", "operator"]))):
    app = session.get(Application, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    for key, value in app_update.model_dump(exclude_unset=True).items():
        setattr(app, key, value)
    session.add(app)
    session.commit()
    session.refresh(app)
    return app

@router.delete("/{app_id}")
def delete_application(app_id: int, session: Session = Depends(get_session), current_user: User = Depends(require_roles(["admin"]))):
    app = session.get(Application, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    session.delete(app)
    session.commit()
    return {"ok": True}