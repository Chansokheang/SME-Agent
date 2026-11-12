#!/usr/bin/env sh
# Opens Gagesite running on your server, through SSH (macOS / Linux). See scripts/tunnel.ps1.
#   sh scripts/tunnel.sh [user@server] [ssh port]
#   (or set GAGESITE_SSH_TARGET=user@server and GAGESITE_SSH_PORT once)
TARGET="${1:-$GAGESITE_SSH_TARGET}"
SSH_PORT="${2:-${GAGESITE_SSH_PORT:-22}}"
if [ -z "$TARGET" ]; then
  echo "Give your server: sh scripts/tunnel.sh user@server [ssh port]"
  exit 1
fi
FORWARDS=""
for port in 3000 8001 $(seq 3100 3119) $(seq 4100 4119); do
  FORWARDS="$FORWARDS -L $port:127.0.0.1:$port"
done
echo "Connecting to $TARGET ... then open http://localhost:3000 (Ctrl+C to close)."
# shellcheck disable=SC2086
exec ssh -N -p "$SSH_PORT" -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 $FORWARDS "$TARGET"
