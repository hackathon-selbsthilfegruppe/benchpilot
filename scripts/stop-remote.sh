#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$ROOT_DIR/.benchpilot/run"
BACKEND_PID_FILE="$RUN_DIR/backend-remote.pid"
FRONTEND_PID_FILE="$RUN_DIR/frontend-remote.pid"

kill_from_pid_file() {
  local pid_file="$1"
  if [[ -f "$pid_file" ]]; then
    local pid
    pid="$(cat "$pid_file")"
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      sleep 1
      if kill -0 "$pid" 2>/dev/null; then
        kill -9 "$pid" 2>/dev/null || true
      fi
    fi
    rm -f "$pid_file"
  fi
}

kill_from_pid_file "$BACKEND_PID_FILE"
kill_from_pid_file "$FRONTEND_PID_FILE"

"$ROOT_DIR/scripts/stop-dev.sh" >/dev/null 2>&1 || true

echo "BenchPilot remote/demo stack stopped"
