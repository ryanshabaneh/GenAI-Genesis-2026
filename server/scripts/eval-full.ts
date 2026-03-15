// server/scripts/eval-full.ts
// Full scan: heuristic + ONE LLM call for deep analysis via claude CLI.
// Usage: npx ts-node scripts/eval-full.ts <repo-url-or-local-path>

import path from 'path'
import fs from 'fs'
import os from 'os'
import { spawn } from 'child_process'

import { documentationAnalyzer } from '../src/scanner/analyzers/documentation'
import { testsAnalyzer } from '../src/scanner/analyzers/tests'
import { envVarsAnalyzer } from '../src/scanner/analyzers/envVars'
import { securityAnalyzer } from '../src/scanner/analyzers/security'
import { loggingAnalyzer } from '../src/scanner/analyzers/logging'
import { cicdAnalyzer } from '../src/scanner/analyzers/cicd'
import { dockerAnalyzer } from '../src/scanner/analyzers/docker'
import { deploymentAnalyzer } from '../src/scanner/analyzers/deployment'
import { buildSlimContext } from '../src/agents/context'
import { buildScannerPreprompt } from '../src/agents/scanner-context'
import { mergeTasks } from '../src/agents/analyzer'
import type { AnalyzerContext } from '../src/scanner/analyzers/base'
import type { AnalyzerResult, BuildingId, Task } from '../src/types'

const ANALYZERS = [
  documentationAnalyzer, testsAnalyzer, envVarsAnalyzer, securityAnalyzer,
  loggingAnalyzer, cicdAnalyzer, dockerAnalyzer, deploymentAnalyzer,
]

const BUILDING_DOMAINS: Record<BuildingId, string> = {
  tests: 'test framework, test files, test coverage, test scripts',
  cicd: 'CI/CD pipelines, GitHub Actions, build/test automation workflows',
  docker: 'Dockerfile, docker-compose, .dockerignore, container best practices',
  documentation: 'README quality, API documentation, setup instructions, code comments',
  envVars: '.env files, environment variable management, config loading, hardcoded config',
  security: 'secrets in code, .gitignore coverage, input validation, auth, CORS, HTTP headers',
  logging: 'logging library, log levels, structured logging, request logging, log configuration',
  deployment: 'deploy config, build/start scripts, PORT binding, health checks, production readiness',
}

// ── Logging ──────────────────────────────────────────────────────

const CYAN = '\x1b[36m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const DIM = '\x1b[2m'
const RESET = '\x1b[0m'

function log(msg: string) { console.log(`${CYAN}[scan]${RESET} ${msg}`) }
function detail(msg: string) { console.log(`${DIM}       ${msg}${RESET}`) }

// ── Claude CLI ───────────────────────────────────────────────────

async function callClaude(systemPrompt: string, userMessage: string): Promise<string> {
  const fullPrompt = `[System]\n${systemPrompt}\n\n[User]\n${userMessage}`
  const promptSize = (fullPrompt.length / 1024).toFixed(1)
  log(`📡 Sending ${promptSize}KB to claude CLI...`)

  const start = Date.now()
  return new Promise((resolve) => {
    const proc = spawn('claude', ['-p', '--output-format', 'json', '--model', 'claude-sonnet-4-6', '--max-turns', '1'], {
      shell: true,
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString() })
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString() })

    proc.on('close', (code) => {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1)
      if (code !== 0 || !stdout.trim()) {
        log(`❌ Claude CLI failed after ${elapsed}s (exit ${code})`)
        detail(stderr.slice(0, 200))
        resolve('{}')
        return
      }
      log(`✅ Response in ${elapsed}s`)
      try {
        const envelope = JSON.parse(stdout)
        resolve(envelope.result ?? '{}')
      } catch {
        log(`⚠ Could not parse JSON envelope`)
        resolve('{}')
      }
    })

    proc.on('error', (err) => {
      log(`❌ Spawn error: ${err.message}`)
      resolve('{}')
    })

    proc.stdin.write(fullPrompt)
    proc.stdin.end()
  })
}

// ── Package.json merge ───────────────────────────────────────────

async function loadMergedPackageJson(repoPath: string) {
  const load = (p: string) => {
    if (!fs.existsSync(p)) return null
    try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return null }
  }
  const rootPkg = load(path.join(repoPath, 'package.json'))
  const skip = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '.cache'])
  const subPkgs: Record<string, unknown>[] = []
  try {
    for (const entry of fs.readdirSync(repoPath, { withFileTypes: true })) {
      if (!entry.isDirectory() || skip.has(entry.name)) continue
      const sub = load(path.join(repoPath, entry.name, 'package.json'))
      if (sub) { subPkgs.push(sub); detail(`found ${entry.name}/package.json`) }
    }
  } catch {}
  if (subPkgs.length === 0) return rootPkg
  const merged: Record<string, unknown> = rootPkg ? { ...rootPkg } : {}
  for (const field of ['dependencies', 'devDependencies', 'scripts']) {
    const base = (merged[field] as Record<string, unknown>) ?? {}
    for (const sub of subPkgs) {
      const sf = sub[field] as Record<string, unknown> | undefined
      if (sf) Object.assign(base, sf)
    }
    if (Object.keys(base).length > 0) merged[field] = base
  }
  return Object.keys(merged).length > 0 ? merged : null
}

// ── Main ─────────────────────────────────────────────────────────

