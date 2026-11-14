from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=REPO_ROOT / ".env", extra="ignore")

    pipeline_dir: Path = REPO_ROOT / "pipeline"
    # Platform-private files (combined stage prompts...). A Docker volume in production.
    data_dir: Path = REPO_ROOT / "data"
    workspaces_dir: Path = REPO_ROOT / "workspaces"
    database_url: str = f"sqlite:///{(REPO_ROOT / 'data' / 'app.db').as_posix()}"

    # Path to the claude CLI; found on PATH when empty.
    claude_bin: str = ""
    # How many `claude -p` runs may execute at once (one subscription: keep at 1).
    # Runs at once across all projects: the agent team with a UI and an API developer needs 2.
    max_concurrent_runs: int = 3

    cors_origins: list[str] = ["http://localhost:3000"]

    # Fernet key that encrypts owners' database connection strings. When empty, a key is
    # generated once and kept in secret_key_file (data/ is gitignored and a Docker volume).
    secret_key: str = ""
    secret_key_file: Path = REPO_ROOT / "data" / "secret.key"

    # Opened from the internet (compose profile "public"): the one password that signs people in,
    # and the public port Gagesite answers on (the sign-in page lives there). See app/access.py.
    gagesite_password: str = ""
    public_port: int = 0


settings = Settings()
