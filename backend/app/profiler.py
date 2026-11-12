"""Profiles uploaded business data (Excel, CSV, SQL schema) for Stage 2.

Claude never sees the raw rows. It gets per-column statistics and a few masked samples,
which is enough to design a schema and keeps customer data (names, phones, emails) private.
"""

import json
import re
from dataclasses import asdict, dataclass, field
from pathlib import Path

import pandas as pd

SPREADSHEET_EXTENSIONS = {".xlsx", ".xlsm", ".xls", ".csv"}
SQL_EXTENSIONS = {".sql"}
ALLOWED_EXTENSIONS = SPREADSHEET_EXTENSIONS | SQL_EXTENSIONS
MAX_UPLOAD_BYTES = 20 * 1024 * 1024
SAMPLE_COUNT = 5
MAX_SQL_CHARS = 20_000

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
DATE_RE = re.compile(r"^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}([ T]\d{1,2}:\d{2}(:\d{2})?)?$")
PHONE_RE = re.compile(r"^\+?[\d\s\-().]{8,}$")
# Headers that usually hold personal data, in English and Korean.
PERSONAL_HINTS = ("name", "phone", "mobile", "tel", "email", "mail", "address", "birth",
                  "이름", "성명", "전화", "연락처", "휴대", "이메일", "주소", "생년")


@dataclass
class ColumnProfile:
    name: str
    inferred_type: str
    filled_percent: float
    unique_count: int
    samples: list[str]
    personal: bool = False


@dataclass
class SheetProfile:
    name: str
    rows: int
    columns: list[ColumnProfile] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)


@dataclass
class FileProfile:
    file: str
    kind: str  # spreadsheet | sql | database (an existing database the owner connected)
    sheets: list[SheetProfile] = field(default_factory=list)
    sql_excerpt: str | None = None
    error: str | None = None


def _mask(value: str, personal: bool) -> str:
    if EMAIL_RE.match(value):
        user, domain = value.split("@", 1)
        return f"{user[:1]}***@{domain}"
    digits = re.sub(r"\D", "", value)
    if PHONE_RE.match(value) and len(digits) >= 8 and not DATE_RE.match(value):
        return f"***-****-{digits[-4:]}"
    if personal:
        return value[:1] + "***" if value else value
    return value[:60]


def _infer_type(series: pd.Series) -> str:
    values = series.dropna().astype(str).str.strip()
    values = values[values != ""]
    if values.empty:
        return "empty"
    sample = values.head(200)
    if pd.api.types.is_datetime64_any_dtype(series) or sample.str.fullmatch(DATE_RE.pattern).mean() > 0.8:
        return "datetime"
    if sample.str.fullmatch(EMAIL_RE.pattern).mean() > 0.8:
        return "email"
    if sample.str.fullmatch(PHONE_RE.pattern).mean() > 0.8 and sample.str.replace(r"\D", "", regex=True).str.len().min() >= 8:
        return "phone"
    if sample.str.lower().isin(["true", "false", "yes", "no", "y", "n", "0", "1", "o", "x"]).mean() > 0.95:
        return "boolean"
    numeric = pd.to_numeric(sample.str.replace(",", ""), errors="coerce")
    if numeric.notna().mean() > 0.9:
        return "integer" if (numeric.dropna() % 1 == 0).all() else "decimal"
    if pd.api.types.is_datetime64_any_dtype(series):
        return "datetime"
    dates = pd.to_datetime(sample, errors="coerce", format="mixed")
    if dates.notna().mean() > 0.8:
        return "datetime"
    return "text"


def _profile_frame(name: str, frame: pd.DataFrame) -> SheetProfile:
    frame = frame.dropna(how="all").dropna(axis=1, how="all")
    sheet = SheetProfile(name=name, rows=len(frame))
    unnamed = [str(c) for c in frame.columns if str(c).startswith("Unnamed")]
    if unnamed:
        sheet.notes.append(f"{len(unnamed)} column(s) have no header; the header row may be missing or merged.")
    if frame.duplicated().any():
        sheet.notes.append(f"{int(frame.duplicated().sum())} fully duplicated row(s).")
    for column in frame.columns:
        series = frame[column]
        header = str(column)
        personal = any(hint in header.lower() for hint in PERSONAL_HINTS)
        filled = float(series.notna().mean() * 100) if len(series) else 0.0
        non_empty = series.dropna().astype(str).str.strip()
        non_empty = non_empty[non_empty != ""]
        samples = [_mask(v, personal) for v in non_empty.drop_duplicates().head(SAMPLE_COUNT)]
        inferred = _infer_type(series)
        sheet.columns.append(ColumnProfile(
            name=header,
            inferred_type=inferred,
            filled_percent=round(filled, 1),
            unique_count=int(non_empty.nunique()),
            samples=samples,
            personal=personal or inferred in ("email", "phone"),
        ))
    return sheet


