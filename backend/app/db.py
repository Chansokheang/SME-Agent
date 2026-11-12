from datetime import datetime, timezone
from uuid import uuid4

from sqlmodel import Field, Session, SQLModel, create_engine

from .config import settings


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def new_id() -> str:
    return uuid4().hex[:12]


class Project(SQLModel, table=True):
    id: str = Field(default_factory=new_id, primary_key=True)
    name: str
    created_at: datetime = Field(default_factory=utcnow)


class StageState(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    project_id: str = Field(index=True, foreign_key="project.id")
    stage_key: str
    # locked | active | approved
    status: str = "locked"
    # Claude Code session used for this stage's conversation.
    session_id: str | None = None
    # Which version of the stage's instructions that conversation has seen. A resumed Claude
    # session keeps the instructions it started with, so newer ones are passed along once.
    prompt_hash: str | None = None
    approved_at: datetime | None = None
    artifact_hash: str | None = None


class Message(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    project_id: str = Field(index=True, foreign_key="project.id")
    stage_key: str
    # user | assistant | error
    role: str
    content: str
    run_id: str | None = None
    # Files the owner attached (JSON list of {file, name, kind}), shown with the message.
    attachments: str | None = None
    # An AI reply's work in order (JSON list of {t: "text", text} | {t: "tool", name, summary}),
    # so the chat can fold the working steps away and show the final answer.
    steps: str | None = None
    created_at: datetime = Field(default_factory=utcnow)


class Run(SQLModel, table=True):
    id: str = Field(default_factory=new_id, primary_key=True)
    project_id: str = Field(index=True, foreign_key="project.id")
    stage_key: str
    # running | succeeded | failed
    status: str = "running"
    session_id: str | None = None
    cost_usd: float | None = None
    error: str | None = None
    started_at: datetime = Field(default_factory=utcnow)
    finished_at: datetime | None = None
    # Which Claude account ran it: a saved account's name, or "This computer's login".
    account: str | None = None


class ClaudeAccount(SQLModel, table=True):
    """A Claude account Gagesite can run on, added with a token from `claude setup-token`.
    The one marked active runs every AI run; with none active, the computer's own login does."""

    id: str = Field(default_factory=new_id, primary_key=True)
    name: str
    # Fernet-encrypted token. Never returned by the API, logged, written to a workspace or put on a command line.
    encrypted_token: str
    hint: str  # the token's last 4 characters, to tell accounts apart
    active: bool = False
    created_at: datetime = Field(default_factory=utcnow)
    last_used_at: datetime | None = None


class SourceDatabase(SQLModel, table=True):
    """An existing database the owner already has, read (never written) to design around in Stage 2."""

    project_id: str = Field(primary_key=True, foreign_key="project.id")
    provider: str  # supabase | neon | postgres
    # Fernet-encrypted connection string. Never returned by the API or written to the workspace.
    encrypted_url: str
    host: str
    database: str
    table_count: int
    connected_at: datetime = Field(default_factory=utcnow)


class GitHubConnection(SQLModel, table=True):
    """The owner's GitHub repository, where the generated website's code is saved (Stage 4 on)."""

    project_id: str = Field(primary_key=True, foreign_key="project.id")
    repo: str  # "owner/name"
    url: str
    # Fernet-encrypted token. Never returned by the API, written to the workspace or put on a command line.
    encrypted_token: str
    connected_at: datetime = Field(default_factory=utcnow)
    last_push_at: datetime | None = None
    last_commit: str | None = None
    last_error: str | None = None


class VercelConnection(SQLModel, table=True):
    """The owner's own Vercel account, where Stage 5 puts the website online."""

    project_id: str = Field(primary_key=True, foreign_key="project.id")
    username: str
    # Fernet-encrypted access token. Never returned by the API, written to the workspace or logged.
    encrypted_token: str
    connected_at: datetime = Field(default_factory=utcnow)


class Deployment(SQLModel, table=True):
    """Stage 5: the website's place on Vercel and how the last attempt to put it online went."""

    project_id: str = Field(primary_key=True, foreign_key="project.id")
    vercel_project_id: str | None = None
    vercel_project_name: str | None = None
    url: str | None = None  # the live address, once online
    # idle | running | live | failed
    status: str = "idle"
    # JSON list of {key, label, status: pending|running|done|skipped|failed, detail}
    steps: str = "[]"
    error: str | None = None
    # Last lines of Vercel's build output when building failed, for Gagesite to fix.
    build_log: str | None = None
    deployment_id: str | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None
    live_at: datetime | None = None
    # Fernet-encrypted: the website's login-signing secret (stable across deploys) and the
    # settings the owner filled in (JSON {NAME: value}).
    encrypted_auth_secret: str | None = None
    encrypted_settings: str | None = None
    # Whether the owner's first account was created in the live database.
    first_account_email: str | None = None
    # Set while the owner has taken the website offline (the Vercel project is paused).
    offline_at: datetime | None = None
    # Fingerprint of what the last successful attempt put online (code, settings, API address), to
    # tell when there are changes waiting to go online.
    online_hash: str | None = None
    # "UI + dedicated API": the API service's own Vercel project and live address.
    service_project_id: str | None = None
    service_url: str | None = None


class ApiServer(SQLModel, table=True):
    """"UI + dedicated API": the API running in Docker on a server the owner controls (instead of
    Vercel), and how the last attempt to put it there went. Only the API: the website is untouched."""

    project_id: str = Field(primary_key=True, foreign_key="project.id")
    # this_pc (Docker on the computer running Gagesite, for trying it) | ssh (the owner's server, later)
    target: str = "this_pc"
    port: int = 4800  # where the API answers on that machine
    # After a change Gagesite makes to the API, put the new version online by itself.
    auto_update: bool = True
    url: str | None = None
    # idle | running | live | failed | stopped
    status: str = "idle"
    steps: str = "[]"  # JSON list of {key, label, status, detail}, like Deployment.steps
    error: str | None = None
    log: str | None = None  # the last failed step's output, secrets removed
    files_hash: str | None = None  # the code that is online, to know when a change needs putting there
    reason: str | None = None  # why the last attempt started: "owner" | "change"
    # Fernet-encrypted token-signing secret, stable across updates so signed-in users stay signed in.
    encrypted_secret: str | None = None
    # target "ssh": the owner's server. Gagesite signs in with its own key (never a password); the
    # owner adds ssh_public_key to the server once. The private key is Fernet-encrypted, never shown.
    ssh_host: str | None = None
    ssh_port: int | None = None
    ssh_user: str | None = None
    ssh_public_key: str | None = None
    encrypted_ssh_key: str | None = None
    # The server's own key, remembered on the first connection: a different one later is refused.
    ssh_host_key: str | None = None
    # The first login made in the database by the API's production script (the same one the live
    # website shows; its password is kept with the website's settings, encrypted).
    first_account_email: str | None = None
    # The last after-deploy test of the live address (smoke.py), as JSON.
    smoke: str | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None
    live_at: datetime | None = None


class DatabaseConnection(SQLModel, table=True):
    """Where a project's finished website stores its data: a database the owner controls."""

    project_id: str = Field(primary_key=True, foreign_key="project.id")
    # supabase | neon | postgres
    provider: str
    # Fernet-encrypted connection string. Never returned by the API or written to the workspace.
    encrypted_url: str
    host: str
    database: str
    username: str
    server_version: str
    table_count: int
    tested_at: datetime = Field(default_factory=utcnow)


if settings.database_url.startswith("sqlite:///"):
    from pathlib import Path

    Path(settings.database_url.removeprefix("sqlite:///")).parent.mkdir(parents=True, exist_ok=True)

engine = create_engine(settings.database_url, connect_args={"check_same_thread": False})


def init_db() -> None:
    SQLModel.metadata.create_all(engine)
    add_missing_columns()


def add_missing_columns() -> None:
    """create_all never changes an existing table: add new optional columns to databases made before them."""
    from sqlalchemy import inspect, text

    inspector = inspect(engine)
    with engine.begin() as connection:
        for table in SQLModel.metadata.sorted_tables:
            if not inspector.has_table(table.name):
                continue
            have = {c["name"] for c in inspector.get_columns(table.name)}
            for column in table.columns:
                if column.name not in have and column.nullable:
                    kind = column.type.compile(dialect=engine.dialect)
                    connection.execute(text(f'ALTER TABLE "{table.name}" ADD COLUMN "{column.name}" {kind}'))


def get_session():
    with Session(engine) as session:
        yield session
