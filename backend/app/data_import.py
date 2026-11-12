"""Importing the owner's own rows into their connected database (Stage 2's Data tab).

The owner picks a source (a spreadsheet they upload, or a table of their existing database), a
table of the design, and which source column fills which field. Gagesite checks every row first
(types, required fields, choices, links to other tables, duplicates) and only then adds them.
Imports only ever ADD rows: nothing is changed or deleted, and a row whose unique value is already
there is skipped. Only the owner sees the rows; Gagesite (the stage AI) never does.
"""

import datetime as dt
import decimal
import json
import re
import threading
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path

import pandas as pd
import psycopg
from psycopg import sql

from .db_connect import CONNECT_TIMEOUT_SECONDS, normalize
from .profiler import _read_csv

IMPORT_DIR = "imports"  # under the workspace's private .uploads folder
FILE_TYPES = {".csv", ".xlsx", ".xls"}
MAX_FILE_BYTES = 50 * 1024 * 1024
MAX_ROWS = 200_000
BATCH = 1000
# Never offered as an import target and hidden in the Data tab: secrets the website makes itself.
SECRET = re.compile(r"password|hash|token|secret|salt", re.I)
TRUE = {"true", "yes", "y", "1", "t", "o", "예", "네", "on", "checked", "x"}
FALSE = {"false", "no", "n", "0", "f", "아니오", "아니요", "off", ""}


class ImportError_(Exception):
    """A plain-language reason the import can't go ahead."""


# ---------------------------------------------------------------- sources

def import_dir(uploads: Path) -> Path:
    path = uploads / IMPORT_DIR
    path.mkdir(parents=True, exist_ok=True)
    return path


def save_upload(uploads: Path, name: str, content: bytes) -> dict:
    suffix = Path(name).suffix.lower()
    if suffix not in FILE_TYPES:
        raise ImportError_("Upload a spreadsheet: a .csv, .xlsx or .xls file.")
    if len(content) > MAX_FILE_BYTES:
        raise ImportError_("That file is over 50 MB. Split it into smaller files and import them one by one.")
    stored = f"{uuid.uuid4().hex[:12]}{suffix}"
    path = import_dir(uploads) / stored
    path.write_bytes(content)
    try:
        sheets = file_sheets(path)
    except Exception as exc:  # noqa: BLE001
        path.unlink(missing_ok=True)
        raise ImportError_(f"Couldn't read that file: {str(exc)[:160]}") from None
    return {"id": stored, "name": Path(name).name, "sheets": sheets}


def file_sheets(path: Path) -> list[dict]:
    if path.suffix.lower() == ".csv":
        frame = read_file(path, "")
        return [{"name": "", "rows": len(frame), "columns": [str(c) for c in frame.columns]}]
    book = pd.read_excel(path, sheet_name=None, dtype=object)
    return [
        {"name": name, "rows": len(frame.dropna(how="all")), "columns": [str(c) for c in frame.columns]}
        for name, frame in book.items()
    ]


_frames: dict[tuple, tuple[float, pd.DataFrame]] = {}


def read_file(path: Path, sheet: str) -> pd.DataFrame:
    key = (str(path), path.stat().st_mtime, sheet)
    if key not in _frames:
        if path.suffix.lower() == ".csv":
            # Everything as text: keeps leading zeros ("00123") and exact numbers.
            frame = None
            for encoding in ("utf-8-sig", "cp949", "latin-1"):
                try:
                    frame = pd.read_csv(path, encoding=encoding, dtype=str, keep_default_na=False)
                    break
                except UnicodeDecodeError:
                    continue
            if frame is None:
                frame = _read_csv(path)
        else:
            frame = pd.read_excel(path, sheet_name=sheet or 0, dtype=object)
        frame = frame.dropna(how="all")
        frame.columns = [str(c).strip() for c in frame.columns]
        if len(_frames) > 6:
            _frames.clear()
        _frames[key] = (time.time(), frame)
    return _frames[key][1]


