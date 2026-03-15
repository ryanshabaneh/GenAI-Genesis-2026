#!/usr/bin/env node
// mock-anthropic.js — local Anthropic API stub for demo/testing
// Mimics POST /v1/messages with a canned SSE streaming response.
// Set ANTHROPIC_BASE_URL=http://localhost:3333 to redirect SDK calls here.
// Zero real tokens consumed.

const http = require('http')

const PORT = process.env.MOCK_PORT ?? 3333

// Canned response text — edit per demo need
const MOCK_TEXT = process.env.MOCK_RESPONSE ??
  "This is a demo response from the local mock API. No tokens were consumed."

function sendSSE(res, text) {
  res.writeHead(200, {
    'Content-Type':  'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection':    'keep-alive',
  })

  const messageId = `msg_mock_${Date.now()}`

  const events = [
    { type: 'message_start',   message: { id: messageId, type: 'message', role: 'assistant', content: [], model: 'claude-sonnet-4-6', usage: { input_tokens: 0, output_tokens: 0 } } },
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    // stream text in ~20-char chunks so it looks real
    ...chunkText(text, 20).map((chunk, i) => ({
      type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: chunk }
    })),
    { type: 'content_block_stop', index: 0 },
    { type: 'message_delta',  delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: text.length } },
    { type: 'message_stop' },
  ]

  for (const event of events) {
    res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
  }
  res.end()
}

function chunkText(text, size) {
  const chunks = []
  for (let i = 0; i < text.length; i += size) chunks.push(text.slice(i, i + size))
  return chunks
}

const server = http.createServer((req, res) => {
  // health check
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ status: 'mock', port: PORT }))
  }

  // main messages endpoint
  if (req.method === 'POST' && req.url === '/v1/messages') {
    let body = ''
    req.on('data', d => body += d)
    req.on('end', () => {
      const payload = JSON.parse(body || '{}')
      const isStream = payload.stream === true
      console.log(`[mock] POST /v1/messages — model: ${payload.model ?? 'n/a'}, stream: ${isStream}`)

      if (isStream) {
        sendSSE(res, MOCK_TEXT)
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          id: `msg_mock_${Date.now()}`,
          type: 'message',
          role: 'assistant',
          content: [{ type: 'text', text: MOCK_TEXT }],
          model: payload.model ?? 'claude-sonnet-4-6',
          stop_reason: 'end_turn',
          usage: { input_tokens: 0, output_tokens: MOCK_TEXT.length },
        }))
      }
    })
    return
  }

  // catch-all
  res.writeHead(404)
  res.end(JSON.stringify({ error: `mock does not handle ${req.method} ${req.url}` }))
})

server.listen(PORT, () => {
  console.log(`[mock-anthropic] Listening on http://localhost:${PORT}`)
  console.log(`[mock-anthropic] Set ANTHROPIC_BASE_URL=http://localhost:${PORT}`)
})
