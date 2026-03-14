import Anthropic from '@anthropic-ai/sdk'
import { spawn } from 'child_process'

const apiKey = process.env.ANTHROPIC_API_KEY

function callClaudeCli(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('claude', ['-p'], { stdio: ['pipe', 'pipe', 'pipe'], shell: true })

    let out = ''
    let err = ''
    proc.stdout.on('data', (d: Buffer) => { out += d.toString() })
    proc.stderr.on('data', (d: Buffer) => { err += d.toString() })
    proc.on('close', (code) =>
      code === 0 ? resolve(out.trim()) : reject(new Error(err || `claude CLI exited with code ${code}`))
    )
    proc.on('error', (e) =>
      reject(new Error(`Failed to spawn claude CLI — is it installed? ${e.message}`))
    )
    proc.stdin.end(prompt)
  })
}

function buildPromptText(params: {
  system?: string | Anthropic.TextBlockParam[]
  messages: Anthropic.MessageCreateParams['messages']
}): string {
  const systemText =
    typeof params.system === 'string'
      ? params.system
      : Array.isArray(params.system)
        ? params.system.map((b) => ('text' in b ? b.text : '')).join('\n')
        : ''

  const messageParts = params.messages.map((m) => {
    const text = typeof m.content === 'string' ? m.content : '(complex content)'
    return `[${m.role}]\n${text}`
  })

  return `<system>\n${systemText}\n</system>\n\n${messageParts.join('\n\n')}`
}

function createCliClient(): Anthropic {
  const mock = {
    messages: {
      async create(params: Anthropic.MessageCreateParams): Promise<Anthropic.Message> {
        const prompt = buildPromptText(params)
        console.log(`[claude-cli] calling claude CLI (${prompt.length} chars)`)
        const text = await callClaudeCli(prompt)
        console.log(`[claude-cli] got response (${text.length} chars)`)
        return {
          id: `cli-${Date.now()}`,
          type: 'message',
          role: 'assistant',
          model: params.model,
          content: [{ type: 'text', text }],
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: { input_tokens: 0, output_tokens: 0 },
        } as Anthropic.Message
      },
    },
  }
  return mock as unknown as Anthropic
}

export const client: Anthropic = apiKey
  ? new Anthropic({ apiKey })
  : createCliClient()

if (!apiKey) {
  console.log('[client] No ANTHROPIC_API_KEY — using claude CLI fallback')
}
