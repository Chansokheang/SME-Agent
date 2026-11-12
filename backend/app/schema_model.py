"""Schema for Stage 2's main output, docs/02-schema.json (the UI renders the ERD and tables from it)."""

from typing import Literal

from pydantic import BaseModel, ValidationError, model_validator

ColumnType = Literal["String", "Int", "Float", "Decimal", "Boolean", "DateTime", "Json", "Enum"]


class Reference(BaseModel):
    table: str
    column: str


class Column(BaseModel):
    name: str
    type: ColumnType
    enum: str | None = None
    required: bool = True
    unique: bool = False
    primary: bool = False
    references: Reference | None = None
    description: str = ""
    example: str = ""
    # Where existing data comes from, e.g. "customers.xlsx > Sheet1 > Phone".
    source: str | None = None


class Table(BaseModel):
    name: str
    label: str = ""
    description: str = ""
    columns: list[Column]


class Relation(BaseModel):
    from_table: str
    to_table: str
    type: Literal["one-to-one", "one-to-many", "many-to-many"]
    label: str = ""


class EnumDef(BaseModel):
    name: str
    values: list[str]


class DataSource(BaseModel):
    file: str
    sheet: str = ""
    # None when the sheet deliberately isn't imported (explained in notes).
    maps_to: str | None = None
    rows: int | None = None
    notes: str = ""


class DataIssue(BaseModel):
    severity: Literal["info", "warning"] = "warning"
    message: str
    source: str = ""


class ContentFile(BaseModel):
    """Without a database, where the site's content lives (files that ship with the site)."""

    file: str  # e.g. "content/menu.json"
    holds: str = ""  # e.g. "Menu items with prices, in Korean and English"


class EmailForm(BaseModel):
    """Without a database, a form that emails its answers instead of storing them."""

    form: str  # e.g. "Reservation request"
    to: str = ""  # who receives it, e.g. "Owner"
    note: str = ""  # what changes compared with storing it


class DatabaseSchema(BaseModel):
    version: int = 1
    status: Literal["draft", "ready"] = "draft"
    # "none": a simple site with no database: content in files, forms by email, no admin page.
    mode: Literal["database", "none"] = "database"
    content_files: list[ContentFile] = []
    email_forms: list[EmailForm] = []
    # Without a database: what the approved plan loses (e.g. "Owner log in: needs a database...").
    left_out: list[str] = []
    tables: list[Table] = []
    relations: list[Relation] = []
    enums: list[EnumDef] = []
    data_sources: list[DataSource] = []
    data_issues: list[DataIssue] = []
    assumptions: list[str] = []
    open_questions: list[str] = []

    @model_validator(mode="after")
    def references_resolve(self) -> "DatabaseSchema":
        tables = {t.name: {c.name for c in t.columns} for t in self.tables}
        enums = {e.name for e in self.enums}
        problems = []
        for table in self.tables:
            if not any(c.primary for c in table.columns):
                problems.append(f"table {table.name} has no primary key column")
            for col in table.columns:
                ref = col.references
                if ref and (ref.table not in tables or ref.column not in tables[ref.table]):
                    problems.append(f"{table.name}.{col.name} references missing {ref.table}.{ref.column}")
                if col.type == "Enum" and col.enum not in enums:
                    problems.append(f"{table.name}.{col.name} uses undefined enum {col.enum}")
        for rel in self.relations:
            for name in (rel.from_table, rel.to_table):
                if name not in tables:
                    problems.append(f"relation mentions missing table {name}")
        if self.status == "ready" and self.mode == "database" and not self.tables:
            problems.append("status is 'ready' but there are no tables")
        if self.status == "ready" and self.mode == "none" and not self.content_files:
            problems.append("status is 'ready' but content_files is empty (where the site's content lives)")
        if problems:
            raise ValueError("; ".join(problems))
        return self


def validate_schema(raw: dict) -> tuple[DatabaseSchema | None, list[str]]:
    try:
        return DatabaseSchema.model_validate(raw), []
    except ValidationError as exc:
        errors = []
        for err in exc.errors():
            location = ".".join(str(part) for part in err["loc"]) or "(root)"
            errors.append(f"{location}: {err['msg']}".removeprefix("(root): Value error, "))
        return None, errors
