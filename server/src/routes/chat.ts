// server/src/routes/chat.ts
// POST /api/chat — sends a user message to the specialist agent for a given building.
// Server owns conversation history (stored per-building in session).
// When history exceeds 50 messages, older messages are summarized via LLM.
// Change log context is injected so the agent knows about project-wide progress.

import { Router } from 'express'
import type { Request, Response } from 'express'
import type { BuildingId, Message } from '../types'
import { getSession, updateSession } from '../session/store'
import { callAgent } from '../agents/base'
import { buildChangeLogContext } from '../agents/scanner-context'
import { client } from '../agents/client'

const router = Router()

const HISTORY_MAX = 50
const HISTORY_KEEP = 20

/**
 * Summarize older messages into a compact context block via LLM.
 */
async function summarizeHistory(messages: Message[]): Promise<string> {
  const transcript = messages
    .map((m) => `${m.role}: ${m.content}`)
    .join('\n\n')

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: 'Summarize the following conversation into a compact context block. Preserve key decisions, code suggestions, and important details. Be concise but complete.',
    messages: [{ role: 'user', content: transcript }],
  })

  const text = response.content
    .filter((block) => block.type === 'text')
    .map((block) => ('text' in block ? block.text : ''))
    .join('')

  return text
}

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const { sessionId, buildingId, message } = req.body as {
    sessionId?: string
    buildingId?: BuildingId
    message?: string
  }

  if (!sessionId || !buildingId || !message) {
    res.status(400).json({ error: 'sessionId, buildingId, and message are required' })
    return
  }

  const session = getSession(sessionId)
  if (!session) {
    res.status(404).json({ error: 'Session not found' })
    return
  }

  // Server is source of truth for conversation history
  const history: Message[] = session.conversations[buildingId] ?? []

  // Build change log context for cross-building awareness
  const changeLogContext = buildChangeLogContext(session, buildingId)

  try {
    const reply = await callAgent({
      buildingId,
      repoPath: session.repoPath,
      message,
      history,
      scanResult: session.results[buildingId],
      changeLogContext: changeLogContext || undefined,
    })

    // Append user message + agent reply to history
    const updatedHistory: Message[] = [
      ...history,
      { role: 'user', content: message },
      { role: 'assistant', content: reply.content },
    ]

    // Summarize if history exceeds threshold
    let finalHistory = updatedHistory
    if (updatedHistory.length > HISTORY_MAX) {
      const olderMessages = updatedHistory.slice(0, updatedHistory.length - HISTORY_KEEP)
      const recentMessages = updatedHistory.slice(updatedHistory.length - HISTORY_KEEP)

      try {
        const summary = await summarizeHistory(olderMessages)
        finalHistory = [
          { role: 'assistant', content: `[Conversation summary]\n${summary}` },
          ...recentMessages,
        ]
      } catch {
        // If summarization fails, just keep recent messages
        finalHistory = recentMessages
      }
    }

    // Persist updated history
    updateSession(sessionId, {
      conversations: {
        ...session.conversations,
        [buildingId]: finalHistory,
      },
    })

    res.json({ reply })
  } catch (err) {
    console.error('Agent error:', err)
    res.status(500).json({ error: 'Agent call failed' })
  }
})

export default router
