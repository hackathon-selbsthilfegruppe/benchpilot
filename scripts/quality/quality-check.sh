#!/usr/bin/env bash
# BenchPilot Quality Gate
#
# Inspired by iam's quality-check.sh, rewritten for this Node-workspace
# repo. Wraps the existing per-tool commands so humans and the
# pre-commit hook hit one entrypoint.
#
# Modes:
#   --quick     Typecheck + lint only (fast — used by pre-commit).
#   --full      Default. Typecheck + lint + tests on both workspaces.
#   --report    Same checks as --full but never fails (CI dashboards).
#
# Scope:
#   --backend           Backend workspace only.
#   --frontend          Frontend workspace only.
#
# Individual checks (override mode):
#   --typecheck         tsc --noEmit
#   --lint              eslint (frontend only — backend has no lint script)
#   --test              vitest run
#   --coverage          vitest run --coverage
#   --audit             npm audit (project root)
#
# Other:
#   -h, --help          Show this help.
#
# Exit codes:
#   0 — all checks passed (or --report).
#   1 — at least one check failed.

set -uo pipefail

show_help() {
  sed -n '2,/^$/{ /^# /p; /^#$/p; }' "$0" | sed 's/^# \{0,1\}//'
}

# ─── Colors ───────────────────────────────────────────────────────────────────
if [[ -t 1 ]]; then
  RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'; NC=$'\033[0m'
else
  RED=""; GREEN=""; YELLOW=""; NC=""
fi

# ─── Defaults ─────────────────────────────────────────────────────────────────
MODE="full"
BACKEND=true
FRONTEND=true
RUN_TYPECHECK=""
RUN_LINT=""
RUN_TEST=""
RUN_COVERAGE=""
RUN_AUDIT=""

while (( "$#" )); do
  case "$1" in
    --quick)             MODE="quick"; shift ;;
    --full)              MODE="full"; shift ;;
    --report)            MODE="report"; shift ;;
    --backend)           FRONTEND=false; shift ;;
    --frontend)          BACKEND=false; shift ;;
    --typecheck)         RUN_TYPECHECK=true; shift ;;
    --lint)              RUN_LINT=true; shift ;;
    --test)              RUN_TEST=true; shift ;;
    --coverage)          RUN_COVERAGE=true; shift ;;
    --audit)             RUN_AUDIT=true; shift ;;
    -h|--help)           show_help; exit 0 ;;
    *)
      echo "Unknown flag: $1" >&2
      exit 2
      ;;
  esac
done

# When no individual flag was given, derive what to run from MODE.
if [[ -z "$RUN_TYPECHECK$RUN_LINT$RUN_TEST$RUN_COVERAGE$RUN_AUDIT" ]]; then
  RUN_TYPECHECK=true
  RUN_LINT=true
  case "$MODE" in
    quick)   RUN_TEST=false; RUN_AUDIT=false ;;
    full)    RUN_TEST=true;  RUN_AUDIT=false ;;
    report)  RUN_TEST=true;  RUN_AUDIT=true  ;;
  esac
fi

# ─── Resolve project root ─────────────────────────────────────────────────────
PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$PROJECT_ROOT"

LOG_DIR="$PROJECT_ROOT/.local"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/quality-check.log"
echo "Quality check started at $(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$LOG_FILE"

FAILED=0
PASSED_CHECKS=()
FAILED_CHECKS=()

# ─── Runner ──────────────────────────────────────────────────────────────────
# Run a labelled subcommand; tee output to the log; show only on failure.
run() {
  local label="$1"; shift
  echo "  [${label}] $*" >> "$LOG_FILE"
  local output
  if output=$("$@" 2>&1); then
    echo "$output" >> "$LOG_FILE"
    echo -e "  ${GREEN}✓${NC} ${label}"
    PASSED_CHECKS+=("$label")
    return 0
  fi
  echo "$output" >> "$LOG_FILE"
  echo -e "  ${RED}✗${NC} ${label}"
  echo "$output" | tail -25 | sed 's/^/    /'
  FAILED_CHECKS+=("$label")
  if [[ "$MODE" != "report" ]]; then
    FAILED=1
  fi
  return 1
}

run_in() {
  local dir="$1"; shift
  local label="$1"; shift
  ( cd "$dir" && run "$label" "$@" )
  return $?
}

# ─── Header ──────────────────────────────────────────────────────────────────
echo -e "${YELLOW}BenchPilot quality check${NC}  (mode: ${MODE})"
echo "  Log: $LOG_FILE"
echo ""

# ─── Typecheck ───────────────────────────────────────────────────────────────
if [[ "$RUN_TYPECHECK" == "true" ]]; then
  echo "Typecheck"
  if [[ "$BACKEND" == "true" ]]; then
    run_in backend "backend tsc --noEmit" npx --no -- tsc --noEmit -p tsconfig.json
  fi
  if [[ "$FRONTEND" == "true" ]]; then
    run_in frontend "frontend tsc --noEmit" npx --no -- tsc --noEmit -p tsconfig.json
  fi
  echo ""
fi

# ─── Lint ────────────────────────────────────────────────────────────────────
if [[ "$RUN_LINT" == "true" && "$FRONTEND" == "true" ]]; then
  echo "Lint"
  run_in frontend "frontend eslint" npm run lint --silent
  echo ""
fi

# ─── Tests ───────────────────────────────────────────────────────────────────
if [[ "$RUN_TEST" == "true" || "$RUN_COVERAGE" == "true" ]]; then
  echo "Tests"
  if [[ "$BACKEND" == "true" ]]; then
    if [[ "$RUN_COVERAGE" == "true" ]]; then
      run_in backend "backend vitest --coverage" npm run test:coverage --silent
    else
      run_in backend "backend vitest" npm test --silent
    fi
  fi
  if [[ "$FRONTEND" == "true" ]]; then
    run_in frontend "frontend vitest" npm test --silent
  fi
  echo ""
fi

# ─── Audit ───────────────────────────────────────────────────────────────────
if [[ "$RUN_AUDIT" == "true" ]]; then
  echo "Audit"
  # `npm audit` exits non-zero on findings; treat severities below `high`
  # as informational (don't fail the gate).
  run "npm audit (high+)" npm audit --audit-level=high
  echo ""
fi

# ─── Summary ─────────────────────────────────────────────────────────────────
echo "----"
if (( ${#PASSED_CHECKS[@]} > 0 )); then
  echo -e "${GREEN}Passed:${NC} ${#PASSED_CHECKS[@]}"
fi
if (( ${#FAILED_CHECKS[@]} > 0 )); then
  echo -e "${RED}Failed:${NC} ${#FAILED_CHECKS[@]}"
  for c in "${FAILED_CHECKS[@]}"; do
    echo "  - $c"
  done
fi

if [[ "$MODE" == "report" ]]; then
  exit 0
fi
exit "$FAILED"