def read_source_table(url: str, table: str) -> pd.DataFrame:
    with psycopg.connect(normalize(url), connect_timeout=CONNECT_TIMEOUT_SECONDS) as conn:
        conn.read_only = True  # the owner's existing database is never changed
        cursor = conn.execute(sql.SQL("select * from {} limit %s").format(sql.Identifier(table)), (MAX_ROWS + 1,))
        columns = [d.name for d in cursor.description or []]
        return pd.DataFrame(cursor.fetchall(), columns=columns, dtype=object)


def source_tables(url: str) -> list[dict]:
    with psycopg.connect(normalize(url), connect_timeout=CONNECT_TIMEOUT_SECONDS) as conn:
        conn.read_only = True
        names = [r[0] for r in conn.execute(
            "select table_name from information_schema.tables where table_schema = 'public' "
            "and table_type = 'BASE TABLE' order by table_name").fetchall()]
        if not names:
            return []
        query = sql.SQL(" union all ").join(
            sql.SQL("select {}, count(*) from {}").format(sql.Literal(t), sql.Identifier(t)) for t in names)
        counts = dict(conn.execute(query).fetchall())
        columns: dict[str, list[str]] = {}
        for table, column in conn.execute(
                "select table_name, column_name from information_schema.columns where table_schema = 'public' "
                "order by table_name, ordinal_position").fetchall():
            columns.setdefault(table, []).append(column)
    return [{"name": t, "rows": counts.get(t, 0), "columns": columns.get(t, [])} for t in names]


# ---------------------------------------------------------------- the target table

@dataclass
class Column:
    name: str
    data_type: str  # information_schema data_type
    udt: str  # udt_name (enum type name, _text for text[]...)
    required: bool  # NOT NULL with no database default
    has_default: bool
    primary: bool = False
    unique: bool = False
    references: tuple[str, str] | None = None  # (table, column)
    choices: list[str] = field(default_factory=list)  # enum values (database enum or the design's)
    label: str = ""
    hint: str = ""
    auto: str = ""  # what Gagesite fills in when left empty: "id" | "now" | ""

    @property
    def kind(self) -> str:
        t = self.data_type
        if t in ("smallint", "integer", "bigint"):
            return "whole number"
        if t in ("numeric", "real", "double precision"):
            return "number"
        if t == "boolean":
            return "yes / no"
        if t == "date":
            return "date"
        if t.startswith("timestamp"):
            return "date and time"
        if t in ("json", "jsonb"):
            return "data (JSON)"
        if t == "ARRAY":
            return "list"
        if self.choices:
            return "one of a list"
        return "text"

    def cast(self) -> sql.Composable:
        if self.data_type == "USER-DEFINED":
            return sql.Identifier(self.udt)
        if self.data_type == "ARRAY":
            return sql.SQL(self.udt.lstrip("_") + "[]")
        return sql.SQL(self.data_type)


def connect_write(url: str) -> psycopg.Connection:
    return psycopg.connect(normalize(url), connect_timeout=CONNECT_TIMEOUT_SECONDS)


def humanize(name: str, linked: bool = False) -> str:
    """organismId -> "Organism" (a link), taxonomyId -> "Taxonomy ID", createdAt -> "Created at"."""
    if linked and len(name) > 2 and name.endswith(("Id", "_id")):
        name = name[:-3] if name.endswith("_id") else name[:-2]
    words = re.sub(r"([a-z0-9])([A-Z])", r"\1 \2", name).replace("_", " ").split()
    words = ["ID" if w.lower() == "id" else ("URL" if w.lower() == "url" else w.lower()) for w in words]
    text = " ".join(words)
    return text[:1].upper() + text[1:] if text else name


def prisma_choices(prisma_text: str, model: str, enums: dict[str, list[str]]) -> dict[str, list[str]]:
    """Field -> allowed values, for fields typed with an enum or marked with one in a comment (`// ProteinStatus`)."""
    block = re.search(rf"^model\s+{re.escape(model)}\s*\{{(.*?)^\}}", prisma_text or "", re.MULTILINE | re.DOTALL)
    found = {}
    for line in (block.group(1) if block else "").splitlines():
        match = re.match(r"\s*(\w+)\s+(\w+)", line)
        if not match:
            continue
        comment = re.search(r"//\s*(\w+)", line)
        for candidate in (match.group(2), comment.group(1) if comment else ""):
            if candidate in enums:
                found[match.group(1)] = enums[candidate]
    return found


