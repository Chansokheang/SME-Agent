"""What routers ask FastAPI for: a database session and the signed-in user (with a role check)."""

from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..core.db import get_session
from ..core.errors import Forbidden, Unauthorized
from ..core.security import read_token

DbSession = Annotated[Session, Depends(get_session)]


class CurrentUser(BaseModel):
    user_id: str
    role: str


# Declared as a security scheme so the API docs (/docs) get an "Authorize" button: sign in with
# POST /api/v1/auth/login, paste the token there, and every call in the docs sends it.
bearer = HTTPBearer(auto_error=False, description="The token from POST /api/v1/auth/login")


def current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> CurrentUser:
    payload = read_token(credentials.credentials) if credentials else None
    if not payload:
        raise Unauthorized("Please sign in")
    return CurrentUser(user_id=payload["userId"], role=payload["role"])


def require_user(*roles: str):
    """A signed-in user, optionally with one of the given roles:
    `user: CurrentUser = Depends(require_user("admin"))`."""

    def check(user: CurrentUser = Depends(current_user)) -> CurrentUser:
        if roles and user.role not in roles:
            raise Forbidden("You don't have access to this")
        return user

    return check
