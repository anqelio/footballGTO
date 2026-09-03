from fastapi import APIRouter, Depends, Query, HTTPException
from sqlmodel import Session, select, func
from datetime import date
from typing import List, Optional
from app.db.session import get_session
from app.models.models import Player, Result
from app.services.rating import calculate_age, compute_player_ratings
from app.schemas.schemas import TopPlayer, TopProgressPlayer

router = APIRouter(prefix="/rankings", tags=["Rankings"])

@router.get("/top/by-category", response_model=List[TopPlayer])
def top_by_category(
    category: str = Query(..., description="Категория: Антропометрия, Атлетизм, Быстрота, Координация, Дриблинг, Техника, Удары"),
    age_group: str = Query("U9", description="U6, U7, ..., U14"),
    gender: str = Query("male", pattern="^(male|female)$"),
    limit: int = Query(10, ge=1, le=50),
    session: Session = Depends(get_session)
):
    age_map = {f"U{i}": (i, i) for i in range(6, 15)}
    if age_group not in age_map:
        raise HTTPException(400, "Invalid age_group")
    min_age, max_age = age_map[age_group]

    today = date.today()
    players = session.exec(
        select(Player).where(
            Player.gender == gender,
            func.extract('year', func.age(today, Player.birth_date)).between(min_age, max_age)
        )
    ).all()

    player_scores = []
    for p in players:
        ratings = compute_player_ratings(
            session, p.id,
            age_group=(min_age, max_age),
            gender=gender,
            as_of_date=today
        )
        if ratings and category in ratings["category_ratings"]:
            player_scores.append({
                "player": p,
                "rating": ratings["category_ratings"][category],
                "total_rating": ratings["total_rating"]
            })

    player_scores.sort(key=lambda x: x["rating"], reverse=True)
    top = player_scores[:limit]

    return [
        TopPlayer(
            player_id=item["player"].id,
            first_name=item["player"].first_name,
            last_name=item["player"].last_name,
            photo_url=item["player"].photo_url,
            age=calculate_age(item["player"].birth_date, today),
            rating=round(item["rating"], 2),
            total_rating=round(item["total_rating"], 2)
        )
        for item in top
    ]


@router.get("/top/by-progress", response_model=List[TopProgressPlayer])
def top_by_progress(
    age_group: str = Query("U9", pattern="^U([6-9]|1[0-4])$"),
    gender: str = Query("male", pattern="^(male|female)$"),
    limit: int = Query(10, ge=1, le=50),
    session: Session = Depends(get_session)
):
    age_num = int(age_group[1:])
    min_age, max_age = age_num, age_num
    today = date.today()

    players_with_multiple = session.exec(
        select(Player.id)
        .join(Result)
        .where(Player.gender == gender)
        .where(func.extract('year', func.age(today, Player.birth_date)).between(min_age, max_age))
        .group_by(Player.id)
        .having(func.count(Result.test_date.distinct()) >= 2)
    ).all()

    progress_list = []
    for (player_id,) in players_with_multiple:
        dates = session.exec(
            select(Result.test_date)
            .where(Result.player_id == player_id)
            .distinct()
            .order_by(Result.test_date.desc())
            .limit(2)
        ).all()
        if len(dates) < 2:
            continue
        last_date, prev_date = dates[0], dates[1]

        current_rating = compute_player_ratings(
            session, player_id,
            age_group=(min_age, max_age),
            gender=gender,
            as_of_date=last_date
        ).get("total_rating", 0)

        previous_rating = compute_player_ratings(
            session, player_id,
            age_group=(min_age, max_age),
            gender=gender,
            as_of_date=prev_date
        ).get("total_rating", 0)

        if previous_rating == 0:
            continue

        progress = current_rating - previous_rating
        player = session.get(Player, player_id)
        progress_list.append({
            "player_id": player.id,
            "first_name": player.first_name,
            "last_name": player.last_name,
            "photo_url": getattr(player, "photo_url", None),
            "age": calculate_age(player.birth_date, last_date),
            "progress": round(progress, 2),
            "current_rating": round(current_rating, 2),
            "previous_rating": round(previous_rating, 2)
        })

    progress_list.sort(key=lambda x: x["progress"], reverse=True)
    return progress_list[:limit]