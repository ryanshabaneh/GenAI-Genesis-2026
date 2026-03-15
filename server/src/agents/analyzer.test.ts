import { describe, it, expect, vi, beforeEach } from 'vitest'

const { createMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
}))

vi.mock('./client', () => ({
  client: { messages: { create: createMock } },
}))

vi.mock('./context', () => ({
  buildSlimContext: vi.fn().mockResolvedValue('mock slim context'),
}))

import { analyzeAllBuildings, mergeTasks } from './analyzer'
import type { AnalyzerResult, BuildingId, Task } from '../types'

const baseScanResults: AnalyzerResult[] = [
  { buildingId: 'tests', percent: 25, tasks: [
    { id: 'tests-dep', label: 'Test framework installed', done: true },
    { id: 'tests-files', label: 'Test files present', done: false },
  ], details: {} },
  { buildingId: 'cicd', percent: 0, tasks: [
    { id: 'cicd-dir', label: 'CI config found', done: false },
  ], details: {} },
  { buildingId: 'docker', percent: 0, tasks: [], details: {} },
  { buildingId: 'documentation', percent: 75, tasks: [], details: {} },
  { buildingId: 'envVars', percent: 0, tasks: [], details: {} },
  { buildingId: 'security', percent: 50, tasks: [], details: {} },
  { buildingId: 'logging', percent: 0, tasks: [], details: {} },
  { buildingId: 'deployment', percent: 25, tasks: [], details: {} },
]

describe('analyzeAllBuildings', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns tasks per building from single LLM call', async () => {
    createMock.mockResolvedValue({
      content: [{
        type: 'text',
        text: JSON.stringify({
          tests: [{ id: 'tests-extra', label: 'Add route tests', done: false }],
          cicd: [],
          docker: [],
          documentation: [{ id: 'doc-license', label: 'Add LICENSE', done: false }],
          envVars: [],
          security: [],
          logging: [],
          deployment: [],
        }),
      }],
    })

    const result = await analyzeAllBuildings({ repoPath: '/tmp/repo', scanResults: baseScanResults })

    expect(createMock).toHaveBeenCalledTimes(1) // ONE call, not 8+1
    expect(result.get('tests')).toHaveLength(1)
    expect(result.get('tests')![0].label).toBe('Add route tests')
    expect(result.get('documentation')).toHaveLength(1)
    expect(result.get('cicd')).toHaveLength(0)
    expect(result.get('docker')).toHaveLength(0)
  })

  it('handles markdown-wrapped JSON', async () => {
    createMock.mockResolvedValue({
      content: [{
        type: 'text',
        text: '```json\n{"tests":[],"cicd":[],"docker":[],"documentation":[],"envVars":[],"security":[],"logging":[],"deployment":[]}\n```',
      }],
    })

    const result = await analyzeAllBuildings({ repoPath: '/tmp/repo', scanResults: baseScanResults })

    expect(result.size).toBe(8)
    for (const tasks of result.values()) {
      expect(tasks).toHaveLength(0)
    }
  })

  it('returns empty tasks on API error', async () => {
    createMock.mockRejectedValue(new Error('API timeout'))

    const result = await analyzeAllBuildings({ repoPath: '/tmp/repo', scanResults: baseScanResults })

    expect(result.size).toBe(8)
    for (const tasks of result.values()) {
      expect(tasks).toHaveLength(0)
    }
  })

  it('returns empty tasks on invalid JSON', async () => {
    createMock.mockResolvedValue({
      content: [{ type: 'text', text: 'not json at all' }],
    })

    const result = await analyzeAllBuildings({ repoPath: '/tmp/repo', scanResults: baseScanResults })

    expect(result.size).toBe(8)
  })

  it('filters out malformed tasks', async () => {
    createMock.mockResolvedValue({
      content: [{
        type: 'text',
        text: JSON.stringify({
          tests: [
            { id: 'good', label: 'Valid task', done: false },
            { id: 123, label: 'Bad id type', done: false },
            { label: 'Missing id', done: false },
          ],
          cicd: [], docker: [], documentation: [], envVars: [],
          security: [], logging: [], deployment: [],
        }),
      }],
    })

    const result = await analyzeAllBuildings({ repoPath: '/tmp/repo', scanResults: baseScanResults })

    expect(result.get('tests')).toHaveLength(1)
    expect(result.get('tests')![0].id).toBe('good')
  })

  it('handles missing buildings in response', async () => {
    // LLM only returns tests, not the others
    createMock.mockResolvedValue({
      content: [{
        type: 'text',
        text: JSON.stringify({
          tests: [{ id: 't1', label: 'Test', done: false }],
        }),
      }],
    })

    const result = await analyzeAllBuildings({ repoPath: '/tmp/repo', scanResults: baseScanResults })

    expect(result.get('tests')).toHaveLength(1)
    expect(result.get('cicd')).toHaveLength(0) // missing = empty
    expect(result.get('docker')).toHaveLength(0)
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
    expect(merged[0].done).toBe(true) // scanner version wins
  })

  it('handles empty agent tasks', () => {
    const merged = mergeTasks(scannerTasks, [])
    expect(merged).toHaveLength(2)
  })
})
