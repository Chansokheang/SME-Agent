"""Read-only rows for the Data tab, one page at a time (the browser never gets a whole table).

Rows come from the owner's own database once it has them, or from an uploaded spreadsheet before
import. Only the owner sees these pages; Claude never does.
"""

import datetime as dt
import decimal
import re
from functools import lru_cache
from pathlib import Path

import pandas as pd
import psycopg
from psycopg import sql

from .db_connect import normalize
from .profiler import _read_csv

PAGE_MAX = 200
CELL_MAX = 300  # characters shown per cell; long texts are cut


def model_tables(prisma_text: str) -> dict[str, str]:
    """Prisma model name -> the real table name in the database (its @@map name, if any)."""
    names = {}
    for match in re.finditer(r"^model\s+(\w+)\s*\{(.*?)^\}", prisma_text or "", re.MULTILINE | re.DOTALL):
        mapped = re.search(r'@@map\("([^"]+)"\)', match.group(2))
        names[match.group(1)] = mapped.group(1) if mapped else match.group(1)
    return names


def _cell(value):
    if value is None:
        return None
    if isinstance(value, float) and pd.isna(value):
        return None
    if isinstance(value, (dt.datetime, dt.date, dt.time, decimal.Decimal, pd.Timestamp)):
        return str(value)
    if isinstance(value, (bytes, bytearray, memoryview)):
        return "(file data)"
    if isinstance(value, (int, float, bool)):
        return value
    text = str(value)
    return text if len(text) <= CELL_MAX else text[:CELL_MAX] + "..."


def _connect(url: str) -> psycopg.Connection:
    conn = psycopg.connect(normalize(url), connect_timeout=8)
    conn.read_only = True  # this view can never change the owner's data
    return conn


def db_counts(url: str, tables: list[str]) -> dict[str, int | None]:
    """Row count per table; None for tables that don't exist in the database yet."""
    with _connect(url) as conn:
        existing = {
            r[0]
            for r in conn.execute(
                "select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'"
            ).fetchall()
        }
        present = [t for t in tables if t in existing]
        counts: dict[str, int | None] = {t: None for t in tables}
        if present:
            # One round trip for every table: remote databases are far away.
            query = sql.SQL(" union all ").join(
                sql.SQL("select {}, count(*) from {}").format(sql.Literal(t), sql.Identifier(t)) for t in present
            )
            counts.update({name: count for name, count in conn.execute(query).fetchall()})
    return counts


def db_page(url: str, table: str, offset: int, limit: int) -> dict:
    with _connect(url) as conn:
        ident = sql.Identifier(table)
        total = conn.execute(sql.SQL("select count(*) from {}").format(ident)).fetchone()[0]
        cursor = conn.execute(sql.SQL("select * from {} order by 1 limit %s offset %s").format(ident), (limit, offset))
        columns = [d.name for d in cursor.description or []]
        rows = [[_cell(v) for v in row] for row in cursor.fetchall()]
    return {"columns": columns, "rows": rows, "total": total}


@lru_cache(maxsize=8)
def _sheet(path: str, mtime: float, sheet: str) -> pd.DataFrame:
    file = Path(path)
    frame = _read_csv(file) if file.suffix.lower() == ".csv" else pd.read_excel(file, sheet_name=sheet or 0)
    return frame.dropna(how="all")


def sheet_page(path: Path, sheet: str, offset: int, limit: int) -> dict:
    frame = _sheet(str(path), path.stat().st_mtime, sheet)
    part = frame.iloc[offset : offset + limit]
    return {
        "columns": [str(c) for c in frame.columns],
        "rows": [[_cell(v) for v in row] for row in part.itertuples(index=False, name=None)],
        "total": len(frame),
    }
