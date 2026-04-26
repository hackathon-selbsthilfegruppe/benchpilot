#!/bin/bash
# WARNING: This script captures live accessibility tree content and sends it to an external LLM.
# It MUST only be run against a local development instance loaded with synthetic test data.
# Running against staging or production is PROHIBITED.
#
# Usage:
#   ./scripts/quality/a11y-check.sh [BASE_URL]
#
# Arguments:
#   BASE_URL  Optional base URL (default: http://localhost:5473)
#             Must be a localhost/127.0.0.1 URL — any other host is rejected.
#
# Prerequisites:
#   - Chrome running with --remote-debugging-port=9222
#     (e.g. open -a 'Google Chrome' --args --remote-debugging-port=9222)
#   - ANTHROPIC_API_KEY environment variable set
#
# Output:
#   .local/a11y/a11y-report.md (created/overwritten on each run)

set -euo pipefail

BASE_URL="${1:-http://localhost:3000}"
CDP_URL="http://localhost:9222"
REPORT_DIR=".local/a11y"
REPORT_FILE="$REPORT_DIR/a11y-report.md"

# ─── Security guard: localhost only ───────────────────────────────────────────
HOSTNAME_PART=$(echo "$BASE_URL" | sed -E 's|https?://([^/:]+).*|\1|')
if [[ "$HOSTNAME_PART" != "localhost" && "$HOSTNAME_PART" != "127.0.0.1" ]]; then
    echo "PROHIBITED: a11y-check.sh may only run against localhost or 127.0.0.1."
    echo "Target URL '$BASE_URL' contains hostname '$HOSTNAME_PART'."
    echo "This script captures live accessibility tree content and sends it to an external LLM."
    echo "Running against staging or production is PROHIBITED."
    exit 1
fi

# ─── Chrome reachability check ────────────────────────────────────────────────
if ! curl -s --connect-timeout 3 "$CDP_URL/json/version" > /dev/null 2>&1; then
    echo "ERROR: Chrome not reachable at $CDP_URL"
    echo "Chrome must be running with --remote-debugging-port=9222."
    echo "Launch Chrome manually with: open -a 'Google Chrome' --args --remote-debugging-port=9222"
    echo "Then start the dev server: npm run dev (frontend on :3000 by default)"
    exit 1
fi

# ─── ANTHROPIC_API_KEY check ──────────────────────────────────────────────────
if [[ -z "${ANTHROPIC_API_KEY:-}" ]]; then
    echo "ERROR: ANTHROPIC_API_KEY environment variable is not set."
    echo "Set it before running: export ANTHROPIC_API_KEY=sk-ant-..."
    exit 1
fi

# ─── Setup ────────────────────────────────────────────────────────────────────
mkdir -p "$REPORT_DIR"

PAGE_NAMES=(
    "Start page"
    "Workbench — enzyme-stability (collapsed)"
    "Workbench — pilbara-hydrothermal (collapsed)"
)

PAGE_ROUTES=(
    "/"
    "/bench/:slug"
    "/bench/:slug"
)

PAGE_PATHS=(
    "/"
    "/bench/enzyme-stability"
    "/bench/pilbara-hydrothermal"
)

echo "=== a11y-check.sh — LLM Semantic Accessibility Review ==="
echo "Target: $BASE_URL"
echo "CDP: $CDP_URL"
echo "Output: $REPORT_FILE"
echo ""

