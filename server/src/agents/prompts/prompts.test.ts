import { describe, it, expect } from 'vitest'
import { AGENT_PROMPTS } from './index'
import type { BuildingId } from '../../types'

const ALL_BUILDING_IDS: BuildingId[] = [
  'tests', 'cicd', 'docker', 'documentation',
  'envVars', 'security', 'logging', 'deployment',
]

describe('AGENT_PROMPTS', () => {
  it('has a prompt for every BuildingId', () => {
    for (const id of ALL_BUILDING_IDS) {
      expect(AGENT_PROMPTS[id]).toBeDefined()
      expect(typeof AGENT_PROMPTS[id]).toBe('string')
      expect(AGENT_PROMPTS[id].length).toBeGreaterThan(50)
    }
  })

  it('every prompt mentions code output format', () => {
    for (const id of ALL_BUILDING_IDS) {
      expect(AGENT_PROMPTS[id]).toContain('// File:')
    }
  })

  it('every prompt instructs to read actual files or interact with user', () => {
    for (const id of ALL_BUILDING_IDS) {
      const prompt = AGENT_PROMPTS[id].toLowerCase()
      expect(prompt).toMatch(/read the user|ask the user/)
    }
  })

  it('prompts reference the correct building metaphor', () => {
    expect(AGENT_PROMPTS.tests).toContain('School Builder')
    expect(AGENT_PROMPTS.cicd).toContain('Factory Builder')
    expect(AGENT_PROMPTS.docker).toContain('Shipping Dock Builder')
    expect(AGENT_PROMPTS.documentation).toContain('Town Hall Builder')
    expect(AGENT_PROMPTS.envVars).toContain('Power Plant Builder')
    expect(AGENT_PROMPTS.security).toContain('Vault Builder')
    expect(AGENT_PROMPTS.logging).toContain('Watchtower Builder')
    expect(AGENT_PROMPTS.deployment).toContain('Launch Pad Builder')
  })

  it('tests prompt mentions testing frameworks', () => {
    expect(AGENT_PROMPTS.tests).toMatch(/jest|vitest|mocha/i)
  })

  it('cicd prompt mentions GitHub Actions', () => {
    expect(AGENT_PROMPTS.cicd).toMatch(/github actions/i)
  })

  it('docker prompt mentions Dockerfile', () => {
    expect(AGENT_PROMPTS.docker).toMatch(/dockerfile/i)
  })

  it('security prompt mentions .gitignore', () => {
    expect(AGENT_PROMPTS.security).toMatch(/\.gitignore/i)
  })

  it('logging prompt mentions structured logging', () => {
    expect(AGENT_PROMPTS.logging).toMatch(/winston|pino/i)
  })

  it('deployment prompt mentions hosting platforms', () => {
    expect(AGENT_PROMPTS.deployment).toMatch(/vercel|railway|fly\.io|render/i)
  })

  it('no prompt is a duplicate of another', () => {
    const prompts = Object.values(AGENT_PROMPTS)
    const unique = new Set(prompts)
    expect(unique.size).toBe(prompts.length)
  })
})
