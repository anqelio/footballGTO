from fastapi import FastAPI
from contextlib import asynccontextmanager
from fastapi_pagination import add_pagination
from starlette.staticfiles import StaticFiles
from app.db.database import *
from app.models import models
from app.api.router_auth import router as router_auth
from app.api.router_clubs import router as router_clubs
from app.api.router_players import router as router_players
from app.api.router_tests import router as router_tests
from app.api.router_results import router as router_results
from app.api.router_events import router as router_events
from app.api.router_application import router as router_application
from app.api.router_user import router as router_user
from app.api.router_feedback import router as router_feedback
from app.api.router_rankings import router as router_rankings
from fastapi.middleware.cors import CORSMiddleware

main_app = FastAPI()

@asynccontextmanager
async def on_startup(app: FastAPI):
    init_db()
    yield
    close_db()

app_v1 = FastAPI(
    title="footballGTO API, Приложение, предназначенное для обработки данных о тестируемых футболистах.", version="1.0.0",
    openapi_url="/openapi.json", docs_url="/docs",
    redoc_url="/redoc",
    description='Выполнил tg: @cyberrobb',
    swagger_ui_oauth2_redirect_url="/docs/oauth2-redirect",
    lifespan=on_startup)

main_app.mount("/api/v1/", app_v1)
app_v1.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:8000", "http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app_v1.include_router(router_auth, tags=['Authorization'])
app_v1.include_router(router_user, tags=['User'])
app_v1.include_router(router_clubs, tags=['Clubs'])
app_v1.include_router(router_players, tags=['Players'])
app_v1.include_router(router_rankings, tags=['Rankings'])
app_v1.include_router(router_tests, tags=['Tests'])
app_v1.include_router(router_results, tags=['Results'])
app_v1.include_router(router_events, tags=['Events'])
app_v1.include_router(router_application, tags=['Applications'])
app_v1.include_router(router_feedback, tags=['Feedback'])
add_pagination(app_v1)