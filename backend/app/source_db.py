"""An existing database the owner already has (Supabase, Neon, any Postgres), used as a SOURCE.

Gagesite designs around it the same way as around uploaded spreadsheets: it reads only the
structure, row counts and a few masked samples per column (never the rows themselves), over a
read-only connection. The rows are copied into the site's own database at launch.
"""

import pandas as pd
import psycopg
from psycopg import sql

from . import profiler
from .db_connect import CONNECT_TIMEOUT_SECONDS, normalize

MAX_TABLES = 50
SAMPLE_ROWS = 500  # rows read per table to work out types and masked samples


def label(provider: str) -> str:
    """The name the profile, the design (`data_sources.file`) and the Data tab use for it."""
    return f"Existing {provider.capitalize() if provider != 'postgres' else 'Postgres'} database"


def connect(url: str) -> psycopg.Connection:
    conn = psycopg.connect(normalize(url), connect_timeout=CONNECT_TIMEOUT_SECONDS)
    conn.read_only = True  # nothing in the owner's existing database can change
    return conn


def profile(url: str, provider: str) -> profiler.FileProfile:
    """Structure, row counts and masked samples of every table in the public schema."""
    name = label(provider)
    with connect(url) as conn:
        tables = [
            r[0]
            for r in conn.execute(
                "select table_name from information_schema.tables "
                "where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name"
            ).fetchall()
        ][:MAX_TABLES]
        columns = conn.execute(
            "select table_name, column_name, data_type, is_nullable from information_schema.columns "
            "where table_schema = 'public' order by table_name, ordinal_position"
        ).fetchall()
        links = conn.execute(
            "select kcu.table_name, kcu.column_name, ccu.table_name, ccu.column_name "
            "from information_schema.table_constraints tc "
            "join information_schema.key_column_usage kcu on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema "
            "join information_schema.constraint_column_usage ccu on tc.constraint_name = ccu.constraint_name and tc.table_schema = ccu.table_schema "
            "where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public'"
        ).fetchall()

        sheets = []
        for table in tables:
            ident = sql.Identifier(table)
            count = conn.execute(sql.SQL("select count(*) from {}").format(ident)).fetchone()[0]
            cursor = conn.execute(sql.SQL("select * from {} limit %s").format(ident), (SAMPLE_ROWS,))
            headers = [d.name for d in cursor.description or []]
            frame = pd.DataFrame(cursor.fetchall(), columns=headers)
            sheet = profiler._profile_frame(table, frame)
            sheet.rows = int(count)
            if count > SAMPLE_ROWS:
                sheet.notes.append(f"Types and samples are based on the first {SAMPLE_ROWS} of {count} rows.")
            sheets.append(sheet)

    # The structure as readable CREATE TABLE statements (no data).
    statements = []
    for table in tables:
        lines = [
            f"  {column} {data_type}{'' if nullable == 'YES' else ' NOT NULL'}"
            for t, column, data_type, nullable in columns
            if t == table
        ]
        lines += [f"  FOREIGN KEY ({column}) REFERENCES {other}({other_column})" for t, column, other, other_column in links if t == table]
        statements.append(f"CREATE TABLE {table} (\n" + ",\n".join(lines) + "\n);")
    if not tables:
        return profiler.FileProfile(file=name, kind="database", error="This database has no tables yet, so there is nothing to design around.")
    return profiler.FileProfile(file=name, kind="database", sheets=sheets, sql_excerpt="\n\n".join(statements)[: profiler.MAX_SQL_CHARS])
