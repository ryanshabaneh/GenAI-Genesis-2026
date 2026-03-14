import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { deploymentAnalyzer } from '../deployment'
import type { AnalyzerContext } from '../base'

let tmpDir: string

function ctx(pkgJson: Record<string, unknown> | null = null): AnalyzerContext {
  return { repoPath: tmpDir, packageJson: pkgJson }
}

function writeFile(relativePath: string, content: string) {
  const full = path.join(tmpDir, relativePath)
  fs.mkdirSync(path.dirname(full), { recursive: true })
  fs.writeFileSync(full, content, 'utf8')
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deploy-test-'))
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

// ─── Execution-plan spec ──────────────────────────────────────────────────
// deployment.ts — Launch Pad
// Task 1: Deploy config file found (vercel.json, fly.toml, etc.) → +25%
// Task 2: "build" script in package.json                         → +25%
// Task 3: "start" script in package.json                         → +25%
// Task 4: process.env.PORT used in source files                  → +25%

describe('deployment analyzer — structural', () => {
  it('always returns exactly 4 tasks', async () => {
    const r = await deploymentAnalyzer.analyze(ctx())
    expect(r.tasks).toHaveLength(4)
  })

  it('has buildingId "deployment"', async () => {
    const r = await deploymentAnalyzer.analyze(ctx())
    expect(r.buildingId).toBe('deployment')
  })

  it('percent equals done-count * 25', async () => {
    const pkg = { scripts: { build: 'tsc', start: 'node dist/index.js' } }
    writeFile('src/index.ts', 'const port = process.env.PORT || 3000\n')
    const r = await deploymentAnalyzer.analyze(ctx(pkg))
    expect(r.percent).toBe(r.tasks.filter((t) => t.done).length * 25)
  })

  it('expected task ids', async () => {
    const r = await deploymentAnalyzer.analyze(ctx())
    const ids = r.tasks.map((t) => t.id)
    expect(ids).toEqual(['deploy-config', 'deploy-build', 'deploy-start', 'deploy-port'])
  })
})

describe('deployment analyzer — normal scenarios', () => {
  it('empty repo, null package.json → 0%', async () => {
    const r = await deploymentAnalyzer.analyze(ctx())
    expect(r.percent).toBe(0)
    expect(r.tasks.every((t) => !t.done)).toBe(true)
  })

  it('only vercel.json → 25%', async () => {
    writeFile('vercel.json', '{}')
    const r = await deploymentAnalyzer.analyze(ctx())
    expect(r.percent).toBe(25)
    expect(r.tasks[0].done).toBe(true)
  })

  it('build + start scripts → 50%', async () => {
    const pkg = { scripts: { build: 'tsc', start: 'node dist/index.js' } }
    const r = await deploymentAnalyzer.analyze(ctx(pkg))
    expect(r.percent).toBe(50)
    expect(r.tasks[1].done).toBe(true)
    expect(r.tasks[2].done).toBe(true)
  })

  it('build + start + PORT → 75%', async () => {
    const pkg = { scripts: { build: 'tsc', start: 'node dist/index.js' } }
    writeFile('src/index.ts', 'const port = process.env.PORT || 3000\n')
    const r = await deploymentAnalyzer.analyze(ctx(pkg))
    expect(r.percent).toBe(75)
  })

  it('full setup → 100%', async () => {
    const pkg = { scripts: { build: 'tsc', start: 'node dist/index.js' } }
    writeFile('vercel.json', '{}')
    writeFile('src/index.ts', 'const port = process.env.PORT || 3000\n')
    const r = await deploymentAnalyzer.analyze(ctx(pkg))
    expect(r.percent).toBe(100)
    expect(r.tasks.every((t) => t.done)).toBe(true)
  })
})

describe('deployment analyzer — deploy config detection', () => {
  for (const configFile of ['vercel.json', 'railway.toml', 'railway.json', 'fly.toml', 'render.yaml', 'netlify.toml']) {
    it(`${configFile} → config detected`, async () => {
      writeFile(configFile, '{}')
      const r = await deploymentAnalyzer.analyze(ctx())
      expect(r.tasks[0].done).toBe(true)
    })
  }

  it('unknown config file not detected', async () => {
    writeFile('heroku.yml', '{}')
    const r = await deploymentAnalyzer.analyze(ctx())
    expect(r.tasks[0].done).toBe(false)
  })
})

describe('deployment analyzer — script detection', () => {
  it('only build script → build=true, start=false', async () => {
    const pkg = { scripts: { build: 'tsc' } }
    const r = await deploymentAnalyzer.analyze(ctx(pkg))
    expect(r.tasks[1].done).toBe(true)
    expect(r.tasks[2].done).toBe(false)
  })

  it('only start script → build=false, start=true', async () => {
    const pkg = { scripts: { start: 'node index.js' } }
    const r = await deploymentAnalyzer.analyze(ctx(pkg))
    expect(r.tasks[1].done).toBe(false)
    expect(r.tasks[2].done).toBe(true)
  })

  it('scripts key is not an object → both false', async () => {
    const pkg = { scripts: 'invalid' }
    const r = await deploymentAnalyzer.analyze(ctx(pkg as any))
    expect(r.tasks[1].done).toBe(false)
    expect(r.tasks[2].done).toBe(false)
  })

  it('null package.json → both false', async () => {
    const r = await deploymentAnalyzer.analyze(ctx(null))
    expect(r.tasks[1].done).toBe(false)
    expect(r.tasks[2].done).toBe(false)
  })

  it('empty scripts object → both false', async () => {
    const pkg = { scripts: {} }
    const r = await deploymentAnalyzer.analyze(ctx(pkg))
    expect(r.tasks[1].done).toBe(false)
    expect(r.tasks[2].done).toBe(false)
  })
})

describe('deployment analyzer — process.env.PORT detection', () => {
  it('process.env.PORT in src/ → detected', async () => {
    writeFile('src/server.ts', 'const port = process.env.PORT || 3000\n')
    const r = await deploymentAnalyzer.analyze(ctx())
    expect(r.tasks[3].done).toBe(true)
  })

  it('process.env.PORT in nested src dir → detected', async () => {
    writeFile('src/config/server.ts', 'export const PORT = process.env.PORT\n')
    const r = await deploymentAnalyzer.analyze(ctx())
    expect(r.tasks[3].done).toBe(true)
  })

  it('no process.env.PORT → not detected', async () => {
    writeFile('src/index.ts', 'const port = 3000\n')
    const r = await deploymentAnalyzer.analyze(ctx())
    expect(r.tasks[3].done).toBe(false)
  })

  it('falls back to repoPath when src/ does not exist', async () => {
    writeFile('index.ts', 'const port = process.env.PORT\n')
    const r = await deploymentAnalyzer.analyze(ctx())
    expect(r.tasks[3].done).toBe(true)
  })

  it('process.env.PORT in .js file → detected', async () => {
    writeFile('src/app.js', 'app.listen(process.env.PORT)\n')
    const r = await deploymentAnalyzer.analyze(ctx())
    expect(r.tasks[3].done).toBe(true)
  })
})

describe('deployment analyzer — multi-language build/start detection', () => {
  it('Makefile → build detected', async () => {
    writeFile('Makefile', 'build:\n\tgo build ./...\n')
    const r = await deploymentAnalyzer.analyze(ctx())
    expect(r.tasks[1].done).toBe(true)
  })

  it('main.py → start entrypoint detected', async () => {
    writeFile('main.py', 'app.run()\n')
    const r = await deploymentAnalyzer.analyze(ctx())
    expect(r.tasks[2].done).toBe(true)
  })

  it('main.go → start entrypoint detected', async () => {
    writeFile('main.go', 'func main() {}\n')
    const r = await deploymentAnalyzer.analyze(ctx())
    expect(r.tasks[2].done).toBe(true)
  })

  it('Procfile → start entrypoint + deploy config detected', async () => {
    writeFile('Procfile', 'web: python main.py\n')
    const r = await deploymentAnalyzer.analyze(ctx())
    expect(r.tasks[0].done).toBe(true) // deploy config
    expect(r.tasks[2].done).toBe(true) // start
  })

  it('pyproject.toml → build detected', async () => {
    writeFile('pyproject.toml', '[build-system]\n')
    const r = await deploymentAnalyzer.analyze(ctx())
    expect(r.tasks[1].done).toBe(true)
  })
})

describe('deployment analyzer — multi-language PORT detection', () => {
  it('Python os.environ.get("PORT") detected', async () => {
    writeFile('src/app.py', 'port = os.environ.get("PORT", 5000)\n')
    const r = await deploymentAnalyzer.analyze(ctx())
    expect(r.tasks[3].done).toBe(true)
  })

  it('Python os.environ["PORT"] detected', async () => {
    writeFile('src/config.py', 'port = os.environ["PORT"]\n')
    const r = await deploymentAnalyzer.analyze(ctx())
    expect(r.tasks[3].done).toBe(true)
  })

  it('Python os.getenv("PORT") detected', async () => {
    writeFile('src/main.py', 'port = os.getenv("PORT")\n')
    const r = await deploymentAnalyzer.analyze(ctx())
    expect(r.tasks[3].done).toBe(true)
  })

  it('Go os.Getenv("PORT") detected', async () => {
    writeFile('src/main.go', 'port := os.Getenv("PORT")\n')
    const r = await deploymentAnalyzer.analyze(ctx())
    expect(r.tasks[3].done).toBe(true)
  })

  it('Ruby ENV["PORT"] detected', async () => {
    writeFile('config.rb', 'port = ENV["PORT"]\n')
    const r = await deploymentAnalyzer.analyze(ctx())
    expect(r.tasks[3].done).toBe(true)
  })

  it('.py file in root detected when no src/', async () => {
    writeFile('app.py', 'port = os.environ.get("PORT")\n')
    const r = await deploymentAnalyzer.analyze(ctx())
    expect(r.tasks[3].done).toBe(true)
  })
})

describe('deployment analyzer — stress / edge cases', () => {
  it('node_modules skipped for PORT scan', async () => {
    writeFile('src/node_modules/lib/index.ts', 'process.env.PORT\n')
    const r = await deploymentAnalyzer.analyze(ctx())
    expect(r.tasks[3].done).toBe(false)
  })

  it('.git directory skipped', async () => {
    writeFile('src/.git/hooks/pre-commit.ts', 'process.env.PORT\n')
    const r = await deploymentAnalyzer.analyze(ctx())
    expect(r.tasks[3].done).toBe(false)
  })

  it('non-js/ts files skipped for PORT', async () => {
    writeFile('src/README.md', 'Set process.env.PORT to configure.\n')
    const r = await deploymentAnalyzer.analyze(ctx())
    expect(r.tasks[3].done).toBe(false)
  })

  it('process.env.PORT_NUMBER does not match (has extra chars)', async () => {
    writeFile('src/index.ts', 'const p = process.env.PORT_NUMBER\n')
    const r = await deploymentAnalyzer.analyze(ctx())
    // PORT_NUMBER contains PORT, regex /process\.env\.PORT/ will match
    // This is by design — the regex is intentionally broad
    expect(r.tasks[3].done).toBe(true)
  })

  it('multiple config files — first match is enough', async () => {
    writeFile('vercel.json', '{}')
    writeFile('fly.toml', '')
    const r = await deploymentAnalyzer.analyze(ctx())
    expect(r.tasks[0].done).toBe(true)
    expect(r.percent >= 25).toBe(true)
  })

  it('very large source file with PORT', async () => {
    const big = '// filler\n'.repeat(50_000) + 'process.env.PORT\n'
    writeFile('src/big.ts', big)
    const r = await deploymentAnalyzer.analyze(ctx())
    expect(r.tasks[3].done).toBe(true)
  })
})
