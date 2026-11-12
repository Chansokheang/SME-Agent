"""Checks an owner's PostgreSQL connection string (Supabase, Neon or any Postgres).

The website's live data lives in a database the owner controls, not on this platform.
This module only connects to confirm the string works and to describe the database.
"""

from dataclasses import asdict, dataclass
from urllib.parse import quote, unquote, urlsplit

import psycopg

PROVIDERS = ("supabase", "neon", "postgres")
CONNECT_TIMEOUT_SECONDS = 8


class ConnectionStringError(ValueError):
    """The string itself is malformed, so there is nothing to try."""


@dataclass
class ConnectionInfo:
    host: str
    port: int
    database: str
    username: str


@dataclass
class TestResult:
    ok: bool
    error: str | None = None
    hint: str | None = None
    host: str | None = None
    database: str | None = None
    username: str | None = None
    server_version: str | None = None
    can_create: bool | None = None
    table_count: int | None = None

    def to_dict(self) -> dict:
        return asdict(self)


def normalize(url: str) -> str:
    """Returns the connection string with the user and password URL-encoded.

    Owners paste passwords containing @ # $ / ? as-is. The server address always follows the
    LAST @, so everything between the scheme and that @ is the user:password part, which gets
    encoded. Already-encoded passwords are decoded first, so they are not encoded twice.
    """
    url = url.strip()
    _check_shape(url)
    scheme, rest = url.split("://", 1)
    if "@" not in rest:
        raise ConnectionStringError("The connection string has no password in it.")
    userinfo, address = rest.rsplit("@", 1)
    user, _, password = userinfo.partition(":")
    if not password:
        raise ConnectionStringError("The connection string has no password in it.")
    return f"{scheme}://{quote(unquote(user), safe='')}:{quote(unquote(password), safe='')}@{address}"


def _check_shape(url: str) -> None:
    # A common mix-up: the project's web address (https://<ref>.supabase.co) instead of the database URI.
    if url.startswith(("http://", "https://")):
        if ".supabase.co" in url:
            raise ConnectionStringError(
                "That's your project's web address, not the database connection string. In Supabase, click "
                "Connect at the top of the project, choose Session pooler, and copy the URI that starts with postgresql://."
            )
        raise ConnectionStringError("That's a web address. Paste the database connection string that starts with postgresql://.")
    if "YOUR-PASSWORD" in url or "YOUR_PASSWORD" in url:
        raise ConnectionStringError("Replace [YOUR-PASSWORD] with your database password first.")
    if not url.startswith(("postgres://", "postgresql://")):
        raise ConnectionStringError("It should start with postgresql:// (copy the URI version of the connection string).")


def parse(url: str) -> ConnectionInfo:
    url = normalize(url)
    try:
        parts = urlsplit(url)
        parts.port  # noqa: B018 - raises on a malformed port
    except ValueError:
        raise ConnectionStringError("The connection string couldn't be read. Copy it again from your database's dashboard.") from None
    if not parts.hostname:
        raise ConnectionStringError("The connection string has no server address.")
    if not parts.password:
        raise ConnectionStringError("The connection string has no password in it.")
    return ConnectionInfo(
        host=parts.hostname,
        port=parts.port or 5432,
        database=(parts.path or "/postgres").lstrip("/") or "postgres",
        username=unquote(parts.username or ""),
    )


def _friendly(error: Exception, info: ConnectionInfo) -> tuple[str, str | None]:
    text = str(error).lower()
    supabase_direct = info.host.startswith("db.") and info.host.endswith(".supabase.co")
    if "password authentication failed" in text:
        return "The password was rejected.", "Check the database password (not your Supabase login password)."
    if "tenant or user not found" in text:
        return "The server didn't recognise that user.", "Copy the connection string again from the Connect dialog."
    if "does not exist" in text and "database" in text:
        return f"There is no database called '{info.database}'.", None
    if any(s in text for s in ("timeout", "could not translate host", "name or service not known",
                               "failed to resolve host", "getaddrinfo",
                               "network is unreachable", "cannot assign requested address", "connection refused")):
        hint = (
            "This direct address only works over IPv6. In Supabase, choose Connect > Session pooler and copy that URI instead."
            if supabase_direct
            else "Check the address, and that the database allows connections from outside."
        )
        return "Couldn't reach the database server.", hint
    return "Couldn't connect to the database.", str(error).splitlines()[0][:200]


def test(url: str) -> TestResult:
    try:
        info = parse(url)
    except ConnectionStringError as exc:
        return TestResult(ok=False, error=str(exc))
    try:
        with psycopg.connect(normalize(url), connect_timeout=CONNECT_TIMEOUT_SECONDS) as conn:
            server_version = conn.execute("show server_version").fetchone()[0]
            can_create = conn.execute("select has_schema_privilege('public', 'CREATE')").fetchone()[0]
            table_count = conn.execute(
                "select count(*) from information_schema.tables "
                "where table_schema = 'public' and table_type = 'BASE TABLE'"
            ).fetchone()[0]
    except Exception as exc:  # any driver/network failure becomes a readable message
        error, hint = _friendly(exc, info)
        return TestResult(ok=False, error=error, hint=hint, host=info.host)
    return TestResult(
        ok=True,
        host=info.host,
        database=info.database,
        username=info.username,
        server_version=str(server_version),
        can_create=bool(can_create),
        table_count=int(table_count),
    )
