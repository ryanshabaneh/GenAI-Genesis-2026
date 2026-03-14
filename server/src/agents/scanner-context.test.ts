import { describe, it, expect } from 'vitest'
import { buildScannerPreprompt, calculatePercent } from './scanner-context'
import type { AnalyzerResult } from '../types'

describe('calculatePercent', () => {
  it('returns 0 for empty tasks', () => {
    expect(calculatePercent([])).toBe(0)
  })

  it('returns 0 when no tasks are done', () => {
    expect(calculatePercent([{ done: false }, { done: false }])).toBe(0)
  })

  it('returns 100 when all tasks are done', () => {
    expect(calculatePercent([{ done: true }, { done: true }])).toBe(100)
  })

  it('returns 50 for 1 of 2 done', () => {
    expect(calculatePercent([{ done: true }, { done: false }])).toBe(50)
  })

  it('returns 25 for 1 of 4 done', () => {
    const tasks = [{ done: true }, { done: false }, { done: false }, { done: false }]
    expect(calculatePercent(tasks)).toBe(25)
  })

  it('returns 75 for 3 of 4 done', () => {
    const tasks = [{ done: true }, { done: true }, { done: true }, { done: false }]
    expect(calculatePercent(tasks)).toBe(75)
  })

  it('rounds correctly for odd ratios', () => {
    // 1 of 3 = 33.33...%
    expect(calculatePercent([{ done: true }, { done: false }, { done: false }])).toBe(33)
    // 2 of 3 = 66.66...%
    expect(calculatePercent([{ done: true }, { done: true }, { done: false }])).toBe(67)
  })
})

describe('buildScannerPreprompt', () => {
  it('returns empty string for undefined result', () => {
    expect(buildScannerPreprompt(undefined)).toBe('')
  })

  it('includes building ID and percent', () => {
    const result: AnalyzerResult = {
      buildingId: 'tests',
      percent: 25,
      tasks: [
        { id: 't1', label: 'Install test framework', done: true },
        { id: 't2', label: 'Add test files', done: false },
        { id: 't3', label: 'Add test script', done: false },
        { id: 't4', label: 'Reach coverage target', done: false },
      ],
      details: { hasDep: true, testFileCount: 0, hasTestScript: false },
    }

    const preprompt = buildScannerPreprompt(result)

    expect(preprompt).toContain('"tests"')
    expect(preprompt).toContain('25%')
    expect(preprompt).toContain('1/4 tasks complete')
  })

  it('marks done tasks with [x] and incomplete with [ ]', () => {
    const result: AnalyzerResult = {
      buildingId: 'cicd',
      percent: 50,
      tasks: [
        { id: 'c1', label: 'CI config exists', done: true },
        { id: 'c2', label: 'Pipeline file exists', done: true },
        { id: 'c3', label: 'Has test step', done: false },
        { id: 'c4', label: 'Has trigger', done: false },
      ],
      details: {},
    }

    const preprompt = buildScannerPreprompt(result)

    expect(preprompt).toContain('[x] CI config exists')
    expect(preprompt).toContain('[x] Pipeline file exists')
    expect(preprompt).toContain('[ ] Has test step')
    expect(preprompt).toContain('[ ] Has trigger')
  })

  it('includes task IDs', () => {
    const result: AnalyzerResult = {
      buildingId: 'docker',
      percent: 0,
      tasks: [{ id: 'docker-file', label: 'Dockerfile exists', done: false }],
      details: {},
    }

    const preprompt = buildScannerPreprompt(result)
    expect(preprompt).toContain('(id: docker-file)')
  })

  it('includes scanner details', () => {
    const result: AnalyzerResult = {
      buildingId: 'tests',
      percent: 25,
      tasks: [{ id: 't1', label: 'Test dep', done: true }],
      details: { hasDep: true, testFileCount: 3, hasTestScript: false },
    }

    const preprompt = buildScannerPreprompt(result)

    expect(preprompt).toContain('hasDep: true')
    expect(preprompt).toContain('testFileCount: 3')
    expect(preprompt).toContain('hasTestScript: false')
  })
})