# ─── CDP WebSocket helper (pure Python, no external deps) ─────────────────────
cdp_get_ax_tree() {
    local ws_url="$1"
    local nav_url="$2"

    python3 << PYEOF
import socket
import ssl
import json
import struct
import base64
import hashlib
import time
import re
import sys
import os

ws_url = "$ws_url"
nav_url = "$nav_url"

def parse_ws_url(url):
    m = re.match(r'ws://([^/:]+):?(\d+)?(.*)', url)
    if not m:
        return None, None, None
    host = m.group(1)
    port = int(m.group(2)) if m.group(2) else 80
    path = m.group(3) or '/'
    return host, port, path

def ws_connect(host, port, path):
    sock = socket.create_connection((host, port), timeout=10)
    key = base64.b64encode(os.urandom(16)).decode()
    handshake = (
        f"GET {path} HTTP/1.1\r\n"
        f"Host: {host}:{port}\r\n"
        f"Upgrade: websocket\r\n"
        f"Connection: Upgrade\r\n"
        f"Sec-WebSocket-Key: {key}\r\n"
        f"Sec-WebSocket-Version: 13\r\n"
        f"\r\n"
    )
    sock.sendall(handshake.encode())
    resp = b""
    while b"\r\n\r\n" not in resp:
        chunk = sock.recv(4096)
        if not chunk:
            break
        resp += chunk
    return sock

def ws_send(sock, data):
    payload = json.dumps(data).encode()
    length = len(payload)
    mask_key = os.urandom(4)
    masked = bytes(b ^ mask_key[i % 4] for i, b in enumerate(payload))
    if length < 126:
        header = struct.pack('BB', 0x81, 0x80 | length) + mask_key
    elif length < 65536:
        header = struct.pack('!BBH', 0x81, 0x80 | 126, length) + mask_key
    else:
        header = struct.pack('!BBQ', 0x81, 0x80 | 127, length) + mask_key
    sock.sendall(header + masked)

def ws_recv(sock, timeout=15):
    sock.settimeout(timeout)
    frames = b""
    while True:
        try:
            header = sock.recv(2)
            if not header or len(header) < 2:
                break
            fin = (header[0] & 0x80) != 0
            opcode = header[0] & 0x0F
            masked = (header[1] & 0x80) != 0
            length = header[1] & 0x7F
            if length == 126:
                length = struct.unpack('!H', sock.recv(2))[0]
            elif length == 127:
                length = struct.unpack('!Q', sock.recv(8))[0]
            if masked:
                mask_key = sock.recv(4)
            data = b""
            while len(data) < length:
                chunk = sock.recv(min(length - len(data), 65536))
                if not chunk:
                    break
                data += chunk
            if masked:
                data = bytes(b ^ mask_key[i % 4] for i, b in enumerate(data))
            if opcode == 8:
                break
            if opcode in (1, 2, 0):
                frames += data
                if fin:
                    break
        except socket.timeout:
            break
    return frames.decode('utf-8', errors='replace') if frames else ""

try:
    host, port, path = parse_ws_url(ws_url)
    if not host:
        raise ValueError(f"Cannot parse WebSocket URL: {ws_url}")

    sock = ws_connect(host, port, path)

    # Enable Accessibility domain
    ws_send(sock, {"id": 1, "method": "Accessibility.enable"})
    time.sleep(0.5)

    # Navigate to target URL
    ws_send(sock, {"id": 2, "method": "Page.navigate", "params": {"url": nav_url}})

    # Wait for navigation and page settle
    time.sleep(4)

    # Get full accessibility tree
    ws_send(sock, {"id": 3, "method": "Accessibility.getFullAXTree"})

    # Collect responses
    ax_result = None
    deadline = time.time() + 15
    while time.time() < deadline:
        raw = ws_recv(sock, timeout=3)
        if not raw:
            break
        # May contain multiple JSON objects concatenated; try line-by-line
        for line in raw.split('\n'):
            line = line.strip()
            if not line:
                continue
            try:
                msg = json.loads(line)
                if msg.get("id") == 3 and "result" in msg:
                    ax_result = msg["result"]
                    break
            except:
                pass
        if ax_result:
            break

    sock.close()

    if not ax_result:
        print(json.dumps({"nodes": [], "error": "no AX tree result received"}))
        sys.exit(0)

    nodes = ax_result.get("nodes", [])
    simplified = []
    for node in nodes[:300]:
        role = node.get("role", {}).get("value", "")
        name_val = node.get("name", {})
        name = name_val.get("value", "") if isinstance(name_val, dict) else ""
        if role and role not in ["none", "generic", "StaticText", "InlineTextBox"]:
            simplified.append({"role": role, "name": name[:100] if name else ""})

    print(json.dumps({"nodes": simplified, "total": len(nodes)}))

except Exception as e:
    print(json.dumps({"nodes": [], "error": str(e)}))
PYEOF
}

# ─── Create a new Chrome tab ───────────────────────────────────────────────────
create_tab() {
    local url="$1"
    local result
    result=$(curl -s -X PUT "$CDP_URL/json/new?$url" 2>/dev/null || echo "")
    if [[ -z "$result" ]]; then
        echo ""
        return 1
    fi
    python3 -c "
import json, sys
try:
    d = json.loads(sys.stdin.read())
    print(d.get('id', ''))
except:
    print('')
" <<< "$result" 2>/dev/null || echo ""
}

# ─── Get WebSocket URL for a tab ──────────────────────────────────────────────
get_ws_url() {
    local tab_id="$1"
    curl -s "$CDP_URL/json/list" 2>/dev/null | python3 -c "
import json, sys
tab_id = '$tab_id'
try:
    tabs = json.load(sys.stdin)
    for tab in tabs:
        if tab.get('id') == tab_id:
            print(tab.get('webSocketDebuggerUrl', ''))
            sys.exit(0)
    print('')
except:
    print('')
" 2>/dev/null || echo ""
}

