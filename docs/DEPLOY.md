# Running Gagesite on a server (Docker Compose)

Gagesite runs in two containers (`compose.yml`): the backend (FastAPI, Claude Code, Node, Python,
Chromium, the Docker CLI) and the web app. They use the server's own network, and listen on the
server itself only (`127.0.0.1`). You open Gagesite through an SSH tunnel, so nothing new is
reachable from the internet. **Gagesite has no sign-in**: anyone who can open it can run Claude on
your account and use your saved connections. Keep `BIND_HOST=127.0.0.1` unless you're sure who
can reach the server.

Ports used on the server: 3000 (web), 8001 (backend), 3100-3119 (website previews), 4100-4119
(their APIs). APIs you put on "this computer" in Stage 5 run on the server's Docker.

## 1. Put the code on the server
Copy the repository to the server, e.g. `~/gagesite-app` (without `data/`, `workspaces/`,
`node_modules/`, `.venv/`). With git: `git clone <your repo> ~/gagesite-app`.

## 2. Settings
```bash
cd ~/gagesite-app
cp .env.example .env
id -u                       # -> GAGESITE_UID in .env
getent group docker         # the number -> DOCKER_GID in .env
```
For Claude, either paste a token from `claude setup-token` into `CLAUDE_CODE_OAUTH_TOKEN`, or
leave it empty and add an account in Gagesite (top right, Claude account).

## 3. Your data (optional: skip for a fresh start)
On the computer Gagesite runs on now:
```bash
python scripts/pack_data.py gagesite-data.tar.gz
scp -P <ssh port> gagesite-data.tar.gz <user>@<server>:~/gagesite-app/
```
On the server:
```bash
cd ~/gagesite-app && mkdir -p data && tar -xzf gagesite-data.tar.gz -C data && rm gagesite-data.tar.gz
```
The archive holds `secret.key`, which unlocks every saved connection: keep it private, and delete
it from both computers once it's copied. Installed packages aren't copied: each project's preview
reinstalls them the first time it starts (a few minutes).

## 4. Start
```bash
mkdir -p data && docker compose up -d --build
docker compose logs -f backend     # Ctrl+C to stop reading
```
The first build takes several minutes (Node, Chromium, Python packages).

## 5. Open it from your computer
Stop Gagesite on your computer first (same ports), then:
```powershell
powershell -ExecutionPolicy Bypass -File scripts\tunnel.ps1 -Server <server> -SshPort <ssh port> -User <user>
```
and open http://localhost:3000. Keep that window open while you work.

## Updating
```bash
cd ~/gagesite-app && git pull && docker compose up -d --build
```
Wait until no AI run, preview build or deploy is in progress first: they live in the backend's
memory and stop when it restarts.
