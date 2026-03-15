// server/src/agents/client.ts
// When ANTHROPIC_API_KEY is set, uses the SDK directly.
// Otherwise, shells out to the `claude` CLI (Claude Code).

import Anthropic from '@anthropic-ai/sdk'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import os from 'os'

const execAsync = promisify(exec)

function buildSdkClient(): Anthropic {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

function buildCliClient(): Anthropic {
  const handler: ProxyHandler<Anthropic> = {
    get(_target, prop) {
      if (prop === 'messages') {
        return {
          create: async (params: Anthropic.MessageCreateParamsNonStreaming) => {
            return callClaudeCli(params)
          },
        }
      }
      return undefined
    },
  }
  return new Proxy({} as Anthropic, handler)
}

async function callClaudeCli(
  params: Anthropic.MessageCreateParamsNonStreaming
): Promise<Anthropic.Message> {
  const parts: string[] = []

  if (params.system) {
    const systemText =
      typeof params.system === 'string'
        ? params.system
        : params.system.map((b) => ('text' in b ? b.text : '')).join('\n')
    parts.push(`[System]\n${systemText}`)
  }

  for (const msg of params.messages) {
    const role = msg.role === 'user' ? 'User' : 'Assistant'
    const content =
      typeof msg.content === 'string'
        ? msg.content
        : (msg.content as Anthropic.TextBlockParam[])
            .filter((b) => b.type === 'text')
            .map((b) => b.text)
            .join('\n')
    parts.push(`[${role}]\n${content}`)
  }

  const prompt = parts.join('\n\n')

  // Write to temp file, pipe to claude via shell
  const tmpFile = path.join(os.tmpdir(), `shipcity-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`)
  fs.writeFileSync(tmpFile, prompt, 'utf8')

  const model = params.model ?? 'claude-sonnet-4-6'
  const cmd = `cat "${tmpFile}" | claude -p --output-format json --model ${model} --max-turns 5`

  console.log(`[claude-cli] calling (${(prompt.length / 1024).toFixed(1)}KB prompt)...`)

  try {
    const { stdout, stderr } = await execAsync(cmd, {
      timeout: 180_000,
      maxBuffer: 10 * 1024 * 1024,
      env: { ...process.env },
    })

    if (!stdout?.trim()) {
      console.error('[claude-cli] empty stdout, stderr:', stderr?.slice(0, 500))
      throw new Error('Claude CLI returned empty response')
    }

    const envelope = JSON.parse(stdout)
    let resultText = envelope.result ?? ''

    // If claude hit max turns (was using tools and ran out), resume the session
    // with no tools so it summarizes what it found.
    if (!resultText && envelope.subtype === 'error_max_turns') {
      const sid = envelope.session_id
      console.log(`[claude-cli] hit max turns (${envelope.num_turns}) — resuming session for summary...`)
      try {
        const resumeCmd = `echo "Please summarize your findings and answer the original question based on what you learned." | claude -p --output-format json --model ${model} --max-turns 1 --allowedTools "" --resume "${sid}"`
        const { stdout: followOut } = await execAsync(resumeCmd, {
          timeout: 60_000,
          maxBuffer: 10 * 1024 * 1024,
          env: { ...process.env },
        })
        const followEnvelope = JSON.parse(followOut)
        resultText = followEnvelope.result ?? ''
        console.log(`[claude-cli] follow-up got ${resultText.length} chars`)
      } catch (followErr) {
        console.error('[claude-cli] follow-up failed:', followErr instanceof Error ? followErr.message.slice(0, 100) : followErr)
        resultText = 'I was researching your codebase but ran out of turns. Please try again with a more specific question.'
      }
    }

    console.log(`[claude-cli] success (${resultText.length} chars)`)

    return {
      id: 'cli-' + Date.now(),
      type: 'message',
      role: 'assistant',
      model,
      content: [{ type: 'text', text: resultText }],
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
    } as Anthropic.Message
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error'
    console.error(`[claude-cli] error: ${msg.slice(0, 300)}`)
    throw new Error(`Claude CLI failed: ${msg.slice(0, 200)}`)
  } finally {
    try { fs.unlinkSync(tmpFile) } catch {}
  }
}

const USE_CLI = !process.env.ANTHROPIC_API_KEY || process.env.USE_CLAUDE_CLI === '1'
if (USE_CLI) {
  console.log('[client] No ANTHROPIC_API_KEY — routing LLM calls through claude CLI')
}

export const client = USE_CLI ? buildCliClient() : buildSdkClient()
