from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select, func
from typing import Optional
from datetime import date
from app.db.session import get_session
from app.models.models import Event
from app.models.models import User
from app.core.authorization import require_roles
from app.schemas.schemas import PaginatedResponse, EventCreate

router = APIRouter(prefix="/events", tags=["Events"])

@router.post("/", response_model=Event)
def create_event(event: EventCreate, session: Session = Depends(get_session), current_user: User = Depends(require_roles(["admin"]))):
    db_event = Event.model_validate(event)
    session.add(db_event)
    session.commit()
    session.refresh(db_event)
    return db_event

@router.get("/", response_model=PaginatedResponse[Event])
def list_events(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    session: Session = Depends(get_session)
):
    offset = (page - 1) * size
    query = select(Event)
    if from_date:
        query = query.where(Event.event_date >= from_date)
    if to_date:
        query = query.where(Event.event_date <= to_date)
    total = session.exec(select(func.count()).select_from(query.subquery())).one()
    events = session.exec(query.offset(offset).limit(size)).all()
    return PaginatedResponse(
        items=events,
        total=total,
        page=page,
        size=size,
        pages=(total + size - 1) // size
    )

@router.get("/{event_id}", response_model=Event)
def get_event(event_id: int, session: Session = Depends(get_session)):
    event = session.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event

@router.patch("/{event_id}", response_model=Event)
def update_event(event_id: int, event_update: EventCreate, session: Session = Depends(get_session), current_user: User = Depends(require_roles(["admin"]))):
    event = session.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    for key, value in event_update.model_dump(exclude_unset=True).items():
        setattr(event, key, value)
    session.add(event)
    session.commit()
    session.refresh(event)
    return event

@router.delete("/{event_id}")
def delete_event(event_id: int, session: Session = Depends(get_session), current_user: User = Depends(require_roles(["admin"]))):
    event = session.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    session.delete(event)
    session.commit()
    return {"ok": True}