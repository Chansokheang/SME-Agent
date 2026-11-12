# Gagesite's backend: FastAPI + Claude Code CLI, plus everything the AI runs use on the projects:
# Node (Claude Code and the generated Next.js sites), Python (generated Python APIs), git (saving to
# GitHub), Chromium (the self-test and screenshots) and the Docker CLI (APIs put on "this computer").
# Build context is the repo root (see compose.yml) so the pipeline/ folder can be copied.
FROM python:3.12-slim

# The server user's ids, so files in ./data belong to that user, and the host's docker group, so
# the container can use the host's Docker (mounted socket).
ARG UID=1000
ARG DOCKER_GID=998

RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates git gnupg \
 && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
 && apt-get install -y --no-install-recommends nodejs \
 && install -m 0755 -d /etc/apt/keyrings \
 && curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc \
 && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
      > /etc/apt/sources.list.d/docker.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends docker-ce-cli docker-compose-plugin \
 && rm -rf /var/lib/apt/lists/*

RUN npm install -g @anthropic-ai/claude-code \
 && pip install --no-cache-dir uv

WORKDIR /app
# The exact versions in uv.lock, not the newest ones.
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv export --frozen --no-dev --no-hashes --no-emit-project -o /tmp/requirements.txt \
 && uv pip install --system --no-cache -r /tmp/requirements.txt

# Chromium for the self-test (site_check.py), design screenshots and reading links.
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN playwright install --with-deps chromium && chmod -R a+rX /ms-playwright

COPY backend/app ./app
COPY pipeline /pipeline

# Claude Code refuses some modes as root, and the agent shouldn't run as root anyway.
RUN (getent group "${DOCKER_GID}" >/dev/null || groupadd -g "${DOCKER_GID}" hostdocker) \
 && useradd --create-home --uid "${UID}" -G "$(getent group "${DOCKER_GID}" | cut -d: -f1)" builder \
 && mkdir -p /data/workspaces /home/builder/.claude \
 && chown -R builder /data /home/builder
USER builder

ENV PIPELINE_DIR=/pipeline \
    DATA_DIR=/data \
    WORKSPACES_DIR=/data/workspaces \
    DATABASE_URL=sqlite:////data/app.db \
    SECRET_KEY_FILE=/data/secret.key \
    BIND_HOST=127.0.0.1 \
    BACKEND_PORT=8001

EXPOSE 8001
# One process: runs, previews and deploys are tracked in memory.
CMD ["sh", "-c", "exec uvicorn app.main:app --host \"$BIND_HOST\" --port \"$BACKEND_PORT\""]
