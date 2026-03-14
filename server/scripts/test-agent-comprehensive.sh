#!/usr/bin/env bash
# test-agent-comprehensive.sh
# End-to-end test of the agent pipeline across 3 repo tiers:
#   1. BARE     — just a README
#   2. PARTIAL  — README + some source code, no infra
#   3. PRODUCTION — mostly complete, minor gaps
#
# For each repo, runs agents on key buildings via `claude -p`,
# captures output, writes files, then analyzes what was produced.
#
# Usage: ./scripts/test-agent-comprehensive.sh [buildings...]
# Default buildings: tests cicd docker security
# Example: ./scripts/test-agent-comprehensive.sh tests cicd

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TEST_ROOT="/tmp/shipcity-agent-tests"
RESULTS_DIR="$TEST_ROOT/results"
BUILDINGS=("${@:-tests cicd docker security}")
if [ "$#" -eq 0 ]; then
  BUILDINGS=(tests cicd docker security)
fi

PASS=0
FAIL=0
TOTAL=0

rm -rf "$TEST_ROOT"
mkdir -p "$RESULTS_DIR"

# ─────────────────────────────────────────────
# Utility functions
# ─────────────────────────────────────────────

log()  { echo -e "\033[1;34m[INFO]\033[0m $*"; }
pass() { echo -e "\033[1;32m[PASS]\033[0m $*"; ((PASS++)); ((TOTAL++)); }
fail() { echo -e "\033[1;31m[FAIL]\033[0m $*"; ((FAIL++)); ((TOTAL++)); }
warn() { echo -e "\033[1;33m[WARN]\033[0m $*"; }

check_file_exists() {
  local repo="$1" file="$2" label="$3"
  if [ -f "$repo/$file" ]; then
    pass "$label — $file created"
    return 0
  else
    fail "$label — $file NOT created"
    return 1
  fi
}

check_output_has_codeblocks() {
  local output_file="$1" label="$2"
  local count
  count=$(grep -c '```' "$output_file" 2>/dev/null || echo 0)
  if [ "$count" -ge 2 ]; then
    pass "$label — output contains code blocks ($((count/2)) blocks)"
    return 0
  else
    fail "$label — output has NO code blocks"
    return 1
  fi
}

check_output_no_placeholders() {
  local output_file="$1" label="$2"
  if grep -qiE '(TODO|FIXME|implement me|placeholder|your.*here)' "$output_file" 2>/dev/null; then
    fail "$label — output contains placeholder/TODO markers"
    return 1
  else
    pass "$label — no placeholder markers found"
    return 0
  fi
}

check_output_not_empty() {
  local output_file="$1" label="$2"
  local lines
  lines=$(wc -l < "$output_file")
  if [ "$lines" -gt 5 ]; then
    pass "$label — output is substantive ($lines lines)"
    return 0
  else
    fail "$label — output is too short ($lines lines)"
    return 1
  fi
}

check_output_has_file_paths() {
  local output_file="$1" label="$2"
  if grep -qE '(// File:|File:|\.ts|\.js|\.yml|\.yaml|\.json|Dockerfile)' "$output_file" 2>/dev/null; then
    pass "$label — output references actual file paths"
    return 0
  else
    fail "$label — output missing file path references"
    return 1
  fi
}

extract_and_write_files() {
  local output_file="$1" repo="$2"
  # Extract "// File: path" + code blocks and write them to disk
  python3 -c "
import re, os, sys

text = open('$output_file').read()

# Match // File: path followed by a code block
pattern = r'(?://\s*File:\s*(.+?)\n)?\`\`\`\w*\n([\s\S]*?)\`\`\`'
matches = re.findall(pattern, text)

written = 0
for path, content in matches:
    path = path.strip() if path else None
    if not path or path == 'snippet':
        continue
    full = os.path.join('$repo', path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, 'w') as f:
        f.write(content)
    written += 1
    print(f'  Wrote: {path}')

print(f'Total files written: {written}')
" 2>/dev/null || warn "Could not extract/write files from output"
}

