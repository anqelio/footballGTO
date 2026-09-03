from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select, func
from typing import List
from app.db.session import get_session
from app.models.models import Test
from app.models.models import User
from app.core.authorization import require_roles
from app.schemas.schemas import PaginatedResponse, TestCreate

router = APIRouter(prefix="/tests", tags=["Tests"])

@router.post("/", response_model=Test)
def create_test(test: TestCreate, session: Session = Depends(get_session), current_user: User = Depends(require_roles(["admin"]))):
    db_test = Test.model_validate(test)
    session.add(db_test)
    session.commit()
    session.refresh(db_test)
    return db_test

@router.get("/", response_model=PaginatedResponse[Test])
def list_tests(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_session)
):
    offset = (page - 1) * size
    total = session.exec(select(func.count()).select_from(Test)).one()
    tests = session.exec(select(Test).offset(offset).limit(size)).all()
    return PaginatedResponse(
        items=tests,
        total=total,
        page=page,
        size=size,
        pages=(total + size - 1) // size
    )

@router.get("/{test_id}", response_model=Test)
def get_test(test_id: int, session: Session = Depends(get_session)):
    test = session.get(Test, test_id)
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    return test

@router.patch("/{test_id}", response_model=Test)
def update_test(test_id: int, test_update: TestCreate, session: Session = Depends(get_session), current_user: User = Depends(require_roles(["admin"]))):
    test = session.get(Test, test_id)
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    for key, value in test_update.model_dump(exclude_unset=True).items():
        setattr(test, key, value)
    session.add(test)
    session.commit()
    session.refresh(test)
    return test

@router.delete("/{test_id}")
def delete_test(test_id: int, session: Session = Depends(get_session), current_user: User = Depends(require_roles(["admin"]))):
    test = session.get(Test, test_id)
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    session.delete(test)
    session.commit()
    return {"ok": True}