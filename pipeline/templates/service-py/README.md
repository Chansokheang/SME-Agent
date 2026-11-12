# API service (FastAPI + SQLAlchemy)

One folder per resource (`app/modules/<resource>/`), each split into the same layers.
`auth` and `users` are the worked example: copy their shape for every new resource.

```
service/
  app/
    main.py              builds the app: CORS, /health, the routers under /api/v1, error handlers
    models.py            imports every module's models (so the tables get created)
    core/                shared, no business rules
      config.py          settings from the environment, API_PREFIX = "/api/v1"
      db.py              engine, Base, get_session
      security.py        password hashing, sign-in tokens
      errors.py          AppError, BadInput, Unauthorized, Forbidden, NotFound, Conflict + handlers
    api/
      deps.py            DbSession, CurrentUser, require_user(*roles)
      router.py          includes every module's router (one line each)
    modules/
      <resource>/        e.g. rooms/
        models.py        SQLAlchemy tables of this resource
        schemas.py       request and response shapes (pydantic)
        repository.py    database queries only
        service.py       business rules (limits, overlaps, who may change what)
        router.py        HTTP only: APIRouter(prefix="/rooms", tags=["Rooms"])
  scripts/
    db.py                creates the tables
    seed.py              sample data and the test accounts
  api/index.py           the Vercel entry point
  Dockerfile             runs it on your own server (Docker)
```

## Who may import what
- `router` -> `service` -> `repository` -> `models` / `core.db`. Never upwards.
- Only routers (and `api/deps.py`) import FastAPI. Services and repositories never see a
  Request, a Response or an HTTPException: services raise `core.errors` (NotFound,
  Conflict...), which `main.py` turns into `{"error": {"code", "message"}}`.
- Repositories only query and save. No rules, no permissions, no HTTP.
- A module uses another module through its service or repository
  (`from ..rooms import service as rooms_service`), never by querying its tables directly.
- Nothing new at the top of `app/` or `service/`: new code goes in its module, shared
  helpers in `core/`.

## Addresses
- Everything under `/api/v1` (`API_PREFIX`), plural nouns: `/api/v1/rooms`,
  `/api/v1/rooms/{room_id}`, `/api/v1/bookings/mine`.
- `/health`, `/docs` and `/openapi.json` stay outside the prefix.
- Each router sets its prefix and ONE tag (the resource's name), so `/docs` groups the
  addresses by resource.
- Answers `{"data": ...}`; errors `{"error": {"code", "message", "fields"?}}`.
