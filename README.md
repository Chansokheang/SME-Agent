# Gagesite (prototype)

Websites for every small shop (가게).

Gagesite is an AI website builder for small businesses. The owner talks to it stage by stage, and
each stage is a Claude Code run (`claude -p`) inside that project's own folder. The owner reviews
and approves every stage before the next one starts. At the end, the website runs in the owner's
own accounts (GitHub, database, Vercel, or their own server).

## The five stages

| Stage | What happens | Output (in the project's `docs/`) |
|---|---|---|
| 1. Feature Analysis & Scope | Chat interview. The owner can attach documents (menu, price list, PDF) and links. A live plan updates as they talk. | `01-scope.json`, `01-scope.md` |
| 2. Database Design | Design from the plan, or from the owner's Excel / CSV / SQL file or an existing Postgres. Data is profiled (Claude sees column statistics, never raw rows). ERD, a Data tab, and import into the owner's database. "No database" is also an option. | `02-schema.json`, Prisma schema |
| 3. UI Design | The owner adds a logo, colours, photos, style notes, an optional 3D model. Gagesite's designer, or optionally Google Stitch, draws 3 styles. The owner picks one, then agrees the design library and key pages. | `03-design-kit.json`, `03-design/` |
| 4. Implementation | An agent team (Advisor, Developer, API developer, QA) builds the Next.js website, plus a dedicated Python or TypeScript API when needed, with a live preview. | `site/`, `service/` |
| 5. Deployment | Code to the owner's GitHub, tables to their Postgres, website to their Vercel. A dedicated API can run on Vercel or on the owner's own server in Docker, with an automatic address, auto-update and a live smoke test. | live website and API |

When an idea needs its own AI model (vision, speech, a custom chatbot, predictions), Stage 1
offers Gagesite's GPU services: deploy, train or run the model for the owner.

## Layout
```
backend/                 FastAPI app (Python 3.12, SQLModel, uv)
  app/main.py              HTTP API and Server-Sent Events streaming
  app/runner.py            runs `claude -p` and turns its output into events
  app/stages.py            stage definitions
  app/build_team.py        Stage 4 agent team
  app/deploy_runner.py     Stage 5: GitHub -> database -> Vercel
  app/api_server.py        Stage 5: dedicated API on this computer or the owner's server
web/                     Next.js app (the Gagesite UI)
pipeline/
  stages/<stage>/          instructions for each stage (system.md, roles, rules)
  patterns/                design research: page types, site types
  templates/
    workspace/               copied into every new project (CLAUDE.md, Stop hook, helpers)
    site/                    starter Next.js website
    service-py/, service-ts/ starter dedicated APIs (FastAPI / TypeScript + Prisma)
scripts/                 pack_data.py (move data to a server), tunnel.ps1 / tunnel.sh
docs/                    DEPLOY.md (server setup), plans/
data/                    generated, not in git: app.db, secret.key, research, server keys
workspaces/<project-id>/ generated, not in git: one folder per project
```

## Database
Gagesite keeps its own data in **SQLite**: `data/app.db` (projects, stages, runs, deployments,
settings). Saved passwords, tokens and keys are encrypted with `data/secret.key`. Don't lose that
key, and never share it. The websites Gagesite builds use the owner's own database, usually
PostgreSQL (Supabase, Neon or any Postgres), connected in Stage 2.

## How a stage run works
1. The UI sends a message. The backend starts `claude -p` in the project's workspace with the
   stage's instructions appended to the system prompt. It uses a new session for the first message
   and `--resume` after that.
2. `--setting-sources project --strict-mcp-config` keeps the host's own Claude Code plugins, hooks
   and MCP servers out of the run. Only the workspace's settings apply. Optional extras, like
   Google Stitch, are passed in per run.
3. Output is streamed to the browser over Server-Sent Events.
4. A Stop hook blocks Claude from finishing until the stage's files are valid. The backend checks
   them again with Pydantic before the UI shows them.
5. **Approve** records the file hashes in `docs/pipeline.json` and unlocks the next stage.

## Run locally (Windows / macOS / Linux)
Needs Python 3.12+, [uv](https://docs.astral.sh/uv/), Node 22, Docker (only for the
dedicated-API "this computer" option) and Claude Code signed in (`claude`).

```bash
cd backend && uv sync && uv run uvicorn app.main:app --port 8001
```
```bash
cd web && npm install && npm run dev
```
Open http://localhost:3000. The backend uses port 8001 because VS Code often holds 8000.
Website previews use ports 3100-3119, and their APIs use 4100-4119.

The Claude account is chosen at the top right of the app. "This computer's login" is your
`claude` sign-in. You can also add accounts with a token from `claude setup-token`.

## Run with Docker (server)
See [docs/DEPLOY.md](docs/DEPLOY.md). In short:

```bash
cp .env.example .env
```
```bash
docker compose up -d --build
```
Then open it from your computer through the SSH tunnel (`scripts/tunnel.ps1` or `scripts/tunnel.sh`).
Gagesite has **no sign-in**, so it listens on the server itself only (`BIND_HOST=127.0.0.1`).

## Settings (`.env`, Docker only)
| Name | Meaning |
|---|---|
| `CLAUDE_CODE_OAUTH_TOKEN` | Token from `claude setup-token`; becomes "This computer's login" |
| `MAX_CONCURRENT_RUNS` | AI runs allowed at once (default 3) |
| `GAGESITE_UID`, `DOCKER_GID` | Your server user id and Docker group id |
| `BIND_HOST` | Where Gagesite listens (keep `127.0.0.1`) |
| `PUBLIC_API_URL` | The backend address as the browser sees it |

Owners' own keys (GitHub, Vercel, database, Stitch, email and so on) are entered in the app and
stored encrypted. They are never put in `.env`.

## Usage note
This prototype runs on a Claude subscription through `claude -p`, so it's for demos that you
operate yourself. Before real customers use it, switch to an Anthropic API key
(`ANTHROPIC_API_KEY`). The CLI reads it automatically, so no code changes are needed.
