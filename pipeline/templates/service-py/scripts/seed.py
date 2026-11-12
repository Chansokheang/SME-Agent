"""Realistic sample data and one test account per role (written in Stage 4). Writes through the
modules' repositories or models; passwords with core.security.hash_password."""

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from sqlalchemy.orm import Session  # noqa: E402

from app import models  # noqa: E402,F401
from app.core.db import engine  # noqa: E402


def main() -> None:
    with Session(engine) as session:
        session.commit()


if __name__ == "__main__":
    main()
