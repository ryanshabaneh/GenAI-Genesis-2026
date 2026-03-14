import { getSession, updateSession } from '../session/store'
import type { AcceptedChange } from '../types'

export function addChange(sessionId: string, change: AcceptedChange): void {
  const session = getSession(sessionId)
  if (!session) {
    throw new Error(`Session ${sessionId} not found`)
  }
  updateSession(sessionId, {
    changes: [...session.changes, change],
  })
}

export function getChanges(sessionId: string): AcceptedChange[] {
  const session = getSession(sessionId)
  return session?.changes ?? []
}
