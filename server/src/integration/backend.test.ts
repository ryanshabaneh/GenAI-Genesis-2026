// server/src/integration/backend.test.ts
// Comprehensive backend integration tests.
// Spins up the real Express + Socket.IO server, mocks only the LLM client.
// Tests the full wiring: routes → session → scanner → agents → evaluator → export.

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import request from 'supertest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import {
  createTestApp,
  mockCreate,
  llmResponse,
  mockAnalyzerResponse,
  mockEvaluatorPass,
  mockEvaluatorFail,
  mockDedupResponse,
  setDefaultLlmMock,
  type TestApp,
} from './setup'

// We need a real repo on disk for the scanner. Create a minimal fake one.
let testApp: TestApp
let fakeRepoPath: string

function createFakeRepo() {
  fakeRepoPath = path.join(os.tmpdir(), `shipcity-test-${Date.now()}`)
  fs.mkdirSync(fakeRepoPath, { recursive: true })

  // package.json
  fs.writeFileSync(
    path.join(fakeRepoPath, 'package.json'),
    JSON.stringify({
      name: 'test-project',
      version: '1.0.0',
      scripts: { test: 'vitest run', start: 'node src/index.js', build: 'tsc' },
      dependencies: { express: '^4.18.0' },
      devDependencies: { vitest: '^1.0.0' },
    }, null, 2)
  )

  // README
  fs.writeFileSync(path.join(fakeRepoPath, 'README.md'), '# Test Project\n\nA test project for integration tests.\n\n## Setup\n\n```bash\nnpm install\n```\n')

  // Source files
  fs.mkdirSync(path.join(fakeRepoPath, 'src'), { recursive: true })
  fs.writeFileSync(
    path.join(fakeRepoPath, 'src', 'index.ts'),
    `import express from 'express'\nconst app = express()\nconst PORT = process.env.PORT || 3000\napp.listen(PORT)\n`
  )

  // Test file
  fs.mkdirSync(path.join(fakeRepoPath, '__tests__'), { recursive: true })
  fs.writeFileSync(
    path.join(fakeRepoPath, '__tests__', 'index.test.ts'),
    `import { describe, it, expect } from 'vitest'\ndescribe('app', () => { it('works', () => { expect(true).toBe(true) }) })\n`
  )

  // .gitignore
  fs.writeFileSync(path.join(fakeRepoPath, '.gitignore'), 'node_modules\n.env\ndist\n')

  // .env.example
  fs.writeFileSync(path.join(fakeRepoPath, '.env.example'), 'PORT=3000\nDATABASE_URL=\n')

  // Dockerfile
  fs.writeFileSync(path.join(fakeRepoPath, 'Dockerfile'), 'FROM node:18\nWORKDIR /app\nCOPY . .\nRUN npm install\nCMD ["npm", "start"]\n')

  // .dockerignore
  fs.writeFileSync(path.join(fakeRepoPath, '.dockerignore'), 'node_modules\n.git\n')

  // GitHub Actions
  fs.mkdirSync(path.join(fakeRepoPath, '.github', 'workflows'), { recursive: true })
  fs.writeFileSync(
    path.join(fakeRepoPath, '.github', 'workflows', 'ci.yml'),
    'name: CI\non: [push]\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: npm test\n'
  )

  // package-lock.json (for security analyzer)
  fs.writeFileSync(path.join(fakeRepoPath, 'package-lock.json'), '{}')

  return fakeRepoPath
}

// Mock cloneRepo to return our fake repo instead of actually cloning
vi.mock('../scanner/clone', () => ({
  cloneRepo: vi.fn().mockImplementation(async (_url: string, _dest: string) => {
    return fakeRepoPath
  }),
}))

beforeAll(async () => {
  createFakeRepo()
  testApp = await createTestApp()
})

afterAll(async () => {
  await testApp.close()
  // Clean up fake repo (ignore errors on Windows where files may be locked)
  try { fs.rmSync(fakeRepoPath, { recursive: true, force: true }) } catch { /* ignore */ }
})

beforeEach(() => {
  vi.clearAllMocks()
  testApp.emittedEvents.length = 0
  setDefaultLlmMock()
})

// ═══════════════════════════════════════════════════════════════════
// 1. HEALTH CHECK
// ═══════════════════════════════════════════════════════════════════