# ─── Close a Chrome tab ───────────────────────────────────────────────────────
close_tab() {
    local tab_id="$1"
    curl -s "$CDP_URL/json/close/$tab_id" > /dev/null 2>&1 || true
}

# ─── Call LLM for semantic a11y review ────────────────────────────────────────
call_llm() {
    local page_name="$1"
    local route="$2"
    local a11y_tree_json="$3"

    # Build the prompt and request body via Python to handle escaping correctly
    python3 << PYEOF
import json
import urllib.request
import sys
import os

api_key = os.environ.get("ANTHROPIC_API_KEY", "")
page_name = "$page_name"
route = "$route"

a11y_data = $a11y_tree_json

nodes = a11y_data.get("nodes", [])
total = a11y_data.get("total", 0)
error = a11y_data.get("error", "")

if error and not nodes:
    tree_summary = f"(Accessibility tree capture failed: {error}. Using minimal structural information.)"
else:
    tree_summary = f"Total nodes: {total}, Interactive/structural elements shown ({len(nodes)} nodes):\n"
    for n in nodes:
        role = n.get("role", "")
        name = n.get("name", "")
        if name:
            tree_summary += f"  [{role}] \"{name}\"\n"
        else:
            tree_summary += f"  [{role}] (no accessible name)\n"

prompt = f"""You are a blind user navigating this page with a screen reader. The page is '{page_name}' at route '{route}' of BenchPilot, a workspace for scientific researchers.

Here is the accessibility tree (roles and names of interactive/structural elements):
{tree_summary}

Based on this accessibility tree, identify what is confusing, unlabeled, or missing context for a screen reader user.

Respond ONLY with a JSON object in this exact format (no markdown fences, no explanation outside JSON):
{{
  "status": "Issues found or Clean",
  "findings": [
    {{
      "severity": "High or Medium or Low",
      "element": "element selector or description",
      "description": "what is wrong",
      "suggested_fix": "how to fix it"
    }}
  ],
  "reading_order_issues": "description of any confusing linearization, or None identified"
}}

Status must be exactly "Issues found" or "Clean".
Severity must be exactly "High", "Medium", or "Low" — no other values.
Severity meanings:
- High: screen reader cannot operate the element (missing name, broken role)
- Medium: confusing but operable (unclear name, unexpected reading order)
- Low: minor labeling gap (redundant or terse labels)"""

request_body = {
    "model": "claude-haiku-4-5",
    "max_tokens": 1024,
    "messages": [{"role": "user", "content": prompt}]
}

try:
    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=json.dumps(request_body).encode(),
        headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        response_data = json.loads(resp.read())

    content = response_data.get("content", [])
    text = ""
    for block in content:
        if block.get("type") == "text":
            text = block.get("text", "").strip()
            break

    if not text:
        raise ValueError("No text content in LLM response")

    # Try to parse as JSON; if wrapped in markdown code fences, strip them
    clean_text = text.strip()
    if clean_text.startswith("```"):
        lines = clean_text.split("\n")
        clean_text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

    result = json.loads(clean_text)

    # Validate and normalise
    valid_severities = {"High", "Medium", "Low"}
    findings = result.get("findings", [])
    for f in findings:
        if f.get("severity") not in valid_severities:
            f["severity"] = "Low"

    if result.get("status") not in ("Issues found", "Clean"):
        result["status"] = "Issues found" if findings else "Clean"

    print(json.dumps(result))

except Exception as e:
    fallback = {
        "status": "Issues found",
        "findings": [],
        "reading_order_issues": f"LLM call failed: {str(e)}"
    }
    print(json.dumps(fallback))
PYEOF
}

