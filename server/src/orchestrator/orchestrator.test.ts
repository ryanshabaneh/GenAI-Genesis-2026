import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies before imports
const { mockCallAider, mockResetAiderChanges, mockCallEvaluator, mockCallAgentForImplementation, mockCallAgent, mockAddChange, mockGetSession, mockUpdateSession } = vi.hoisted(() => ({
  mockCallAider: vi.fn(),
  mockResetAiderChanges: vi.fn(),
  mockCallEvaluator: vi.fn(),
  mockCallAgentForImplementation: vi.fn(),
  mockCallAgent: vi.fn(),
  mockAddChange: vi.fn(),
  mockGetSession: vi.fn(),
  mockUpdateSession: vi.fn(),
}))

vi.mock('../agents/aider', () => ({
  callAider: mockCallAider,
  resetAiderChanges: mockResetAiderChanges,
}))
vi.mock('../agents/base', () => ({
  callAgentForImplementation: mockCallAgentForImplementation,
  callAgent: mockCallAgent,
  parseCodeBlocks: vi.fn().mockReturnValue([]),
}))
vi.mock('../agents/evaluator', () => ({ callEvaluator: mockCallEvaluator }))
vi.mock('../changes/queue', () => ({ addChange: mockAddChange }))
vi.mock('../session/store', () => ({
  getSession: mockGetSession,
  updateSession: mockUpdateSession,
}))

import { runTaskImplementation, _setAiderAvailable } from './index'

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
    pendingReview: null,
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
  let currentSession: ReturnType<typeof makeSession> | undefined

  beforeEach(() => {
    vi.clearAllMocks()
    currentSession = undefined
    mockResetAiderChanges.mockResolvedValue(undefined)
    mockCallAgentForImplementation.mockResolvedValue('Agent-generated implementation instructions')
    // Force aider as available for tests (skip the execSync check)
    _setAiderAvailable(true)
    // Make updateSession actually mutate the session so getSession returns updated state
    mockUpdateSession.mockImplementation((_id: string, updates: Record<string, unknown>) => {
      if (currentSession) Object.assign(currentSession, updates)
    })
  })

  function setupSession(overrides = {}) {
    currentSession = makeSession(overrides)
    mockGetSession.mockReturnValue(currentSession)
    return currentSession
  }

  it('runs aider + evaluator and sets pendingReview on success', async () => {
    setupSession()
    mockCallAider.mockResolvedValue(makeAiderSuccess())
    mockCallEvaluator.mockResolvedValue({ pass: true, feedback: '', summary: 'Added unit tests' })

    const io = makeIo()
    await runTaskImplementation({
      sessionId: 'sess-1',
      buildingId: 'tests',
      taskIds: ['1'],
      io,
    })

    expect(mockCallAider).toHaveBeenCalledTimes(1)
    expect(mockCallEvaluator).toHaveBeenCalledTimes(1)
    // Changes stay on disk — pendingReview is set instead of addChange
    expect(mockUpdateSession).toHaveBeenCalledWith('sess-1', expect.objectContaining({
      pendingReview: expect.objectContaining({
        buildingId: 'tests',
        taskIds: ['1'],
        files: ['test.ts'],
        summary: 'Added unit tests',
      }),
    }))
  })

  it('emits task:start and review:pending events', async () => {
    setupSession()
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
    expect(emittedTypes).toContain('review:pending')
  })

  it('retries when evaluator fails then sets pendingReview on pass', async () => {
    setupSession()
    mockCallAider.mockResolvedValue(makeAiderSuccess())
    mockCallEvaluator
      .mockResolvedValueOnce({ pass: false, feedback: 'Missing coverage', summary: '' })
      .mockResolvedValueOnce({ pass: true, feedback: '', summary: 'Fixed' })

    const io = makeIo()
    await runTaskImplementation({
      sessionId: 'sess-1',
      buildingId: 'tests',
      taskIds: ['1'],
      io,
    })

    expect(mockCallAider).toHaveBeenCalledTimes(2)
    expect(mockCallEvaluator).toHaveBeenCalledTimes(2)
    // After retry passes, pendingReview is set (not addChange)
    expect(mockUpdateSession).toHaveBeenCalledWith('sess-1', expect.objectContaining({
      pendingReview: expect.objectContaining({ buildingId: 'tests' }),
    }))
  })

  it('sets pendingReview after MAX_ITERATIONS even if evaluator fails', async () => {
    setupSession()
    mockCallAider.mockResolvedValue(makeAiderSuccess())
    mockCallEvaluator.mockResolvedValue({ pass: false, feedback: 'Still bad', summary: '' })

    const io = makeIo()
    await runTaskImplementation({
      sessionId: 'sess-1',
      buildingId: 'tests',
      taskIds: ['1'],
      io,
    })

    expect(mockCallAider).toHaveBeenCalledTimes(3)
    // Changes stay on disk for user review — no immediate addChange
    expect(mockAddChange).not.toHaveBeenCalled()
    expect(mockUpdateSession).toHaveBeenCalledWith('sess-1', expect.objectContaining({
      pendingReview: expect.objectContaining({
        buildingId: 'tests',
        taskIds: ['1'],
      }),
    }))
  })

  it('sets pendingReview with changed files (addChange deferred to accept)', async () => {
    setupSession()
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

    // addChange is NOT called until user accepts via /api/accept
    expect(mockAddChange).not.toHaveBeenCalled()
    expect(mockUpdateSession).toHaveBeenCalledWith('sess-1', expect.objectContaining({
      pendingReview: expect.objectContaining({
        files: ['test.ts'],
        summary: 'Tests added',
      }),
    }))
  })

  it('handles aider failure gracefully', async () => {
    setupSession()
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

  it('throws if pendingReview exists', async () => {
    setupSession({
      pendingReview: { buildingId: 'tests', taskIds: ['1'], files: ['test.ts'], summary: 'x', createdAt: Date.now() },
    })

    const io = makeIo()
    await expect(runTaskImplementation({
      sessionId: 'sess-1',
      buildingId: 'tests',
      taskIds: ['1'],
      io,
    })).rejects.toThrow('pending review must be accepted or rejected')
  })

  it('throws if another implementation is already running', async () => {
    setupSession()
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

  it('includes user message in agent call', async () => {
    setupSession()
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

    const agentCall = mockCallAgentForImplementation.mock.calls[0][0]
    expect(agentCall.message).toContain('Use Jest for testing')
  })
})