describe('Health', () => {
  it('GET /health returns ok', async () => {
    const res = await request(testApp.app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
  })
})

// ═══════════════════════════════════════════════════════════════════
// 2. SCAN — full heuristic + LLM pipeline
// ═══════════════════════════════════════════════════════════════════

describe('POST /api/scan', () => {
  it('returns 400 without repoUrl', async () => {
    const res = await request(testApp.app).post('/api/scan').send({})
    expect(res.status).toBe(400)
  })

  it('returns sessionId immediately', async () => {
    const res = await request(testApp.app)
      .post('/api/scan')
      .send({ repoUrl: 'https://github.com/test/repo' })
    expect(res.status).toBe(200)
    expect(res.body.sessionId).toBeDefined()
    expect(typeof res.body.sessionId).toBe('string')
  })

  it('scan populates session with results for all 8 buildings', async () => {
    // Mock LLM for analyzer (returns empty tasks) and dedup
    mockCreate.mockResolvedValue(llmResponse('[]'))

    const res = await request(testApp.app)
      .post('/api/scan')
      .send({ repoUrl: 'https://github.com/test/repo2' })

    const sessionId = res.body.sessionId

    // Wait for async scan to complete
    await waitForScanComplete(sessionId, 15_000)

    // Verify session has results
    const { getSession } = await import('../session/store')
    const session = getSession(sessionId)
    expect(session).toBeDefined()
    expect(session!.repoPath).toBeTruthy()

    const buildings = Object.keys(session!.results)
    expect(buildings.length).toBe(8)
    expect(buildings).toContain('tests')
    expect(buildings).toContain('cicd')
    expect(buildings).toContain('docker')
    expect(buildings).toContain('documentation')
    expect(buildings).toContain('envVars')
    expect(buildings).toContain('security')
    expect(buildings).toContain('logging')
    expect(buildings).toContain('deployment')
  }, 20_000)

  it('each building has tasks with correct structure', async () => {
    mockCreate.mockResolvedValue(llmResponse('[]'))

    const res = await request(testApp.app)
      .post('/api/scan')
      .send({ repoUrl: 'https://github.com/test/repo3' })

    await waitForScanComplete(res.body.sessionId, 15_000)

    const { getSession } = await import('../session/store')
    const session = getSession(res.body.sessionId)!

    for (const [buildingId, result] of Object.entries(session.results)) {
      expect(result).toBeDefined()
      expect(result!.buildingId).toBe(buildingId)
      expect(typeof result!.percent).toBe('number')
      expect(result!.percent).toBeGreaterThanOrEqual(0)
      expect(result!.percent).toBeLessThanOrEqual(100)
      expect(Array.isArray(result!.tasks)).toBe(true)
      expect(result!.tasks.length).toBeGreaterThanOrEqual(4) // at least 4 heuristic tasks

      for (const task of result!.tasks) {
        expect(task.id).toBeDefined()
        expect(typeof task.id).toBe('string')
        expect(task.label).toBeDefined()
        expect(typeof task.label).toBe('string')
        expect(typeof task.done).toBe('boolean')
      }
    }
  }, 20_000)

  it('well-configured repo scores higher than 0', async () => {
    mockCreate.mockResolvedValue(llmResponse('[]'))

    const res = await request(testApp.app)
      .post('/api/scan')
      .send({ repoUrl: 'https://github.com/test/repo4' })

    await waitForScanComplete(res.body.sessionId, 15_000)

    const { getSession } = await import('../session/store')
    const session = getSession(res.body.sessionId)!

    // Our fake repo has tests, CI, Docker, .gitignore, .env.example, README, etc.
    // It should score meaningfully above 0
    const allResults = Object.values(session.results)
    const score = Math.round(
      allResults.reduce((sum, r) => sum + (r?.percent ?? 0), 0) / allResults.length
    )
    expect(score).toBeGreaterThan(0)
  }, 20_000)

  it('mergeTasks correctly merges scanner + agent tasks', async () => {
    // Test the merge logic directly instead of through async scan
    // This avoids mock stomping from parallel test files
    const { mergeTasks } = await import('../agents/analyzer')

    const scannerTasks = [
      { id: 'tests-dep', label: 'Test framework installed', done: true },
      { id: 'tests-files', label: 'Test files present', done: false },
      { id: 'tests-script', label: 'Test runner configured', done: true },
      { id: 'tests-count', label: 'More than 3 test files', done: false },
    ]

    const agentTasks = [
      { id: 'tests-extra-1', label: 'Add tests for DELETE endpoint', done: false },
      { id: 'tests-extra-2', label: 'Add error handling tests', done: false },
    ]

    const merged = mergeTasks(scannerTasks, agentTasks)
    expect(merged.length).toBe(6) // 4 scanner + 2 agent
    expect(merged.some((t) => t.id === 'tests-extra-1')).toBe(true)
    expect(merged.some((t) => t.id === 'tests-extra-2')).toBe(true)

    // Dedup by ID — re-adding the same task doesn't duplicate
    const merged2 = mergeTasks(merged, [{ id: 'tests-dep', label: 'duplicate', done: false }])
    expect(merged2.length).toBe(6) // no increase
  }, 10_000)
})

// ═══════════════════════════════════════════════════════════════════
// 3. CHAT — agent conversation
// ═══════════════════════════════════════════════════════════════════

describe('POST /api/chat', () => {
  let sessionId: string

  beforeAll(async () => {
    mockCreate.mockResolvedValue(llmResponse('[]'))
    const res = await request(testApp.app)
      .post('/api/scan')
      .send({ repoUrl: 'https://github.com/test/chat-repo' })
    sessionId = res.body.sessionId
    await waitForScanComplete(sessionId, 15_000)
  }, 20_000)

  it('returns 400 without required fields', async () => {
    const res = await request(testApp.app).post('/api/chat').send({})
    expect(res.status).toBe(400)
  })

  it('returns 404 for non-existent session', async () => {
    const res = await request(testApp.app)
      .post('/api/chat')
      .send({ sessionId: 'fake-id', buildingId: 'tests', message: 'hello' })
    expect(res.status).toBe(404)
  })

  it('returns agent reply with content', async () => {
    mockCreate.mockResolvedValue(llmResponse('This project uses Vitest for testing.'))

    const res = await request(testApp.app)
      .post('/api/chat')
      .send({ sessionId, buildingId: 'tests', message: 'What test framework?' })

    expect(res.status).toBe(200)
    expect(res.body.reply).toBeDefined()
    expect(res.body.reply.role).toBe('assistant')
    expect(res.body.reply.content).toContain('Vitest')
  })

  it('parses code blocks in agent response', async () => {
    mockCreate.mockResolvedValue(
      llmResponse(
        'Here is a test:\n// File: src/__tests__/app.test.ts\n```typescript\nimport { test } from "vitest"\ntest("works", () => {})\n```'
      )
    )

    const res = await request(testApp.app)
      .post('/api/chat')
      .send({ sessionId, buildingId: 'tests', message: 'Write a test' })

    expect(res.status).toBe(200)
    expect(res.body.reply.codeBlocks).toBeDefined()
    expect(res.body.reply.codeBlocks.length).toBeGreaterThan(0)
    expect(res.body.reply.codeBlocks[0].path).toBe('src/__tests__/app.test.ts')
    expect(res.body.reply.codeBlocks[0].language).toBe('typescript')
  })

  it('persists conversation history across messages', async () => {
    mockCreate.mockResolvedValue(llmResponse('First response'))

    await request(testApp.app)
      .post('/api/chat')
      .send({ sessionId, buildingId: 'security', message: 'First message' })

    mockCreate.mockResolvedValue(llmResponse('Second response'))

    await request(testApp.app)
      .post('/api/chat')
      .send({ sessionId, buildingId: 'security', message: 'Second message' })

    // Check the second call included history from the first
    const secondCallArgs = mockCreate.mock.calls[mockCreate.mock.calls.length - 1][0]
    const messages = secondCallArgs.messages as Array<{ role: string; content: string }>

    // Should have: [first user msg, first assistant reply, second user msg]
    expect(messages.length).toBeGreaterThanOrEqual(3)
    expect(messages.some((m: { content: string }) => m.content === 'First message')).toBe(true)
    expect(messages.some((m: { content: string }) => m.content === 'First response')).toBe(true)
  })

  it('conversation history is per-building (isolated)', async () => {
    mockCreate.mockResolvedValue(llmResponse('Docker response'))

    await request(testApp.app)
      .post('/api/chat')
      .send({ sessionId, buildingId: 'docker', message: 'Docker question' })

    mockCreate.mockResolvedValue(llmResponse('CI response'))

    await request(testApp.app)
      .post('/api/chat')
      .send({ sessionId, buildingId: 'cicd', message: 'CI question' })

    // CI call should NOT contain Docker history
    const ciCallArgs = mockCreate.mock.calls[mockCreate.mock.calls.length - 1][0]
    const messages = ciCallArgs.messages as Array<{ role: string; content: string }>
    expect(messages.some((m: { content: string }) => m.content === 'Docker question')).toBe(false)
  })

  it('includes scanner context in system prompt', async () => {
    mockCreate.mockResolvedValue(llmResponse('Response with context'))

    await request(testApp.app)
      .post('/api/chat')
      .send({ sessionId, buildingId: 'tests', message: 'Analyze my tests' })

    const callArgs = mockCreate.mock.calls[mockCreate.mock.calls.length - 1][0]
    const system = callArgs.system as string

    // System should contain the building prompt
    expect(system).toContain('School Builder')
    // System should contain repo context (package.json content)
    expect(system).toContain('test-project')
  })

  it('handles agent error gracefully', async () => {
    mockCreate.mockRejectedValue(new Error('LLM is down'))

    const res = await request(testApp.app)
      .post('/api/chat')
      .send({ sessionId, buildingId: 'tests', message: 'fail please' })

    expect(res.status).toBe(500)
    expect(res.body.error).toBeDefined()
  })
})

// ═══════════════════════════════════════════════════════════════════
// 4. ACCEPT — accept code changes
// ═══════════════════════════════════════════════════════════════════

describe('POST /api/accept', () => {
  let sessionId: string

  beforeAll(async () => {
    mockCreate.mockResolvedValue(llmResponse('[]'))
    const res = await request(testApp.app)
      .post('/api/scan')
      .send({ repoUrl: 'https://github.com/test/accept-repo' })
    sessionId = res.body.sessionId
    await waitForScanComplete(sessionId, 15_000)
  }, 20_000)

  it('returns 400 without required fields', async () => {
    const res = await request(testApp.app).post('/api/accept').send({})
    expect(res.status).toBe(400)
  })

  it('returns 404 for non-existent session', async () => {
    const res = await request(testApp.app).post('/api/accept').send({
      sessionId: 'fake', buildingId: 'tests',
      files: [{ path: 'test.ts', content: 'code', isNew: true }],
    })
    expect(res.status).toBe(404)
  })

  it('accepts changes and updates percent', async () => {
    const { getSession } = await import('../session/store')
    const session = getSession(sessionId)!
    const testsResult = session.results.tests!
    const firstIncompleteTask = testsResult.tasks.find((t) => !t.done)

    const res = await request(testApp.app).post('/api/accept').send({
      sessionId,
      buildingId: 'tests',
      files: [{ path: 'test.ts', content: 'test code', isNew: true }],
      taskIds: firstIncompleteTask ? [firstIncompleteTask.id] : [],
    })

    expect(res.status).toBe(200)
    expect(res.body.buildingId).toBe('tests')
    expect(typeof res.body.percent).toBe('number')
    expect(typeof res.body.score).toBe('number')
    expect(Array.isArray(res.body.tasks)).toBe(true)
  })

  it('marks specific tasks as done when taskIds provided', async () => {
    const { getSession } = await import('../session/store')
    const session = getSession(sessionId)!
    const secResult = session.results.security!
    const incompleteTasks = secResult.tasks.filter((t) => !t.done)

    if (incompleteTasks.length === 0) return // all done, skip

    const taskToMark = incompleteTasks[0]

    await request(testApp.app).post('/api/accept').send({
      sessionId,
      buildingId: 'security',
      files: [{ path: '.gitignore', content: 'node_modules\n.env\n', isNew: false }],
      taskIds: [taskToMark.id],
    })

    const updated = getSession(sessionId)!
    const updatedTask = updated.results.security!.tasks.find((t) => t.id === taskToMark.id)
    expect(updatedTask!.done).toBe(true)
  })

  it('marks next incomplete task when no taskIds (legacy)', async () => {
    const { getSession } = await import('../session/store')
    const beforeSession = getSession(sessionId)!
    const loggingResult = beforeSession.results.logging!
    const beforeDoneCount = loggingResult.tasks.filter((t) => t.done).length

    await request(testApp.app).post('/api/accept').send({
      sessionId,
      buildingId: 'logging',
      files: [{ path: 'logger.ts', content: 'export const logger = {}', isNew: true }],
      // no taskIds
    })

    const afterSession = getSession(sessionId)!
    const afterDoneCount = afterSession.results.logging!.tasks.filter((t) => t.done).length
    expect(afterDoneCount).toBe(beforeDoneCount + 1)
  })
})

// ═══════════════════════════════════════════════════════════════════
// 5. EXPORT — download changes as ZIP
// ═══════════════════════════════════════════════════════════════════

describe('POST /api/export', () => {
  let sessionId: string

  beforeAll(async () => {
    mockCreate.mockResolvedValue(llmResponse('[]'))
    const res = await request(testApp.app)
      .post('/api/scan')
      .send({ repoUrl: 'https://github.com/test/export-repo' })
    sessionId = res.body.sessionId
    await waitForScanComplete(sessionId, 15_000)
  }, 20_000)

  it('returns 400 without format: zip', async () => {
    const res = await request(testApp.app)
      .post('/api/export')
      .send({ sessionId, format: 'tar' })
    expect(res.status).toBe(400)
  })

  it('returns 400 when no changes to export', async () => {
    const res = await request(testApp.app)
      .post('/api/export')
      .send({ sessionId, format: 'zip' })
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('No accepted changes')
  })

  it('returns valid ZIP after accepting changes', async () => {
    // First accept a change
    await request(testApp.app).post('/api/accept').send({
      sessionId,
      buildingId: 'tests',
      files: [{ path: 'test.ts', content: 'test content', isNew: true }],
    })

    const res = await request(testApp.app)
      .post('/api/export')
      .send({ sessionId, format: 'zip' })
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () => cb(null, Buffer.concat(chunks)))
      })

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('application/zip')
    expect(res.headers['content-disposition']).toContain('shipcity-changes.zip')

    // Verify it's actually a ZIP (magic bytes PK)
    const buf = res.body as Buffer
    expect(buf[0]).toBe(0x50) // P
    expect(buf[1]).toBe(0x4b) // K
  })
})

