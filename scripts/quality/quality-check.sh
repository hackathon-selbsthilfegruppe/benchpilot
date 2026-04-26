#!/usr/bin/env bash
# BenchPilot Quality Gate
#
# Inspired by iam's quality-check.sh, rewritten for this Node-workspace
# repo. Wraps the existing per-tool commands so humans and the
# pre-commit hook hit one entrypoint, and emits a structured JSON
# data file that scripts/quality/dashboard.html renders.
#
# Modes:
#   --quick     Typecheck + lint only (fast — used by pre-commit).
#   --full      Default. Typecheck + lint + tests + jscpd + knip on
#               both workspaces.
#   --report    Same checks as --full + coverage + audit. Never fails.
#   --all       Full + coverage + audit + build. Slowest standard mode.
#
# Scope:
#   --backend           Backend workspace only.
#   --frontend          Frontend workspace only.
#
# Individual checks (override mode):
#   --typecheck         tsc --noEmit on each workspace
#   --lint              eslint (frontend) — captures errors/warnings + top rules
#   --test              vitest run (parses test counts)
#   --coverage          vitest run --coverage (parses line/branch/funcs/stmts %)
#   --cpd               jscpd copy-paste detection across backend + frontend
#   --deadcode          knip — unused exports, files, dependencies
#   --audit             npm audit (counts by severity)
#   --build             next build (frontend) + tsc -p (backend)
#   --a11y              run only frontend *.a11y.test.tsx (axe + RTL — opt-in;
#                       these tests already run as part of the regular vitest
#                       pass, so this is for "run only the axe subset")
#   --e2e               run frontend Playwright tests (opt-in — needs the dev
#                       stack on :3000 and the relevant API keys)
#
# Other:
#   --html              Always write JSON results AND open dashboard.html.
#   --no-open           Skip auto-opening the dashboard (with --html).
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
RUN_BUILD=""
RUN_CPD=""
RUN_DEADCODE=""
RUN_A11Y=""
RUN_E2E=""
HTML=false
OPEN_HTML=true

while (( "$#" )); do
  case "$1" in
    --quick)             MODE="quick"; shift ;;
    --full)              MODE="full"; shift ;;
    --report)            MODE="report"; shift ;;
    --all)               MODE="all"; shift ;;
    --backend)           FRONTEND=false; shift ;;
    --frontend)          BACKEND=false; shift ;;
    --typecheck)         RUN_TYPECHECK=true; shift ;;
    --lint)              RUN_LINT=true; shift ;;
    --test)              RUN_TEST=true; shift ;;
    --coverage)          RUN_COVERAGE=true; shift ;;
    --audit)             RUN_AUDIT=true; shift ;;
    --build)             RUN_BUILD=true; shift ;;
    --cpd)               RUN_CPD=true; shift ;;
    --deadcode)          RUN_DEADCODE=true; shift ;;
    --a11y)              RUN_A11Y=true; shift ;;
    --e2e)               RUN_E2E=true; shift ;;
    --html)              HTML=true; shift ;;
    --no-open)           OPEN_HTML=false; shift ;;
    -h|--help)           show_help; exit 0 ;;
    *)
      echo "Unknown flag: $1" >&2
      exit 2
      ;;
  esac
done

