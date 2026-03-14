import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import { createSession, getSession } from '../session/store'

// Mock the agent call so we don't hit Claude API
vi.mock('../agents/base', () => ({
  callAgent: vi.fn().mockResolvedValue({
    role: 'assistant',
    content: 'Here is a test file for your auth routes.',
    codeBlocks: [
      { path: 'tests/auth.test.ts', content: 'test("auth", () => {})', language: 'typescript' },
    ],
  }),
}))

// Mock the client to avoid summarization LLM calls
vi.mock('../agents/client', () => ({
  client: { messages: { create: vi.fn() } },
}))

import chatRouter from './chat'
import { callAgent } from '../agents/base'

function createApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/chat', chatRouter)
  return app
}

describe('POST /api/chat', () => {
  let app: express.Express
  let sessionId: string

  beforeEach(() => {
    vi.clearAllMocks()
    app = createApp()
    const session = createSession({ repoUrl: 'https://github.com/test/repo', repoPath: '/tmp/repo' })
    sessionId = session.id
  })

  it('returns 400 when sessionId is missing', async () => {
    const res = await request(app)
      .post('/api/chat')
      .send({ buildingId: 'tests', message: 'help' })

    expect(res.status).toBe(400)
    expect(res.body.error).toContain('required')
  })

  it('returns 400 when buildingId is missing', async () => {
    const res = await request(app)
      .post('/api/chat')
      .send({ sessionId, message: 'help' })

    expect(res.status).toBe(400)
    expect(res.body.error).toContain('required')
  })

  it('returns 400 when message is missing', async () => {
    const res = await request(app)
      .post('/api/chat')
      .send({ sessionId, buildingId: 'tests' })

    expect(res.status).toBe(400)
    expect(res.body.error).toContain('required')
  })

  it('returns 404 for non-existent session', async () => {
    const res = await request(app)
      .post('/api/chat')
      .send({ sessionId: 'fake-id', buildingId: 'tests', message: 'help' })

    expect(res.status).toBe(404)
    expect(res.body.error).toContain('Session not found')
  })

  it('returns agent reply for valid request', async () => {
    const res = await request(app)
      .post('/api/chat')
      .send({ sessionId, buildingId: 'tests', message: 'Write auth tests' })

    expect(res.status).toBe(200)
    expect(res.body.reply).toBeDefined()
    expect(res.body.reply.role).toBe('assistant')
    expect(res.body.reply.content).toContain('auth routes')
    expect(res.body.reply.codeBlocks).toHaveLength(1)
  })

  it('passes correct params to callAgent (server-side history)', async () => {
    await request(app)
      .post('/api/chat')
      .send({
        sessionId,
        buildingId: 'docker',
        message: 'Add Dockerfile',
      })

    // Server owns history — starts empty, no client-provided history
    expect(callAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        buildingId: 'docker',
        repoPath: '/tmp/repo',
        message: 'Add Dockerfile',
        history: [],
      })
    )
  })

  it('persists conversation history in session', async () => {
    await request(app)
      .post('/api/chat')
      .send({ sessionId, buildingId: 'tests', message: 'First message' })

    const session = getSession(sessionId)!
    const history = session.conversations['tests']
    expect(history).toHaveLength(2) // user + assistant
    expect(history![0].role).toBe('user')
    expect(history![0].content).toBe('First message')
    expect(history![1].role).toBe('assistant')
  })

  it('uses server-side history on subsequent calls', async () => {
    // First call
    await request(app)
      .post('/api/chat')
      .send({ sessionId, buildingId: 'tests', message: 'First' })

    // Second call
    await request(app)
      .post('/api/chat')
      .send({ sessionId, buildingId: 'tests', message: 'Second' })

    // Second call should have received history from first call
    const secondCallArgs = vi.mocked(callAgent).mock.calls[1][0]
    expect(secondCallArgs.history).toHaveLength(2) // user + assistant from first call
    expect(secondCallArgs.history[0].content).toBe('First')
  })

  it('returns 500 when agent throws', async () => {
    vi.mocked(callAgent).mockRejectedValueOnce(new Error('API down'))

    const res = await request(app)
      .post('/api/chat')
      .send({ sessionId, buildingId: 'tests', message: 'Help' })

    expect(res.status).toBe(500)
    expect(res.body.error).toContain('Agent call failed')
  })
})