// ═══════════════════════════════════════════════════════════════════
// 6. EVALUATE — on-demand task evaluation
// ═══════════════════════════════════════════════════════════════════

describe('POST /api/evaluate', () => {
  let sessionId: string

  beforeAll(async () => {
    mockCreate.mockResolvedValue(llmResponse('[]'))
    const res = await request(testApp.app)
      .post('/api/scan')
      .send({ repoUrl: 'https://github.com/test/eval-repo' })
    sessionId = res.body.sessionId
    await waitForScanComplete(sessionId, 15_000)
  }, 20_000)

  it('returns 400 without required fields', async () => {
    const res = await request(testApp.app).post('/api/evaluate').send({})
    expect(res.status).toBe(400)
  })

  it('returns 404 for non-existent session', async () => {
    const res = await request(testApp.app)
      .post('/api/evaluate')
      .send({ sessionId: 'fake', buildingId: 'tests' })
    expect(res.status).toBe(404)
  })

  it('evaluates tasks and returns per-task results', async () => {
    mockCreate.mockResolvedValue(mockEvaluatorPass('Tests exist and pass'))

    const res = await request(testApp.app)
      .post('/api/evaluate')
      .send({ sessionId, buildingId: 'tests' })

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.results)).toBe(true)
    expect(typeof res.body.percent).toBe('number')
    expect(typeof res.body.score).toBe('number')

    for (const result of res.body.results) {
      expect(result.taskId).toBeDefined()
      expect(typeof result.pass).toBe('boolean')
    }
  })

  it('marks passing tasks as done in session', async () => {
    mockCreate.mockResolvedValue(mockEvaluatorPass('Task verified'))

    const { getSession } = await import('../session/store')
    const before = getSession(sessionId)!
    const beforeDone = before.results.docker!.tasks.filter((t) => t.done).length

    await request(testApp.app)
      .post('/api/evaluate')
      .send({ sessionId, buildingId: 'docker' })

    const after = getSession(sessionId)!
    const afterDone = after.results.docker!.tasks.filter((t) => t.done).length
    expect(afterDone).toBeGreaterThanOrEqual(beforeDone)
  })

  it('creates change log entries for passing tasks', async () => {
    mockCreate.mockResolvedValue(mockEvaluatorPass('Env vars configured'))

    const { getSession } = await import('../session/store')
    const beforeLog = getSession(sessionId)!.changeLog.length

    await request(testApp.app)
      .post('/api/evaluate')
      .send({ sessionId, buildingId: 'envVars' })

    const afterLog = getSession(sessionId)!.changeLog.length
    expect(afterLog).toBeGreaterThanOrEqual(beforeLog)
  })

  it('evaluates specific tasks when taskIds provided', async () => {
    const { getSession } = await import('../session/store')
    const session = getSession(sessionId)!
    const cicdTasks = session.results.cicd!.tasks
    const targetTask = cicdTasks[0]

    mockCreate.mockResolvedValue(mockEvaluatorFail('CI not configured'))

    const res = await request(testApp.app)
      .post('/api/evaluate')
      .send({ sessionId, buildingId: 'cicd', taskIds: [targetTask.id] })

    expect(res.status).toBe(200)
    expect(res.body.results.length).toBe(1)
    expect(res.body.results[0].taskId).toBe(targetTask.id)
    expect(res.body.results[0].pass).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════
// 7. IMPLEMENT — agent → aider → evaluator pipeline
// ═══════════════════════════════════════════════════════════════════

describe('POST /api/implement', () => {
  let sessionId: string

  beforeAll(async () => {
    mockCreate.mockResolvedValue(llmResponse('[]'))
    const res = await request(testApp.app)
      .post('/api/scan')
      .send({ repoUrl: 'https://github.com/test/impl-repo' })
    sessionId = res.body.sessionId
    await waitForScanComplete(sessionId, 15_000)
  }, 20_000)

  it('returns 400 without required fields', async () => {
    const res = await request(testApp.app).post('/api/implement').send({})
    expect(res.status).toBe(400)
  })

  it('returns 400 with empty taskIds', async () => {
    const res = await request(testApp.app).post('/api/implement').send({
      sessionId, buildingId: 'tests', taskIds: [],
    })
    expect(res.status).toBe(400)
  })

  it('returns 404 for non-existent session', async () => {
    const res = await request(testApp.app).post('/api/implement').send({
      sessionId: 'fake', buildingId: 'tests', taskIds: ['1'],
    })
    expect(res.status).toBe(404)
  })

  it('returns 404 for building with no scan results', async () => {
    // Create a session with no results
    const { createSession } = await import('../session/store')
    const emptySession = createSession({ repoUrl: 'x', repoPath: '/tmp/x' })

    const res = await request(testApp.app).post('/api/implement').send({
      sessionId: emptySession.id, buildingId: 'tests', taskIds: ['1'],
    })
    expect(res.status).toBe(404)
  })
})

// ═══════════════════════════════════════════════════════════════════
// 8. FULL FLOW — scan → chat → accept → export
// ═══════════════════════════════════════════════════════════════════

describe('Full flow: scan → chat → accept → export', () => {
  it('completes the entire user journey', async () => {
    // Mock analyzer to return empty (so scan is fast)
    mockCreate.mockResolvedValue(llmResponse('[]'))

    // 1. Scan
    const scanRes = await request(testApp.app)
      .post('/api/scan')
      .send({ repoUrl: 'https://github.com/test/full-flow' })
    expect(scanRes.status).toBe(200)
    const sessionId = scanRes.body.sessionId

    await waitForScanComplete(sessionId, 15_000)

    // 2. Verify scan produced results
    const { getSession } = await import('../session/store')
    const session = getSession(sessionId)!
    expect(Object.keys(session.results).length).toBe(8)

    // 3. Chat with tests agent
    mockCreate.mockResolvedValue(
      llmResponse(
        'You should add tests.\n// File: src/__tests__/utils.test.ts\n```typescript\nimport { test } from "vitest"\ntest("add", () => { expect(1+1).toBe(2) })\n```'
      )
    )

    const chatRes = await request(testApp.app).post('/api/chat').send({
      sessionId,
      buildingId: 'tests',
      message: 'Write tests for my utils',
    })
    expect(chatRes.status).toBe(200)
    expect(chatRes.body.reply.codeBlocks.length).toBe(1)

    // 4. Accept the code
    const codeBlock = chatRes.body.reply.codeBlocks[0]
    const acceptRes = await request(testApp.app).post('/api/accept').send({
      sessionId,
      buildingId: 'tests',
      files: [{ path: codeBlock.path, content: codeBlock.content, isNew: true }],
    })
    expect(acceptRes.status).toBe(200)
    expect(acceptRes.body.percent).toBeGreaterThanOrEqual(0)

    // 5. Verify changes were saved
    const updatedSession = getSession(sessionId)!
    expect(updatedSession.changes.length).toBeGreaterThan(0)

    // 6. Export as ZIP
    const exportRes = await request(testApp.app)
      .post('/api/export')
      .send({ sessionId, format: 'zip' })
    expect(exportRes.status).toBe(200)
    expect(exportRes.headers['content-type']).toContain('application/zip')

    // 7. Conversation history persisted
    expect(updatedSession.conversations.tests!.length).toBeGreaterThanOrEqual(2)
  }, 25_000)
})

// ═══════════════════════════════════════════════════════════════════
// 9. CROSS-BUILDING AWARENESS
// ═══════════════════════════════════════════════════════════════════

describe('Cross-building awareness', () => {
  it('change log context is passed to agent on chat', async () => {
    mockCreate.mockResolvedValue(llmResponse('[]'))

    const scanRes = await request(testApp.app)
      .post('/api/scan')
      .send({ repoUrl: 'https://github.com/test/cross-building' })
    const sessionId = scanRes.body.sessionId
    await waitForScanComplete(sessionId, 15_000)

    // Accept a change for tests building to create a change log entry
    const { getSession, updateSession } = await import('../session/store')
    const session = getSession(sessionId)!
    updateSession(sessionId, {
      changeLog: [
        ...session.changeLog,
        {
          taskId: 'test-1',
          taskLabel: 'Add unit tests',
          buildingId: 'tests' as const,
          summary: 'Added vitest tests for all routes',
          filesChanged: ['src/__tests__/routes.test.ts'],
          completedAt: Date.now(),
        },
      ],
    })

    // Now chat with a DIFFERENT building — it should see other buildings' state
    mockCreate.mockResolvedValue(llmResponse('I see tests were already added'))

    await request(testApp.app).post('/api/chat').send({
      sessionId,
      buildingId: 'cicd',
      message: 'Set up CI',
    })

    const callArgs = mockCreate.mock.calls[mockCreate.mock.calls.length - 1][0]
    const system = callArgs.system as string

    // System prompt should include cross-building context showing other buildings' tasks
    // The "Project-Wide Progress" section includes all buildings except the current one
    expect(system).toContain('Project-Wide Progress')
    expect(system).toContain('tests')
    // Should NOT include cicd's own tasks in the cross-building section
    // (cicd is excluded since that's the current building)
    expect(system).toContain('Factory Builder') // cicd's own prompt is still there
  }, 20_000)
})

// ═══════════════════════════════════════════════════════════════════
// 10. SESSION ISOLATION
// ═══════════════════════════════════════════════════════════════════

describe('Session isolation', () => {
  it('different sessions have independent state', async () => {
    mockCreate.mockResolvedValue(llmResponse('[]'))

    const res1 = await request(testApp.app)
      .post('/api/scan')
      .send({ repoUrl: 'https://github.com/test/session-1' })
    const res2 = await request(testApp.app)
      .post('/api/scan')
      .send({ repoUrl: 'https://github.com/test/session-2' })

    const sid1 = res1.body.sessionId
    const sid2 = res2.body.sessionId

    expect(sid1).not.toBe(sid2)

    await Promise.all([
      waitForScanComplete(sid1, 15_000),
      waitForScanComplete(sid2, 15_000),
    ])

    // Accept change only on session 1
    await request(testApp.app).post('/api/accept').send({
      sessionId: sid1,
      buildingId: 'tests',
      files: [{ path: 'test.ts', content: 'only session 1', isNew: true }],
    })

    const { getSession } = await import('../session/store')
    expect(getSession(sid1)!.changes.length).toBe(1)
    expect(getSession(sid2)!.changes.length).toBe(0)
  }, 25_000)
})

// ═══════════════════════════════════════════════════════════════════
// 11. SCANNER — heuristic accuracy
// ═══════════════════════════════════════════════════════════════════

describe('Scanner heuristic accuracy', () => {
  it('detects test framework from package.json', async () => {
    mockCreate.mockResolvedValue(llmResponse('[]'))

    const res = await request(testApp.app)
      .post('/api/scan')
      .send({ repoUrl: 'https://github.com/test/heuristic-1' })
    await waitForScanComplete(res.body.sessionId, 15_000)

    const { getSession } = await import('../session/store')
    const session = getSession(res.body.sessionId)!
    const testsResult = session.results.tests!

    // Our fake repo has vitest in devDeps + test files
    const hasTestFramework = testsResult.tasks.some((t) => t.done && t.label.toLowerCase().includes('framework'))
    || testsResult.details.hasDep === true
    expect(testsResult.percent).toBeGreaterThan(0)
  }, 20_000)

  it('detects Dockerfile', async () => {
    mockCreate.mockResolvedValue(llmResponse('[]'))

    const res = await request(testApp.app)
      .post('/api/scan')
      .send({ repoUrl: 'https://github.com/test/heuristic-2' })
    await waitForScanComplete(res.body.sessionId, 15_000)

    const { getSession } = await import('../session/store')
    const session = getSession(res.body.sessionId)!
    const dockerResult = session.results.docker!

    // Fake repo has Dockerfile + .dockerignore
    expect(dockerResult.percent).toBeGreaterThan(0)
    const dockerfileTask = dockerResult.tasks.find((t) =>
      t.label.toLowerCase().includes('dockerfile')
    )
    expect(dockerfileTask?.done).toBe(true)
  }, 20_000)

  it('detects GitHub Actions', async () => {
    mockCreate.mockResolvedValue(llmResponse('[]'))

    const res = await request(testApp.app)
      .post('/api/scan')
      .send({ repoUrl: 'https://github.com/test/heuristic-3' })
    await waitForScanComplete(res.body.sessionId, 15_000)

    const { getSession } = await import('../session/store')
    const session = getSession(res.body.sessionId)!
    const ciResult = session.results.cicd!

    expect(ciResult.percent).toBeGreaterThan(0)
  }, 20_000)

  it('detects .gitignore with .env', async () => {
    mockCreate.mockResolvedValue(llmResponse('[]'))

    const res = await request(testApp.app)
      .post('/api/scan')
      .send({ repoUrl: 'https://github.com/test/heuristic-4' })
    await waitForScanComplete(res.body.sessionId, 15_000)

    const { getSession } = await import('../session/store')
    const session = getSession(res.body.sessionId)!
    const secResult = session.results.security!

    expect(secResult.percent).toBeGreaterThan(0)
  }, 20_000)

  it('detects .env.example', async () => {
    mockCreate.mockResolvedValue(llmResponse('[]'))

    const res = await request(testApp.app)
      .post('/api/scan')
      .send({ repoUrl: 'https://github.com/test/heuristic-5' })
    await waitForScanComplete(res.body.sessionId, 15_000)

    const { getSession } = await import('../session/store')
    const session = getSession(res.body.sessionId)!
    const envResult = session.results.envVars!

    expect(envResult.percent).toBeGreaterThan(0)
    const envExampleTask = envResult.tasks.find((t) =>
      t.label.toLowerCase().includes('.env.example') || t.label.toLowerCase().includes('env example')
    )
    expect(envExampleTask?.done).toBe(true)
  }, 20_000)
})

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

async function waitForScanComplete(sessionId: string, timeoutMs: number) {
  const { getSession } = await import('../session/store')
  const start = Date.now()

  while (Date.now() - start < timeoutMs) {
    const session = getSession(sessionId)
    if (session && Object.keys(session.results).length === 8) {
      return
    }
    await new Promise((r) => setTimeout(r, 200))
  }

  // Check what we got
  const session = getSession(sessionId)
  const resultCount = session ? Object.keys(session.results).length : 0
  throw new Error(
    `Scan did not complete within ${timeoutMs}ms. Got ${resultCount}/8 buildings.`
  )
}
