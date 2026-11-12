"""Every setting the service reads from its environment, in one place."""

import os
from functools import lru_cache

# All addresses live under this prefix (e.g. /api/v1/rooms). /health and /docs stay outside it.
API_PREFIX = "/api/v1"


class Settings:
    def __init__(self) -> None:
        self.app_name = os.environ.get("APP_NAME", "API")
        self.database_url = os.environ.get("DATABASE_URL", "sqlite:///./dev.db")
        self.jwt_secret = os.environ.get("SERVICE_JWT_SECRET", "")
        self.token_days = int(os.environ.get("TOKEN_DAYS", "7"))
        self.allowed_origins = [
            o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000").split(",") if o.strip()
        ]


@lru_cache
def get_settings() -> Settings:
    return Settings()
