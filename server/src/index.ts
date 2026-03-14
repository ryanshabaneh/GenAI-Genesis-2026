// server/src/index.ts
// Express + Socket.IO entry point for the ShipCity backend.
// Responsibilities: CORS, JSON parsing, route mounting, Socket.IO session rooms,
// global error handling, and process-level exception guards.
// io is attached to app.locals so route handlers can emit events without
// importing Socket.IO directly (avoids a circular dependency).

import 'dotenv/config'
import http from 'http'
import express from 'express'
import cors from 'cors'
import { Server as SocketIOServer } from 'socket.io'
import scanRouter from './routes/scan'
import chatRouter from './routes/chat'
import acceptRouter from './routes/accept'
import exportRouter from './routes/export'

const PORT = process.env['PORT'] ? parseInt(process.env['PORT'], 10) : 3001
const FRONTEND_URL = process.env['FRONTEND_URL'] ?? 'http://localhost:3000'

const app = express()

// Middleware
// CORS is locked to FRONTEND_URL — don't open this up in production
app.use(cors({ origin: FRONTEND_URL, credentials: true }))
app.use(express.json())

// Create HTTP server and attach Socket.IO
// We wrap Express in an http.Server so Socket.IO and Express share the same port
const httpServer = http.createServer(app)

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: FRONTEND_URL,
    methods: ['GET', 'POST'],
    credentials: true,
  },
})

// Make io available to route handlers via app.locals
// This avoids passing io as middleware or importing it directly in routes
app.locals['io'] = io

// Mount API routes
app.use('/api/scan', scanRouter)
app.use('/api/chat', chatRouter)
app.use('/api/accept', acceptRouter)
app.use('/api/export', exportRouter)

// Health check — used by hosting platforms (Railway, Fly.io) to verify the process is alive
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: Date.now() })
})

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`[socket] connected: ${socket.id}`)

  // Client calls joinSession with their sessionId to receive scan events
  // Each scan gets its own room so events aren't broadcast to all connected clients
  socket.on('joinSession', (sessionId: string) => {
    void socket.join(sessionId)
    console.log(`[socket] ${socket.id} joined session: ${sessionId}`)
  })

  socket.on('disconnect', () => {
    console.log(`[socket] disconnected: ${socket.id}`)
  })
})

// Global Express error handler — catches errors passed to next(err) from route handlers
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[error]', err.message)
  res.status(500).json({ error: err.message ?? 'Internal server error' })
})

// Process-level safety nets — prevent a single unhandled promise or thrown error
// from crashing the whole server during a hackathon demo
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err)
})

process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason)
})

httpServer.listen(PORT, () => {
  console.log(`[server] ShipCity server running on http://localhost:${PORT}`)
  console.log(`[server] Accepting requests from ${FRONTEND_URL}`)
})
