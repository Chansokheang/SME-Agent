"""Imports every module's tables so SQLAlchemy knows them all (scripts/db.py creates them).
Add one line per module that has a models.py."""

from .modules.users.models import User  # noqa: F401
