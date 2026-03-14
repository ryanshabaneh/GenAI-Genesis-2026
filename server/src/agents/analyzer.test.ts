import { describe, it, expect, vi, beforeEach } from 'vitest'

const { createMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
}))

vi.mock('./client', () => ({
  client: { messages: { create: createMock } },
}))

vi.mock('./context', () => ({
  buildAgentContext: vi.fn().mockResolvedValue('mock context'),
}))

import { analyzeForTasks, mergeTasks, deduplicateAcrossBuildings } from './analyzer'
import type { AnalyzerResult, BuildingId, Task } from '../types'

const baseScanResult: AnalyzerResult = {
  buildingId: 'tests',
  percent: 25,
  tasks: [
    { id: 'tests-dep', label: 'Test framework installed', done: true },
    { id: 'tests-files', label: 'Test files present', done: false },
    { id: 'tests-script', label: 'Test runner configured', done: false },
    { id: 'tests-coverage', label: 'More than 3 test files', done: false },
  ],
  details: { hasDep: true, testFileCount: 0 },
}

describe('analyzeForTasks', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns additional tasks from agent response', async () => {
    createMock.mockResolvedValue({
      content: [{
        type: 'text',
        text: JSON.stringify([
          { id: 'tests-no-delete-coverage', label: 'Add tests for DELETE route', done: false },
          { id: 'tests-no-error-cases', label: 'Add error case tests', done: false },
        ]),
      }],
    })

    const tasks = await analyzeForTasks({
      buildingId: 'tests',
      repoPath: '/tmp/repo',
      scanResult: baseScanResult,
    })

    expect(tasks).toHaveLength(2)
    expect(tasks[0].id).toBe('tests-no-delete-coverage')
    expect(tasks[1].label).toBe('Add error case tests')
    expect(tasks[0].done).toBe(false)
  })

  it('handles markdown-wrapped JSON', async () => {
    createMock.mockResolvedValue({
      content: [{
        type: 'text',
        text: '```json\n[{"id":"x","label":"task","done":false}]\n```',
      }],
    })

    const tasks = await analyzeForTasks({
      buildingId: 'tests',
      repoPath: '/tmp/repo',
      scanResult: baseScanResult,
    })

    expect(tasks).toHaveLength(1)
    expect(tasks[0].id).toBe('x')
  })

  it('returns empty array on invalid JSON', async () => {
    createMock.mockResolvedValue({
      content: [{ type: 'text', text: 'not json at all' }],
    })

    const tasks = await analyzeForTasks({
      buildingId: 'tests',
      repoPath: '/tmp/repo',
      scanResult: baseScanResult,
    })

    expect(tasks).toEqual([])
  })

  it('returns empty array on API error', async () => {
    createMock.mockRejectedValue(new Error('API timeout'))

    const tasks = await analyzeForTasks({
      buildingId: 'tests',
      repoPath: '/tmp/repo',
      scanResult: baseScanResult,
    })

    expect(tasks).toEqual([])
  })

  it('filters out malformed tasks', async () => {
    createMock.mockResolvedValue({
      content: [{
        type: 'text',
        text: JSON.stringify([
          { id: 'good', label: 'Valid task', done: false },
          { id: 123, label: 'Bad id type', done: false },
          { label: 'Missing id', done: false },
          { id: 'no-label', done: false },
        ]),
      }],
    })

    const tasks = await analyzeForTasks({
      buildingId: 'tests',
      repoPath: '/tmp/repo',
      scanResult: baseScanResult,
    })

    expect(tasks).toHaveLength(1)
    expect(tasks[0].id).toBe('good')
  })
})

describe('mergeTasks', () => {
  const scannerTasks: Task[] = [
    { id: 'tests-dep', label: 'Test framework installed', done: true },
    { id: 'tests-files', label: 'Test files present', done: false },
  ]

  it('appends agent tasks after scanner tasks', () => {
    const agentTasks: Task[] = [
      { id: 'tests-route-coverage', label: 'Test all routes', done: false },
    ]

    const merged = mergeTasks(scannerTasks, agentTasks)

    expect(merged).toHaveLength(3)
    expect(merged[0].id).toBe('tests-dep')
    expect(merged[2].id).toBe('tests-route-coverage')
  })

  it('deduplicates by ID', () => {
    const agentTasks: Task[] = [
      { id: 'tests-dep', label: 'Duplicate', done: false },
      { id: 'tests-new', label: 'New task', done: false },
    ]

    const merged = mergeTasks(scannerTasks, agentTasks)

    expect(merged).toHaveLength(3)
    // Scanner version of tests-dep wins
    expect(merged[0].done).toBe(true)
  })

  it('handles empty agent tasks', () => {
    const merged = mergeTasks(scannerTasks, [])
    expect(merged).toHaveLength(2)
  })
})

describe('deduplicateAcrossBuildings', () => {
  it('moves secret-related tasks to security building only', () => {
    const input = new Map<BuildingId, Task[]>([
      ['security', [{ id: 'sec-key', label: 'Remove hardcoded secret from code', done: false }]],
      ['tests', [{ id: 'tests-key', label: 'Remove hardcoded secret key in index.ts', done: false }]],
      ['docker', [{ id: 'docker-key', label: 'Hardcoded API key found', done: false }]],
    ])

    const result = deduplicateAcrossBuildings(input)

    expect(result.get('security')).toHaveLength(1) // keeps it
    expect(result.get('tests')).toHaveLength(0) // removed — secret belongs to security
    expect(result.get('docker')).toHaveLength(0) // removed
  })

  it('moves validation tasks to security building only', () => {
    const input = new Map<BuildingId, Task[]>([
      ['security', [{ id: 'sec-val', label: 'Add input validation on POST route', done: false }]],
      ['cicd', [{ id: 'cicd-val', label: 'No input validation on endpoints', done: false }]],
    ])

    const result = deduplicateAcrossBuildings(input)

    expect(result.get('security')).toHaveLength(1)
    expect(result.get('cicd')).toHaveLength(0)
  })

  it('keeps domain-specific tasks untouched', () => {
    const input = new Map<BuildingId, Task[]>([
      ['tests', [
        { id: 'tests-coverage', label: 'Add tests for GET route', done: false },
        { id: 'tests-mock', label: 'Add mock for external API calls in tests', done: false },
      ]],
      ['cicd', [
        { id: 'cicd-cache', label: 'Add npm caching to CI workflow', done: false },
      ]],
    ])

    const result = deduplicateAcrossBuildings(input)

    expect(result.get('tests')).toHaveLength(2)
    expect(result.get('cicd')).toHaveLength(1)
  })

  it('moves error handling tasks to logging', () => {
    const input = new Map<BuildingId, Task[]>([
      ['logging', [{ id: 'log-err', label: 'Add error handling middleware', done: false }]],
      ['docker', [{ id: 'docker-err', label: 'No error middleware found', done: false }]],
    ])

    const result = deduplicateAcrossBuildings(input)

    expect(result.get('logging')).toHaveLength(1)
    expect(result.get('docker')).toHaveLength(0)
  })

  it('handles empty maps', () => {
    const result = deduplicateAcrossBuildings(new Map())
    expect(result.size).toBe(0)
  })
})
