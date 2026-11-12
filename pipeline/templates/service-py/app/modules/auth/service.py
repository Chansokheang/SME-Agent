"""Sign-in rules. Takes plain values and a database session, raises core.errors; knows nothing
about HTTP (no Request, no HTTPException), so any router, script or test can call it."""

from sqlalchemy.orm import Session

from ...core.errors import NotFound, Unauthorized
from ...core.security import check_password, sign_token
from ..users import repository as users
from .schemas import LoginOut, UserOut


def _out(user) -> UserOut:
    return UserOut(id=str(user.id), email=user.email, name=getattr(user, "name", None),
                   role=getattr(user, "role", None) or "user")


def login(db: Session, email: str, password: str) -> LoginOut:
    user = users.get_by_email(db, email)
    if not user or not check_password(password, user.password_hash):
        raise Unauthorized("Email or password is incorrect", code="wrong_credentials")
    out = _out(user)
    return LoginOut(token=sign_token(out.id, out.role), user=out)


def me(db: Session, user_id: str) -> UserOut:
    user = users.get(db, int(user_id))
    if not user:
        raise NotFound("This account no longer exists")
    return _out(user)
