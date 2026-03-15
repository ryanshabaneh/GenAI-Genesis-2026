import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

const { mockEvaluateRepoState, mockGetSession, mockUpdateSession } = vi.hoisted(() => ({
  mockEvaluateRepoState: vi.fn(),
  mockGetSession: vi.fn(),
  mockUpdateSession: vi.fn(),
}))

vi.mock('../agents/evaluator', () => ({
  evaluateRepoState: mockEvaluateRepoState,
}))
vi.mock('../session/store', () => ({
  getSession: mockGetSession,
  updateSession: mockUpdateSession,
}))

import evaluateRouter from './evaluate'

function createApp() {
  const app = express()
  app.use(express.json())
  const mockIo = { to: vi.fn().mockReturnValue({ emit: vi.fn() }) }
  app.locals['io'] = mockIo
  app.use('/api/evaluate', evaluateRouter)
  return app
}

const baseSession = {
  id: 'sess-1',
  repoUrl: 'https://github.com/test/repo',
  repoPath: '/tmp/cloned-repo',
  results: {
    envVars: {
      buildingId: 'envVars',
      percent: 0,
      tasks: [
        { id: 'env-example', label: '.env.example or .env.template exists', done: false },
        { id: 'env-gitignore', label: '.env in .gitignore', done: false },
      ],
      details: {},
    },
  },
  changes: [],
  conversations: {},
  changeLog: [],
  createdAt: Date.now(),
}

describe('POST /api/evaluate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 if sessionId or buildingId missing', async () => {
    const app = createApp()
    const res = await request(app).post('/api/evaluate').send({})
    expect(res.status).toBe(400)
    expect(mockEvaluateRepoState).not.toHaveBeenCalled()
  })

  it('returns 404 if session not found', async () => {
    mockGetSession.mockReturnValue(undefined)
    const app = createApp()
    const res = await request(app).post('/api/evaluate').send({
      sessionId: 'nope',
      buildingId: 'envVars',
    })
    expect(res.status).toBe(404)
    expect(mockEvaluateRepoState).not.toHaveBeenCalled()
  })

  it('returns 400 when repoPath is empty (scan not complete)', async () => {
    mockGetSession.mockReturnValue({ ...baseSession, repoPath: '' })
    const app = createApp()
    const res = await request(app).post('/api/evaluate').send({
      sessionId: 'sess-1',
      buildingId: 'envVars',
    })
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('Repository not ready')
    expect(res.body.error).toContain('scan')
    expect(mockEvaluateRepoState).not.toHaveBeenCalled()
  })

  it('returns 400 when repoPath is whitespace-only', async () => {
    mockGetSession.mockReturnValue({ ...baseSession, repoPath: '   ' })
    const app = createApp()
    const res = await request(app).post('/api/evaluate').send({
      sessionId: 'sess-1',
      buildingId: 'envVars',
    })
    expect(res.status).toBe(400)
    expect(mockEvaluateRepoState).not.toHaveBeenCalled()
  })

  it('returns 404 if building has no scan results', async () => {
    mockGetSession.mockReturnValue({ ...baseSession, results: {} })
    const app = createApp()
    const res = await request(app).post('/api/evaluate').send({
      sessionId: 'sess-1',
      buildingId: 'envVars',
    })
    expect(res.status).toBe(404)
    expect(mockEvaluateRepoState).not.toHaveBeenCalled()
  })

  it('calls evaluateRepoState and returns results on success', async () => {
    mockGetSession.mockReturnValue(baseSession)
    mockEvaluateRepoState.mockResolvedValue([
      { taskId: 'env-example', pass: false, feedback: 'No .env.example found', summary: '' },
    ])

    const app = createApp()
    const res = await request(app).post('/api/evaluate').send({
      sessionId: 'sess-1',
      buildingId: 'envVars',
    })

    expect(res.status).toBe(200)
    expect(mockEvaluateRepoState).toHaveBeenCalledWith({
      buildingId: 'envVars',
      repoPath: '/tmp/cloned-repo',
      tasks: baseSession.results.envVars.tasks,
      taskIds: undefined,
    })
    expect(res.body.results).toHaveLength(1)
    expect(res.body.results[0].taskId).toBe('env-example')
    expect(res.body.results[0].pass).toBe(false)
    expect(res.body.results[0].feedback).toContain('.env.example')
  })
})
