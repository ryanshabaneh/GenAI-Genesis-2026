import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'

const { createMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
}))

vi.mock('./client', () => ({
  client: { messages: { create: createMock } },
}))

import { callEvaluator, evaluateRepoState } from './evaluator'

const baseParms = {
  buildingId: 'tests',
  repoPath: '/tmp/repo',
  tasks: [
    { id: '1', label: 'Add unit tests', done: false },
    { id: '2', label: 'Add coverage config', done: true },
  ],
  builderResponse: 'Here is the test file.',
  codeBlocks: [{ path: 'tests/index.test.ts', content: 'test("x", () => {})', language: 'typescript' }],
}

describe('callEvaluator', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns pass:true when evaluator approves', async () => {
    createMock.mockResolvedValue({
      content: [{ type: 'text', text: '{ "pass": true, "feedback": "" }' }],
    })

    const result = await callEvaluator(baseParms)
    expect(result.pass).toBe(true)
    expect(result.feedback).toBe('')
  })

  it('returns pass:false with feedback when evaluator rejects', async () => {
    createMock.mockResolvedValue({
      content: [{ type: 'text', text: '{ "pass": false, "feedback": "Missing coverage config" }' }],
    })

    const result = await callEvaluator(baseParms)
    expect(result.pass).toBe(false)
    expect(result.feedback).toBe('Missing coverage config')
  })

  it('uses claude-sonnet-4-6 with max_tokens 1024', async () => {
    createMock.mockResolvedValue({
      content: [{ type: 'text', text: '{ "pass": true, "feedback": "" }' }],
    })

    await callEvaluator(baseParms)

    const callArgs = createMock.mock.calls[0][0]
    expect(callArgs.model).toBe('claude-sonnet-4-6')
    expect(callArgs.max_tokens).toBe(1024)
  })

  it('treats JSON parse failure as pass:false', async () => {
    createMock.mockResolvedValue({
      content: [{ type: 'text', text: 'Not valid JSON at all' }],
    })

    const result = await callEvaluator(baseParms)
    expect(result.pass).toBe(false)
    expect(result.feedback).toContain('failed')
  })

  it('treats API error as pass:false', async () => {
    createMock.mockRejectedValue(new Error('API timeout'))

    const result = await callEvaluator(baseParms)
    expect(result.pass).toBe(false)
  })

  it('only includes incomplete tasks in the prompt', async () => {
    createMock.mockResolvedValue({
      content: [{ type: 'text', text: '{ "pass": true, "feedback": "" }' }],
    })

    await callEvaluator(baseParms)

    const callArgs = createMock.mock.calls[0][0]
    const userMsg = callArgs.messages[0].content
    expect(userMsg).toContain('Add unit tests')
    expect(userMsg).not.toContain('Add coverage config')
  })
})

describe('evaluateRepoState — deterministic env-example check', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'evaluator-env-test-'))
  })

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('empty repo → env-example fails (no false positive)', async () => {
    const result = await evaluateRepoState({
      buildingId: 'envVars',
      repoPath: tmpDir,
      tasks: [{ id: 'env-example', label: '.env.example or .env.template exists', done: false }],
      taskIds: ['env-example'],
    })
    expect(result).toHaveLength(1)
    expect(result[0].taskId).toBe('env-example')
    expect(result[0].pass).toBe(false)
    expect(result[0].feedback).toContain('No .env.example')
  })

  it('repo with .env.example → env-example passes', async () => {
    fs.writeFileSync(path.join(tmpDir, '.env.example'), 'DATABASE_URL=')
    const result = await evaluateRepoState({
      buildingId: 'envVars',
      repoPath: tmpDir,
      tasks: [{ id: 'env-example', label: '.env.example or .env.template exists', done: false }],
      taskIds: ['env-example'],
    })
    expect(result).toHaveLength(1)
    expect(result[0].pass).toBe(true)
    expect(result[0].summary).toContain('.env.example')
  })

  it('repo with .env.template only → env-example passes', async () => {
    fs.writeFileSync(path.join(tmpDir, '.env.template'), 'PORT=3000')
    const result = await evaluateRepoState({
      buildingId: 'envVars',
      repoPath: tmpDir,
      tasks: [{ id: 'env-example', label: '.env.example or .env.template exists', done: false }],
      taskIds: ['env-example'],
    })
    expect(result).toHaveLength(1)
    expect(result[0].pass).toBe(true)
  })
})

describe('evaluateRepoState — deterministic env-gitignore / security-env-ignored check', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'evaluator-gitignore-test-'))
  })

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('empty repo (no .gitignore) → env-gitignore fails', async () => {
    const result = await evaluateRepoState({
      buildingId: 'envVars',
      repoPath: tmpDir,
      tasks: [{ id: 'env-gitignore', label: '.env in .gitignore', done: false }],
      taskIds: ['env-gitignore'],
    })
    expect(result).toHaveLength(1)
    expect(result[0].taskId).toBe('env-gitignore')
    expect(result[0].pass).toBe(false)
    expect(result[0].feedback).toMatch(/\.gitignore|\.env/)
  })

  it('empty repo (no .gitignore) → security-env-ignored fails', async () => {
    const result = await evaluateRepoState({
      buildingId: 'security',
      repoPath: tmpDir,
      tasks: [{ id: 'security-env-ignored', label: '.env listed in .gitignore', done: false }],
      taskIds: ['security-env-ignored'],
    })
    expect(result).toHaveLength(1)
    expect(result[0].taskId).toBe('security-env-ignored')
    expect(result[0].pass).toBe(false)
  })

  it('.gitignore without .env → env-gitignore fails', async () => {
    fs.writeFileSync(path.join(tmpDir, '.gitignore'), 'node_modules\ndist\n')
    const result = await evaluateRepoState({
      buildingId: 'envVars',
      repoPath: tmpDir,
      tasks: [{ id: 'env-gitignore', label: '.env in .gitignore', done: false }],
      taskIds: ['env-gitignore'],
    })
    expect(result[0].pass).toBe(false)
  })

  it('.gitignore with .env → env-gitignore passes', async () => {
    fs.writeFileSync(path.join(tmpDir, '.gitignore'), 'node_modules\n.env\ndist\n')
    const result = await evaluateRepoState({
      buildingId: 'envVars',
      repoPath: tmpDir,
      tasks: [{ id: 'env-gitignore', label: '.env in .gitignore', done: false }],
      taskIds: ['env-gitignore'],
    })
    expect(result[0].pass).toBe(true)
    expect(result[0].summary).toContain('.gitignore')
  })

  it('.gitignore with .env → security-env-ignored passes', async () => {
    fs.writeFileSync(path.join(tmpDir, '.gitignore'), '.env\n')
    const result = await evaluateRepoState({
      buildingId: 'security',
      repoPath: tmpDir,
      tasks: [{ id: 'security-env-ignored', label: '.env listed in .gitignore', done: false }],
      taskIds: ['security-env-ignored'],
    })
    expect(result[0].pass).toBe(true)
  })
})
