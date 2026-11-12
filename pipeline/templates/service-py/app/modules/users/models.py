"""The user table. Rename and complete it to match the data design's user table
(docs/02-schema.prisma): same name and fields, the password stored only as a bcrypt hash."""

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from ...core.db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str | None] = mapped_column(String(120))
    role: Mapped[str] = mapped_column(String(40), default="user")
    password_hash: Mapped[str] = mapped_column(String(255))