def _read_csv(path: Path) -> pd.DataFrame:
    # Korean spreadsheets exported from Excel are often CP949, not UTF-8.
    for encoding in ("utf-8-sig", "cp949", "latin-1"):
        try:
            return pd.read_csv(path, encoding=encoding)
        except UnicodeDecodeError:
            continue
    raise ValueError("Could not read the CSV file's text encoding.")


def profile_file(path: Path) -> FileProfile:
    suffix = path.suffix.lower()
    try:
        if suffix in SQL_EXTENSIONS:
            text = path.read_text(encoding="utf-8", errors="replace")
            # Keep only structure: CREATE TABLE / TYPE / INDEX statements, never INSERT data.
            statements = re.findall(r"CREATE\s+(?:TABLE|TYPE|UNIQUE\s+INDEX|INDEX)[\s\S]*?;", text, re.IGNORECASE)
            excerpt = "\n\n".join(statements)[:MAX_SQL_CHARS]
            if not excerpt:
                return FileProfile(file=path.name, kind="sql", error="No CREATE TABLE statements found in this file.")
            return FileProfile(file=path.name, kind="sql", sql_excerpt=excerpt)
        if suffix == ".csv":
            return FileProfile(file=path.name, kind="spreadsheet", sheets=[_profile_frame(path.stem, _read_csv(path))])
        workbook = pd.read_excel(path, sheet_name=None)
        sheets = [_profile_frame(name, frame) for name, frame in workbook.items() if not frame.dropna(how="all").empty]
        return FileProfile(file=path.name, kind="spreadsheet", sheets=sheets)
    except Exception as exc:  # malformed files should show up as an error card, not crash the upload
        return FileProfile(file=path.name, kind="sql" if suffix in SQL_EXTENSIONS else "spreadsheet", error=str(exc))


def profile_to_markdown(profiles: list[FileProfile]) -> str:
    lines = [
        "# Uploaded business data (profile)",
        "",
        "Generated by the platform from the owner's uploads. Raw rows are NOT included; samples are",
        "masked. Use this to design tables and fill `data_sources` and column `source` fields.",
        "",
    ]
    for profile in profiles:
        lines.append(f"## File: {profile.file}")
        if profile.error:
            lines += [f"Could not read this file: {profile.error}", ""]
            continue
        if profile.sql_excerpt:
            lines += ["Existing database structure (CREATE statements only):", "", "```sql", profile.sql_excerpt, "```", ""]
            if not profile.sheets:
                continue
            # A connected database also has per-table statistics and masked samples below.
        for sheet in profile.sheets:
            lines += [f"### Sheet: {sheet.name} ({sheet.rows} rows)", ""]
            lines += [f"- Note: {note}" for note in sheet.notes]
            lines += ["", "| Column | Looks like | Filled | Unique | Samples (masked) |", "|---|---|---|---|---|"]
            for col in sheet.columns:
                samples = ", ".join(col.samples).replace("|", "/")
                lines.append(
                    f"| {col.name} | {col.inferred_type}{' (personal)' if col.personal else ''} "
                    f"| {col.filled_percent}% | {col.unique_count} | {samples} |"
                )
            lines.append("")
    return "\n".join(lines)


def profiles_to_json(profiles: list[FileProfile]) -> str:
    return json.dumps([asdict(p) for p in profiles], ensure_ascii=False, indent=2)


def profile_from_dict(data: dict) -> FileProfile:
    """The reverse of profiles_to_json, for a profile that was stored (a connected database)."""
    sheets = [
        SheetProfile(
            name=s["name"],
            rows=s["rows"],
            columns=[ColumnProfile(**c) for c in s.get("columns", [])],
            notes=s.get("notes", []),
        )
        for s in data.get("sheets", [])
    ]
    return FileProfile(
        file=data["file"], kind=data["kind"], sheets=sheets, sql_excerpt=data.get("sql_excerpt"), error=data.get("error")
    )
