"""Reading and writing users. Queries only: no rules, no HTTP."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import User


def get_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == email.lower()))


def get(db: Session, user_id: int) -> User | None:
    return db.get(User, user_id)
