import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies before imports
const { mockCallAider, mockResetAiderChanges, mockCallEvaluator, mockAddChange, mockGetSession, mockUpdateSession } = vi.hoisted(() => ({
  mockCallAider: vi.fn(),
  mockResetAiderChanges: vi.fn(),
  mockCallEvaluator: vi.fn(),
  mockAddChange: vi.fn(),
  mockGetSession: vi.fn(),
  mockUpdateSession: vi.fn(),
}))

vi.mock('../agents/aider', () => ({
  callAider: mockCallAider,
  resetAiderChanges: mockResetAiderChanges,
}))
vi.mock('../agents/evaluator', () => ({ callEvaluator: mockCallEvaluator }))
vi.mock('../changes/queue', () => ({ addChange: mockAddChange }))
vi.mock('../session/store', () => ({
  getSession: mockGetSession,
  updateSession: mockUpdateSession,
}))

import { runTaskImplementation } from './index'

function makeIo() {
  const emit = vi.fn()
  const to = vi.fn().mockReturnValue({ emit })
  return { to, emit } as any
}

function makeSession(overrides = {}) {
  return {
    id: 'sess-1',
    repoUrl: 'https://github.com/test/repo',
    repoPath: '/tmp/repo',
    results: {
      tests: { buildingId: 'tests', percent: 50, tasks: [
        { id: '1', label: 'Add unit tests', done: false },
        { id: '2', label: 'Add coverage', done: true },
      ], details: {} },
    },
    changes: [],
    conversations: {},
    changeLog: [],
    createdAt: Date.now(),
    ...overrides,
  }
}

function makeAiderSuccess(files = [{ path: 'test.ts', content: 'test("x", () => {})' }]) {
  return {
    diff: '+test("x", () => {})',
    changedFiles: files,
    success: true,
  }
}

function makeAiderFailure(error = 'aider error') {
  return { diff: '', changedFiles: [], success: false, error }
}

