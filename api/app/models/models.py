from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship, Column, Numeric, Date
from sqlalchemy import Index, CheckConstraint, Text

# === Модели ===

class Club(SQLModel, table=True):
    __tablename__ = "clubs"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(max_length=100, unique=True, nullable=False)

    # Связи
    players: List["Player"] = Relationship(back_populates="club")


class Player(SQLModel, table=True):
    __tablename__ = "players"
    __table_args__ = (
        Index("idx_players_birth", "birth_date"),
        Index("idx_players_club", "club_id"),
        CheckConstraint("gender IN ('male', 'female')", name="players_gender_check"),
        CheckConstraint("preferred_foot IN ('left', 'right')", name="players_preferred_foot_check"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    first_name: str = Field(max_length=50, nullable=False)
    last_name: str = Field(max_length=50, nullable=False)
    birth_date: date = Field(nullable=False)
    gender: Optional[str] = Field(max_length=10, default=None, regex="^(male|female)$")
    preferred_foot: Optional[str] = Field(max_length=10, default=None, regex="^(left|right)$")
    club_id: Optional[int] = Field(default=None, foreign_key="clubs.id", ondelete="SET NULL")
    created_at: Optional[datetime] = Field(default=None, sa_column_kwargs={"server_default": "CURRENT_TIMESTAMP"})
    photo_url: Optional[str] = Field(default=None, max_length=500)
    
    # Связи
    club: Optional[Club] = Relationship(back_populates="players")
    results: List["Result"] = Relationship(back_populates="player", sa_relationship_kwargs={"cascade": "all, delete-orphan"})


class Test(SQLModel, table=True):
    __tablename__ = "tests"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(max_length=100, unique=True, nullable=False)
    section: str = Field(max_length=50, nullable=False)
    physical_quality: Optional[str] = Field(max_length=100, default=None)
    unit: Optional[str] = Field(max_length=20, default=None)
    weight: Optional[Decimal] = Field(
        default=0.0,
        sa_column=Column(Numeric(5, 3), default=0.0)
    )

    # Связи
    results: List["Result"] = Relationship(back_populates="test")


class Result(SQLModel, table=True):
    __tablename__ = "results"
    __table_args__ = (
        Index("idx_results_player_date", "player_id", "test_date"),
        Index("idx_results_test", "test_id"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    player_id: int = Field(foreign_key="players.id", ondelete="CASCADE", nullable=False)
    test_id: int = Field(foreign_key="tests.id", ondelete="CASCADE", nullable=False)
    test_date: date = Field(nullable=False)
    value: Decimal = Field(
        sa_column=Column(Numeric(10, 3), nullable=False)
    )
    notes: Optional[str] = Field(default=None, sa_column=Column("notes", Text))

    # Связи
    player: Player = Relationship(back_populates="results")
    test: Test = Relationship(back_populates="results")


class Event(SQLModel, table=True):
    __tablename__ = "events"
    __table_args__ = (
        Index("idx_events_date", "event_date"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    title: str = Field(max_length=200, nullable=False)
    event_date: date = Field(nullable=False)
    location: Optional[str] = Field(max_length=200, default=None)
    description: Optional[str] = Field(default=None, sa_column=Column("description", Text))
    participants_count: Optional[int] = Field(default=None)
    photo_url: Optional[str] = Field(default=None, sa_column=Column("photo_url", Text))
    video_url: Optional[str] = Field(default=None, sa_column=Column("video_url", Text))


class Application(SQLModel, table=True):
    __tablename__ = "applications"

    id: Optional[int] = Field(default=None, primary_key=True)
    parent_name: str = Field(max_length=100, nullable=False)
    parent_phone: str = Field(max_length=20, nullable=False)
    child_name: str = Field(max_length=100, nullable=False)
    child_age: Optional[int] = Field(default=None)
    club_name: Optional[str] = Field(max_length=100, default=None)
    created_at: Optional[datetime] = Field(default=None, sa_column_kwargs={"server_default": "CURRENT_TIMESTAMP"})
    status: Optional[str] = Field(default="new", max_length=20)
    
    
class Feedback(SQLModel, table=True):
    __tablename__ = "feedback"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(max_length=100, nullable=False)
    phone: str = Field(max_length=20, nullable=False)
    email: Optional[str] = Field(max_length=100, default=None)
    message: str = Field(sa_column=Column(Text, nullable=False))
    created_at: datetime = Field(default_factory=datetime.now, nullable=False)
    status: str = Field(default="new", max_length=20)


class User(SQLModel, table=True):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("role IN ('admin', 'operator')", name="users_role_check"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(max_length=50, unique=True, nullable=False)
    password_hash: str = Field(max_length=255, nullable=False)
    role: str = Field(max_length=20, nullable=False, regex="^(admin|operator)$")
    

class Anthropometry(SQLModel, table=True):
    __tablename__ = "anthropometry"
    id: Optional[int] = Field(default=None, primary_key=True)
    player_id: int = Field(foreign_key="players.id", ondelete="CASCADE")
    test_date: date = Field(nullable=False)
    height: float  # см
    weight: float  # кг
    chest_circumference: float