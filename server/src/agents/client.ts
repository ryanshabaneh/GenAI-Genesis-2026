import Anthropic from '@anthropic-ai/sdk'

export const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})
