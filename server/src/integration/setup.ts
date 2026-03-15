// server/src/integration/setup.ts
// Shared test infrastructure for comprehensive backend integration tests.
// Creates a real Express app with Socket.IO, mocks only the LLM client boundary.

import http from 'http'
import express from 'express'
import cors from 'cors'
import session from 'express-session'
import { Server as SocketIOServer } from 'socket.io'
import { vi } from 'vitest'
import type Anthropic from '@anthropic-ai/sdk'

// ── Mock LLM responses ─────────────────────────────────────────────
// We mock at the client boundary so every agent, evaluator, and analyzer
// uses deterministic responses. This tests ALL wiring, just not the LLM itself.

export const mockCreate = vi.fn()

vi.mock('../agents/client', () => ({
  client: {
    messages: { create: (...args: unknown[]) => mockCreate(...args) },
  },
}))

/** Helper: return a fake Anthropic SDK response with the given text */
export function llmResponse(text: string) {
  return {
    id: 'mock-' + Date.now(),
    type: 'message',
    role: 'assistant',
    model: 'claude-sonnet-4-6',
    content: [{ type: 'text', text }],
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 0, output_tokens: 0 },
  }
}

/** Set a default LLM mock that returns a generic text response */
export function setDefaultLlmMock() {
  mockCreate.mockResolvedValue(llmResponse('Mock LLM response'))
}

/** Make LLM return a valid analyzer task array */
export function mockAnalyzerResponse(buildingId: string, tasks: Array<{ id: string; label: string; done: boolean }>) {
  return llmResponse(JSON.stringify(tasks))
}

/** Make LLM return a valid evaluator result */
export function mockEvaluatorPass(summary = 'Looks good') {
  return llmResponse(JSON.stringify({ pass: true, feedback: '', summary }))
}

export function mockEvaluatorFail(feedback = 'Missing implementation') {
  return llmResponse(JSON.stringify({ pass: false, feedback, summary: '' }))
}

/** Make LLM return valid dedup output */
export function mockDedupResponse(tasks: Record<string, Array<{ id: string; label: string; done: boolean }>>) {
  return llmResponse(JSON.stringify(tasks))
}

// ── App factory ─────────────────────────────────────────────────────

export interface TestApp {
  app: express.Express
  server: http.Server
  io: SocketIOServer
  port: number
  baseUrl: string
  close: () => Promise<void>
  /** Collected Socket.IO events emitted to any room */
  emittedEvents: Array<{ room: string; event: string; data: unknown }>
}

export async function createTestApp(): Promise<TestApp> {
  const app = express()
  app.use(cors())
  app.use(express.json())
  app.use(
    session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false,
    })
  )

  const server = http.createServer(app)
  const io = new SocketIOServer(server, { cors: { origin: '*' } })
  app.locals['io'] = io

  // Spy on Socket.IO emissions
  const emittedEvents: TestApp['emittedEvents'] = []
  const originalTo = io.to.bind(io)
  io.to = ((room: string) => {
    const namespace = originalTo(room)
    const originalEmit = namespace.emit.bind(namespace)
    namespace.emit = ((event: string, ...args: unknown[]) => {
      emittedEvents.push({ room, event, data: args[0] })
      return originalEmit(event, ...args)
    }) as typeof namespace.emit
    return namespace
  }) as typeof io.to

  // Mount routes (dynamic import to pick up mocks)
  const { default: scanRouter } = await import('../routes/scan')
  const { default: chatRouter } = await import('../routes/chat')
  const { default: acceptRouter } = await import('../routes/accept')
  const { default: exportRouter } = await import('../routes/export')
  const { default: implementRouter } = await import('../routes/implement')
  const { default: evaluateRouter } = await import('../routes/evaluate')
  const { default: rejectRouter } = await import('../routes/reject')

  app.use('/api/scan', scanRouter)
  app.use('/api/chat', chatRouter)
  app.use('/api/accept', acceptRouter)
  app.use('/api/export', exportRouter)
  app.use('/api/implement', implementRouter)
  app.use('/api/evaluate', evaluateRouter)
  app.use('/api/reject', rejectRouter)

  app.get('/health', (_req, res) => res.json({ status: 'ok' }))

  // Error handler
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: err.message })
  })

  return new Promise((resolve) => {
    server.listen(0, () => {
      const addr = server.address()
      const port = typeof addr === 'object' && addr ? addr.port : 0
      resolve({
        app,
        server,
        io,
        port,
        baseUrl: `http://localhost:${port}`,
        close: () => new Promise<void>((r) => { io.close(); server.close(() => r()) }),
        emittedEvents,
      })
    })
  })
}
