#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$ROOT_DIR/.benchpilot/run"
BACKEND_LOG="$RUN_DIR/backend-remote.log"
FRONTEND_LOG="$RUN_DIR/frontend-remote.log"
BACKEND_PID_FILE="$RUN_DIR/backend-remote.pid"
FRONTEND_PID_FILE="$RUN_DIR/frontend-remote.pid"
BACKEND_PORT="${BENCHPILOT_BACKEND_PORT:-8787}"
FRONTEND_PORT="${BENCHPILOT_FRONTEND_PORT:-3000}"
FRONTEND_HOST="${BENCHPILOT_FRONTEND_HOST:-0.0.0.0}"
BACKEND_URL="${BENCHPILOT_BACKEND_URL:-http://127.0.0.1:${BACKEND_PORT}}"

mkdir -p "$RUN_DIR"

"$ROOT_DIR/scripts/stop-remote.sh" >/dev/null 2>&1 || true

cd "$ROOT_DIR"

echo "Building frontend and backend"
npm run build

echo "Starting backend (production) on :$BACKEND_PORT"
nohup node "$ROOT_DIR/backend/dist/server.js" >"$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!
echo "$BACKEND_PID" >"$BACKEND_PID_FILE"

echo "Starting frontend (production) on $FRONTEND_HOST:$FRONTEND_PORT"
(
  cd "$ROOT_DIR/frontend"
  nohup env BENCHPILOT_BACKEND_URL="$BACKEND_URL" npx next start -H "$FRONTEND_HOST" -p "$FRONTEND_PORT" >"$FRONTEND_LOG" 2>&1 &
  echo $! >"$FRONTEND_PID_FILE"
)

sleep 3

echo "BenchPilot remote/demo stack started"
echo "  frontend: http://127.0.0.1:$FRONTEND_PORT"
echo "  backend:  http://127.0.0.1:$BACKEND_PORT"
echo "  frontend log: $FRONTEND_LOG"
echo "  backend log:  $BACKEND_LOG"
