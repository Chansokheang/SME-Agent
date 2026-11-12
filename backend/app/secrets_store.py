"""Encrypts secrets (owners' database connection strings) at rest with Fernet."""

from functools import lru_cache

from cryptography.fernet import Fernet

from .config import settings


@lru_cache
def _fernet() -> Fernet:
    if settings.secret_key:
        return Fernet(settings.secret_key.encode())
    path = settings.secret_key_file
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(Fernet.generate_key())
    return Fernet(path.read_bytes().strip())


def encrypt(value: str) -> str:
    return _fernet().encrypt(value.encode()).decode()


def decrypt(token: str) -> str:
    return _fernet().decrypt(token.encode()).decode()
