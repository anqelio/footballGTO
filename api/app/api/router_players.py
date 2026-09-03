from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select, func, or_
from typing import Optional, List
from app.db.session import get_session
from app.models.models import Player, Club
from app.models.models import User
from app.core.authorization import require_roles
from app.services.rating import *
from app.schemas.schemas import PaginatedResponse, PlayerCreate, PlayerRankingOut

router = APIRouter(prefix="/players", tags=["Players"])

@router.get("/rankings", response_model=PaginatedResponse[PlayerRankingOut])
def get_players_rankings(
    age_group: Optional[str] = Query(None, pattern="^U\\d+$"),
    club_id: Optional[int] = None,
    gender: Optional[str] = Query(None, pattern="^(male|female)$"),
    search: Optional[str] = None,
    sort_by: str = Query("total_rating", pattern="^(total_rating|anthropometry|athleticism|speed|agility|dribbling|technique|shots)$"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_session)
):
    query = select(Player)
    if club_id:
        query = query.where(Player.club_id == club_id)
    if gender:
        query = query.where(Player.gender == gender)
    if search:
        query = query.where(
            or_(Player.first_name.ilike(f"%{search}%"), Player.last_name.ilike(f"%{search}%"))
        )
    players = session.exec(query).all()

    # Определяем возрастную группу для расчёта
    age_tuple = None
    if age_group:
        age_num = int(age_group[1:])
        age_tuple = (age_num, age_num)  # точный возраст, можно расширить до (age_num-1, age_num) по ТЗ

    results = []
    for player in players:
        try:
            ratings = compute_player_ratings(
                session, player.id,
                age_group=age_tuple,
                gender=gender
            )
        except Exception as e:
            continue

        # Маппинг категорий на поля схемы
        category_map = {
            "Антропометрия": "anthropometry",
            "Атлетизм": "athleticism",
            "Быстрота": "speed",
            "Координация": "agility",      # в схеме agility
            "Дриблинг": "dribbling",
            "Техника": "technique",
            "Удары": "shots",
        }
        rating_fields = {}
        for cat_key, cat_value in ratings["category_ratings"].items():
            field = category_map.get(cat_key)
            if field:
                rating_fields[field] = round(cat_value, 2)

        age = calculate_age(player.birth_date)

        player_data = PlayerRankingOut(
            player_id=player.id,
            first_name=player.first_name,
            last_name=player.last_name,
            photo_url=player.photo_url,
            age=age,
            club_name=player.club.name if player.club else None,
            **rating_fields,
            total_rating=round(ratings["total_rating"], 2)
        )
        results.append(player_data)

    # Сортировка
    if sort_by == "total_rating":
        results.sort(key=lambda x: x.total_rating, reverse=True)
    else:
        results.sort(key=lambda x: getattr(x, sort_by, 0), reverse=True)

    # Пагинация
    total = len(results)
    start = (page - 1) * size
    end = start + size
    paginated_items = results[start:end]

    return PaginatedResponse(
        items=paginated_items,
        total=total,
        page=page,
        size=size,
        pages=(total + size - 1) // size
    )

@router.get("/{player_id}", response_model=Player)
def get_player(player_id: int, session: Session = Depends(get_session)):
    player = session.get(Player, player_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    return player


@router.post("/", response_model=Player)
def create_player(player: PlayerCreate, session: Session = Depends(get_session), current_user: User = Depends(require_roles(["admin", "operator"]))):
    if player.club_id:
        club = session.get(Club, player.club_id)
        if not club:
            raise HTTPException(status_code=400, detail="Invalid club_id")
    db_player = Player.model_validate(player)
    session.add(db_player)
    session.commit()
    session.refresh(db_player)
    return db_player

@router.get("/", response_model=PaginatedResponse[Player])
def list_players(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    club_id: Optional[int] = None,
    search: Optional[str] = None,
    session: Session = Depends(get_session)
):
    offset = (page - 1) * size
    query = select(Player)
    if club_id:
        query = query.where(Player.club_id == club_id)
    if search:
        query = query.where(
            or_(
                Player.first_name.ilike(f"%{search}%"),
                Player.last_name.ilike(f"%{search}%")
            )
        )
    total = session.exec(select(func.count()).select_from(query.subquery())).one()
    players = session.exec(query.offset(offset).limit(size)).all()
    return PaginatedResponse(
        items=players,
        total=total,
        page=page,
        size=size,
        pages=(total + size - 1) // size
    )


@router.patch("/{player_id}", response_model=Player)
def update_player(player_id: int, player_update: PlayerCreate, session: Session = Depends(get_session), current_user: User = Depends(require_roles(["admin", "operator"]))):
    player = session.get(Player, player_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    update_data = player_update.model_dump(exclude_unset=True)
    if "club_id" in update_data and update_data["club_id"] is not None:
        club = session.get(Club, update_data["club_id"])
        if not club:
            raise HTTPException(status_code=400, detail="Invalid club_id")
    for key, value in update_data.items():
        setattr(player, key, value)
    session.add(player)
    session.commit()
    session.refresh(player)
    return player

@router.delete("/{player_id}")
def delete_player(player_id: int, session: Session = Depends(get_session), current_user: User = Depends(require_roles(["admin", "operator"]))):
    player = session.get(Player, player_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    session.delete(player)
    session.commit()
    return {"ok": True}