import Anthropic from '@anthropic-ai/sdk'
import type { BuildingId, Message } from '../types'
import { AGENT_PROMPTS } from './prompts'
import { buildAgentContext } from './context'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// Parse code blocks from assistant response text
// Looks for patterns like:
// // File: path/to/file
// ```language
// ...content...
// ```
function parseCodeBlocks(
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
}): Promise<Message> {
  const { buildingId, repoPath, message, history } = params

  const systemPrompt = AGENT_PROMPTS[buildingId]
  const context = await buildAgentContext(buildingId, repoPath)

  const systemWithContext = `${systemPrompt}\n\n---\n\n${context}`

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

  const reply: Message & { codeBlocks?: typeof codeBlocks } = {
    role: 'assistant',
    content: assistantText,
    ...(codeBlocks.length > 0 ? { codeBlocks } : {}),
  }

  return reply
}
