#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$ROOT_DIR/.benchpilot/run"
BACKEND_PID_FILE="$RUN_DIR/backend.pid"
FRONTEND_PID_FILE="$RUN_DIR/frontend.pid"
BACKEND_PORT="${BENCHPILOT_BACKEND_PORT:-8787}"
FRONTEND_PORT="${BENCHPILOT_FRONTEND_PORT:-3000}"

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

kill_listeners_on_port() {
  local port="$1"
  local pids
  pids="$(ss -ltnp 2>/dev/null | awk -v port=":$port" '$4 ~ port {print $NF}' | grep -o 'pid=[0-9]*' | cut -d= -f2 | sort -u || true)"
  if [[ -n "$pids" ]]; then
    while IFS= read -r pid; do
      [[ -z "$pid" ]] && continue
      kill "$pid" 2>/dev/null || true
      sleep 1
      if kill -0 "$pid" 2>/dev/null; then
        kill -9 "$pid" 2>/dev/null || true
      fi
    done <<< "$pids"
  fi
}

kill_from_pid_file "$BACKEND_PID_FILE"
kill_from_pid_file "$FRONTEND_PID_FILE"

pkill -f "tsx watch src/server.ts" 2>/dev/null || true
pkill -f "backend/dist/server.js" 2>/dev/null || true
pkill -f "next dev -H 0.0.0.0 -p $FRONTEND_PORT" 2>/dev/null || true
pkill -f "next-server" 2>/dev/null || true

kill_listeners_on_port "$BACKEND_PORT"
kill_listeners_on_port "$FRONTEND_PORT"

rm -rf "$ROOT_DIR/frontend/.next"

echo "BenchPilot dev stack stopped"
