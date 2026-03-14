#!/usr/bin/env bash
# test-full-pipeline-local.sh
# Runs the full scanner → analysis agent pipeline using claude CLI for phase 2.
# No API key needed — uses your existing Claude Code auth.
# Usage: ./scripts/test-full-pipeline-local.sh /path/to/repo

set -euo pipefail

REPO="${1:?Usage: test-full-pipeline-local.sh /path/to/repo}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RESULTS_DIR="/tmp/shipcity-pipeline-results"

rm -rf "$RESULTS_DIR"
mkdir -p "$RESULTS_DIR"

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  FULL PIPELINE TEST: $REPO"
echo "════════════════════════════════════════════════════════════"

# Phase 1: run the scanner (no LLM needed)
echo ""
echo "─── PHASE 1: HEURISTIC SCAN ───"
echo ""
cd "$SCRIPT_DIR/.." && npx ts-node scripts/run-scanner.ts "$REPO" 2>/dev/null | tee "$RESULTS_DIR/phase1.txt"

# Phase 2: for each building, call claude CLI to generate deeper tasks
echo ""
echo "─── PHASE 2: DEEP ANALYSIS (claude CLI) ───"
echo ""

# Build repo snapshot
SNAPSHOT=$(cd "$REPO" && find . -not -path './.git/*' -not -path './node_modules/*' -type f | head -30 | while read -r f; do
  echo "=== $f ==="
  head -100 "$f" 2>/dev/null
  echo ""
done)

BUILDINGS=(documentation tests envVars security logging cicd docker deployment)

for building in "${BUILDINGS[@]}"; do
  echo -n "  Analyzing $building... "

  PROMPT="You are a ShipCity analysis agent for the \"$building\" building.

Here are the files in the repository:

$SNAPSHOT

The heuristic scanner already found these baseline tasks. Now look DEEPER at the actual code and find additional issues the scanner missed.

Return ONLY a JSON array of additional task objects — no markdown fences, no explanation:
[{\"id\": \"unique-id\", \"label\": \"Specific actionable task\", \"done\": false}]

Rules:
- Only add NEW tasks the scanner would miss (code quality, missing error handling, bad patterns, etc.)
- Each task must be specific to THIS repo's actual code
- 2-6 tasks max, focus on most impactful
- Set done=true if the repo already handles it, false if not"

  OUTPUT=$(claude -p "$PROMPT" --output-format text --max-turns 2 2>&1 || echo "[]")

  # Extract JSON array from response
  JSON=$(echo "$OUTPUT" | grep -oP '\[.*\]' | head -1 || echo "[]")

  if [ -z "$JSON" ] || [ "$JSON" = "[]" ]; then
    echo "0 additional tasks"
    echo "[]" > "$RESULTS_DIR/${building}_tasks.json"
  else
    COUNT=$(echo "$JSON" | python3 -c "import sys,json; print(len(json.loads(sys.stdin.read())))" 2>/dev/null || echo "$JSON" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).length)}catch{console.log(0)}})")
    echo "+$COUNT tasks"
    echo "$JSON" > "$RESULTS_DIR/${building}_tasks.json"
  fi
done

# Print combined report
echo ""
echo "════════════════════════════════════════════════════════════"
echo "  PHASE 2 RESULTS — AGENT-DISCOVERED TASKS"
echo "════════════════════════════════════════════════════════════"

for building in "${BUILDINGS[@]}"; do
  FILE="$RESULTS_DIR/${building}_tasks.json"
  if [ -f "$FILE" ] && [ "$(cat "$FILE")" != "[]" ]; then
    echo ""
    echo "┌─ $building (agent tasks)"
    echo "│"
    # Pretty print each task
    node -e "
      const tasks = JSON.parse(require('fs').readFileSync('$FILE','utf8'));
      tasks.forEach(t => {
        const icon = t.done ? '✅' : '❌';
        console.log('│  ' + icon + ' [' + t.id + '] ' + t.label);
      });
    " 2>/dev/null || cat "$FILE"
    echo "└──────────────────────────────────────────"
  fi
done

echo ""
echo "Raw results: $RESULTS_DIR"
echo ""