async function main() {
  let repoPath = process.argv[2]
  if (!repoPath) {
    console.error('Usage: npx ts-node scripts/eval-full.ts <repo-url-or-local-path>')
    process.exit(1)
  }

  if (repoPath.startsWith('http') || repoPath.startsWith('github.com')) {
    const { cloneRepo } = await import('../src/scanner/clone')
    const tmpDir = path.join(os.tmpdir(), 'shipcity-eval')
    log(`📦 Cloning ${repoPath}...`)
    repoPath = await cloneRepo(repoPath, tmpDir)
    log(`   → ${repoPath}`)
  } else {
    repoPath = path.resolve(repoPath)
  }

  log(`Loading package.json (+ monorepo merge)...`)
  const packageJson = await loadMergedPackageJson(repoPath)
  const ctx: AnalyzerContext = { repoPath, packageJson }

  // ── Phase 1: Heuristic ──────────────────────────────────────
  console.log(`\n${GREEN}── Phase 1: Heuristic Scan ──${RESET}\n`)
  const results: AnalyzerResult[] = []
  for (const a of ANALYZERS) {
    const r = await a.analyze(ctx)
    results.push(r)
    const icon = r.percent === 100 ? '✅' : r.percent >= 50 ? '🟡' : '🔴'
    log(`${icon} ${r.buildingId} — ${r.percent}%`)
    for (const t of r.tasks) detail(`${t.done ? '✓' : '✗'} ${t.label}`)
  }

  // ── Phase 2: ONE LLM call for all buildings ─────────────────
  console.log(`\n${GREEN}── Phase 2: Deep Analysis (1 LLM call) ──${RESET}\n`)

  log('Building slim repo context...')
  const context = await buildSlimContext('deployment', repoPath)
  detail(`context: ${(context.length / 1024).toFixed(1)}KB`)

  // Build scanner summaries
  const scannerSummaries = results.map((r) => {
    return `### ${r.buildingId.toUpperCase()}\n${buildScannerPreprompt(r)}`
  }).join('\n\n')

  const domainList = Object.entries(BUILDING_DOMAINS)
    .map(([b, d]) => `- **${b}**: ${d}`).join('\n')

  const systemPrompt = `You are a codebase analyzer. You review repositories and identify additional tasks that a heuristic scanner missed. You analyze ALL 8 building domains in a single pass.

## Building Domains
${domainList}

## Repository Context
${context}`

  const userMessage = `## Scanner Results (all 8 buildings)

${scannerSummaries}

---

For each building, generate additional tasks the scanner missed.

Rules:
1. If the FOUNDATION for a domain doesn't exist (no Dockerfile, no CI config, no test framework), return [] for that building. Only add refinement tasks for things that ALREADY EXIST.
2. No cross-building duplication — each task belongs to exactly ONE building.
3. Be specific — reference actual files, functions, or patterns from the repo.
4. Max 4 tasks per building. Return [] if the scanner already covers everything.
5. Task IDs must start with the building prefix (e.g., "tests-...", "docker-...").

Return ONLY a JSON object. No markdown fences, no explanation:
{"tests":[],"cicd":[],"docker":[],"documentation":[],"envVars":[],"security":[],"logging":[],"deployment":[]}`

  const totalStart = Date.now()
  const text = await callClaude(systemPrompt, userMessage)
  const totalElapsed = ((Date.now() - totalStart) / 1000).toFixed(1)

  // Parse response
  let allAgentTasks = new Map<BuildingId, Task[]>()
  try {
    const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
    const parsed = JSON.parse(cleaned) as Record<string, Task[]>

    for (const [bid, tasks] of Object.entries(parsed)) {
      if (!Array.isArray(tasks)) continue
      const valid = tasks
        .filter((t) => t && typeof t.id === 'string' && typeof t.label === 'string' && typeof t.done === 'boolean')
        .map((t) => ({ id: t.id, label: t.label, done: t.done }))
      allAgentTasks.set(bid as BuildingId, valid)

      if (valid.length > 0) {
        log(`${bid}: +${valid.length} tasks`)
        for (const t of valid) detail(`${t.done ? '✓' : '✗'} ${t.label}`)
      }
    }
  } catch (err) {
    log(`⚠ Could not parse response JSON`)
    detail(text.slice(0, 300))
  }

  log(`Deep analysis complete in ${totalElapsed}s (1 call)`)

  // ── Final Results ───────────────────────────────────────────
  console.log(`\n${GREEN}── Final Results ──${RESET}\n`)
  let totalPercent = 0

  for (const result of results) {
    const agentTasks = allAgentTasks.get(result.buildingId) ?? []
    const merged = mergeTasks(result.tasks, agentTasks)
    const doneCount = merged.filter((t) => t.done).length
    const percent = merged.length > 0 ? Math.round((doneCount / merged.length) * 100) : 0
    totalPercent += percent

    const icon = percent === 100 ? '✅' : percent >= 50 ? '🟡' : '🔴'
    console.log(`${icon} ${YELLOW}${result.buildingId.toUpperCase()}${RESET} — ${percent}% (${doneCount}/${merged.length})`)
    for (const t of result.tasks) console.log(`  ${t.done ? '✓' : '✗'} ${t.label}`)
    if (agentTasks.length > 0) {
      console.log(`  ${DIM}── LLM-added ──${RESET}`)
      for (const t of agentTasks) console.log(`  ${t.done ? '✓' : '✗'} ${t.label}`)
    }
    console.log()
  }

  const score = Math.round(totalPercent / results.length)
  console.log(`${'═'.repeat(50)}`)
  console.log(`  OVERALL: ${score}%`)
  console.log(`${'═'.repeat(50)}\n`)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
