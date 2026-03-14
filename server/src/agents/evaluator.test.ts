import { describe, it, expect, vi, beforeEach } from 'vitest'

const { createMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
}))

vi.mock('./client', () => ({
  client: { messages: { create: createMock } },
}))

import { callEvaluator } from './evaluator'

const baseParms = {
  buildingId: 'tests',
  repoPath: '/tmp/repo',
  tasks: [
    { id: '1', label: 'Add unit tests', done: false },
    { id: '2', label: 'Add coverage config', done: true },
  ],
  builderResponse: 'Here is the test file.',
  codeBlocks: [{ path: 'tests/index.test.ts', content: 'test("x", () => {})', language: 'typescript' }],
}

describe('callEvaluator', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns pass:true when evaluator approves', async () => {
    createMock.mockResolvedValue({
      content: [{ type: 'text', text: '{ "pass": true, "feedback": "" }' }],
    })

    const result = await callEvaluator(baseParms)
    expect(result.pass).toBe(true)
    expect(result.feedback).toBe('')
  })

  it('returns pass:false with feedback when evaluator rejects', async () => {
    createMock.mockResolvedValue({
      content: [{ type: 'text', text: '{ "pass": false, "feedback": "Missing coverage config" }' }],
    })

    const result = await callEvaluator(baseParms)
    expect(result.pass).toBe(false)
    expect(result.feedback).toBe('Missing coverage config')
  })

  it('uses claude-sonnet-4-6 with max_tokens 1024', async () => {
    createMock.mockResolvedValue({
      content: [{ type: 'text', text: '{ "pass": true, "feedback": "" }' }],
    })

    await callEvaluator(baseParms)

    const callArgs = createMock.mock.calls[0][0]
    expect(callArgs.model).toBe('claude-sonnet-4-6')
    expect(callArgs.max_tokens).toBe(1024)
  })

  it('treats JSON parse failure as pass:false', async () => {
    createMock.mockResolvedValue({
      content: [{ type: 'text', text: 'Not valid JSON at all' }],
    })

    const result = await callEvaluator(baseParms)
    expect(result.pass).toBe(false)
    expect(result.feedback).toContain('failed')
  })

  it('treats API error as pass:false', async () => {
    createMock.mockRejectedValue(new Error('API timeout'))

    const result = await callEvaluator(baseParms)
    expect(result.pass).toBe(false)
  })

  it('only includes incomplete tasks in the prompt', async () => {
    createMock.mockResolvedValue({
      content: [{ type: 'text', text: '{ "pass": true, "feedback": "" }' }],
    })

    await callEvaluator(baseParms)

    const callArgs = createMock.mock.calls[0][0]
    const userMsg = callArgs.messages[0].content
    expect(userMsg).toContain('Add unit tests')
    expect(userMsg).not.toContain('Add coverage config')
  })
})
