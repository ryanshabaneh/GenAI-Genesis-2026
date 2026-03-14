import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockExecFile } = vi.hoisted(() => ({
  mockExecFile: vi.fn(),
}))

vi.mock('util', async (importOriginal) => {
  const actual = await importOriginal<typeof import('util')>()
  return {
    ...actual,
    promisify: () => mockExecFile,
  }
})

import { callAider, resetAiderChanges } from './aider'

describe('callAider', () => {
  beforeEach(() => vi.clearAllMocks())

  it('spawns aider with correct flags and returns diff + changed files', async () => {
    // First call: aider itself
    mockExecFile.mockResolvedValueOnce({ stdout: '', stderr: '' })
    // Second call: git diff
    mockExecFile.mockResolvedValueOnce({ stdout: '+++ b/test.ts\n+console.log("hi")', stderr: '' })
    // Third call: git ls-files (untracked)
    mockExecFile.mockResolvedValueOnce({ stdout: '', stderr: '' })

    // Mock fs/promises readFile for collectChangedFiles
    vi.doMock('fs/promises', () => ({
      readFile: vi.fn().mockResolvedValue('console.log("hi")'),
    }))

    const result = await callAider({
      buildingId: 'tests',
      repoPath: '/tmp/repo',
      taskDescription: 'Add unit tests',
    })

    expect(result.success).toBe(true)
    expect(result.diff).toContain('test.ts')

    // Check aider was called with --message, --yes, --no-auto-commits, etc.
    const aiderCall = mockExecFile.mock.calls[0]
    expect(aiderCall[0]).toBe('aider')
    const args = aiderCall[1] as string[]
    expect(args).toContain('--message')
    expect(args).toContain('--yes')
    expect(args).toContain('--no-auto-commits')
    expect(args).toContain('--no-stream')
    expect(args).toContain('--map-tokens')
  })

  it('returns success:false when aider process fails', async () => {
    mockExecFile.mockRejectedValueOnce(new Error('aider not found'))

    const result = await callAider({
      buildingId: 'tests',
      repoPath: '/tmp/repo',
      taskDescription: 'Add tests',
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('aider not found')
    expect(result.changedFiles).toEqual([])
  })

  it('passes task description directly as the message (pure executor)', async () => {
    mockExecFile.mockResolvedValueOnce({ stdout: '', stderr: '' })
    mockExecFile.mockResolvedValueOnce({ stdout: '', stderr: '' })
    mockExecFile.mockResolvedValueOnce({ stdout: '', stderr: '' })

    await callAider({
      buildingId: 'tests',
      repoPath: '/tmp/repo',
      taskDescription: 'Create a test file at src/__tests__/utils.test.ts that tests the add function',
    })

    const aiderCall = mockExecFile.mock.calls[0]
    const args = aiderCall[1] as string[]
    const messageIdx = args.indexOf('--message')
    const message = args[messageIdx + 1]
    expect(message).toBe('Create a test file at src/__tests__/utils.test.ts that tests the add function')
  })

  it('uses custom model when provided', async () => {
    mockExecFile.mockResolvedValueOnce({ stdout: '', stderr: '' })
    mockExecFile.mockResolvedValueOnce({ stdout: '', stderr: '' })
    mockExecFile.mockResolvedValueOnce({ stdout: '', stderr: '' })

    await callAider({
      buildingId: 'tests',
      repoPath: '/tmp/repo',
      taskDescription: 'Add tests',
      model: 'anthropic/claude-opus-4-6',
    })

    const args = mockExecFile.mock.calls[0][1] as string[]
    const modelIdx = args.indexOf('--model')
    expect(args[modelIdx + 1]).toBe('anthropic/claude-opus-4-6')
  })
})

describe('resetAiderChanges', () => {
  beforeEach(() => vi.clearAllMocks())

  it('runs git checkout and git clean', async () => {
    mockExecFile.mockResolvedValue({ stdout: '', stderr: '' })

    await resetAiderChanges('/tmp/repo')

    expect(mockExecFile).toHaveBeenCalledTimes(2)
    expect(mockExecFile.mock.calls[0][1]).toContain('checkout')
    expect(mockExecFile.mock.calls[1][1]).toContain('clean')
  })
})