# When no individual flag was given, derive from MODE.
#   - jscpd + knip run by default in --full / --report / --all so redundancy
#     is always caught, but stay out of --quick (too slow for pre-commit).
#   - --a11y and --e2e are *opt-in* — never part of any standard mode:
#     a11y unit tests already run as part of the regular vitest pass,
#     and Playwright needs the dev stack + API keys.
if [[ -z "$RUN_TYPECHECK$RUN_LINT$RUN_TEST$RUN_COVERAGE$RUN_AUDIT$RUN_BUILD$RUN_CPD$RUN_DEADCODE$RUN_A11Y$RUN_E2E" ]]; then
  RUN_TYPECHECK=true
  RUN_LINT=true
  case "$MODE" in
    quick)   RUN_TEST=false; RUN_COVERAGE=false; RUN_AUDIT=false; RUN_BUILD=false; RUN_CPD=false; RUN_DEADCODE=false ;;
    full)    RUN_TEST=true;  RUN_COVERAGE=false; RUN_AUDIT=false; RUN_BUILD=false; RUN_CPD=true;  RUN_DEADCODE=true  ;;
    report)  RUN_TEST=true;  RUN_COVERAGE=true;  RUN_AUDIT=true;  RUN_BUILD=false; RUN_CPD=true;  RUN_DEADCODE=true  ;;
    all)     RUN_TEST=true;  RUN_COVERAGE=true;  RUN_AUDIT=true;  RUN_BUILD=true;  RUN_CPD=true;  RUN_DEADCODE=true  ;;
  esac
  RUN_A11Y=${RUN_A11Y:-false}
  RUN_E2E=${RUN_E2E:-false}
fi

# ─── Resolve project root ─────────────────────────────────────────────────────
PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$PROJECT_ROOT"

LOG_DIR="$PROJECT_ROOT/.local"
mkdir -p "$LOG_DIR/quality-data"
LOG_FILE="$LOG_DIR/quality-check.log"
echo "Quality check started at $(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$LOG_FILE"

FAILED=0
PASSED_CHECKS=()
FAILED_CHECKS=()
declare -a JSON_CHECKS=()
STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
RESULTS_FILE="$LOG_DIR/quality-data/data.js"

# ─── Helpers ──────────────────────────────────────────────────────────────────
json_escape() {
  python3 -c 'import json, sys; sys.stdout.write(json.dumps(sys.stdin.read()))'
}

now_ms() {
  python3 -c 'import time; print(int(time.time()*1000))'
}

parse_vitest() {
  python3 -c '
import re, sys, json
text = sys.stdin.read()
files = re.search(r"Test Files\s+(?:(\d+)\s+failed\s*\|\s*)?(\d+)\s+passed\s*\((\d+)\)", text)
tests = re.search(r"Tests\s+(?:(\d+)\s+failed\s*\|\s*)?(\d+)\s+passed\s*\((\d+)\)", text)
dur = re.search(r"Duration\s+([\d.]+\s*\w+)", text)
out = {}
if files:
    out["files_failed"] = int(files.group(1) or 0)
    out["files_passed"] = int(files.group(2))
    out["files_total"] = int(files.group(3))
if tests:
    out["tests_failed"] = int(tests.group(1) or 0)
    out["tests_passed"] = int(tests.group(2))
    out["tests_total"] = int(tests.group(3))
if dur:
    out["duration_text"] = dur.group(1).strip()
print(json.dumps(out))
'
}

parse_eslint_json() {
  python3 -c '
import json, sys, collections, re
raw = sys.stdin.read()
m = re.search(r"(\[\s*(?:{.*}\s*,?\s*)*\])", raw, re.DOTALL)
data = json.loads(m.group(1)) if m else []
errs = warns = files_with_issues = 0
rules = collections.Counter()
for f in data:
    n = 0
    for msg in f.get("messages", []):
        n += 1
        rules[msg.get("ruleId") or "unknown"] += 1
        sev = msg.get("severity", 0)
        if sev == 2: errs += 1
        elif sev == 1: warns += 1
    if n: files_with_issues += 1
print(json.dumps({
    "errors": errs,
    "warnings": warns,
    "files_with_issues": files_with_issues,
    "files_total": len(data),
    "top_rules": [{"rule": r, "count": c} for r, c in rules.most_common(10)],
}))
'
}

parse_coverage_summary() {
  local path="$1"
  if [[ ! -f "$path" ]]; then echo '{}'; return; fi
  python3 -c '
import json, sys
with open(sys.argv[1]) as f:
    d = json.load(f)
t = d.get("total", {})
out = {}
for k in ("lines", "statements", "branches", "functions"):
    s = t.get(k, {})
    if s:
        out[k] = {"covered": s.get("covered"), "total": s.get("total"), "pct": s.get("pct")}
print(json.dumps(out))
' "$path"
}