def target_columns(conn: psycopg.Connection, table: str, design_table: dict, enums: dict[str, list[str]],
                   choices_by_field: dict[str, list[str]] | None = None) -> list[Column]:
    rows = conn.execute(
        "select column_name, data_type, udt_name, is_nullable, column_default, is_identity "
        "from information_schema.columns where table_schema = 'public' and table_name = %s order by ordinal_position",
        (table,)).fetchall()
    if not rows:
        raise ImportError_("This table isn't in your database yet. Create the tables first (Connect panel).")
    uniques = {r[0] for r in conn.execute(
        "select a.attname from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey) "
        "where i.indrelid = %s::regclass and i.indisunique and i.indnatts = 1",
        (f'public."{table}"',)).fetchall()}
    primary = {r[0] for r in conn.execute(
        "select a.attname from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey) "
        "where i.indrelid = %s::regclass and i.indisprimary", (f'public."{table}"',)).fetchall()}
    links = {r[0]: (r[1], r[2]) for r in conn.execute(
        "select kcu.column_name, ccu.table_name, ccu.column_name from information_schema.table_constraints tc "
        "join information_schema.key_column_usage kcu on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema "
        "join information_schema.constraint_column_usage ccu on tc.constraint_name = ccu.constraint_name and tc.table_schema = ccu.table_schema "
        "where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public' and tc.table_name = %s", (table,)).fetchall()}
    db_enums: dict[str, list[str]] = {}
    for type_name, label in conn.execute(
            "select t.typname, e.enumlabel from pg_type t join pg_enum e on e.enumtypid = t.oid order by e.enumsortorder").fetchall():
        db_enums.setdefault(type_name, []).append(label)

    design = {c.get("name"): c for c in design_table.get("columns", []) if isinstance(c, dict)}
    columns = []
    for name, data_type, udt, nullable, default, identity in rows:
        spec = design.get(name, {})
        has_default = default is not None or identity == "YES"
        choices = (db_enums.get(udt, []) if data_type == "USER-DEFINED"
                   else (choices_by_field or {}).get(name) or enums.get(str(spec.get("type", "")), []))
        column = Column(
            name=name, data_type=data_type, udt=udt, required=nullable == "NO" and not has_default,
            has_default=has_default, primary=name in primary, unique=name in uniques or name in primary,
            references=links.get(name), choices=choices,
            label=str(spec.get("label") or humanize(name, linked=name in links)),
            hint=str(spec.get("description") or ""),
        )
        if column.required and column.primary and data_type in ("text", "character varying"):
            column.auto = "id"  # Prisma makes cuid() ids itself; the database has no default
        elif column.required and data_type.startswith("timestamp") and name.lower() in ("updatedat", "createdat", "updated_at", "created_at"):
            column.auto = "now"
        columns.append(column)
    return columns


def column_info(column: Column) -> dict:
    return {
        "name": column.name, "label": column.label, "hint": column.hint, "kind": column.kind,
        "required": column.required and not column.auto, "auto": column.auto, "has_default": column.has_default,
        "primary": column.primary, "unique": column.unique, "choices": column.choices[:40],
        "references": {"table": column.references[0], "column": column.references[1]} if column.references else None,
        "secret": bool(SECRET.search(column.name)),
    }


def link_columns(conn: psycopg.Connection, table: str) -> list[str]:
    """Columns of a linked table that can identify a row (to match by name instead of id)."""
    rows = conn.execute(
        "select column_name, data_type from information_schema.columns where table_schema = 'public' and table_name = %s "
        "order by ordinal_position", (table,)).fetchall()
    return [name for name, data_type in rows
            if data_type in ("text", "character varying", "integer", "bigint") and not SECRET.search(name)][:12]


