# API service (Hono + Prisma)

One folder per resource (`src/modules/<resource>/`), each split into the same layers.
`auth` and `users` are the worked example: copy their shape for every new resource.

```
service/
  src/
    app.ts                   builds the app: CORS, /health, the modules under /api/v1, /docs, errors
    server.ts                local server (the preview)
    config/env.ts            settings from the environment, API_PREFIX = "/api/v1"
    db/prisma.ts             the Prisma client (only repositories import it)
    lib/
      errors.ts              AppError, BadInput, Unauthorized, Forbidden, NotFound, Conflict
      security.ts            password hashing, sign-in tokens
      router.ts              createRouter() and json() for every module
    middlewares/auth.ts      requireUser(...roles): puts the user on c.var.user
    modules/
      <resource>/            e.g. rooms/
        rooms.schemas.ts     request and response shapes (zod, from @hono/zod-openapi)
        rooms.repository.ts  Prisma queries only
        rooms.service.ts     business rules (limits, overlaps, who may change what)
        rooms.routes.ts      HTTP only: createRoute({ tags: ["Rooms"], ... }) per address
  prisma/
    schema.prisma            the data design
    seed.ts                  sample data and the test accounts
  api/index.ts               the Vercel entry point
  Dockerfile                 runs it on your own server (Docker)
```

## Who may import what
- `routes` -> `service` -> `repository` -> `db/prisma`. Never upwards.
- Only routes and middlewares import Hono. Services and repositories never see a Context;
  services throw `lib/errors` (NotFound, Conflict...), which `app.ts` turns into
  `{ error: { code, message } }`.
- Repositories only query and save. No rules, no permissions, no HTTP.
- A module uses another module through its service or repository, never by querying its
  tables directly.
- Nothing new at the top of `src/` or `service/`: new code goes in its module, shared
  helpers in `lib/`.

## Addresses
- Everything under `/api/v1` (`API_PREFIX`), mounted in `app.ts`:
  ``app.route(`${API_PREFIX}/rooms`, roomsRoutes)``. Plural nouns; path parameters as
  `{id}` in `createRoute` (zod-openapi turns them into Hono's `:id`).
- `/health`, `/docs` and `/openapi.json` stay outside the prefix.
- Every address is declared with `createRoute` and ONE tag (the resource's name), so
  `/docs` groups the addresses by resource.
- Answers `{ data: ... }`; errors `{ error: { code, message, fields? } }`.
