import Anthropic from '@anthropic-ai/sdk'
import type { AgentReply, AnalyzerResult, BuildingId, Message } from '../types'
import { AGENT_PROMPTS } from './prompts'
import { buildAgentContext } from './context'
import { buildScannerPreprompt } from './scanner-context'
import { client } from './client'

// Parse code blocks from assistant response text
// Looks for patterns like:
// // File: path/to/file
// ```language
// ...content...
// ```
export function parseCodeBlocks(
  text: string
): Array<{ path: string; content: string; language: string }> {
  const blocks: Array<{ path: string; content: string; language: string }> = []

  // Match optional "// File: ..." comment before a fenced code block
  const pattern = /(?:\/\/\s*File:\s*(.+?)\n)?```(\w+)?\n([\s\S]*?)```/g
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    const filePath = match[1]?.trim() ?? 'snippet'
    const language = match[2]?.trim() ?? 'text'
    const content = match[3] ?? ''
    blocks.push({ path: filePath, content, language })
  }

  return blocks
}

export async function callAgent(params: {
  buildingId: BuildingId
  repoPath: string
  message: string
  history: Message[]
  scanResult?: AnalyzerResult
}): Promise<AgentReply> {
  const { buildingId, repoPath, message, history, scanResult } = params

  const systemPrompt = AGENT_PROMPTS[buildingId]
  const context = await buildAgentContext(buildingId, repoPath)
  const scannerPreprompt = buildScannerPreprompt(scanResult)

  const systemWithContext = `${systemPrompt}\n\n---\n\n${scannerPreprompt ? scannerPreprompt + '\n\n---\n\n' : ''}${context}`

  // Map history to Anthropic message format
  const messages: Anthropic.MessageParam[] = [
    ...history.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })),
    { role: 'user' as const, content: message },
  ]

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: systemWithContext,
    messages,
  })

  const assistantText =
    response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('') ?? ''

  const codeBlocks = parseCodeBlocks(assistantText)

  const reply: AgentReply = {
    role: 'assistant',
    content: assistantText,
    ...(codeBlocks.length > 0 ? { codeBlocks } : {}),
  }

  return reply
}
