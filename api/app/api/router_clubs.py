from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select, func
from typing import List, Optional
from app.db.session import get_session
from app.models.models import Club
from app.core.authorization import require_roles
from app.models.models import User
from app.schemas.schemas import ClubCreate, PaginatedResponse

router = APIRouter(prefix="/clubs", tags=["Clubs"])

@router.post("/", response_model=Club)
def create_club(club: ClubCreate, session: Session = Depends(get_session), current_user: User = Depends(require_roles(["admin"]))):
    db_club = Club.model_validate(club)
    session.add(db_club)
    session.commit()
    session.refresh(db_club)
    return db_club

@router.get("/", response_model=PaginatedResponse[Club])
def list_clubs(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_session)
):
    offset = (page - 1) * size
    query = select(Club)
    total = session.exec(select(func.count()).select_from(Club)).one()
    clubs = session.exec(query.offset(offset).limit(size)).all()
    return PaginatedResponse(
        items=clubs,
        total=total,
        page=page,
        size=size,
        pages=(total + size - 1) // size
    )

@router.get("/{club_id}", response_model=Club)
def get_club(club_id: int, session: Session = Depends(get_session)):
    club = session.get(Club, club_id)
    if not club:
        raise HTTPException(status_code=404, detail="Club not found")
    return club

@router.patch("/{club_id}", response_model=Club)
def update_club(club_id: int, club_update: ClubCreate, session: Session = Depends(get_session), current_user: User = Depends(require_roles(["admin"]))):
    club = session.get(Club, club_id)
    if not club:
        raise HTTPException(status_code=404, detail="Club not found")
    for key, value in club_update.model_dump(exclude_unset=True).items():
        setattr(club, key, value)
    session.add(club)
    session.commit()
    session.refresh(club)
    return club

@router.delete("/{club_id}")
def delete_club(club_id: int, session: Session = Depends(get_session), current_user: User = Depends(require_roles(["admin"]))):
    club = session.get(Club, club_id)
    if not club:
        raise HTTPException(status_code=404, detail="Club not found")
    session.delete(club)
    session.commit()
    return {"ok": True}