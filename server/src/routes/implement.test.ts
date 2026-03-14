import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

const { mockCallAider, mockResetAider, mockGetSession } = vi.hoisted(() => ({
  mockCallAider: vi.fn(),
  mockResetAider: vi.fn(),
  mockGetSession: vi.fn(),
}))

vi.mock('../agents/aider', () => ({
  callAider: mockCallAider,
  resetAiderChanges: mockResetAider,
}))
vi.mock('../session/store', () => ({
  getSession: mockGetSession,
}))

import implementRouter from './implement'

function createApp() {
  const app = express()
  app.use(express.json())
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
  createdAt: Date.now(),
}

describe('POST /api/implement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockResetAider.mockResolvedValue(undefined)
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

  it('returns 400 if taskIds dont match any tasks', async () => {
    mockGetSession.mockReturnValue(baseSession)
    const app = createApp()
    const res = await request(app).post('/api/implement').send({
      sessionId: 'sess-1',
      buildingId: 'tests',
      taskIds: ['nonexistent'],
    })
    expect(res.status).toBe(400)
  })

  it('calls aider with selected tasks and returns preview', async () => {
    mockGetSession.mockReturnValue(baseSession)
    mockCallAider.mockResolvedValue({
      success: true,
      diff: '+test code',
      changedFiles: [{ path: 'tests/routes.test.ts', content: 'test code' }],
    })

    const app = createApp()
    const res = await request(app).post('/api/implement').send({
      sessionId: 'sess-1',
      buildingId: 'tests',
      taskIds: ['t2', 't3'],
    })

    expect(res.status).toBe(200)
    expect(res.body.files).toHaveLength(1)
    expect(res.body.files[0].path).toBe('tests/routes.test.ts')
    expect(res.body.diff).toBe('+test code')
    expect(res.body.taskIds).toEqual(['t2', 't3'])

    // Verify aider was called with the right task labels
    const aiderCall = mockCallAider.mock.calls[0][0]
    expect(aiderCall.buildingId).toBe('tests')
    expect(aiderCall.taskDescription).toContain('Add unit tests for routes')
    expect(aiderCall.taskDescription).toContain('Add test script to package.json')
  })

  it('includes user message in aider call', async () => {
    mockGetSession.mockReturnValue(baseSession)
    mockCallAider.mockResolvedValue({
      success: true,
      diff: '+code',
      changedFiles: [{ path: 'test.ts', content: 'code' }],
    })

    const app = createApp()
    await request(app).post('/api/implement').send({
      sessionId: 'sess-1',
      buildingId: 'tests',
      taskIds: ['t2'],
      message: 'Use vitest not jest',
    })

    const aiderCall = mockCallAider.mock.calls[0][0]
    expect(aiderCall.taskDescription).toContain('Use vitest not jest')
  })

  it('resets repo after returning preview', async () => {
    mockGetSession.mockReturnValue(baseSession)
    mockCallAider.mockResolvedValue({
      success: true,
      diff: '+code',
      changedFiles: [{ path: 'test.ts', content: 'code' }],
    })

    const app = createApp()
    await request(app).post('/api/implement').send({
      sessionId: 'sess-1',
      buildingId: 'tests',
      taskIds: ['t2'],
    })

    expect(mockResetAider).toHaveBeenCalledWith('/tmp/repo')
  })

  it('returns 500 and resets when aider fails', async () => {
    mockGetSession.mockReturnValue(baseSession)
    mockCallAider.mockResolvedValue({
      success: false,
      diff: '',
      changedFiles: [],
      error: 'aider timeout',
    })

    const app = createApp()
    const res = await request(app).post('/api/implement').send({
      sessionId: 'sess-1',
      buildingId: 'tests',
      taskIds: ['t2'],
    })

    expect(res.status).toBe(500)
    expect(res.body.error).toContain('aider')
    expect(mockResetAider).toHaveBeenCalled()
  })
})
