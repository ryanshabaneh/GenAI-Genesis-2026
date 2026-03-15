/**
 * Integration test: clone a real empty GitHub repo and run every analyzer.
 *
 * Expected results for https://github.com/40u5/empty-repo-test:
 *   - No files at all → every file-existence check fails
 *   - No package.json → packageJson is null
 *   - security gets 50% because "no .env committed" and "no secrets" are both true
 *   - everything else is 0%
 *
 * Per the execution plan, an empty repo should be a "ghost town."
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

const REPO_URL = 'https://github.com/40u5/empty-repo-test'
let repoPath: string
let ctx: AnalyzerContext

beforeAll(async () => {
  repoPath = fs.mkdtempSync(path.join(os.tmpdir(), 'shipyard-empty-repo-'))

  const simpleGit = (await import('simple-git')).default
  const git = simpleGit()
  await git.clone(REPO_URL, repoPath, ['--depth', '1'])

  const pkgPath = path.join(repoPath, 'package.json')
  const packageJson = fs.existsSync(pkgPath)
    ? JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
    : null

  ctx = { repoPath, packageJson }
}, 30_000) // 30s timeout for clone

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

// ─── Per-analyzer expectations for an empty repo ──────────────────────────

describe('empty repo integration — cicd', () => {
  let result: AnalyzerResult

  beforeAll(async () => {
    result = await cicdAnalyzer.analyze(ctx)
  })

  it('structural: 4 tasks, correct formula', () => assertStructure(result))

  it('0% — no .github/workflows, no yml, no steps, no triggers', () => {
    expect(result.percent).toBe(0)
    expect(result.tasks[0].done).toBe(false) // dir
    expect(result.tasks[1].done).toBe(false) // file
    expect(result.tasks[2].done).toBe(false) // step
    expect(result.tasks[3].done).toBe(false) // trigger
  })
})

describe('empty repo integration — docker', () => {
  let result: AnalyzerResult

  beforeAll(async () => {
    result = await dockerAnalyzer.analyze(ctx)
  })

  it('structural: 4 tasks, correct formula', () => assertStructure(result))

  it('0% — no Dockerfile, no .dockerignore, no compose, no multi-stage', () => {
    expect(result.percent).toBe(0)
    expect(result.tasks.every((t) => !t.done)).toBe(true)
  })
})

describe('empty repo integration — logging', () => {
  let result: AnalyzerResult

  beforeAll(async () => {
    result = await loggingAnalyzer.analyze(ctx)
  })

  it('structural: 4 tasks, correct formula', () => assertStructure(result))

  it('0% — no deps, no imports, no JSON logging, no config', () => {
    expect(result.percent).toBe(0)
    expect(result.tasks.every((t) => !t.done)).toBe(true)
  })
})

describe('empty repo integration — deployment', () => {
  let result: AnalyzerResult

  beforeAll(async () => {
    result = await deploymentAnalyzer.analyze(ctx)
  })

  it('structural: 4 tasks, correct formula', () => assertStructure(result))

  it('0% — no deploy config, no scripts, no process.env.PORT', () => {
    expect(result.percent).toBe(0)
    expect(result.tasks.every((t) => !t.done)).toBe(true)
  })
})

describe('empty repo integration — security', () => {
  let result: AnalyzerResult

  beforeAll(async () => {
    result = await securityAnalyzer.analyze(ctx)
  })

  it('structural: 4 tasks, correct formula', () => assertStructure(result))

  it('.env not committed + no secrets are always true for near-empty repos', () => {
    // These two are always true for repos without actual source code
    expect(result.tasks[1].done).toBe(true)  // .env file does not exist → good
    expect(result.tasks[2].done).toBe(true)  // no hardcoded secrets → good
    // .gitignore and lockfile depend on remote repo state — don't assert exact values
    expect(result.percent).toBeGreaterThanOrEqual(50)
  })
})

// ─── Overall score check ──────────────────────────────────────────────────

describe('empty repo integration — overall score', () => {
  it('low overall average — only security contributes meaningfully', async () => {
    const results = await Promise.all([
      cicdAnalyzer.analyze(ctx),
      dockerAnalyzer.analyze(ctx),
      loggingAnalyzer.analyze(ctx),
      deploymentAnalyzer.analyze(ctx),
      securityAnalyzer.analyze(ctx),
    ])

    const total = results.reduce((sum, r) => sum + r.percent, 0)
    const average = Math.round(total / results.length)

    // cicd=0, docker=0, logging=0, deployment=0, security>=50
    expect(results.find((r) => r.buildingId === 'cicd')!.percent).toBe(0)
    expect(results.find((r) => r.buildingId === 'docker')!.percent).toBe(0)
    expect(results.find((r) => r.buildingId === 'logging')!.percent).toBe(0)
    expect(results.find((r) => r.buildingId === 'deployment')!.percent).toBe(0)
    expect(results.find((r) => r.buildingId === 'security')!.percent).toBeGreaterThanOrEqual(50)
    expect(average).toBeLessThanOrEqual(20)
  })
})