parse_audit_json() {
  python3 -c '
import json, sys
text = sys.stdin.read()
try:
    d = json.loads(text)
except json.JSONDecodeError:
    print(json.dumps({"error": "non-JSON output", "info": 0, "low": 0, "moderate": 0, "high": 0, "critical": 0, "total": 0}))
    sys.exit(0)
vulns = d.get("metadata", {}).get("vulnerabilities", {})
print(json.dumps({
    "info": vulns.get("info", 0),
    "low": vulns.get("low", 0),
    "moderate": vulns.get("moderate", 0),
    "high": vulns.get("high", 0),
    "critical": vulns.get("critical", 0),
    "total": vulns.get("total", 0),
}))
'
}

parse_jscpd_report() {
  local path="$1"
  if [[ ! -f "$path" ]]; then echo '{}'; return; fi
  python3 -c '
import json, sys, collections
with open(sys.argv[1]) as f:
    d = json.load(f)
stats_total = d.get("statistics", {}).get("total", {})
dups = d.get("duplicates", []) or []
by_file = collections.Counter()
for dup in dups:
    a = dup.get("firstFile", {}).get("name") or ""
    b = dup.get("secondFile", {}).get("name") or ""
    if a: by_file[a] += 1
    if b: by_file[b] += 1
top = [{"file": f, "count": c} for f, c in by_file.most_common(10)]
print(json.dumps({
    "total_lines": stats_total.get("lines"),
    "duplicated_lines": stats_total.get("duplicatedLines"),
    "percentage": stats_total.get("percentage"),
    "clones": stats_total.get("clones") if stats_total.get("clones") is not None else len(dups),
    "files": stats_total.get("sources"),
    "top_files": top,
}))
' "$path"
}

parse_knip_json() {
  python3 -c '
import json, sys, re
raw = sys.stdin.read()
m = re.search(r"(\{.*\})", raw, re.DOTALL)
data = json.loads(m.group(1)) if m else {}
issues = data.get("issues", []) or []
counts = {
    "files": 0,
    "exports": 0,
    "types": 0,
    "duplicates": 0,
    "dependencies": 0,
    "devDependencies": 0,
    "unlisted": 0,
    "binaries": 0,
}
top_files = []
for entry in issues:
    file_name = entry.get("file") or ""
    file_issue_count = 0
    for key in ("exports", "types", "duplicates"):
        bucket = entry.get(key)
        n = 0
        if isinstance(bucket, list):
            n = len(bucket)
        elif isinstance(bucket, dict):
            n = sum(len(v) if hasattr(v, "__len__") else 1 for v in bucket.values())
        counts[key] += n
        file_issue_count += n
    is_used = entry.get("isFileUsed", True)
    if is_used is False:
        counts["files"] += 1
        file_issue_count += 1
    if file_issue_count:
        top_files.append({"file": file_name, "count": file_issue_count})
for key in ("dependencies", "devDependencies", "unlisted", "binaries"):
    val = data.get(key)
    if isinstance(val, list):
        counts[key] += len(val)
    elif isinstance(val, dict):
        counts[key] += sum(len(v) for v in val.values() if hasattr(v, "__len__"))
top_files.sort(key=lambda x: x["count"], reverse=True)
out = {**counts, "top_files": top_files[:10]}
out["total"] = sum(counts.values())
print(json.dumps(out))
'
}

# ─── Run primitive ────────────────────────────────────────────────────────────
LAST_LABEL=""
LAST_STATUS=""
LAST_OUTPUT=""
LAST_DURATION_MS=0
LAST_RC=0