# ---------------------------------------------------------------- matching

def _key(text: str) -> str:
    return re.sub(r"[^a-z0-9가-힣]", "", str(text).lower())


def suggest(columns: list[Column], source_columns: list[str], hints: dict[str, str]) -> list[dict]:
    """A first guess at which source column fills which field: same name, the design's label, or its noted source."""
    by_key = {_key(c): c for c in source_columns}
    used: set[str] = set()
    mapping = []
    for column in columns:
        if SECRET.search(column.name) or (column.has_default and column.primary):
            continue
        found = None
        for candidate in (hints.get(column.name, ""), column.name, column.label,
                          column.name.removesuffix("Id"), column.name.removesuffix("_id")):
            source = by_key.get(_key(candidate)) if candidate else None
            if source and source not in used:
                found = source
                break
        if found:
            used.add(found)
        mapping.append({"column": column.name, "from": found, "value": None, "match": None})
    return mapping


# ---------------------------------------------------------------- checking and converting

def _empty(value) -> bool:
    if value is None:
        return True
    if isinstance(value, float) and pd.isna(value):
        return True
    try:
        if pd.isna(value) is True:
            return True
    except (TypeError, ValueError):
        pass
    return isinstance(value, str) and not value.strip()


def _text(value) -> str:
    if isinstance(value, float) and value.is_integer():
        return str(int(value))  # Excel stores 123 as 123.0
    if isinstance(value, (pd.Timestamp, dt.datetime)):
        return value.isoformat()
    return str(value).strip()


def convert(column: Column, value):
    """The value as the database wants it, or raises ValueError with a plain reason."""
    kind = column.kind
    if kind == "whole number":
        if isinstance(value, bool):
            raise ValueError("not a whole number")
        number = decimal.Decimal(re.sub(r"[,\s]", "", _text(value)))
        if number != number.to_integral_value():
            raise ValueError("not a whole number")
        return int(number)
    if kind == "number":
        try:
            return decimal.Decimal(re.sub(r"[,\s₩$€£%]", "", _text(value)))
        except decimal.InvalidOperation:
            raise ValueError("not a number") from None
    if kind == "yes / no":
        text = _text(value).lower()
        if text in TRUE:
            return True
        if text in FALSE:
            return False
        raise ValueError("not yes or no")
    if kind in ("date", "date and time"):
        stamp = value if isinstance(value, (dt.datetime, dt.date)) else pd.to_datetime(_text(value), errors="raise")
        if isinstance(stamp, pd.Timestamp):
            stamp = stamp.to_pydatetime()
        if kind == "date":
            return stamp.date() if isinstance(stamp, dt.datetime) else stamp
        return stamp if isinstance(stamp, dt.datetime) else dt.datetime.combine(stamp, dt.time())
    if kind == "data (JSON)":
        text = _text(value)
        try:
            json.loads(text)
            return text
        except json.JSONDecodeError:
            return json.dumps(text, ensure_ascii=False)
    if kind == "list":
        if isinstance(value, (list, tuple)):
            return list(value)
        return [part.strip() for part in re.split(r"[;,\n]", _text(value)) if part.strip()]
    text = _text(value)
    if column.choices:
        for choice in column.choices:
            if _key(choice) == _key(text):
                return choice
        raise ValueError("not one of the choices")
    return text


REASONS = {
    "not a whole number": "isn't a whole number",
    "not a number": "isn't a number",
    "not yes or no": "isn't yes or no",
    "not one of the choices": "isn't one of the allowed choices",
}


@dataclass
class Checked:
    table: str
    columns: list[str]
    casts: list[sql.Composable]
    rows: list[list]  # converted rows ready to add
    total: int
    problems: list[dict]
    skipped_invalid: int
    duplicates_file: int
    duplicates_db: int
    sample: list[dict]


