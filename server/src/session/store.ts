// server/src/session/store.ts
// In-memory session store. Each scan creates a Session keyed by UUID.
// Sessions accumulate analyzer results and accepted changes over their lifetime.
// Using a plain Map (not Redis, not a DB) is intentional for hackathon speed —
// data is lost on server restart, which is fine for a demo.
// If we need persistence, swap this Map for a Redis client behind these same functions.

import { v4 as uuidv4 } from 'uuid'
import type { Session } from '../types'

// Single in-process store — all routes access it through the functions below
const sessions = new Map<string, Session>()

// Creates a new session with a generated UUID and empty results/changes arrays.
// The caller provides repoUrl and repoPath (repoPath can be empty until cloneRepo resolves).
export function createSession(
  data: Omit<Session, 'id' | 'results' | 'changes' | 'conversations' | 'changeLog' | 'lastEvalHash' | 'pendingReview' | 'createdAt'>
): Session {
  const session: Session = {
    id: uuidv4(),
    ...data,
    results: {},
    changes: [],
    conversations: {},
    changeLog: [],
    lastEvalHash: {},
    pendingReview: null,
    createdAt: Date.now(),
  }
  sessions.set(session.id, session)
  return session
}

export function getSession(id: string): Session | undefined {
  return sessions.get(id)
}

// Merges a partial update into an existing session — used to set repoPath after
// clone completes, or to append analyzer results one at a time during a scan.
export function updateSession(id: string, update: Partial<Session>): void {
  const existing = sessions.get(id)
  if (existing) {
    sessions.set(id, { ...existing, ...update })
  }
}

// Called for cleanup if we ever want to evict old sessions (not yet wired up)
export function deleteSession(id: string): void {
  sessions.delete(id)
}