run_capture() {
  local label="$1"; shift
  echo "  [${label}] $*" >> "$LOG_FILE"
  local start end
  start=$(now_ms)
  if LAST_OUTPUT=$("$@" 2>&1); then
    LAST_STATUS="passed"
    LAST_RC=0
    PASSED_CHECKS+=("$label")
    echo -e "  ${GREEN}✓${NC} ${label}"
  else
    LAST_STATUS="failed"
    LAST_RC=1
    FAILED_CHECKS+=("$label")
    echo -e "  ${RED}✗${NC} ${label}"
    echo "$LAST_OUTPUT" | tail -25 | sed 's/^/    /'
    if [[ "$MODE" != "report" ]]; then
      FAILED=1
    fi
  fi
  end=$(now_ms)
  LAST_LABEL="$label"
  LAST_DURATION_MS=$((end - start))
  echo "$LAST_OUTPUT" >> "$LOG_FILE"
}

run_capture_in() {
  local dir="$1"; shift
  local label="$1"; shift
  pushd "$dir" >/dev/null
  run_capture "$label" "$@"
  popd >/dev/null
}

emit_check() {
  local kind="$1"
  local extras="${2:-}"
  local detail label
  detail=$(printf "%s" "$LAST_OUTPUT" | tail -80 | json_escape)
  label=$(printf "%s" "$LAST_LABEL" | json_escape)
  local extras_part=""
  if [[ -n "$extras" ]]; then
    extras_part=",\"data\":${extras}"
  fi
  JSON_CHECKS+=("{\"kind\":\"${kind}\",\"label\":${label},\"status\":\"${LAST_STATUS}\",\"duration_ms\":${LAST_DURATION_MS},\"detail\":${detail}${extras_part}}")
}

# Re-classify the most recent check based on a parsed counter — used by audit,
# cpd, deadcode where exit code alone doesn't tell us whether to fail the gate.
reclassify_last() {
  local should_fail="$1"
  # Helper: rebuild an array, dropping a specific element by exact match.
  # `${arr[@]/needle}` only blanks the element rather than removing it,
  # which then prints empty bullets in the summary.
  drop_from() {
    local -n arr="$1"
    local needle="$2"
    local out=()
    for v in "${arr[@]}"; do
      [[ "$v" == "$needle" ]] && continue
      out+=("$v")
    done
    arr=("${out[@]}")
  }

  if [[ "$should_fail" == "true" ]]; then
    if [[ "$LAST_STATUS" == "passed" ]]; then
      LAST_STATUS="failed"
      drop_from PASSED_CHECKS "$LAST_LABEL"
      FAILED_CHECKS+=("$LAST_LABEL")
      [[ "$MODE" != "report" ]] && FAILED=1
    fi
  else
    if [[ "$LAST_STATUS" == "failed" ]]; then
      LAST_STATUS="passed"
      drop_from FAILED_CHECKS "$LAST_LABEL"
      PASSED_CHECKS+=("$LAST_LABEL")
    fi
  fi
}

# ─── Header ──────────────────────────────────────────────────────────────────
echo -e "${YELLOW}BenchPilot quality check${NC}  (mode: ${MODE})"
echo "  Log: $LOG_FILE"
echo ""

# ─── Typecheck ───────────────────────────────────────────────────────────────
if [[ "$RUN_TYPECHECK" == "true" ]]; then
  echo "Typecheck"
  if [[ "$BACKEND" == "true" ]]; then
    run_capture_in backend "backend tsc --noEmit" npx --no -- tsc --noEmit -p tsconfig.json
    emit_check "typecheck"
  fi
  if [[ "$FRONTEND" == "true" ]]; then
    run_capture_in frontend "frontend tsc --noEmit" npx --no -- tsc --noEmit -p tsconfig.json
    emit_check "typecheck"
  fi
  echo ""
fi

