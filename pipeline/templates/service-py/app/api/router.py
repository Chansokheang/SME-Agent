"""Every resource's router, mounted under API_PREFIX (/api/v1). Each router sets its own path and
Swagger tag (APIRouter(prefix="/rooms", tags=["Rooms"])), so /docs groups the addresses."""

from fastapi import APIRouter

from ..modules.auth.router import router as auth_router

api_router = APIRouter()
api_router.include_router(auth_router)
# One line per resource, e.g.:
# from ..modules.rooms.router import router as rooms_router
# api_router.include_router(rooms_router)
