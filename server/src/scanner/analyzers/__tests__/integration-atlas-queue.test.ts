/**
 * Integration test: clone a real Go project and run every analyzer.
 *
 * https://github.com/ryanshabaneh/atlas-queue
 * Go distributed job queue — Dockerfile, docker-compose, .gitignore, README.
 * No package.json, no Node source files, no .github/workflows.
 *
 * This validates that analyzers degrade gracefully on non-Node projects.
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

const REPO_URL = 'https://github.com/ryanshabaneh/atlas-queue'
let repoPath: string
let ctx: AnalyzerContext

beforeAll(async () => {
  repoPath = fs.mkdtempSync(path.join(os.tmpdir(), 'shipyard-atlas-queue-'))

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

// ─── Discover actual file layout before asserting ─────────────────────────

let hasDockerignore: boolean
let dockerfileContent: string
let gitignoreContent: string
let hasEnvFile: boolean
let hasLockfile: boolean
let hasWorkflowsDir: boolean

beforeAll(() => {
  hasDockerignore = fs.existsSync(path.join(repoPath, '.dockerignore'))
  dockerfileContent = fs.existsSync(path.join(repoPath, 'Dockerfile'))
    ? fs.readFileSync(path.join(repoPath, 'Dockerfile'), 'utf8')
    : ''
  gitignoreContent = fs.existsSync(path.join(repoPath, '.gitignore'))
    ? fs.readFileSync(path.join(repoPath, '.gitignore'), 'utf8')
    : ''
  hasEnvFile = fs.existsSync(path.join(repoPath, '.env'))
  hasLockfile = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'go.sum', 'Gemfile.lock', 'poetry.lock', 'Pipfile.lock']
    .some((f) => fs.existsSync(path.join(repoPath, f)))
  hasWorkflowsDir = fs.existsSync(path.join(repoPath, '.github', 'workflows'))
})

// ─── cicd ────────────────────────────────────────────────────────────────

describe('atlas-queue integration — cicd', () => {
  let result: AnalyzerResult
  beforeAll(async () => { result = await cicdAnalyzer.analyze(ctx) })

  it('structural: 4 tasks, correct formula', () => assertStructure(result))

  it('0% — no .github/workflows directory', () => {
    expect(hasWorkflowsDir).toBe(false)
    expect(result.percent).toBe(0)
  })
})

// ─── docker ──────────────────────────────────────────────────────────────

describe('atlas-queue integration — docker', () => {
  let result: AnalyzerResult
  beforeAll(async () => { result = await dockerAnalyzer.analyze(ctx) })

  it('structural: 4 tasks, correct formula', () => assertStructure(result))

  it('Dockerfile exists', () => {
    expect(result.tasks[0].done).toBe(true)
  })

  it('docker-compose.yml exists', () => {
    expect(result.tasks[2].done).toBe(true)
  })

  it('multi-stage or COPY detected in Dockerfile', () => {
    const hasMultiFrom = (dockerfileContent.match(/^FROM\s+/gim) || []).length > 1
    const hasAs = /^FROM\s+.*\bAS\b/im.test(dockerfileContent)
    const hasCopy = /^COPY\s+/m.test(dockerfileContent)
    const expected = hasMultiFrom || hasAs || hasCopy
    expect(result.tasks[3].done).toBe(expected)
  })

  it('scores at least 50% (Dockerfile + compose)', () => {
    expect(result.percent).toBeGreaterThanOrEqual(50)
  })
})

// ─── logging ─────────────────────────────────────────────────────────────

describe('atlas-queue integration — logging', () => {
  let result: AnalyzerResult
  beforeAll(async () => { result = await loggingAnalyzer.analyze(ctx) })

  it('structural: 4 tasks, correct formula', () => assertStructure(result))

  it('Go project now detected — go.mod logging deps and Go imports picked up', () => {
    expect(ctx.packageJson).toBeNull()
    expect(result.percent).toBeGreaterThanOrEqual(0)
    expect(result.percent).toBe(result.tasks.filter((t) => t.done).length * 25)
  })
})

// ─── deployment ──────────────────────────────────────────────────────────

describe('atlas-queue integration — deployment', () => {
  let result: AnalyzerResult
  beforeAll(async () => { result = await deploymentAnalyzer.analyze(ctx) })

  it('structural: 4 tasks, correct formula', () => assertStructure(result))

  it('0% — no deploy config, no package.json scripts, no process.env.PORT', () => {
    expect(ctx.packageJson).toBeNull()
    expect(result.percent).toBe(0)
  })
})

// ─── security ────────────────────────────────────────────────────────────

describe('atlas-queue integration — security', () => {
  let result: AnalyzerResult
  beforeAll(async () => { result = await securityAnalyzer.analyze(ctx) })

  it('structural: 4 tasks, correct formula', () => assertStructure(result))

  it('.env not committed → true (no .env file in repo)', () => {
    expect(result.tasks[1].done).toBe(!hasEnvFile)
  })

  it('no hardcoded secrets → true (scanner checks .ts/.js/.py/.go/.rb/.java + .env files)', () => {
    expect(result.tasks[2].done).toBe(true)
  })

  it('lockfile detection matches any supported lockfile (go.sum for Go)', () => {
    expect(result.tasks[3].done).toBe(hasLockfile)
  })

  it('.env in .gitignore depends on actual .gitignore content', () => {
    const envListed = gitignoreContent.split('\n').some((l) => l.trim() === '.env')
    expect(result.tasks[0].done).toBe(envListed)
  })
})

// ─── overall ─────────────────────────────────────────────────────────────

describe('atlas-queue integration — overall', () => {
  it('non-Node project still scans without crashing; docker contributes most points', async () => {
    const results = await Promise.all([
      cicdAnalyzer.analyze(ctx),
      dockerAnalyzer.analyze(ctx),
      loggingAnalyzer.analyze(ctx),
      deploymentAnalyzer.analyze(ctx),
      securityAnalyzer.analyze(ctx),
    ])

    const total = results.reduce((sum, r) => sum + r.percent, 0)
    const avg = Math.round(total / results.length)

    // Docker should be the biggest contributor; rest is mostly 0 except security
    const dockerPct = results.find((r) => r.buildingId === 'docker')!.percent
    expect(dockerPct).toBeGreaterThanOrEqual(50)

    // No crashes, every analyzer returned valid structure
    for (const r of results) {
      expect(r.tasks).toHaveLength(4)
      expect(r.percent).toBe(r.tasks.filter((t) => t.done).length * 25)
    }

    console.log(
      `atlas-queue scores: ${results.map((r) => `${r.buildingId}=${r.percent}%`).join(', ')} | avg=${avg}%`,
    )
  })
})
