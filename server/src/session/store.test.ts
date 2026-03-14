import { describe, it, expect, beforeEach } from 'vitest'
import { createSession, getSession, updateSession, deleteSession } from './store'

describe('session store', () => {
  // Each test gets fresh sessions since the store is module-scoped.
  // We track IDs to avoid cross-test pollution.
  let sessionId: string

  beforeEach(() => {
    const session = createSession({ repoUrl: 'https://github.com/test/repo', repoPath: '' })
    sessionId = session.id
  })

  describe('createSession', () => {
    it('returns a session with a generated UUID', () => {
      const session = createSession({ repoUrl: 'https://github.com/foo/bar', repoPath: '' })
      expect(session.id).toBeDefined()
      expect(session.id).toMatch(/^[0-9a-f-]{36}$/)
    })

    it('initializes with empty results and changes', () => {
      const session = createSession({ repoUrl: 'https://github.com/foo/bar', repoPath: '' })
      expect(session.results).toEqual({})
      expect(session.changes).toEqual([])
    })

    it('sets createdAt timestamp', () => {
      const before = Date.now()
      const session = createSession({ repoUrl: 'https://github.com/foo/bar', repoPath: '' })
      expect(session.createdAt).toBeGreaterThanOrEqual(before)
      expect(session.createdAt).toBeLessThanOrEqual(Date.now())
    })

    it('preserves the repoUrl', () => {
      const session = createSession({ repoUrl: 'https://github.com/foo/bar', repoPath: '/tmp/bar' })
      expect(session.repoUrl).toBe('https://github.com/foo/bar')
      expect(session.repoPath).toBe('/tmp/bar')
    })
  })

  describe('getSession', () => {
    it('retrieves an existing session by id', () => {
      const session = getSession(sessionId)
      expect(session).toBeDefined()
      expect(session!.id).toBe(sessionId)
    })

    it('returns undefined for non-existent id', () => {
      const session = getSession('non-existent-id')
      expect(session).toBeUndefined()
    })
  })

  describe('updateSession', () => {
    it('updates repoPath on existing session', () => {
      updateSession(sessionId, { repoPath: '/tmp/cloned-repo' })
      const session = getSession(sessionId)
      expect(session!.repoPath).toBe('/tmp/cloned-repo')
    })

    it('preserves other fields when updating', () => {
      updateSession(sessionId, { repoPath: '/tmp/new-path' })
      const session = getSession(sessionId)
      expect(session!.repoUrl).toBe('https://github.com/test/repo')
      expect(session!.results).toEqual({})
    })

    it('does nothing for non-existent session', () => {
      // Should not throw
      updateSession('fake-id', { repoPath: '/tmp/nope' })
      expect(getSession('fake-id')).toBeUndefined()
    })
  })

  describe('deleteSession', () => {
    it('removes a session', () => {
      deleteSession(sessionId)
      expect(getSession(sessionId)).toBeUndefined()
    })

    it('does nothing for non-existent session', () => {
      // Should not throw
      deleteSession('fake-id')
    })
  })
})
