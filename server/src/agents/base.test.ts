import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.hoisted runs before vi.mock hoisting, so createMock is available inside the factory
const { createMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
}))

vi.mock('@anthropic-ai/sdk', () => {
  class MockAnthropic {
    messages = { create: createMock }
  }
  return { default: MockAnthropic }
})

// Mock context builder — we don't want real file reads
vi.mock('./context', () => ({
  buildAgentContext: vi.fn().mockResolvedValue('### File: package.json\n```\n{"name":"test"}\n```'),
}))

// Mock prompts
vi.mock('./prompts', () => ({
  AGENT_PROMPTS: {
    tests: 'You are the School Builder.',
    cicd: 'You are the Factory Builder.',
    docker: 'You are the Shipping Dock Builder.',
    readme: 'You are the Town Hall Builder.',
    envVars: 'You are the Power Plant Builder.',
    security: 'You are the Vault Builder.',
    logging: 'You are the Watchtower Builder.',
    deployment: 'You are the Launch Pad Builder.',
    errorHandling: 'You are the Hospital Builder.',
    linting: 'You are the Police Station Builder.',
    license: 'You are the Courthouse Builder.',
    healthCheck: 'You are the Pharmacy Builder.',
    scripts: 'You are the Roads Builder.',
    hosting: 'You are the Server Room Builder.',
  },
}))

import { callAgent } from './base'

describe('callAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls Claude API with correct model and system prompt', async () => {
    createMock.mockResolvedValue({
      content: [{ type: 'text', text: 'Here is some advice.' }],
    })

    await callAgent({
      buildingId: 'tests',
      repoPath: '/tmp/repo',
      message: 'Add tests for my routes',
      history: [],
    })

    expect(createMock).toHaveBeenCalledOnce()
    const callArgs = createMock.mock.calls[0][0]
    expect(callArgs.model).toBe('claude-sonnet-4-6')
    expect(callArgs.max_tokens).toBe(4096)
    expect(callArgs.system).toContain('You are the School Builder.')
  })

  it('includes repo context in system prompt', async () => {
    createMock.mockResolvedValue({
      content: [{ type: 'text', text: 'Done.' }],
    })

    await callAgent({
      buildingId: 'tests',
      repoPath: '/tmp/repo',
      message: 'Help',
      history: [],
    })

    const callArgs = createMock.mock.calls[0][0]
    expect(callArgs.system).toContain('package.json')
    expect(callArgs.system).toContain('---')
  })

  it('passes chat history plus new message as messages', async () => {
    createMock.mockResolvedValue({
      content: [{ type: 'text', text: 'Sure.' }],
    })

    const history = [
      { role: 'user' as const, content: 'What testing framework should I use?' },
      { role: 'assistant' as const, content: 'I recommend vitest.' },
    ]

    await callAgent({
      buildingId: 'tests',
      repoPath: '/tmp/repo',
      message: 'OK, set it up',
      history,
    })

    const callArgs = createMock.mock.calls[0][0]
    expect(callArgs.messages).toHaveLength(3)
    expect(callArgs.messages[0]).toEqual({ role: 'user', content: 'What testing framework should I use?' })
    expect(callArgs.messages[1]).toEqual({ role: 'assistant', content: 'I recommend vitest.' })
    expect(callArgs.messages[2]).toEqual({ role: 'user', content: 'OK, set it up' })
  })

  it('returns assistant reply without code blocks when none present', async () => {
    createMock.mockResolvedValue({
      content: [{ type: 'text', text: 'You should add vitest to your project.' }],
    })

    const result = await callAgent({
      buildingId: 'tests',
      repoPath: '/tmp/repo',
      message: 'Help',
      history: [],
    })

    expect(result.role).toBe('assistant')
    expect(result.content).toBe('You should add vitest to your project.')
    expect((result as any).codeBlocks).toBeUndefined()
  })

  it('parses code blocks with file paths from response', async () => {
    const responseText = `Here's a test file:

// File: tests/auth.test.ts
\`\`\`typescript
import { describe, it, expect } from 'vitest'

describe('auth', () => {
  it('should work', () => {
    expect(true).toBe(true)
  })
})
\`\`\``

    createMock.mockResolvedValue({
      content: [{ type: 'text', text: responseText }],
    })

    const result = await callAgent({
      buildingId: 'tests',
      repoPath: '/tmp/repo',
      message: 'Write auth tests',
      history: [],
    })

    expect((result as any).codeBlocks).toBeDefined()
    expect((result as any).codeBlocks).toHaveLength(1)
    expect((result as any).codeBlocks[0].path).toBe('tests/auth.test.ts')
    expect((result as any).codeBlocks[0].language).toBe('typescript')
    expect((result as any).codeBlocks[0].content).toContain("describe('auth'")
  })

  it('parses multiple code blocks from response', async () => {
    const responseText = `Here are two files:

// File: tests/auth.test.ts
\`\`\`typescript
test('auth', () => {})
\`\`\`

// File: tests/users.test.ts
\`\`\`typescript
test('users', () => {})
\`\`\``

    createMock.mockResolvedValue({
      content: [{ type: 'text', text: responseText }],
    })

    const result = await callAgent({
      buildingId: 'tests',
      repoPath: '/tmp/repo',
      message: 'Write tests',
      history: [],
    })

    expect((result as any).codeBlocks).toHaveLength(2)
    expect((result as any).codeBlocks[0].path).toBe('tests/auth.test.ts')
    expect((result as any).codeBlocks[1].path).toBe('tests/users.test.ts')
  })

  it('handles code blocks without file path annotation', async () => {
    const responseText = `Here's some code:

\`\`\`typescript
console.log('hello')
\`\`\``

    createMock.mockResolvedValue({
      content: [{ type: 'text', text: responseText }],
    })

    const result = await callAgent({
      buildingId: 'tests',
      repoPath: '/tmp/repo',
      message: 'Show example',
      history: [],
    })

    expect((result as any).codeBlocks).toHaveLength(1)
    expect((result as any).codeBlocks[0].path).toBe('snippet')
    expect((result as any).codeBlocks[0].language).toBe('typescript')
  })

  it('handles response with multiple text blocks', async () => {
    createMock.mockResolvedValue({
      content: [
        { type: 'text', text: 'Part 1. ' },
        { type: 'text', text: 'Part 2.' },
      ],
    })

    const result = await callAgent({
      buildingId: 'tests',
      repoPath: '/tmp/repo',
      message: 'Help',
      history: [],
    })

    expect(result.content).toBe('Part 1. Part 2.')
  })

  it('filters out non-text content blocks', async () => {
    createMock.mockResolvedValue({
      content: [
        { type: 'text', text: 'Hello' },
        { type: 'tool_use', id: 'x', name: 'foo', input: {} },
      ],
    })

    const result = await callAgent({
      buildingId: 'tests',
      repoPath: '/tmp/repo',
      message: 'Help',
      history: [],
    })

    expect(result.content).toBe('Hello')
  })

  it('works with different building types', async () => {
    createMock.mockResolvedValue({
      content: [{ type: 'text', text: 'Docker advice.' }],
    })

    await callAgent({
      buildingId: 'docker',
      repoPath: '/tmp/repo',
      message: 'Add Dockerfile',
      history: [],
    })

    const callArgs = createMock.mock.calls[0][0]
    expect(callArgs.system).toContain('You are the Shipping Dock Builder.')
  })
})