# ─── Lint ────────────────────────────────────────────────────────────────────
if [[ "$RUN_LINT" == "true" && "$FRONTEND" == "true" ]]; then
  echo "Lint"
  run_capture_in frontend "frontend eslint" npx --no -- eslint --format json
  local_lint_extras=$(printf "%s" "$LAST_OUTPUT" | parse_eslint_json)
  emit_check "lint" "$local_lint_extras"
  echo ""
fi

# ─── Tests ───────────────────────────────────────────────────────────────────
if [[ "$RUN_TEST" == "true" || "$RUN_COVERAGE" == "true" ]]; then
  echo "Tests"
  if [[ "$BACKEND" == "true" ]]; then
    if [[ "$RUN_COVERAGE" == "true" ]]; then
      run_capture_in backend "backend vitest --coverage" npm run test:coverage --silent
      cov=$(parse_coverage_summary "backend/coverage/coverage-summary.json")
      vit=$(printf "%s" "$LAST_OUTPUT" | parse_vitest)
      extras=$(python3 -c '
import json, sys
v, c = json.loads(sys.argv[1]), json.loads(sys.argv[2])
print(json.dumps({**v, "coverage": c}))
' "$vit" "$cov")
      emit_check "test" "$extras"
    else
      run_capture_in backend "backend vitest" npm test --silent
      vit=$(printf "%s" "$LAST_OUTPUT" | parse_vitest)
      emit_check "test" "$vit"
    fi
  fi
  if [[ "$FRONTEND" == "true" ]]; then
    if [[ "$RUN_COVERAGE" == "true" ]]; then
      run_capture_in frontend "frontend vitest --coverage" npx --no -- vitest run --coverage --coverage.reporter=json-summary
      cov=$(parse_coverage_summary "frontend/coverage/coverage-summary.json")
      vit=$(printf "%s" "$LAST_OUTPUT" | parse_vitest)
      extras=$(python3 -c '
import json, sys
v, c = json.loads(sys.argv[1]), json.loads(sys.argv[2])
print(json.dumps({**v, "coverage": c}))
' "$vit" "$cov")
      emit_check "test" "$extras"
    else
      run_capture_in frontend "frontend vitest" npm test --silent
      vit=$(printf "%s" "$LAST_OUTPUT" | parse_vitest)
      emit_check "test" "$vit"
    fi
  fi
  echo ""
fi

# ─── Build ───────────────────────────────────────────────────────────────────
if [[ "$RUN_BUILD" == "true" ]]; then
  echo "Build"
  if [[ "$BACKEND" == "true" ]]; then
    run_capture_in backend "backend tsc build" npm run build --silent
    emit_check "build"
  fi
  if [[ "$FRONTEND" == "true" ]]; then
    run_capture_in frontend "frontend next build" npx --no -- next build
    emit_check "build"
  fi
  echo ""
fi

# ─── Code duplication (jscpd) ────────────────────────────────────────────────
if [[ "$RUN_CPD" == "true" ]]; then
  echo "Code duplication (jscpd)"
  rm -rf "$LOG_DIR/quality-data/jscpd" 2>/dev/null || true
  run_capture "jscpd" npx --no -- jscpd
  cpd_extras=$(parse_jscpd_report "$LOG_DIR/quality-data/jscpd/jscpd-report.json")
  # jscpd exits 0 even with clones found, so reclassify based on the parsed
  # clone count: any clone above the configured min-lines/min-tokens fails the
  # gate. Tighten or relax the threshold in .jscpd.json, not here.
  cpd_clones=$(echo "$cpd_extras" | python3 -c '
import json, sys
print(int(json.load(sys.stdin).get("clones") or 0))
')
  if [[ "$cpd_clones" -gt 0 ]]; then
    reclassify_last true
  else
    reclassify_last false
  fi
  emit_check "cpd" "$cpd_extras"
  echo ""
fi

# ─── Dead code (knip) ────────────────────────────────────────────────────────
if [[ "$RUN_DEADCODE" == "true" ]]; then
  echo "Dead code (knip)"
  run_capture "knip" npx --no -- knip --reporter json
  knip_extras=$(printf "%s" "$LAST_OUTPUT" | parse_knip_json)
  total=$(echo "$knip_extras" | python3 -c '
import json, sys
print(int(json.load(sys.stdin).get("total", 0)))
')
  # knip findings are informational — don't fail the gate on them, just
  # surface in the dashboard. Adjust to taste later if the team wants it
  # strict.
  reclassify_last false
  emit_check "deadcode" "$knip_extras"
  echo ""
fi

# ─── Accessibility (axe + RTL unit tests) ────────────────────────────────────
if [[ "$RUN_A11Y" == "true" && "$FRONTEND" == "true" ]]; then
  echo "Accessibility (axe + RTL)"
  run_capture_in frontend "frontend a11y (axe)" npx --no -- vitest run a11y
  vit=$(printf "%s" "$LAST_OUTPUT" | parse_vitest)
  emit_check "a11y" "$vit"
  echo ""
fi

# ─── End-to-end (Playwright) ─────────────────────────────────────────────────
if [[ "$RUN_E2E" == "true" && "$FRONTEND" == "true" ]]; then
  echo "End-to-end (Playwright)"
  run_capture_in frontend "frontend playwright" npm run e2e --silent
  emit_check "e2e"
  echo ""
fi

# ─── Audit ───────────────────────────────────────────────────────────────────
if [[ "$RUN_AUDIT" == "true" ]]; then
  echo "Audit"
  run_capture "npm audit" npm audit --json --audit-level=high
  audit_extras=$(printf "%s" "$LAST_OUTPUT" | parse_audit_json)
  high_count=$(echo "$audit_extras" | python3 -c '
import json, sys
d = json.load(sys.stdin)
print(int(d.get("high", 0)) + int(d.get("critical", 0)))
')
  if [[ "$high_count" -gt 0 ]]; then
    reclassify_last true
  else
    reclassify_last false
  fi
  emit_check "audit" "$audit_extras"
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

# ─── HTML dashboard data ─────────────────────────────────────────────────────
write_html_data() {
  local scope="both"
  if [[ "$BACKEND" == "true" && "$FRONTEND" == "false" ]]; then scope="backend"; fi
  if [[ "$BACKEND" == "false" && "$FRONTEND" == "true" ]]; then scope="frontend"; fi
  local host
  host="$(hostname 2>/dev/null || echo "")"
  local checks_csv
  checks_csv=$(IFS=,; echo "${JSON_CHECKS[*]:-}")
  local log_excerpt
  log_excerpt=$(tail -200 "$LOG_FILE" | json_escape)
  local mode_json scope_json started_json host_json
  mode_json=$(printf "%s" "$MODE" | json_escape)
  scope_json=$(printf "%s" "$scope" | json_escape)
  started_json=$(printf "%s" "$STARTED_AT" | json_escape)
  host_json=$(printf "%s" "$host" | json_escape)
  cat > "$RESULTS_FILE" <<EOF
window.QUALITY_DATA = {
  "mode": ${mode_json},
  "scope": ${scope_json},
  "started_at": ${started_json},
  "host": ${host_json},
  "checks": [${checks_csv}],
  "log_excerpt": ${log_excerpt}
};
EOF
}

if [[ "$HTML" == "true" || "$MODE" == "report" || "$MODE" == "all" ]]; then
  write_html_data
  if [[ "$HTML" == "true" && "$OPEN_HTML" == "true" ]]; then
    DASHBOARD="$PROJECT_ROOT/scripts/quality/dashboard.html"
    if command -v open >/dev/null 2>&1; then
      open "$DASHBOARD"
    elif command -v xdg-open >/dev/null 2>&1; then
      xdg-open "$DASHBOARD" >/dev/null 2>&1 || true
    else
      echo "Dashboard at: file://$DASHBOARD"
    fi
  fi
fi

if [[ "$MODE" == "report" ]]; then
  exit 0
fi
exit "$FAILED"
