"""The database: a local SQLite file while building, the owner's PostgreSQL online (DATABASE_URL)."""

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session

from .config import get_settings


def database_url() -> str:
    url = get_settings().database_url
    # Hosting providers give "postgres://" or "postgresql://"; SQLAlchemy's psycopg 3 driver needs its own prefix.
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix):]
    return url


engine = create_engine(
    database_url(),
    connect_args={"check_same_thread": False} if database_url().startswith("sqlite") else {},
    pool_pre_ping=True,
)


class Base(DeclarativeBase):
    """Every table (app/modules/<resource>/models.py) inherits from this."""


def get_session():
    with Session(engine) as session:
        yield session