# ─────────────────────────────────────────────
# Create test repositories
# ─────────────────────────────────────────────

create_bare_repo() {
  local repo="$TEST_ROOT/bare-repo"
  mkdir -p "$repo"
  cd "$repo" && git init -q

  cat > README.md << 'EOF'
# My App
A simple web app.
EOF

  cat > package.json << 'PKGJSON'
{
  "name": "my-app",
  "version": "1.0.0",
  "main": "src/index.js",
  "scripts": {},
  "dependencies": {}
}
PKGJSON

  git add -A && git commit -q -m "init"
  echo "$repo"
}

create_partial_repo() {
  local repo="$TEST_ROOT/partial-repo"
  mkdir -p "$repo/src/routes" "$repo/src/utils"
  cd "$repo" && git init -q

  cat > README.md << 'EOF'
# TaskAPI
A REST API for managing tasks.
## Setup
npm install && npm run dev
EOF

  cat > package.json << 'PKGJSON'
{
  "name": "task-api",
  "version": "1.0.0",
  "main": "src/index.ts",
  "scripts": {
    "dev": "ts-node src/index.ts"
  },
  "dependencies": {
    "express": "^4.18.0",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "ts-node": "^10.9.0",
    "@types/express": "^4.17.0"
  }
}
PKGJSON

  cat > tsconfig.json << 'TSC'
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true
  }
}
TSC

  cat > src/index.ts << 'SRC'
import express from 'express'
import cors from 'cors'
import { taskRouter } from './routes/tasks'

const app = express()
app.use(cors())
app.use(express.json())
app.use('/api/tasks', taskRouter)

app.listen(3000, () => console.log('Server running on 3000'))
SRC

  cat > src/routes/tasks.ts << 'ROUTES'
import { Router } from 'express'

const router = Router()

interface Task { id: string; title: string; done: boolean }
const tasks: Task[] = []

router.get('/', (req, res) => {
  res.json(tasks)
})

router.post('/', (req, res) => {
  const task: Task = { id: String(Date.now()), title: req.body.title, done: false }
  tasks.push(task)
  res.status(201).json(task)
})

router.put('/:id', (req, res) => {
  const task = tasks.find(t => t.id === req.params.id)
  if (!task) return res.status(404).json({ error: 'Not found' })
  task.title = req.body.title ?? task.title
  task.done = req.body.done ?? task.done
  res.json(task)
})

router.delete('/:id', (req, res) => {
  const idx = tasks.findIndex(t => t.id === req.params.id)
  if (idx === -1) return res.status(404).json({ error: 'Not found' })
  tasks.splice(idx, 1)
  res.status(204).send()
})

export { router as taskRouter }
ROUTES

  cat > src/utils/validate.ts << 'UTIL'
export function validateTitle(title: unknown): string {
  if (typeof title !== 'string' || title.trim().length === 0) {
    throw new Error('Title is required')
  }
  return title.trim()
}
UTIL

  git add -A && git commit -q -m "init"
  echo "$repo"
}

