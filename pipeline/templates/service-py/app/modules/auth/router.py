"""POST /api/v1/auth/login {email, password} -> {data: {token, user}}
GET  /api/v1/auth/me -> {data: user}

A router is HTTP only: read the request (schemas), call the service, answer {"data": ...}.
No queries and no business rules here."""

from fastapi import APIRouter, Depends

from ...api.deps import CurrentUser, DbSession, require_user
from . import service
from .schemas import LoginAnswer, LoginIn, MeAnswer

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/login", response_model=LoginAnswer)
def login(body: LoginIn, db: DbSession):
    return {"data": service.login(db, body.email, body.password)}


@router.get("/me", response_model=MeAnswer)
def me(db: DbSession, user: CurrentUser = Depends(require_user())):
    return {"data": service.me(db, user.user_id)}
