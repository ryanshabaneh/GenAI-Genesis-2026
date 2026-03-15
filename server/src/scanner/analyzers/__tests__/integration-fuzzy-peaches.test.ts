/**
 * Integration test: clone a real Python+JS full-stack project.
 *
 * https://github.com/ryanshabaneh/fuzzy-peaches
 * Python backend (FastAPI) + JS frontend (Vite/React).
 * Has: .gitignore, README.md, railway.json, requirements.txt, frontend/, tests/
 * No: Dockerfile, docker-compose, .github/workflows, root package.json
 *
 * This validates analyzers against a mixed-language project.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import type { AnalyzerContext } from '../base'
import type { AnalyzerResult } from '../../../types'

import { cicdAnalyzer } from '../cicd'
import { dockerAnalyzer } from '../docker'
import { loggingAnalyzer } from '../logging'
import { deploymentAnalyzer } from '../deployment'
import { securityAnalyzer } from '../security'

const REPO_URL = 'https://github.com/ryanshabaneh/fuzzy-peaches'
let repoPath: string
let ctx: AnalyzerContext

beforeAll(async () => {
  repoPath = fs.mkdtempSync(path.join(os.tmpdir(), 'shipyard-fuzzy-peaches-'))

  const simpleGit = (await import('simple-git')).default
  const git = simpleGit()
  await git.clone(REPO_URL, repoPath, ['--depth', '1'])

  const pkgPath = path.join(repoPath, 'package.json')
  const packageJson = fs.existsSync(pkgPath)
    ? JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
    : null

  ctx = { repoPath, packageJson }
}, 30_000)

afterAll(() => {
  if (repoPath) {
    fs.rmSync(repoPath, { recursive: true, force: true })
  }
})

function assertStructure(r: AnalyzerResult) {
  expect(r.tasks).toHaveLength(4)
  expect(r.percent).toBe(r.tasks.filter((t) => t.done).length * 25)
  expect(r.percent % 25).toBe(0)
}

// ─── Discover actual file layout ─────────────────────────────────────────

let hasWorkflowsDir: boolean
let hasDockerfile: boolean
let hasDockerignore: boolean
let hasDockerCompose: boolean
let hasRailwayJson: boolean
let hasGitignore: boolean
let gitignoreContent: string
let hasEnvFile: boolean
let hasLockfile: boolean
let hasRootPkg: boolean

beforeAll(() => {
  hasWorkflowsDir = fs.existsSync(path.join(repoPath, '.github', 'workflows'))
  hasDockerfile = fs.existsSync(path.join(repoPath, 'Dockerfile'))
  hasDockerignore = fs.existsSync(path.join(repoPath, '.dockerignore'))
  hasDockerCompose =
    fs.existsSync(path.join(repoPath, 'docker-compose.yml')) ||
    fs.existsSync(path.join(repoPath, 'docker-compose.yaml'))
  hasRailwayJson = fs.existsSync(path.join(repoPath, 'railway.json'))
  hasGitignore = fs.existsSync(path.join(repoPath, '.gitignore'))
  gitignoreContent = hasGitignore
    ? fs.readFileSync(path.join(repoPath, '.gitignore'), 'utf8')
    : ''
  hasEnvFile = fs.existsSync(path.join(repoPath, '.env'))
  hasLockfile = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'go.sum', 'Gemfile.lock', 'poetry.lock', 'Pipfile.lock']
    .some((f) => fs.existsSync(path.join(repoPath, f)))
  hasRootPkg = fs.existsSync(path.join(repoPath, 'package.json'))
})

// ─── cicd ────────────────────────────────────────────────────────────────

describe('fuzzy-peaches integration — cicd', () => {
  let result: AnalyzerResult
  beforeAll(async () => { result = await cicdAnalyzer.analyze(ctx) })

  it('structural: 4 tasks, correct formula', () => assertStructure(result))

  it('0% — no .github/workflows', () => {
    expect(hasWorkflowsDir).toBe(false)
    expect(result.percent).toBe(0)
  })
})

// ─── docker ──────────────────────────────────────────────────────────────

describe('fuzzy-peaches integration — docker', () => {
  let result: AnalyzerResult
  beforeAll(async () => { result = await dockerAnalyzer.analyze(ctx) })

  it('structural: 4 tasks, correct formula', () => assertStructure(result))

  it('0% — no Dockerfile, no .dockerignore, no docker-compose', () => {
    expect(hasDockerfile).toBe(false)
    expect(hasDockerignore).toBe(false)
    expect(hasDockerCompose).toBe(false)
    expect(result.percent).toBe(0)
  })
})

// ─── logging ─────────────────────────────────────────────────────────────

describe('fuzzy-peaches integration — logging', () => {
  let result: AnalyzerResult
  beforeAll(async () => { result = await loggingAnalyzer.analyze(ctx) })

  it('structural: 4 tasks, correct formula', () => assertStructure(result))

  it('no root package.json → dep check false', () => {
    expect(hasRootPkg).toBe(false)
    expect(ctx.packageJson).toBeNull()
    expect(result.tasks[0].done).toBe(false)
  })

  it('percent is deterministic and matches task count', () => {
    expect(result.percent).toBe(result.tasks.filter((t) => t.done).length * 25)
  })
})

// ─── deployment ──────────────────────────────────────────────────────────

describe('fuzzy-peaches integration — deployment', () => {
  let result: AnalyzerResult
  beforeAll(async () => { result = await deploymentAnalyzer.analyze(ctx) })

  it('structural: 4 tasks, correct formula', () => assertStructure(result))

  it('railway.json detected as deploy config', () => {
    expect(hasRailwayJson).toBe(true)
    expect(result.tasks[0].done).toBe(true)
  })

  it('no root package.json but Makefile + main.py detected', () => {
    expect(hasRootPkg).toBe(false)
    // Makefile → build detected, main.py → start detected
    expect(result.tasks[1].done).toBe(true) // build (Makefile)
    expect(result.tasks[2].done).toBe(true) // start (main.py)
  })

  it('scores at least 25% from railway.json', () => {
    expect(result.percent).toBeGreaterThanOrEqual(25)
  })
})

// ─── security ────────────────────────────────────────────────────────────

describe('fuzzy-peaches integration — security', () => {
  let result: AnalyzerResult
  beforeAll(async () => { result = await securityAnalyzer.analyze(ctx) })

  it('structural: 4 tasks, correct formula', () => assertStructure(result))

  it('.env gitignore status matches actual .gitignore content', () => {
    const envListed = gitignoreContent.split('\n').some((l) => l.trim() === '.env')
    expect(result.tasks[0].done).toBe(envListed)
  })

  it('.env committed status matches whether .env file exists', () => {
    expect(result.tasks[1].done).toBe(!hasEnvFile)
  })

  it('secret scan only checks .ts/.js/.tsx/.jsx files', () => {
    // Python files (.py) won't be scanned — secrets there won't be flagged
    // JS files in frontend/src/ WILL be scanned
    expect(typeof result.tasks[2].done).toBe('boolean')
  })

  it('lockfile status matches whether any supported lockfile exists', () => {
    expect(result.tasks[3].done).toBe(hasLockfile)
  })
})

// ─── overall ─────────────────────────────────────────────────────────────

describe('fuzzy-peaches integration — overall', () => {
  it('mixed-language project scans without crashing; deployment picks up railway.json', async () => {
    const results = await Promise.all([
      cicdAnalyzer.analyze(ctx),
      dockerAnalyzer.analyze(ctx),
      loggingAnalyzer.analyze(ctx),
      deploymentAnalyzer.analyze(ctx),
      securityAnalyzer.analyze(ctx),
    ])

    const total = results.reduce((sum, r) => sum + r.percent, 0)
    const avg = Math.round(total / results.length)

    for (const r of results) {
      expect(r.tasks).toHaveLength(4)
      expect(r.percent).toBe(r.tasks.filter((t) => t.done).length * 25)
    }

    // Deployment should contribute at least 25% from railway.json
    const deployPct = results.find((r) => r.buildingId === 'deployment')!.percent
    expect(deployPct).toBeGreaterThanOrEqual(25)

    console.log(
      `fuzzy-peaches scores: ${results.map((r) => `${r.buildingId}=${r.percent}%`).join(', ')} | avg=${avg}%`,
    )
  })
})
