"""Creates every table (app/modules/*/models.py, listed in app/models.py) in the database at
DATABASE_URL (missing ones only)."""

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from app import models  # noqa: E402,F401  (registers the tables)
from app.core.db import Base, engine  # noqa: E402

Base.metadata.create_all(engine)
print(f"Tables ready: {', '.join(sorted(Base.metadata.tables)) or '(none yet)'}")
