import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies before imports
const { mockCallAider, mockResetAiderChanges, mockCallEvaluator, mockAddChange, mockGetSession } = vi.hoisted(() => ({
  mockCallAider: vi.fn(),
  mockResetAiderChanges: vi.fn(),
  mockCallEvaluator: vi.fn(),
  mockAddChange: vi.fn(),
  mockGetSession: vi.fn(),
}))

vi.mock('../agents/aider', () => ({
  callAider: mockCallAider,
  resetAiderChanges: mockResetAiderChanges,
}))
vi.mock('../agents/evaluator', () => ({ callEvaluator: mockCallEvaluator }))
vi.mock('../changes/queue', () => ({ addChange: mockAddChange }))
vi.mock('../session/store', () => ({
  getSession: mockGetSession,
  updateSession: vi.fn(),
}))

import { runOrchestrator } from './index'

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
      readme: { buildingId: 'readme', percent: 100, tasks: [
        { id: '3', label: 'Add README', done: true },
      ], details: {} },
    },
    changes: [],
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

describe('runOrchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockResetAiderChanges.mockResolvedValue(undefined)
  })

  it('skips buildings already at 100%', async () => {
    const session = makeSession()
    mockGetSession.mockReturnValue(session)
    mockCallAider.mockResolvedValue(makeAiderSuccess())
    mockCallEvaluator.mockResolvedValue({ pass: true, feedback: '' })

    const io = makeIo()
    await runOrchestrator('sess-1', io)

    // Should only call aider for 'tests' (50%), not 'readme' (100%)
    expect(mockCallAider).toHaveBeenCalledTimes(1)
    expect(mockCallAider.mock.calls[0][0].buildingId).toBe('tests')
  })

  it('emits agent:start, agent:complete, and orchestrator:complete events', async () => {
    const session = makeSession()
    mockGetSession.mockReturnValue(session)
    mockCallAider.mockResolvedValue(makeAiderSuccess())
    mockCallEvaluator.mockResolvedValue({ pass: true, feedback: '' })

    const io = makeIo()
    await runOrchestrator('sess-1', io)

    const emittedTypes = io.to('sess-1').emit.mock.calls.map((c: any) => c[1].type)
    expect(emittedTypes).toContain('agent:start')
    expect(emittedTypes).toContain('agent:complete')
    expect(emittedTypes).toContain('orchestrator:complete')
  })

  it('retries when evaluator fails and emits agent:iteration', async () => {
    const session = makeSession()
    mockGetSession.mockReturnValue(session)
    mockCallAider.mockResolvedValue(makeAiderSuccess())
    mockCallEvaluator
      .mockResolvedValueOnce({ pass: false, feedback: 'Missing coverage setup' })
      .mockResolvedValueOnce({ pass: true, feedback: '' })

    const io = makeIo()
    await runOrchestrator('sess-1', io)

    // Aider called twice (initial + retry), evaluator called twice
    expect(mockCallAider).toHaveBeenCalledTimes(2)
    expect(mockCallEvaluator).toHaveBeenCalledTimes(2)

    const emittedTypes = io.to('sess-1').emit.mock.calls.map((c: any) => c[1].type)
    expect(emittedTypes).toContain('agent:iteration')
  })

  it('passes feedback to aider on retry', async () => {
    const session = makeSession()
    mockGetSession.mockReturnValue(session)
    mockCallAider.mockResolvedValue(makeAiderSuccess())
    mockCallEvaluator
      .mockResolvedValueOnce({ pass: false, feedback: 'Tests are incomplete' })
      .mockResolvedValueOnce({ pass: true, feedback: '' })

    const io = makeIo()
    await runOrchestrator('sess-1', io)

    // Second aider call should include the feedback
    const secondCall = mockCallAider.mock.calls[1][0]
    expect(secondCall.feedback).toBe('Tests are incomplete')
  })

  it('resets repo between iterations', async () => {
    const session = makeSession()
    mockGetSession.mockReturnValue(session)
    mockCallAider.mockResolvedValue(makeAiderSuccess())
    mockCallEvaluator
      .mockResolvedValueOnce({ pass: false, feedback: 'Bad' })
      .mockResolvedValueOnce({ pass: true, feedback: '' })

    const io = makeIo()
    await runOrchestrator('sess-1', io)

    // resetAiderChanges called after failed eval + after successful accept
    expect(mockResetAiderChanges).toHaveBeenCalledWith('/tmp/repo')
  })

  it('auto-accepts after MAX_ITERATIONS even if evaluator fails', async () => {
    const session = makeSession()
    mockGetSession.mockReturnValue(session)
    mockCallAider.mockResolvedValue(makeAiderSuccess())
    mockCallEvaluator.mockResolvedValue({ pass: false, feedback: 'Still bad' })

    const io = makeIo()
    await runOrchestrator('sess-1', io)

    // 3 iterations max
    expect(mockCallAider).toHaveBeenCalledTimes(3)
    expect(mockAddChange).toHaveBeenCalledTimes(1)

    const emittedTypes = io.to('sess-1').emit.mock.calls.map((c: any) => c[1].type)
    expect(emittedTypes).toContain('agent:complete')
  })

  it('saves accepted changes via addChange', async () => {
    const session = makeSession()
    mockGetSession.mockReturnValue(session)
    mockCallAider.mockResolvedValue(makeAiderSuccess([
      { path: 'test.ts', content: 'test code' },
    ]))
    mockCallEvaluator.mockResolvedValue({ pass: true, feedback: '' })

    const io = makeIo()
    await runOrchestrator('sess-1', io)

    expect(mockAddChange).toHaveBeenCalledTimes(1)
    const change = mockAddChange.mock.calls[0][1]
    expect(change.buildingId).toBe('tests')
    expect(change.files[0].path).toBe('test.ts')
    expect(change.files[0].content).toBe('test code')
  })

  it('handles aider failure without crashing', async () => {
    const session = makeSession()
    mockGetSession.mockReturnValue(session)
    mockCallAider.mockResolvedValue(makeAiderFailure('timeout'))

    const io = makeIo()
    await runOrchestrator('sess-1', io)

    // Should retry up to MAX_ITERATIONS then emit error
    expect(mockCallAider).toHaveBeenCalledTimes(3)
    const emittedTypes = io.to('sess-1').emit.mock.calls.map((c: any) => c[1].type)
    expect(emittedTypes).toContain('agent:error')
  })

  it('catches per-building errors without stopping other buildings', async () => {
    const session = makeSession({
      results: {
        tests: { buildingId: 'tests', percent: 50, tasks: [{ id: '1', label: 'Add tests', done: false }], details: {} },
        docker: { buildingId: 'docker', percent: 25, tasks: [{ id: '2', label: 'Add Dockerfile', done: false }], details: {} },
      },
    })
    mockGetSession.mockReturnValue(session)

    mockCallAider
      .mockRejectedValueOnce(new Error('API error'))
      .mockResolvedValue(makeAiderSuccess([
        { path: 'Dockerfile', content: 'FROM node' },
      ]))
    mockCallEvaluator.mockResolvedValue({ pass: true, feedback: '' })

    const io = makeIo()
    await runOrchestrator('sess-1', io)

    const emittedTypes = io.to('sess-1').emit.mock.calls.map((c: any) => c[1].type)
    expect(emittedTypes).toContain('agent:error')
    expect(emittedTypes).toContain('agent:complete')
  })

  it('emits orchestrator:complete with score 100 when no buildings need fixing', async () => {
    const session = makeSession({
      results: {
        tests: { buildingId: 'tests', percent: 100, tasks: [], details: {} },
        readme: { buildingId: 'readme', percent: 100, tasks: [], details: {} },
      },
    })
    mockGetSession.mockReturnValue(session)

    const io = makeIo()
    await runOrchestrator('sess-1', io)

    expect(mockCallAider).not.toHaveBeenCalled()
    const lastEmit = io.to('sess-1').emit.mock.calls[0][1]
    expect(lastEmit.type).toBe('orchestrator:complete')
    expect(lastEmit.score).toBe(100)
  })

  it('does nothing if session not found', async () => {
    mockGetSession.mockReturnValue(undefined)

    const io = makeIo()
    await runOrchestrator('nonexistent', io)

    expect(mockCallAider).not.toHaveBeenCalled()
    expect(io.to).not.toHaveBeenCalled()
  })
})
