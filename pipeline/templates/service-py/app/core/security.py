"""Password hashing and sign-in tokens (JWT, sent as "Authorization: Bearer <token>"). No HTTP here."""

import datetime as dt

import bcrypt
import jwt

from .config import get_settings


def _secret() -> str:
    value = get_settings().jwt_secret
    if not value:
        raise RuntimeError("SERVICE_JWT_SECRET is not set")
    return value


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def check_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except ValueError:
        return False


def sign_token(user_id: str, role: str) -> str:
    now = dt.datetime.now(dt.timezone.utc)
    payload = {"userId": user_id, "role": role, "iat": now, "exp": now + dt.timedelta(days=get_settings().token_days)}
    return jwt.encode(payload, _secret(), algorithm="HS256")


def read_token(token: str) -> dict | None:
    """The token's {"userId", "role"}, or None when it is missing, wrong or expired."""
    try:
        payload = jwt.decode(token, _secret(), algorithms=["HS256"])
    except jwt.PyJWTError:
        return None
    return {"userId": str(payload["userId"]), "role": str(payload["role"])}
