import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { buildAgentContext } from './context'

describe('buildAgentContext', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shipcity-test-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('returns "no relevant files" message for empty repo', async () => {
    const result = await buildAgentContext('tests', tmpDir)
    expect(result).toBe('No relevant files were found in the repository for this area.')
  })

  it('reads package.json for logging building', async () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'my-app', scripts: { dev: 'nodemon' } }))

    const result = await buildAgentContext('logging', tmpDir)
    expect(result).toContain('package.json')
    expect(result).toContain('my-app')
    expect(result).toContain('nodemon')
  })

  it('reads README.md for documentation building', async () => {
    fs.writeFileSync(path.join(tmpDir, 'README.md'), '# My Project\nThis is a cool project.')
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"test"}')

    const result = await buildAgentContext('documentation', tmpDir)
    expect(result).toContain('README.md')
    expect(result).toContain('My Project')
    expect(result).toContain('package.json')
  })

  it('reads Dockerfile for docker building', async () => {
    fs.writeFileSync(path.join(tmpDir, 'Dockerfile'), 'FROM node:20\nCOPY . .\nRUN npm install')
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"test"}')

    const result = await buildAgentContext('docker', tmpDir)
    expect(result).toContain('Dockerfile')
    expect(result).toContain('FROM node:20')
  })

  it('reads .gitignore for security building', async () => {
    fs.writeFileSync(path.join(tmpDir, '.gitignore'), 'node_modules\n.env\ndist')
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"test"}')

    const result = await buildAgentContext('security', tmpDir)
    expect(result).toContain('.gitignore')
    expect(result).toContain('node_modules')
  })

  it('reads package.json for cicd building when no workflow ts/js files exist', async () => {
    // The directory walker only picks up .ts/.js files, so .yml files in
    // .github/workflows won't be included. But package.json is a direct target.
    const workflowDir = path.join(tmpDir, '.github', 'workflows')
    fs.mkdirSync(workflowDir, { recursive: true })
    fs.writeFileSync(path.join(workflowDir, 'ci.yml'), 'name: CI\non: push')
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"cicd-test","scripts":{"test":"vitest"}}')

    const result = await buildAgentContext('cicd', tmpDir)
    expect(result).toContain('package.json')
    expect(result).toContain('cicd-test')
  })

  it('reads source files from src directory for tests building', async () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"test"}')
    const srcDir = path.join(tmpDir, 'src')
    fs.mkdirSync(srcDir)
    fs.writeFileSync(path.join(srcDir, 'index.ts'), 'export function main() { return "hello" }')

    const result = await buildAgentContext('tests', tmpDir)
    expect(result).toContain('index.ts')
    expect(result).toContain('main()')
  })

  it('truncates files larger than 8KB', async () => {
    const bigContent = 'x'.repeat(10_000)
    fs.writeFileSync(path.join(tmpDir, 'package.json'), bigContent)

    const result = await buildAgentContext('logging', tmpDir)
    expect(result).toContain('... (truncated)')
    expect(result.length).toBeLessThan(bigContent.length)
  })

  it('skips node_modules and .git directories', async () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"test"}')
    const srcDir = path.join(tmpDir, 'src')
    fs.mkdirSync(srcDir)
    fs.writeFileSync(path.join(srcDir, 'app.ts'), 'export const app = true')

    const nmDir = path.join(srcDir, 'node_modules')
    fs.mkdirSync(nmDir)
    fs.writeFileSync(path.join(nmDir, 'bad.ts'), 'should not appear')

    const result = await buildAgentContext('tests', tmpDir)
    expect(result).toContain('app.ts')
    expect(result).not.toContain('should not appear')
  })

  it('reads .env.example for envVars building', async () => {
    fs.writeFileSync(path.join(tmpDir, '.env.example'), 'DATABASE_URL=\nAPI_KEY=')
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"test"}')

    const result = await buildAgentContext('envVars', tmpDir)
    expect(result).toContain('.env.example')
    expect(result).toContain('DATABASE_URL')
  })

  it('limits directory reads to maxFiles (5)', async () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"test"}')
    const srcDir = path.join(tmpDir, 'src')
    fs.mkdirSync(srcDir)
    for (let i = 0; i < 10; i++) {
      fs.writeFileSync(path.join(srcDir, `file${i}.ts`), `export const val${i} = ${i}`)
    }

    const result = await buildAgentContext('tests', tmpDir)
    // Should include some src files but not all 10
    const fileMatches = result.match(/### File:/g)
    // package.json + up to 5 src files = max 6
    expect(fileMatches!.length).toBeLessThanOrEqual(6)
  })
})