create_production_repo() {
  local repo="$TEST_ROOT/production-repo"
  mkdir -p "$repo/src/routes" "$repo/src/middleware" "$repo/src/utils" "$repo/tests" "$repo/.github/workflows"
  cd "$repo" && git init -q

  cat > README.md << 'EOF'
# TaskAPI
A production-ready REST API for task management.

## Setup
```bash
npm install
cp .env.example .env
npm run dev
```

## Usage
- GET /api/tasks — list all tasks
- POST /api/tasks — create a task
- PUT /api/tasks/:id — update a task
- DELETE /api/tasks/:id — delete a task
- GET /health — health check

## Testing
```bash
npm test
```
EOF

  cat > package.json << 'PKGJSON'
{
  "name": "task-api",
  "version": "1.0.0",
  "main": "dist/index.js",
  "scripts": {
    "dev": "ts-node src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "lint": "eslint src/"
  },
  "dependencies": {
    "express": "^4.18.0",
    "cors": "^2.8.5",
    "helmet": "^7.0.0",
    "winston": "^3.11.0",
    "dotenv": "^16.3.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "ts-node": "^10.9.0",
    "vitest": "^1.0.0",
    "@types/express": "^4.17.0",
    "eslint": "^8.50.0"
  }
}
PKGJSON

  cat > .env.example << 'ENV'
PORT=3000
NODE_ENV=development
CORS_ORIGINS=http://localhost:3000
ENV

  cat > .gitignore << 'GI'
node_modules/
dist/
.env
coverage/
GI

  cat > src/index.ts << 'SRC'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import dotenv from 'dotenv'
import { taskRouter } from './routes/tasks'
import { errorHandler } from './middleware/errors'
import { logger } from './utils/logger'

dotenv.config()

const app = express()
const PORT = parseInt(process.env.PORT || '3000', 10)

app.use(helmet())
app.use(cors({ origin: process.env.CORS_ORIGINS?.split(',') || '*' }))
app.use(express.json())

app.get('/health', (_req, res) => res.json({ status: 'ok', uptime: process.uptime() }))
app.use('/api/tasks', taskRouter)
app.use(errorHandler)

const server = app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Server running on port ${PORT}`)
})

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down')
  server.close(() => process.exit(0))
})
SRC

  cat > src/routes/tasks.ts << 'ROUTES'
import { Router } from 'express'
import { validateTitle } from '../utils/validate'

const router = Router()

interface Task { id: string; title: string; done: boolean }
const tasks: Task[] = []

router.get('/', (_req, res) => {
  res.json(tasks)
})

router.post('/', (req, res, next) => {
  try {
    const title = validateTitle(req.body.title)
    const task: Task = { id: String(Date.now()), title, done: false }
    tasks.push(task)
    res.status(201).json(task)
  } catch (err) {
    next(err)
  }
})

router.put('/:id', (req, res, next) => {
  try {
    const task = tasks.find(t => t.id === req.params.id)
    if (!task) return res.status(404).json({ error: 'Not found' })
    if (req.body.title) task.title = validateTitle(req.body.title)
    task.done = req.body.done ?? task.done
    res.json(task)
  } catch (err) {
    next(err)
  }
})

router.delete('/:id', (_req, res) => {
  const idx = tasks.findIndex(t => t.id === _req.params.id)
  if (idx === -1) return res.status(404).json({ error: 'Not found' })
  tasks.splice(idx, 1)
  res.status(204).send()
})

export { router as taskRouter }
ROUTES

  cat > src/middleware/errors.ts << 'MID'
import { Request, Response, NextFunction } from 'express'
import { logger } from '../utils/logger'

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  logger.error(err.message)
  res.status(400).json({ error: err.message })
}
MID

  cat > src/utils/logger.ts << 'LOG'
import winston from 'winston'

export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    process.env.NODE_ENV === 'production'
      ? winston.format.json()
      : winston.format.simple()
  ),
  transports: [new winston.transports.Console()],
})
LOG

  cat > src/utils/validate.ts << 'UTIL'
export function validateTitle(title: unknown): string {
  if (typeof title !== 'string' || title.trim().length === 0) {
    throw new Error('Title is required')
  }
  return title.trim()
}
UTIL

  cat > tests/tasks.test.ts << 'TEST'
import { describe, it, expect } from 'vitest'
import { validateTitle } from '../src/utils/validate'

describe('validateTitle', () => {
  it('returns trimmed title', () => {
    expect(validateTitle('  hello  ')).toBe('hello')
  })
  it('throws on empty', () => {
    expect(() => validateTitle('')).toThrow()
  })
})
TEST

  cat > .github/workflows/ci.yml << 'CI'
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm test
      - run: npm run lint
CI

  git add -A && git commit -q -m "init"
  echo "$repo"
}

# ─────────────────────────────────────────────
# Run agent on a repo for a specific building
# ─────────────────────────────────────────────

run_agent() {
  local repo="$1" building="$2" tier="$3"
  local label="[$tier/$building]"
  local output_file="$RESULTS_DIR/${tier}_${building}.txt"

  log "$label Running agent..."

  # Build prompt in a temp file to avoid shell quoting issues
  local prompt_file="$RESULTS_DIR/${tier}_${building}_prompt.txt"

  {
    echo "You are a ShipCity builder agent for the \"$building\" building."
    echo ""
    echo "Here are the files in the repository:"
    echo ""
    cd "$repo" && find . -not -path './.git/*' -not -path './node_modules/*' -type f | head -30 | while read -r f; do
      echo "=== $f ==="
      head -100 "$f" 2>/dev/null
      echo ""
    done
    echo ""
    echo "Analyze this repository and fix any issues related to the \"$building\" category."
    echo "Edit existing files or create new ones as needed."
    echo "Output each file with a // File: path/to/file comment before the code block."
    echo "Generate real working code. Do NOT use placeholders, TODOs, or stubs."
    echo "Do NOT use any tools — just output the code as text."
  } > "$prompt_file"

  cd "$repo"
  if claude -p "$(cat "$prompt_file")" --output-format text --max-turns 2 > "$output_file" 2>&1; then
    log "$label Claude returned output"
  else
    fail "$label Claude CLI failed"
    return 1
  fi

  # Run checks on the output
  check_output_not_empty "$output_file" "$label"
  check_output_has_codeblocks "$output_file" "$label"
  check_output_has_file_paths "$output_file" "$label"
  check_output_no_placeholders "$output_file" "$label"

  # Try to extract and write files to repo
  log "$label Extracting files..."
  extract_and_write_files "$output_file" "$repo"

  echo ""
}

# ─────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║   ShipCity Agent Comprehensive Test Suite        ║"
echo "║   Testing buildings: ${BUILDINGS[*]}"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# Create repos
log "Creating test repositories..."
BARE_REPO=$(create_bare_repo)
log "  bare-repo:       $BARE_REPO"
PARTIAL_REPO=$(create_partial_repo)
log "  partial-repo:    $PARTIAL_REPO"
PROD_REPO=$(create_production_repo)
log "  production-repo: $PROD_REPO"
echo ""

# Run agents on each tier
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  TIER 1: BARE REPO (just a README + empty package.json)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
for b in "${BUILDINGS[@]}"; do
  run_agent "$BARE_REPO" "$b" "bare"
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  TIER 2: PARTIAL REPO (source code, no infra)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
for b in "${BUILDINGS[@]}"; do
  run_agent "$PARTIAL_REPO" "$b" "partial"
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  TIER 3: PRODUCTION REPO (mostly complete)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
for b in "${BUILDINGS[@]}"; do
  run_agent "$PROD_REPO" "$b" "production"
done

# ─────────────────────────────────────────────
# Final report
# ─────────────────────────────────────────────

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║   RESULTS                                        ║"
echo "╠══════════════════════════════════════════════════╣"
echo "║   Total checks: $TOTAL"
echo "║   Passed:       $PASS"
echo "║   Failed:       $FAIL"
echo "╚══════════════════════════════════════════════════╝"
echo ""
echo "Raw outputs saved to: $RESULTS_DIR"
echo ""
ls -la "$RESULTS_DIR"
echo ""

# Show a summary of what was generated per tier
for tier in bare partial production; do
  echo "--- $tier repo: files generated ---"
  repo_path="$TEST_ROOT/${tier}-repo"
  cd "$repo_path"
  git diff --stat HEAD 2>/dev/null || true
  git ls-files --others --exclude-standard 2>/dev/null | head -20
  echo ""
done

if [ "$FAIL" -gt 0 ]; then
  echo "Some checks failed. Review the outputs in $RESULTS_DIR"
  exit 1
else
  echo "All checks passed!"
  exit 0
fi
