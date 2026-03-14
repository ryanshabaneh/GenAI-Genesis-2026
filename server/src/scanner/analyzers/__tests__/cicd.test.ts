import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { cicdAnalyzer } from '../cicd'
import type { AnalyzerContext } from '../base'

let tmpDir: string

function ctx(pkgJson: Record<string, unknown> | null = null): AnalyzerContext {
  return { repoPath: tmpDir, packageJson: pkgJson }
}

function mkdirp(...segments: string[]) {
  fs.mkdirSync(path.join(tmpDir, ...segments), { recursive: true })
}

function writeFile(relativePath: string, content: string) {
  const full = path.join(tmpDir, relativePath)
  fs.mkdirSync(path.dirname(full), { recursive: true })
  fs.writeFileSync(full, content, 'utf8')
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cicd-test-'))
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

// ─── Execution-plan spec ──────────────────────────────────────────────────
// cicd.ts — Factory
// Task 1: .github/workflows/ directory exists          → +25%
// Task 2: At least one .yml workflow file              → +25%
// Task 3: Workflow includes a test or build step       → +25%
// Task 4: Workflow triggers on push or pull_request    → +25%

describe('cicd analyzer — structural', () => {
  it('always returns exactly 4 tasks', async () => {
    const r = await cicdAnalyzer.analyze(ctx())
    expect(r.tasks).toHaveLength(4)
  })

  it('has buildingId "cicd"', async () => {
    const r = await cicdAnalyzer.analyze(ctx())
    expect(r.buildingId).toBe('cicd')
  })

  it('percent is always a multiple of 25', async () => {
    const r = await cicdAnalyzer.analyze(ctx())
    expect(r.percent % 25).toBe(0)
  })

  it('percent equals done-count * 25', async () => {
    mkdirp('.github', 'workflows')
    writeFile('.github/workflows/ci.yml', 'on: push\njobs:\n  test:\n    run: npm test')
    const r = await cicdAnalyzer.analyze(ctx())
    expect(r.percent).toBe(r.tasks.filter((t) => t.done).length * 25)
  })

  it('expected task ids', async () => {
    const r = await cicdAnalyzer.analyze(ctx())
    const ids = r.tasks.map((t) => t.id)
    expect(ids).toEqual(['cicd-dir', 'cicd-file', 'cicd-step', 'cicd-trigger'])
  })
})

describe('cicd analyzer — normal scenarios', () => {
  it('empty repo → 0%', async () => {
    const r = await cicdAnalyzer.analyze(ctx())
    expect(r.percent).toBe(0)
    expect(r.tasks.every((t) => !t.done)).toBe(true)
  })

  it('only workflows dir (no yml) → 25%', async () => {
    mkdirp('.github', 'workflows')
    const r = await cicdAnalyzer.analyze(ctx())
    expect(r.percent).toBe(25)
    expect(r.tasks[0].done).toBe(true) // dir
    expect(r.tasks[1].done).toBe(false) // file
  })

  it('dir + one empty yml → 50%', async () => {
    mkdirp('.github', 'workflows')
    writeFile('.github/workflows/ci.yml', 'name: CI\n')
    const r = await cicdAnalyzer.analyze(ctx())
    expect(r.percent).toBe(50)
    expect(r.tasks[0].done).toBe(true)
    expect(r.tasks[1].done).toBe(true)
    expect(r.tasks[2].done).toBe(false) // no test/build step
    expect(r.tasks[3].done).toBe(false) // no trigger
  })

  it('dir + yml with test step but no trigger → 75%', async () => {
    mkdirp('.github', 'workflows')
    writeFile('.github/workflows/ci.yml', 'jobs:\n  build:\n    steps:\n      - run: npm test\n')
    const r = await cicdAnalyzer.analyze(ctx())
    expect(r.percent).toBe(75)
    expect(r.tasks[2].done).toBe(true) // test step
    expect(r.tasks[3].done).toBe(false) // no trigger
  })

  it('full setup → 100%', async () => {
    mkdirp('.github', 'workflows')
    writeFile(
      '.github/workflows/ci.yml',
      'on: push\njobs:\n  test:\n    steps:\n      - run: npm test\n',
    )
    const r = await cicdAnalyzer.analyze(ctx())
    expect(r.percent).toBe(100)
    expect(r.tasks.every((t) => t.done)).toBe(true)
  })
})

describe('cicd analyzer — trigger detection', () => {
  it('on: pull_request detected', async () => {
    mkdirp('.github', 'workflows')
    writeFile('.github/workflows/pr.yml', 'on: pull_request\njobs:\n  lint:\n    run: echo ok\n')
    const r = await cicdAnalyzer.analyze(ctx())
    expect(r.tasks[3].done).toBe(true)
  })

  it('on: [push, pull_request] detected', async () => {
    mkdirp('.github', 'workflows')
    writeFile('.github/workflows/ci.yml', 'on: [push, pull_request]\njobs:\n  x:\n    run: echo\n')
    const r = await cicdAnalyzer.analyze(ctx())
    expect(r.tasks[3].done).toBe(true)
  })

  it('on:\\n  push: detected (multiline YAML)', async () => {
    mkdirp('.github', 'workflows')
    writeFile('.github/workflows/ci.yml', 'on:\n  push:\n    branches: [main]\njobs:\n  x:\n    run: echo\n')
    const r = await cicdAnalyzer.analyze(ctx())
    expect(r.tasks[3].done).toBe(true)
  })
})

describe('cicd analyzer — build/test step detection', () => {
  it('detects yarn test', async () => {
    mkdirp('.github', 'workflows')
    writeFile('.github/workflows/ci.yml', 'jobs:\n  x:\n    run: yarn test\n')
    const r = await cicdAnalyzer.analyze(ctx())
    expect(r.tasks[2].done).toBe(true)
  })

  it('detects pnpm build', async () => {
    mkdirp('.github', 'workflows')
    writeFile('.github/workflows/ci.yml', 'jobs:\n  x:\n    run: pnpm build\n')
    const r = await cicdAnalyzer.analyze(ctx())
    expect(r.tasks[2].done).toBe(true)
  })

  it('detects npm run build', async () => {
    mkdirp('.github', 'workflows')
    writeFile('.github/workflows/ci.yml', 'jobs:\n  x:\n    run: npm run build\n')
    const r = await cicdAnalyzer.analyze(ctx())
    expect(r.tasks[2].done).toBe(true)
  })

  it('detects vitest', async () => {
    mkdirp('.github', 'workflows')
    writeFile('.github/workflows/ci.yml', 'jobs:\n  x:\n    run: vitest\n')
    const r = await cicdAnalyzer.analyze(ctx())
    expect(r.tasks[2].done).toBe(true)
  })

  it('detects jest', async () => {
    mkdirp('.github', 'workflows')
    writeFile('.github/workflows/ci.yml', 'jobs:\n  x:\n    run: jest --coverage\n')
    const r = await cicdAnalyzer.analyze(ctx())
    expect(r.tasks[2].done).toBe(true)
  })
})

describe('cicd analyzer — alternative CI providers', () => {
  it('.gitlab-ci.yml detected', async () => {
    writeFile('.gitlab-ci.yml', 'stages:\n  - test\ntest:\n  script: npm test\n')
    const r = await cicdAnalyzer.analyze(ctx())
    expect(r.tasks[0].done).toBe(true)
    expect(r.tasks[1].done).toBe(true)
    expect(r.tasks[2].done).toBe(true) // npm test
  })

  it('.travis.yml detected', async () => {
    writeFile('.travis.yml', 'language: node_js\nscript: npm test\n')
    const r = await cicdAnalyzer.analyze(ctx())
    expect(r.tasks[0].done).toBe(true)
    expect(r.tasks[1].done).toBe(true)
  })

  it('.circleci/config.yml detected', async () => {
    writeFile('.circleci/config.yml', 'jobs:\n  build:\n    steps:\n      - run: npm test\n')
    const r = await cicdAnalyzer.analyze(ctx())
    expect(r.tasks[0].done).toBe(true)
    expect(r.tasks[1].done).toBe(true)
  })

  it('Jenkinsfile detected', async () => {
    writeFile('Jenkinsfile', 'pipeline { stages { stage("Test") { steps { sh "npm test" } } } }')
    const r = await cicdAnalyzer.analyze(ctx())
    expect(r.tasks[0].done).toBe(true)
    expect(r.tasks[1].done).toBe(true)
  })

  it('bitbucket-pipelines.yml detected', async () => {
    writeFile('bitbucket-pipelines.yml', 'pipelines:\n  default:\n    - step:\n        script: npm test\n')
    const r = await cicdAnalyzer.analyze(ctx())
    expect(r.tasks[0].done).toBe(true)
    expect(r.tasks[1].done).toBe(true)
  })

  it('detects pytest in CI step', async () => {
    writeFile('.gitlab-ci.yml', 'test:\n  script: pytest\n')
    const r = await cicdAnalyzer.analyze(ctx())
    expect(r.tasks[2].done).toBe(true)
  })

  it('detects go test in CI step', async () => {
    mkdirp('.github', 'workflows')
    writeFile('.github/workflows/ci.yml', 'jobs:\n  test:\n    run: go test ./...\n')
    const r = await cicdAnalyzer.analyze(ctx())
    expect(r.tasks[2].done).toBe(true)
  })

  it('detects make test in CI step', async () => {
    writeFile('.travis.yml', 'script: make test\n')
    const r = await cicdAnalyzer.analyze(ctx())
    expect(r.tasks[2].done).toBe(true)
  })

  it('detects branches: trigger pattern in GitLab CI', async () => {
    writeFile('.gitlab-ci.yml', 'workflow:\n  rules:\n    - if: $CI_COMMIT_BRANCH\n\ntest:\n  script: pytest\n  only:\n    branches:\n      - main\n')
    const r = await cicdAnalyzer.analyze(ctx())
    expect(r.tasks[3].done).toBe(true)
  })
})

describe('cicd analyzer — stress / edge cases', () => {
  it('.yaml extension works too', async () => {
    mkdirp('.github', 'workflows')
    writeFile('.github/workflows/deploy.yaml', 'on: push\njobs:\n  x:\n    run: npm build\n')
    const r = await cicdAnalyzer.analyze(ctx())
    expect(r.tasks[1].done).toBe(true)
  })

  it('non-yml files in workflows dir are ignored', async () => {
    mkdirp('.github', 'workflows')
    writeFile('.github/workflows/readme.md', '# CI docs')
    writeFile('.github/workflows/notes.txt', 'notes')
    const r = await cicdAnalyzer.analyze(ctx())
    expect(r.tasks[0].done).toBe(true) // dir exists
    expect(r.tasks[1].done).toBe(false) // no yml files
  })

  it('multiple workflow files — picks up steps across files', async () => {
    mkdirp('.github', 'workflows')
    writeFile('.github/workflows/test.yml', 'jobs:\n  test:\n    run: npm test\n')
    writeFile('.github/workflows/deploy.yml', 'on: push\njobs:\n  deploy:\n    run: echo deploy\n')
    const r = await cicdAnalyzer.analyze(ctx())
    expect(r.tasks[1].done).toBe(true) // file found
    expect(r.tasks[2].done).toBe(true) // test step from first file
    expect(r.tasks[3].done).toBe(true) // trigger from second file
    expect(r.percent).toBe(100)
  })

  it('.github dir exists but no workflows subdir → 0%', async () => {
    mkdirp('.github')
    const r = await cicdAnalyzer.analyze(ctx())
    expect(r.percent).toBe(0)
  })

  it('workflow content with no matching keywords → step=false, trigger=false', async () => {
    mkdirp('.github', 'workflows')
    writeFile('.github/workflows/ci.yml', 'name: lint\njobs:\n  lint:\n    run: eslint .\n')
    const r = await cicdAnalyzer.analyze(ctx())
    expect(r.tasks[2].done).toBe(false)
    expect(r.tasks[3].done).toBe(false)
    expect(r.percent).toBe(50)
  })

  it('very large workflow file still scans correctly', async () => {
    mkdirp('.github', 'workflows')
    const bigContent = 'on: push\n' + 'jobs:\n  x:\n    run: npm test\n' + '#'.repeat(100_000)
    writeFile('.github/workflows/big.yml', bigContent)
    const r = await cicdAnalyzer.analyze(ctx())
    expect(r.percent).toBe(100)
  })
})