describe('runTaskImplementation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockResetAiderChanges.mockResolvedValue(undefined)
  })

  it('runs aider + evaluator and returns completed task IDs on success', async () => {
    const session = makeSession()
    mockGetSession.mockReturnValue(session)
    mockCallAider.mockResolvedValue(makeAiderSuccess())
    mockCallEvaluator.mockResolvedValue({ pass: true, feedback: '', summary: 'Added unit tests' })

    const io = makeIo()
    const result = await runTaskImplementation({
      sessionId: 'sess-1',
      buildingId: 'tests',
      taskIds: ['1'],
      io,
    })

    expect(result.success).toBe(true)
    expect(result.completedTaskIds).toContain('1')
    expect(mockCallAider).toHaveBeenCalledTimes(1)
    expect(mockCallEvaluator).toHaveBeenCalledTimes(1)
  })

  it('emits task:start and task:complete events', async () => {
    const session = makeSession()
    mockGetSession.mockReturnValue(session)
    mockCallAider.mockResolvedValue(makeAiderSuccess())
    mockCallEvaluator.mockResolvedValue({ pass: true, feedback: '', summary: 'Done' })

    const io = makeIo()
    await runTaskImplementation({
      sessionId: 'sess-1',
      buildingId: 'tests',
      taskIds: ['1'],
      io,
    })

    const emittedTypes = io.to('sess-1').emit.mock.calls.map((c: any) => c[1].type)
    expect(emittedTypes).toContain('task:start')
    expect(emittedTypes).toContain('task:complete')
  })

  it('retries when evaluator fails', async () => {
    const session = makeSession()
    mockGetSession.mockReturnValue(session)
    mockCallAider.mockResolvedValue(makeAiderSuccess())
    mockCallEvaluator
      .mockResolvedValueOnce({ pass: false, feedback: 'Missing coverage', summary: '' })
      .mockResolvedValueOnce({ pass: true, feedback: '', summary: 'Fixed' })

    const io = makeIo()
    const result = await runTaskImplementation({
      sessionId: 'sess-1',
      buildingId: 'tests',
      taskIds: ['1'],
      io,
    })

    expect(mockCallAider).toHaveBeenCalledTimes(2)
    expect(mockCallEvaluator).toHaveBeenCalledTimes(2)
    expect(result.success).toBe(true)
  })

  it('auto-accepts after MAX_ITERATIONS even if evaluator fails', async () => {
    const session = makeSession()
    mockGetSession.mockReturnValue(session)
    mockCallAider.mockResolvedValue(makeAiderSuccess())
    mockCallEvaluator.mockResolvedValue({ pass: false, feedback: 'Still bad', summary: '' })

    const io = makeIo()
    const result = await runTaskImplementation({
      sessionId: 'sess-1',
      buildingId: 'tests',
      taskIds: ['1'],
      io,
    })

    expect(mockCallAider).toHaveBeenCalledTimes(3)
    expect(result.success).toBe(true)
    expect(mockAddChange).toHaveBeenCalledTimes(1)
  })

  it('saves accepted changes via addChange', async () => {
    const session = makeSession()
    mockGetSession.mockReturnValue(session)
    mockCallAider.mockResolvedValue(makeAiderSuccess([
      { path: 'test.ts', content: 'test code' },
    ]))
    mockCallEvaluator.mockResolvedValue({ pass: true, feedback: '', summary: 'Tests added' })

    const io = makeIo()
    await runTaskImplementation({
      sessionId: 'sess-1',
      buildingId: 'tests',
      taskIds: ['1'],
      io,
    })

    expect(mockAddChange).toHaveBeenCalledTimes(1)
    const change = mockAddChange.mock.calls[0][1]
    expect(change.buildingId).toBe('tests')
    expect(change.files[0].path).toBe('test.ts')
  })

  it('handles aider failure gracefully', async () => {
    const session = makeSession()
    mockGetSession.mockReturnValue(session)
    mockCallAider.mockResolvedValue(makeAiderFailure('timeout'))

    const io = makeIo()
    const result = await runTaskImplementation({
      sessionId: 'sess-1',
      buildingId: 'tests',
      taskIds: ['1'],
      io,
    })

    expect(mockCallAider).toHaveBeenCalledTimes(3)
    expect(result.success).toBe(false)
    expect(result.completedTaskIds).toHaveLength(0)
  })

  it('throws if session not found', async () => {
    mockGetSession.mockReturnValue(undefined)

    const io = makeIo()
    await expect(runTaskImplementation({
      sessionId: 'nonexistent',
      buildingId: 'tests',
      taskIds: ['1'],
      io,
    })).rejects.toThrow('Session not found')
  })

  it('throws if another implementation is already running', async () => {
    const session = makeSession()
    mockGetSession.mockReturnValue(session)
    mockCallAider.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve(makeAiderSuccess()), 100)))
    mockCallEvaluator.mockResolvedValue({ pass: true, feedback: '', summary: 'Done' })

    const io = makeIo()

    // Start first run
    const first = runTaskImplementation({
      sessionId: 'sess-1',
      buildingId: 'tests',
      taskIds: ['1'],
      io,
    })

    // Try second run immediately
    await expect(runTaskImplementation({
      sessionId: 'sess-1',
      buildingId: 'tests',
      taskIds: ['2'],
      io,
    })).rejects.toThrow('Another implementation is already running')

    await first
  })

  it('includes user message in task description', async () => {
    const session = makeSession()
    mockGetSession.mockReturnValue(session)
    mockCallAider.mockResolvedValue(makeAiderSuccess())
    mockCallEvaluator.mockResolvedValue({ pass: true, feedback: '', summary: 'Done' })

    const io = makeIo()
    await runTaskImplementation({
      sessionId: 'sess-1',
      buildingId: 'tests',
      taskIds: ['1'],
      userMessage: 'Use Jest for testing',
      io,
    })

    const aiderCall = mockCallAider.mock.calls[0][0]
    expect(aiderCall.taskDescription).toContain('Use Jest for testing')
  })
})
