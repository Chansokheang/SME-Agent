"""Stage 2 without a database: the simple-site design, written straight from the approved plan.

Picking "No database" needs no conversation: there are no tables to design. This turns the plan
into docs/02-schema.json (mode "none") and a short docs/02-database.md for the next stages:
what content the site carries, which forms arrive by email, and what the plan loses.
"""

import re

# Plan features that only work with stored data and a log in.
NEEDS_DATABASE = re.compile(
    r"log ?in|sign ?in|sign ?up|admin|dashboard|manage|edit|confirm|approve|decline|account|member|"
    r"관리|로그인|회원",
    re.IGNORECASE,
)
# Things visitors send in, rather than content the owner publishes.
SUBMISSION = re.compile(
    r"reservation|booking|request|order|inquiry|enquiry|message|application|submission|review|예약|문의|주문",
    re.IGNORECASE,
)
PEOPLE = re.compile(r"\b(user|account|admin|owner|staff|member|customer)s?\b|회원|관리자", re.IGNORECASE)
FORM_PAGE = re.compile(r"form|reserve|booking|contact|inquiry|enquiry|order|apply|예약|문의", re.IGNORECASE)


def slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug or "content"


def build(scope: dict) -> tuple[dict, str]:
    """(02-schema.json data, 02-database.md text) for a site with no database."""
    business = (scope.get("business") or {}).get("name") or "the business"

    content_files = [
        {
            "file": "content/site.json",
            "holds": f"Details about {business}: name, introduction, contact details, address, opening hours and links.",
        }
    ]
    submitted = []
    for entity in scope.get("entities") or []:
        name = str(entity.get("name") or "").strip()
        if not name or PEOPLE.search(name):
            continue
        if SUBMISSION.search(name):
            submitted.append(name)
            continue
        fields = ", ".join(str(f) for f in (entity.get("fields") or [])[:6])
        holds = entity.get("description") or name
        content_files.append({"file": f"content/{slugify(name)}.json", "holds": f"{holds}{f' ({fields})' if fields else ''}"})

    # Forms: what the owner is told about by email, else pages that collect something.
    email_forms = []
    for note in scope.get("notifications") or []:
        to = str(note.get("to") or "")
        if note.get("channel") == "email" and not re.search(r"visitor|customer|guest", to, re.IGNORECASE):
            form = re.sub(r"^new\s+", "", str(note.get("name") or ""), flags=re.IGNORECASE).strip()
            if form:
                email_forms.append({"form": form[:1].upper() + form[1:], "to": to or "Owner"})
    if not email_forms:
        for page in scope.get("pages") or []:
            text = f"{page.get('name', '')} {' '.join(page.get('sections') or [])}"
            if FORM_PAGE.search(text):
                email_forms.append({"form": f"{page.get('name', 'Contact')} form", "to": "Owner"})
    if not email_forms and submitted:
        email_forms = [{"form": f"{name} request", "to": "Owner"} for name in submitted]
    for form in email_forms:
        form["note"] = "Arrives as an email. There is no list to manage it in: you reply to the sender by phone or email."

    left_out = [
        f"{f.get('name')}: not included, because it needs a database and an admin page."
        for f in scope.get("features") or []
        if NEEDS_DATABASE.search(f"{f.get('name', '')}")
    ]
    left_out += [f"Saved {name.lower()} records: each one arrives by email instead." for name in submitted]

    schema = {
        "version": 1,
        "status": "ready",
        "mode": "none",
        "content_files": content_files,
        "email_forms": email_forms,
        "left_out": left_out,
        "tables": [],
        "relations": [],
        "enums": [],
        "data_sources": [],
        "data_issues": [],
        "assumptions": [
            "The owner chose no database: the site's content ships with it in files, forms are emailed, and there is no admin page.",
            "Changing content later (a price, the opening hours) means asking Gagesite to update the site.",
        ],
        "open_questions": [],
    }

    lines = [
        "# Data design: a simple site",
        "",
        "The owner chose **no database**. The website's content ships with it in files, forms are sent by email, "
        "and there is no admin or log-in page.",
        "",
        "## Content in the website",
        *[f"- `{f['file']}`: {f['holds']}" for f in content_files],
        "",
        "## Forms sent by email",
        *([f"- {f['form']} (to {f['to']}): {f['note']}" for f in email_forms] or ["- None."]),
    ]
    if left_out:
        lines += ["", "## Not included from the plan", *[f"- {item}" for item in left_out]]
    return schema, "\n".join(lines) + "\n"
