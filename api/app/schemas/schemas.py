from pydantic import BaseModel, ConfigDict, Field, field_validator
from datetime import date, datetime
from typing import Optional, Generic, TypeVar, List
from decimal import Decimal

T = TypeVar("T")

class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    size: int
    pages: int


# === Clubs ===
class ClubBase(BaseModel):
    name: str = Field(max_length=100)


class ClubCreate(ClubBase):
    pass


class Club(ClubBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


# === Players ===
class PlayerBase(BaseModel):
    first_name: str = Field(max_length=50)
    last_name: str = Field(max_length=50)
    birth_date: date
    gender: Optional[str] = Field(None, pattern="^(male|female)$")
    preferred_foot: Optional[str] = Field(None, pattern="^(left|right)$")
    club_id: Optional[int] = None
    photo_url: Optional[str] = None

    @field_validator("gender", mode="before")
    def validate_gender(cls, v):
        if v not in (None, "male", "female"):
            raise ValueError("gender must be 'male' or 'female'")
        return v

    @field_validator("preferred_foot", mode="before")
    def validate_foot(cls, v):
        if v not in (None, "left", "right"):
            raise ValueError("preferred_foot must be 'left' or 'right'")
        return v


class PlayerCreate(PlayerBase):
    pass


class Player(PlayerBase):
    id: int
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# === Tests ===
class TestBase(BaseModel):
    name: str = Field(max_length=100)
    section: str = Field(max_length=50)
    physical_quality: Optional[str] = Field(None, max_length=100)
    unit: Optional[str] = Field(None, max_length=20)
    weight: Optional[Decimal] = Field(0.0, decimal_places=3)


class TestCreate(TestBase):
    pass


class Test(TestBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


# === Results ===
class ResultBase(BaseModel):
    player_id: int
    test_id: int
    test_date: date
    value: Decimal = Field(decimal_places=3)
    notes: Optional[str] = None


class ResultCreate(ResultBase):
    pass


class Result(ResultBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


# === Events ===
class EventBase(BaseModel):
    title: str = Field(max_length=200)
    event_date: date
    location: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None
    participants_count: Optional[int] = None
    photo_url: Optional[str] = None
    video_url: Optional[str] = None


class EventCreate(EventBase):
    pass


class Event(EventBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


# === Applications ===
class ApplicationBase(BaseModel):
    parent_name: str = Field(max_length=100)
    parent_phone: str = Field(max_length=20)
    child_name: str = Field(max_length=100)
    child_age: Optional[int] = None
    club_name: Optional[str] = Field(None, max_length=100)
    status: Optional[str] = Field("new", max_length=20)


class ApplicationCreate(ApplicationBase):
    pass


class Application(ApplicationBase):
    id: int
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# === Users ===
class UserBase(BaseModel):
    username: str = Field(max_length=50)
    password_hash: str = Field(max_length=255)
    role: str = Field(max_length=20)

    @field_validator("role")
    def validate_role(cls, v):
        if v not in ("admin", "operator"):
            raise ValueError("role must be 'admin' or 'operator'")
        return v


class UserCreate(BaseModel):
    username: str = Field(max_length=50)
    password: str
    role: str = Field(max_length=20)
    
    @field_validator("role")
    def validate_role(cls, v):
        if v not in ("admin", "operator"):
            raise ValueError("role must be 'admin' or 'operator'")
        return v
    
    
class UserUpdate(BaseModel):
    username: Optional[str] = Field(None, max_length=50)
    password: Optional[str] = None
    role: Optional[str] = Field(None, max_length=20)

    @field_validator("role")
    def validate_role(cls, v):
        if v is not None and v not in ("admin", "operator"):
            raise ValueError("role must be 'admin' or 'operator'")
        return v


class User(UserBase):
    id: int

    model_config = ConfigDict(from_attributes=True)
    
    
class UserLogin(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: Optional[str] = None


class UserPublic(BaseModel):
    id: int
    username: str
    role: str
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
    

class PlayerRankingOut(BaseModel):
    player_id: int
    first_name: str
    last_name: str
    photo_url: Optional[str] = None
    age: Optional[int] = None
    club_name: Optional[str] = None
    anthropometry: Optional[float] = None
    athleticism: Optional[float] = None
    speed: Optional[float] = None
    agility: Optional[float] = None
    dribbling: Optional[float] = None
    technique: Optional[float] = None
    shots: Optional[float] = None
    total_rating: float
    photo_url: Optional[str] = None
    
class TopPlayer(BaseModel):
    player_id: int
    first_name: str
    last_name: str
    photo_url: Optional[str] = None
    age: Optional[int] = None
    rating: float
    total_rating: float
    photo_url: Optional[str] = None

class TopProgressPlayer(BaseModel):
    player_id: int
    first_name: str
    last_name: str
    photo_url: Optional[str] = None
    age: Optional[int] = None
    progress: float
    current_rating: float
    previous_rating: float
    
    
class FeedbackBase(BaseModel):
    name: str = Field(max_length=100)
    phone: str = Field(max_length=20)
    email: Optional[str] = Field(None, max_length=100)
    message: str
    status: Optional[str] = Field("new", max_length=20)

class FeedbackCreate(FeedbackBase):
    pass

class Feedback(FeedbackBase):
    id: int
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)