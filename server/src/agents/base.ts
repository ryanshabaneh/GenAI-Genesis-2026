import Anthropic from '@anthropic-ai/sdk'
import type { AgentReply, AnalyzerResult, BuildingId, Message } from '../types'
import { AGENT_PROMPTS, IMPLEMENTATION_FORMAT } from './prompts'
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

  // Only treat a code block as actionable if prefixed with "// File: path"
  const pattern = /\/\/\s*File:\s*(.+?)\n```(\w+)?\n([\s\S]*?)```/g
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    const filePath = match[1].trim()
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
  changeLogContext?: string
}): Promise<AgentReply> {
  const { buildingId, repoPath, message, history, scanResult, changeLogContext } = params

  const systemPrompt = AGENT_PROMPTS[buildingId]
  const context = await buildAgentContext(buildingId, repoPath)
  const scannerPreprompt = buildScannerPreprompt(scanResult)

  const changeLogBlock = changeLogContext ? changeLogContext + '\n\n---\n\n' : ''
  const repoAnchor = `You are analyzing the user's repository cloned at: ${repoPath}\nEverything you say should be about THEIR project — not about ShipCity or any other system.\n\n---\n\n`
  const systemWithContext = `${systemPrompt}\n\n---\n\n${repoAnchor}${scannerPreprompt ? scannerPreprompt + '\n\n---\n\n' : ''}${changeLogBlock}${context}`

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
    cwd: repoPath,
  } as Anthropic.MessageCreateParamsNonStreaming)

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

// IMPLEMENTATION_FORMAT is imported from ./prompts/formats.ts (central format registry)

/**
 * Call the agent in implementation mode — produces specific instructions
 * for aider to execute rather than conversational responses.
 */
export async function callAgentForImplementation(params: {
  buildingId: BuildingId
  repoPath: string
  message: string
  history: Message[]
  scanResult?: AnalyzerResult
  changeLogContext?: string
}): Promise<string> {
  const { buildingId, repoPath, message, history, scanResult, changeLogContext } = params

  const systemPrompt = AGENT_PROMPTS[buildingId]
  const context = await buildAgentContext(buildingId, repoPath)
  const scannerPreprompt = buildScannerPreprompt(scanResult)

  const changeLogBlock = changeLogContext ? changeLogContext + '\n\n---\n\n' : ''
  const repoAnchor = `You are analyzing the user's repository cloned at: ${repoPath}\nEverything you say should be about THEIR project — not about ShipCity or any other system.\n\n---\n\n`
  const systemWithContext = `${systemPrompt}\n\n${IMPLEMENTATION_FORMAT}\n\n---\n\n${repoAnchor}${scannerPreprompt ? scannerPreprompt + '\n\n---\n\n' : ''}${changeLogBlock}${context}`

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
    cwd: repoPath,
  } as Anthropic.MessageCreateParamsNonStreaming)

  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')
}
