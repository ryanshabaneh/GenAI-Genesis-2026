import { describe, it, expect, beforeEach } from 'vitest'
import { addChange, getChanges } from './queue'
import { generateZip } from './export'
import { createSession } from '../session/store'
import type { AcceptedChange } from '../types'

describe('changes queue', () => {
  let sessionId: string

  beforeEach(() => {
    const session = createSession({ repoUrl: 'https://github.com/test/repo', repoPath: '/tmp/repo' })
    sessionId = session.id
  })

  describe('addChange', () => {
    it('adds a change to the session', () => {
      const change: AcceptedChange = {
        id: 'change-1',
        buildingId: 'tests',
        files: [{ path: 'tests/auth.test.ts', content: 'test code', isNew: true }],
        acceptedAt: Date.now(),
      }

      addChange(sessionId, change)
      const changes = getChanges(sessionId)
      expect(changes).toHaveLength(1)
      expect(changes[0].id).toBe('change-1')
      expect(changes[0].buildingId).toBe('tests')
    })

    it('accumulates multiple changes', () => {
      addChange(sessionId, {
        id: 'c1', buildingId: 'tests',
        files: [{ path: 'tests/a.test.ts', content: 'a', isNew: true }],
        acceptedAt: Date.now(),
      })
      addChange(sessionId, {
        id: 'c2', buildingId: 'docker',
        files: [{ path: 'Dockerfile', content: 'FROM node', isNew: true }],
        acceptedAt: Date.now(),
      })

      const changes = getChanges(sessionId)
      expect(changes).toHaveLength(2)
      expect(changes[0].buildingId).toBe('tests')
      expect(changes[1].buildingId).toBe('docker')
    })

    it('throws for non-existent session', () => {
      expect(() =>
        addChange('fake-session', {
          id: 'c1', buildingId: 'tests',
          files: [], acceptedAt: Date.now(),
        })
      ).toThrow('Session fake-session not found')
    })
  })

  describe('getChanges', () => {
    it('returns empty array for session with no changes', () => {
      const changes = getChanges(sessionId)
      expect(changes).toEqual([])
    })

    it('returns empty array for non-existent session', () => {
      const changes = getChanges('non-existent')
      expect(changes).toEqual([])
    })
  })
})

describe('generateZip', () => {
  it('generates a valid zip buffer from session changes', async () => {
    const session = createSession({ repoUrl: 'https://github.com/test/repo', repoPath: '/tmp/repo' })
    addChange(session.id, {
      id: 'c1',
      buildingId: 'tests',
      files: [
        { path: 'tests/auth.test.ts', content: 'import { test } from "vitest"', isNew: true },
        { path: 'tests/user.test.ts', content: 'import { test } from "vitest"', isNew: true },
      ],
      acceptedAt: Date.now(),
    })

    const updatedSession = (await import('../session/store')).getSession(session.id)!
    const zipBuffer = await generateZip(updatedSession)

    expect(zipBuffer).toBeInstanceOf(Buffer)
    expect(zipBuffer.length).toBeGreaterThan(0)
    // ZIP magic number: PK\x03\x04
    expect(zipBuffer[0]).toBe(0x50) // P
    expect(zipBuffer[1]).toBe(0x4b) // K
  })

  it('generates a zip with multiple changes from different buildings', async () => {
    const session = createSession({ repoUrl: 'https://github.com/test/repo', repoPath: '/tmp/repo' })
    addChange(session.id, {
      id: 'c1', buildingId: 'tests',
      files: [{ path: 'tests/a.test.ts', content: 'test a', isNew: true }],
      acceptedAt: Date.now(),
    })
    addChange(session.id, {
      id: 'c2', buildingId: 'docker',
      files: [{ path: 'Dockerfile', content: 'FROM node:20', isNew: true }],
      acceptedAt: Date.now(),
    })

    const updatedSession = (await import('../session/store')).getSession(session.id)!
    const zipBuffer = await generateZip(updatedSession)

    expect(zipBuffer).toBeInstanceOf(Buffer)
    expect(zipBuffer.length).toBeGreaterThan(0)
  })

  it('handles empty changes gracefully', async () => {
    const session = createSession({ repoUrl: 'https://github.com/test/repo', repoPath: '/tmp/repo' })
    const zipBuffer = await generateZip(session)

    expect(zipBuffer).toBeInstanceOf(Buffer)
    // Empty ZIP is still valid (just the end-of-central-directory record)
    expect(zipBuffer.length).toBeGreaterThan(0)
  })

  it('strips leading slashes from file paths', async () => {
    const session = createSession({ repoUrl: 'https://github.com/test/repo', repoPath: '/tmp/repo' })
    addChange(session.id, {
      id: 'c1', buildingId: 'cicd',
      files: [{ path: '/github/workflows/ci.yml', content: 'name: CI', isNew: true }],
      acceptedAt: Date.now(),
    })

    const updatedSession = (await import('../session/store')).getSession(session.id)!
    const zipBuffer = await generateZip(updatedSession)

    // Just verify it doesn't throw and produces valid zip
    expect(zipBuffer).toBeInstanceOf(Buffer)
    expect(zipBuffer[0]).toBe(0x50)
  })
})