# ─── Format a single page section as Markdown ─────────────────────────────────
format_section() {
    local page_name="$1"
    local route="$2"
    local llm_json="$3"

    python3 << PYEOF
import json

page_name = "$page_name"
route = "$route"
raw = r"""$llm_json"""

try:
    data = json.loads(raw)
except Exception as e:
    data = {
        "status": "Issues found",
        "findings": [],
        "reading_order_issues": f"Could not parse LLM response: {str(e)}"
    }

status = data.get("status", "Issues found")
findings = data.get("findings", [])
reading_order = data.get("reading_order_issues", "None identified")

# Ensure severity values are valid
valid_severities = {"High", "Medium", "Low"}
for f in findings:
    if f.get("severity") not in valid_severities:
        f["severity"] = "Low"

print(f"## {page_name} — {route}")
print()
print(f"**Status:** {status}")
print()
print("### Findings")
print()
print("| Severity | Element | Description | Suggested Fix |")
print("|----------|---------|-------------|---------------|")

if findings:
    for f in findings:
        sev = f.get("severity", "Low")
        elem = str(f.get("element", "")).replace("|", "\\|")
        desc = str(f.get("description", "")).replace("|", "\\|")
        fix = str(f.get("suggested_fix", "")).replace("|", "\\|")
        print(f"| {sev} | {elem} | {desc} | {fix} |")
else:
    print("| — | — | No issues found | — |")

print()
print("### Reading Order Issues")
print()
if reading_order:
    print(reading_order)
else:
    print("None identified.")
print()
PYEOF
}

# ─── Skipped section fallback ─────────────────────────────────────────────────
skipped_section() {
    local page_name="$1"
    local route="$2"
    local reason="$3"
    echo "## $page_name — $route"
    echo ""
    echo "**Status:** Skipped"
    echo ""
    echo "### Findings"
    echo ""
    echo "| Severity | Element | Description | Suggested Fix |"
    echo "|----------|---------|-------------|---------------|"
    echo "| — | — | Page skipped: $reason | — |"
    echo ""
    echo "### Reading Order Issues"
    echo ""
    echo "Skipped."
    echo ""
}

# ─── Main: generate report ────────────────────────────────────────────────────
{
    echo "# Accessibility Review Report"
    echo ""
    echo "**Generated:** $(date '+%Y-%m-%d %H:%M:%S')"
    echo "**Target:** $BASE_URL"
    echo "**Tool:** a11y-check.sh (LLM semantic review via Anthropic Claude)"
    echo ""
    echo "> This report was generated by an LLM reviewing the accessibility tree of each page."
    echo "> It complements (but does not replace) the automated axe-core scan in \`AccessibilityE2ETest\`."
    echo "> Work through High findings first, then Medium, then Low."
    echo ""
    echo "---"
    echo ""
} > "$REPORT_FILE"

PAGE_COUNT=${#PAGE_NAMES[@]}

for i in "${!PAGE_NAMES[@]}"; do
    PAGE_NAME="${PAGE_NAMES[$i]}"
    PAGE_ROUTE="${PAGE_ROUTES[$i]}"
    PAGE_PATH="${PAGE_PATHS[$i]}"
    FULL_URL="$BASE_URL$PAGE_PATH"

    echo "[$((i+1))/$PAGE_COUNT] Scanning: $PAGE_NAME ($PAGE_ROUTE)"

    # Create a new Chrome tab
    TAB_ID=$(create_tab "$FULL_URL")
    if [[ -z "$TAB_ID" ]]; then
        echo "  WARNING: Could not create Chrome tab for $PAGE_NAME — skipping"
        skipped_section "$PAGE_NAME" "$PAGE_ROUTE" "tab creation failed" >> "$REPORT_FILE"
        continue
    fi

    # Get the WebSocket URL for this tab
    WS_URL=$(get_ws_url "$TAB_ID")
    if [[ -z "$WS_URL" ]]; then
        echo "  WARNING: No WebSocket URL for tab $TAB_ID — skipping"
        close_tab "$TAB_ID"
        skipped_section "$PAGE_NAME" "$PAGE_ROUTE" "no WebSocket URL" >> "$REPORT_FILE"
        continue
    fi

    # Capture accessibility tree via CDP
    echo "  Capturing accessibility tree..."
    A11Y_JSON=$(cdp_get_ax_tree "$WS_URL" "$FULL_URL" 2>/dev/null || echo '{"nodes":[],"error":"capture exception"}')
    close_tab "$TAB_ID"

    # Call LLM for semantic review
    echo "  Sending to LLM for review..."
    LLM_RESULT=$(call_llm "$PAGE_NAME" "$PAGE_ROUTE" "$A11Y_JSON" 2>/dev/null || echo '{"status":"Issues found","findings":[],"reading_order_issues":"LLM call failed"}')

    # Write section to report
    format_section "$PAGE_NAME" "$PAGE_ROUTE" "$LLM_RESULT" >> "$REPORT_FILE"

    echo "  Done."
done

echo ""
echo "Report written to: $REPORT_FILE"
echo ""
echo "Next steps:"
echo "  1. Open $REPORT_FILE"
echo "  2. Work through High findings first"
echo "  3. Re-run a11y-check.sh after fixes to confirm findings are resolved"
echo "  4. Medium and Low findings feed the backlog, not a blocker"