def check(conn: psycopg.Connection, table: str, columns: list[Column], frame: pd.DataFrame, mapping: list[dict],
          first_row: int = 2) -> Checked:
    """Converts and checks every row. first_row: the number the owner sees for the first data row (2 under a header)."""
    if len(frame) > MAX_ROWS:
        raise ImportError_(f"That source has more than {MAX_ROWS:,} rows. Split it and import the parts one by one.")
    by_name = {c.name: c for c in columns}
    plan = [m for m in mapping if m.get("column") in by_name and (m.get("from") or not _empty(m.get("value")))]
    for m in plan:
        if m.get("from") and m["from"] not in frame.columns:
            raise ImportError_(f'The column "{m["from"]}" isn\'t in this source.')
        if SECRET.search(m["column"]):
            raise ImportError_(f"{m['column']} is made by the website itself and can't be imported.")
    filled = {m["column"] for m in plan}
    problems: dict[tuple[str, str], list[int]] = {}

    def problem(column: str, reason: str, row: int) -> None:
        problems.setdefault((column, reason), []).append(row)

    missing = [c for c in columns if c.required and not c.auto and c.name not in filled]
    if missing:
        names = ", ".join(c.label or c.name for c in missing)
        raise ImportError_(f"These fields are required: choose a column or a value for each: {names}.")

    # Links to other tables: matched by id, or by another column of the linked table (e.g. a name).
    lookups: dict[str, dict[str, object]] = {}
    for m in plan:
        column = by_name[m["column"]]
        if column.references:
            other, other_id = column.references
            match = m.get("match") or other_id
            found = conn.execute(sql.SQL("select {}, {} from {}").format(
                sql.Identifier(match), sql.Identifier(other_id), sql.Identifier(other))).fetchall()
            lookups[column.name] = {_key(_text(k)): v for k, v in found if k is not None}

    autos = [c for c in columns if c.auto and c.name not in filled]
    names = [m["column"] for m in plan] + [c.name for c in autos]
    casts = [by_name[n].cast() for n in names]
    rows: list[list] = []
    invalid = 0
    now = dt.datetime.now(dt.timezone.utc).replace(tzinfo=None)
    records = frame.to_dict("records")
    for index, record in enumerate(records, start=first_row):
        out, bad = [], False
        for m in plan:
            column = by_name[m["column"]]
            raw = record.get(m["from"]) if m.get("from") else m.get("value")
            if _empty(raw):
                if column.required:
                    problem(column.name, "is empty but required", index)
                    bad = True
                out.append(None)
                continue
            if column.name in lookups:
                value = lookups[column.name].get(_key(_text(raw)))
                if value is None:
                    problem(column.name, f"doesn't match any {column.references[0]}", index)
                    bad = True
                out.append(value)
                continue
            try:
                out.append(convert(column, raw))
            except (ValueError, decimal.InvalidOperation, TypeError, OverflowError) as exc:
                reason = REASONS.get(str(exc), "isn't a valid " + column.kind)
                problem(column.name, reason, index)
                out.append(None)
                bad = True
        for column in autos:
            out.append("c" + uuid.uuid4().hex[:24] if column.auto == "id" else now)
        if bad:
            invalid += 1
        else:
            rows.append(out)

    # Duplicates: unique values repeated in the source, or already in the database. Both are skipped.
    dup_file = dup_db = 0
    for i, name in enumerate(names):
        column = by_name[name]
        if not column.unique or column.auto:
            continue
        seen, kept = set(), []
        for row in rows:
            key = row[i]
            if key is not None and key in seen:
                dup_file += 1
                continue
            seen.add(key)
            kept.append(row)
        rows = kept
        values = [row[i] for row in rows if row[i] is not None]
        existing: set = set()
        for start in range(0, len(values), 5000):
            chunk = values[start:start + 5000]
            existing |= {r[0] for r in conn.execute(
                sql.SQL("select {col} from {table} where {col} = any(%s::{cast}[])").format(
                    col=sql.Identifier(name), table=sql.Identifier(table), cast=column.cast()), (chunk,)).fetchall()}
        if existing:
            before = len(rows)
            rows = [row for row in rows if row[i] not in existing]
            dup_db += before - len(rows)

    sample = [{n: (str(v) if isinstance(v, (dt.date, dt.datetime, decimal.Decimal)) else v)
               for n, v in zip(names, row)} for row in rows[:5]]
    listed = [
        {"column": column, "label": by_name[column].label or column, "reason": reason, "count": len(found), "rows": found[:8]}
        for (column, reason), found in sorted(problems.items(), key=lambda item: -len(item[1]))
    ]
    return Checked(table, names, casts, rows, len(records), listed, invalid, dup_file, dup_db, sample)


