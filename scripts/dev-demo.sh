#!/usr/bin/env bash
# dev-demo.sh — run server + frontend with mock Anthropic API (no real tokens)
# Usage:
#   ./scripts/dev-demo.sh          # mock API + server + frontend
#   ./scripts/dev-demo.sh server   # mock API + server only
#   ./scripts/dev-demo.sh aider    # mock API + aider (pass extra args after)

set -e

MOCK_PORT=3333
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$SCRIPT_DIR/.."

# start mock Anthropic API in background
echo "[demo] Starting mock Anthropic API on port $MOCK_PORT..."
node "$SCRIPT_DIR/mock-anthropic.js" &
MOCK_PID=$!

# give it a moment to bind
sleep 0.5

# inject env — redirects any Anthropic SDK call to the mock
export ANTHROPIC_BASE_URL="http://localhost:$MOCK_PORT"
export ANTHROPIC_API_KEY="mock-key-no-tokens"

echo "[demo] ANTHROPIC_BASE_URL=$ANTHROPIC_BASE_URL"
echo "[demo] Real API key untouched in .env"

cleanup() {
  echo "[demo] Shutting down mock..."
  kill $MOCK_PID 2>/dev/null
}
trap cleanup EXIT

MODE="${1:-all}"

case "$MODE" in
  server)
    echo "[demo] Starting server only..."
    cd "$ROOT/server" && npm run dev
    ;;
  aider)
    echo "[demo] Starting aider with mock API..."
    shift
    aider "$@"
    ;;
  all|*)
    echo "[demo] Starting server + frontend..."
    cd "$ROOT/server" && npm run dev &
    SERVER_PID=$!
    sleep 1
    cd "$ROOT/frontend" && npm run dev
    kill $SERVER_PID 2>/dev/null
    ;;
esac
