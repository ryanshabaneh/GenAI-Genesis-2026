import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

const { mockRunTaskImpl, mockGetSession } = vi.hoisted(() => ({
  mockRunTaskImpl: vi.fn(),
  mockGetSession: vi.fn(),
}))

vi.mock('../orchestrator', () => ({
  runTaskImplementation: mockRunTaskImpl,
}))
vi.mock('../session/store', () => ({
  getSession: mockGetSession,
}))

import implementRouter from './implement'

function createApp() {
  const app = express()
  app.use(express.json())
  // Provide a mock io so the route can access it
  const mockIo = { to: vi.fn().mockReturnValue({ emit: vi.fn() }) }
  app.locals['io'] = mockIo
  app.use('/api/implement', implementRouter)
  return app
}

const baseSession = {
  id: 'sess-1',
  repoUrl: 'https://github.com/test/repo',
  repoPath: '/tmp/repo',
  results: {
    tests: {
      buildingId: 'tests',
      percent: 25,
      tasks: [
        { id: 't1', label: 'Install test framework', done: true },
        { id: 't2', label: 'Add unit tests for routes', done: false },
        { id: 't3', label: 'Add test script to package.json', done: false },
        { id: 't4', label: 'Reach 50% coverage', done: false },
      ],
      details: {},
    },
  },
  changes: [],
  conversations: {},
  changeLog: [],
  createdAt: Date.now(),
}

describe('POST /api/implement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 if sessionId, buildingId, or taskIds missing', async () => {
    const app = createApp()
    const res = await request(app).post('/api/implement').send({})
    expect(res.status).toBe(400)
  })

  it('returns 404 if session not found', async () => {
    mockGetSession.mockReturnValue(undefined)
    const app = createApp()
    const res = await request(app).post('/api/implement').send({
      sessionId: 'nope',
      buildingId: 'tests',
      taskIds: ['t2'],
    })
    expect(res.status).toBe(404)
  })

  it('returns 404 if building has no scan results', async () => {
    mockGetSession.mockReturnValue({ ...baseSession, results: {} })
    const app = createApp()
    const res = await request(app).post('/api/implement').send({
      sessionId: 'sess-1',
      buildingId: 'tests',
      taskIds: ['t2'],
    })
    expect(res.status).toBe(404)
  })

  it('calls runTaskImplementation and returns result on success', async () => {
    mockGetSession.mockReturnValue(baseSession)
    mockRunTaskImpl.mockResolvedValue({
      success: true,
      completedTaskIds: ['t2', 't3'],
    })

    const app = createApp()
    const res = await request(app).post('/api/implement').send({
      sessionId: 'sess-1',
      buildingId: 'tests',
      taskIds: ['t2', 't3'],
    })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.completedTaskIds).toEqual(['t2', 't3'])
    expect(mockRunTaskImpl).toHaveBeenCalledTimes(1)
  })

  it('passes user message to runTaskImplementation', async () => {
    mockGetSession.mockReturnValue(baseSession)
    mockRunTaskImpl.mockResolvedValue({
      success: true,
      completedTaskIds: ['t2'],
    })

    const app = createApp()
    await request(app).post('/api/implement').send({
      sessionId: 'sess-1',
      buildingId: 'tests',
      taskIds: ['t2'],
      message: 'Use vitest not jest',
    })

    const callArgs = mockRunTaskImpl.mock.calls[0][0]
    expect(callArgs.userMessage).toBe('Use vitest not jest')
    expect(callArgs.buildingId).toBe('tests')
    expect(callArgs.taskIds).toEqual(['t2'])
  })

  it('returns 500 when runTaskImplementation throws', async () => {
    mockGetSession.mockReturnValue(baseSession)
    mockRunTaskImpl.mockRejectedValue(new Error('Another implementation is already running'))

    const app = createApp()
    const res = await request(app).post('/api/implement').send({
      sessionId: 'sess-1',
      buildingId: 'tests',
      taskIds: ['t2'],
    })

    expect(res.status).toBe(500)
    expect(res.body.error).toContain('already running')
  })
})