def checked_summary(checked: Checked) -> dict:
    return {
        "total": checked.total,
        "ready": len(checked.rows),
        "invalid": checked.skipped_invalid,
        "duplicates_file": checked.duplicates_file,
        "duplicates_db": checked.duplicates_db,
        "problems": checked.problems[:30],
        "sample": checked.sample,
        "columns": checked.columns,
    }


# ---------------------------------------------------------------- adding the rows

@dataclass
class Job:
    table: str
    total: int
    status: str = "running"  # running | done | failed
    added: int = 0
    skipped: int = 0
    error: str | None = None
    started: float = field(default_factory=time.time)
    finished: float | None = None


jobs: dict[str, Job] = {}
_lock = threading.Lock()


def running(project_id: str) -> bool:
    job = jobs.get(project_id)
    return bool(job and job.status == "running")


def start(project_id: str, url: str, checked: Checked, label: str, on_done=None) -> Job:
    with _lock:
        if running(project_id):
            raise ImportError_("An import is already running for this website.")
        job = Job(table=label, total=len(checked.rows))
        jobs[project_id] = job

    def work() -> None:
        try:
            with connect_write(url) as conn:
                with conn.transaction():  # all or nothing
                    table = sql.Identifier(checked.table)
                    before = conn.execute(sql.SQL("select count(*) from {}").format(table)).fetchone()[0]
                    statement = sql.SQL("insert into {} ({}) values ({}) on conflict do nothing").format(
                        table,
                        sql.SQL(", ").join(sql.Identifier(c) for c in checked.columns),
                        sql.SQL(", ").join(sql.SQL("cast(%s as {})").format(cast) for cast in checked.casts),
                    )
                    with conn.cursor() as cursor:
                        for start_at in range(0, len(checked.rows), BATCH):
                            part = checked.rows[start_at:start_at + BATCH]
                            cursor.executemany(statement, part)
                            job.added = min(start_at + len(part), job.total)  # progress (final count below)
                    after = conn.execute(sql.SQL("select count(*) from {}").format(table)).fetchone()[0]
                    # Tables with counter ids: move the counter past the new rows.
                    for column, default in conn.execute(
                            "select column_name, column_default from information_schema.columns where table_schema = 'public' "
                            "and table_name = %s and column_default like 'nextval%%'", (checked.table,)).fetchall():
                        conn.execute(sql.SQL("select setval(pg_get_serial_sequence({t}, {c}), "
                                             "greatest(coalesce((select max({col}) from {table}), 0), 1))").format(
                            t=sql.Literal(f'public."{checked.table}"'), c=sql.Literal(column),
                            col=sql.Identifier(column), table=table))
            job.added = after - before
            job.skipped = job.total - job.added
            job.status = "done"
        except Exception as exc:  # noqa: BLE001
            job.status = "failed"
            job.error = friendly_error(exc)
            job.added = 0
        finally:
            job.finished = time.time()
            if on_done:
                on_done(job)

    threading.Thread(target=work, daemon=True).start()
    return job


def friendly_error(exc: Exception) -> str:
    text = str(exc).splitlines()[0][:220] if str(exc) else type(exc).__name__
    if "permission denied" in text:
        return "Your database didn't allow adding rows with this connection (permission denied). Nothing was added."
    return f"The database refused the import, so nothing was added: {text}"


def job_info(project_id: str) -> dict | None:
    job = jobs.get(project_id)
    if not job:
        return None
    return {"table": job.table, "status": job.status, "total": job.total, "added": job.added, "skipped": job.skipped,
            "error": job.error, "seconds": round((job.finished or time.time()) - job.started)}
