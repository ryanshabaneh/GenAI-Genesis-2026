#!/usr/bin/env bash
# test-agent.sh — Test the agent pipeline using Claude Code CLI instead of aider + Anthropic API key.
# Usage: ./scripts/test-agent.sh <repo-path> <building-id>
# Example: ./scripts/test-agent.sh /tmp/shipcity-repos/my-repo tests
#
# This builds the same prompt the orchestrator would send to aider,
# but pipes it through `claude -p` (which is already authenticated).

set -euo pipefail

REPO_PATH="${1:?Usage: test-agent.sh <repo-path> <building-id>}"
BUILDING="${2:?Usage: test-agent.sh <repo-path> <building-id>}"

if [ ! -d "$REPO_PATH" ]; then
  echo "Error: $REPO_PATH is not a directory"
  exit 1
fi

# Pull the building prompt from our prompts file
PROMPT_FILE="$(dirname "$0")/../src/agents/prompts/index.ts"
if [ ! -f "$PROMPT_FILE" ]; then
  echo "Error: prompts file not found at $PROMPT_FILE"
  exit 1
fi

echo "=== ShipCity Agent Test ==="
echo "Repo:     $REPO_PATH"
echo "Building: $BUILDING"
echo ""

# Build the message (same structure aider.ts builds)
MESSAGE="You are a ShipCity builder agent for the \"$BUILDING\" building.

Analyze the repository and fix any issues related to this building's category.
Edit existing files or create new ones as needed.
Output each file with a \`// File: path\` comment before the code block.

Look at the repo and complete any incomplete tasks for the \"$BUILDING\" category."

echo "--- Calling Claude Code CLI ---"
echo ""

# Run claude in print mode from the repo directory
# This uses the same auth as the current Claude Code session — no API key needed
cd "$REPO_PATH"
claude -p "$MESSAGE" --output-format text

echo ""
echo "--- Done ---"
echo "Check the output above for generated code blocks."
