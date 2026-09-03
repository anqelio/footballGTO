from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select, func
from typing import Optional, List
from datetime import date
from app.db.session import get_session
from app.models.models import Result, Player, Test
from app.models.models import User
from app.core.authorization import require_roles
from app.schemas.schemas import PaginatedResponse, ResultCreate

router = APIRouter(prefix="/results", tags=["Results"])

@router.post("/", response_model=Result)
def create_result(result: ResultCreate, session: Session = Depends(get_session), current_user: User = Depends(require_roles(["admin", "operator"]))):
    player = session.get(Player, result.player_id)
    if not player:
        raise HTTPException(status_code=400, detail="Player not found")
    test = session.get(Test, result.test_id)
    if not test:
        raise HTTPException(status_code=400, detail="Test not found")
    db_result = Result.model_validate(result)
    session.add(db_result)
    session.commit()
    session.refresh(db_result)
    return db_result

@router.get("/", response_model=PaginatedResponse[Result])
def list_results(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    player_id: Optional[int] = None,
    test_id: Optional[int] = None,
    session: Session = Depends(get_session)
):
    offset = (page - 1) * size
    query = select(Result)
    if player_id:
        query = query.where(Result.player_id == player_id)
    if test_id:
        query = query.where(Result.test_id == test_id)
    total = session.exec(select(func.count()).select_from(query.subquery())).one()
    results = session.exec(query.offset(offset).limit(size)).all()
    return PaginatedResponse(
        items=results,
        total=total,
        page=page,
        size=size,
        pages=(total + size - 1) // size
    )

@router.get("/{result_id}", response_model=Result)
def get_result(result_id: int, session: Session = Depends(get_session)):
    result = session.get(Result, result_id)
    if not result:
        raise HTTPException(status_code=404, detail="Result not found")
    return result

@router.patch("/{result_id}", response_model=Result)
def update_result(result_id: int, result_update: ResultCreate, session: Session = Depends(get_session), current_user: User = Depends(require_roles(["admin", "operator"]))):
    result = session.get(Result, result_id)
    if not result:
        raise HTTPException(status_code=404, detail="Result not found")
    update_data = result_update.model_dump(exclude_unset=True)
    if "player_id" in update_data:
        player = session.get(Player, update_data["player_id"])
        if not player:
            raise HTTPException(status_code=400, detail="Invalid player_id")
    if "test_id" in update_data:
        test = session.get(Test, update_data["test_id"])
        if not test:
            raise HTTPException(status_code=400, detail="Invalid test_id")
    for key, value in update_data.items():
        setattr(result, key, value)
    session.add(result)
    session.commit()
    session.refresh(result)
    return result

@router.delete("/{result_id}")
def delete_result(result_id: int, session: Session = Depends(get_session), current_user: User = Depends(require_roles(["admin", "operator"]))):
    result = session.get(Result, result_id)
    if not result:
        raise HTTPException(status_code=404, detail="Result not found")
    session.delete(result)
    session.commit()
    return {"ok": True}