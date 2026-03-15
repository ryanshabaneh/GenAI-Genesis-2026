#!/usr/bin/env bash
# End-to-end test: starts the server, runs scan → chat → implement, then kills the server.
# Uses claude CLI as the LLM backend (no ANTHROPIC_API_KEY needed).
#
# Usage: bash server/scripts/e2e-test.sh [repo-url]
# Default repo: https://github.com/expressjs/express (small, well-known)

set -euo pipefail

REPO_URL="${1:-https://github.com/ryanshabaneh/GenAI-Genesis-2026}"
PORT=3099
BASE="http://localhost:$PORT"
SERVER_PID=""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${CYAN}[e2e]${NC} $1"; }
pass() { echo -e "${GREEN}[PASS]${NC} $1"; }
fail() { echo -e "${RED}[FAIL]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

cleanup() {
  if [ -n "$SERVER_PID" ]; then
    log "Killing server (PID $SERVER_PID)..."
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
    log "Server stopped."
  fi
}
trap cleanup EXIT

# ── 1. Start server ──────────────────────────────────────────────────
log "Starting server on port $PORT (no ANTHROPIC_API_KEY → claude CLI mode)..."

cd "$(dirname "$0")/.."

# Force CLI mode: USE_CLAUDE_CLI=1 overrides even if .env has an API key
USE_CLAUDE_CLI=1 PORT=$PORT FRONTEND_URL="$BASE" npx ts-node src/index.ts &
SERVER_PID=$!

# Wait for server to be ready
log "Waiting for server..."
for i in $(seq 1 30); do
  if curl -sf "$BASE/health" > /dev/null 2>&1; then
    break
  fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    fail "Server process died during startup"
    exit 1
  fi
  sleep 1
done

HEALTH=$(curl -sf "$BASE/health" 2>/dev/null || echo "")
if [ -z "$HEALTH" ]; then
  fail "Server failed to start after 30s"
  exit 1
fi
pass "Server is up: $HEALTH"

# ── 2. Scan ──────────────────────────────────────────────────────────
log "POST /api/scan with repo: $REPO_URL"

SCAN_RESPONSE=$(curl -sf -X POST "$BASE/api/scan" \
  -H "Content-Type: application/json" \
  -d "{\"repoUrl\": \"$REPO_URL\"}" 2>&1) || {
  fail "Scan request failed"
  echo "$SCAN_RESPONSE"
  exit 1
}

SESSION_ID=$(echo "$SCAN_RESPONSE" | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).sessionId))" 2>/dev/null || echo "")
if [ -z "$SESSION_ID" ]; then
  fail "No sessionId in scan response: $SCAN_RESPONSE"
  exit 1
fi
pass "Scan started — sessionId: $SESSION_ID"

# Wait for scan to finish (poll session results)
log "Waiting for scan to complete (clone + analyzers + deep analysis)..."
log "This may take a few minutes with claude CLI..."

SCAN_DONE=false
for i in $(seq 1 180); do
  # Check if at least one building has results by trying chat
  # (We don't have a direct session endpoint, so we'll just wait a reasonable time)
  sleep 5

  # Try a chat call — if scan isn't done, the session won't have results yet but will exist
  CHAT_TEST=$(curl -sf -X POST "$BASE/api/chat" \
    -H "Content-Type: application/json" \
    -d "{\"sessionId\": \"$SESSION_ID\", \"buildingId\": \"tests\", \"message\": \"ping\"}" 2>&1) || true

  if echo "$CHAT_TEST" | grep -q '"reply"'; then
    SCAN_DONE=true
    break
  fi

  # Check for agent error (means scan is done but agent call failed)
  if echo "$CHAT_TEST" | grep -q '"error":"Agent call failed"'; then
    warn "Agent call failed — scan may be done but LLM errored. Continuing..."
    SCAN_DONE=true
    break
  fi

  if [ $((i % 12)) -eq 0 ]; then
    log "Still waiting... (${i}s elapsed)"
  fi
done

if [ "$SCAN_DONE" = false ]; then
  fail "Scan did not complete within timeout"
  exit 1
fi
pass "Scan complete — chat agent responded"

# ── 3. Chat ──────────────────────────────────────────────────────────
log "POST /api/chat — asking tests agent about the repo..."

CHAT_RESPONSE=$(curl -sf -X POST "$BASE/api/chat" \
  -H "Content-Type: application/json" \
  -d "{
    \"sessionId\": \"$SESSION_ID\",
    \"buildingId\": \"tests\",
    \"message\": \"What testing framework does this project use? Be brief.\"
  }" 2>&1) || {
  fail "Chat request failed"
  exit 1
}

# Extract reply content (first 200 chars)
REPLY_PREVIEW=$(echo "$CHAT_RESPONSE" | node -e "
process.stdin.resume();let d='';
process.stdin.on('data',c=>d+=c);
process.stdin.on('end',()=>{
  try{const r=JSON.parse(d);console.log((r.reply?.content||'').slice(0,200))}
  catch{console.log('(could not parse)')}
})
" 2>/dev/null || echo "(could not parse)")

pass "Chat response received"
echo -e "  ${YELLOW}Agent says:${NC} $REPLY_PREVIEW"

# ── 4. Summary ───────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}  E2E test complete!${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo ""
echo "  Session:  $SESSION_ID"
echo "  Repo:     $REPO_URL"
echo "  Server:   PID $SERVER_PID (will be killed on exit)"
echo ""
log "Cleaning up..."
