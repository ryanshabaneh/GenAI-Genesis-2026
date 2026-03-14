import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { securityAnalyzer } from '../security'
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
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'security-test-'))
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

// ─── Execution-plan spec ──────────────────────────────────────────────────
// security.ts — Vault
// Task 1: .env listed in .gitignore                          → +25%
// Task 2: .env not committed to repo                         → +25%
// Task 3: No hardcoded secrets (API keys, AWS, Stripe)       → +25%
// Task 4: package-lock.json exists (npm audit possible)      → +25%

describe('security analyzer — structural', () => {
  it('always returns exactly 4 tasks', async () => {
    const r = await securityAnalyzer.analyze(ctx())
    expect(r.tasks).toHaveLength(4)
  })

  it('has buildingId "security"', async () => {
    const r = await securityAnalyzer.analyze(ctx())
    expect(r.buildingId).toBe('security')
  })

  it('percent equals done-count * 25', async () => {
    const r = await securityAnalyzer.analyze(ctx())
    expect(r.percent).toBe(r.tasks.filter((t) => t.done).length * 25)
  })

  it('expected task ids match plan', async () => {
    const r = await securityAnalyzer.analyze(ctx())
    const ids = r.tasks.map((t) => t.id)
    expect(ids).toEqual([
      'security-env-ignored',
      'security-env-not-committed',
      'security-no-secrets',
      'security-lockfile',
    ])
  })
})

describe('security analyzer — normal scenarios', () => {
  it('empty repo → 50% (no .env committed + no secrets)', async () => {
    const r = await securityAnalyzer.analyze(ctx())
    expect(r.tasks[0].done).toBe(false) // no .gitignore
    expect(r.tasks[1].done).toBe(true)  // .env not found = good
    expect(r.tasks[2].done).toBe(true)  // no secrets
    expect(r.tasks[3].done).toBe(false) // no lockfile
    expect(r.percent).toBe(50)
  })

  it('.gitignore with .env → 75%', async () => {
    writeFile('.gitignore', 'node_modules\n.env\n')
    const r = await securityAnalyzer.analyze(ctx())
    expect(r.tasks[0].done).toBe(true) // .env in gitignore
    expect(r.tasks[1].done).toBe(true) // .env not committed
    expect(r.tasks[2].done).toBe(true) // no secrets
    expect(r.percent).toBe(75)
  })

  it('.gitignore with .env + lockfile → 100%', async () => {
    writeFile('.gitignore', '.env\n')
    writeFile('package-lock.json', '{}')
    const r = await securityAnalyzer.analyze(ctx())
    expect(r.percent).toBe(100)
    expect(r.tasks.every((t) => t.done)).toBe(true)
  })

  it('.env file exists → env-not-committed = false', async () => {
    writeFile('.env', 'SECRET=abc')
    const r = await securityAnalyzer.analyze(ctx())
    expect(r.tasks[1].done).toBe(false)
  })

  it('.gitignore exists but does not include .env → env-ignored = false', async () => {
    writeFile('.gitignore', 'node_modules\ndist\n')
    const r = await securityAnalyzer.analyze(ctx())
    expect(r.tasks[0].done).toBe(false)
  })
})

describe('security analyzer — secret pattern detection (API key pattern)', () => {
  it('api_key = "longvalue1234567890" → secret found', async () => {
    writeFile('src/config.ts', 'const api_key = "abcdefghijklmnopqr"\n')
    const r = await securityAnalyzer.analyze(ctx())
    expect(r.tasks[2].done).toBe(false) // secrets found
  })

  it('apikey = "short" (< 16 chars) → NOT flagged', async () => {
    writeFile('src/config.ts', "const apikey = 'short'\n")
    const r = await securityAnalyzer.analyze(ctx())
    expect(r.tasks[2].done).toBe(true)
  })

  it('token = "AAAAAAAAAAAAAAAA1234" → flagged (16+ chars)', async () => {
    writeFile('src/config.ts', 'const token = "AAAAAAAAAAAAAAAA1234"\n')
    const r = await securityAnalyzer.analyze(ctx())
    expect(r.tasks[2].done).toBe(false)
  })

  it('secret = "mysecret1234567890ab" → flagged', async () => {
    writeFile('src/config.ts', 'const secret = "mysecret1234567890ab"\n')
    const r = await securityAnalyzer.analyze(ctx())
    expect(r.tasks[2].done).toBe(false)
  })

  it('process.env.API_KEY reference (no hardcoded value) → safe', async () => {
    writeFile('src/config.ts', 'const key = process.env.API_KEY\n')
    const r = await securityAnalyzer.analyze(ctx())
    expect(r.tasks[2].done).toBe(true)
  })
})

describe('security analyzer — AWS key detection', () => {
  it('AKIA followed by 16 uppercase alphanumeric → flagged', async () => {
    writeFile('src/aws.ts', 'const key = "AKIAIOSFODNN7EXAMPLE"\n')
    const r = await securityAnalyzer.analyze(ctx())
    expect(r.tasks[2].done).toBe(false)
  })

  it('AKIA with only 10 chars after → NOT flagged', async () => {
    writeFile('src/aws.ts', 'const key = "AKIA1234567890"\n')
    const r = await securityAnalyzer.analyze(ctx())
    // AKIA + 10 chars = 14 total. Pattern requires AKIA + exactly 16.
    // "AKIA1234567890" has AKIA + 10 = 14 chars after AKIA, which is < 16
    expect(r.tasks[2].done).toBe(true)
  })

  it('real-world-ish AWS key format AKIA + 16 → flagged', async () => {
    writeFile('src/config.ts', 'const accessKeyId = "AKIAI44QH8DHBEXAMPLE"\n')
    const r = await securityAnalyzer.analyze(ctx())
    expect(r.tasks[2].done).toBe(false)
  })
})

describe('security analyzer — Stripe key detection', () => {
  const livePrefix = ['sk', 'live'].join('_') + '_'
  const testPrefix = ['sk', 'test'].join('_') + '_'
  const suffix = 'abcdefghijklmnopqrstuvwx'

  it('sk_live_ + 24 alphanumeric → flagged', async () => {
    writeFile('src/stripe.ts', `const key = "${livePrefix}${suffix}"\n`)
    const r = await securityAnalyzer.analyze(ctx())
    expect(r.tasks[2].done).toBe(false)
  })

  it('sk_test_ key → NOT flagged (only sk_live_ matches)', async () => {
    writeFile('src/stripe.ts', `const key = "${testPrefix}${suffix}"\n`)
    const r = await securityAnalyzer.analyze(ctx())
    expect(r.tasks[2].done).toBe(true)
  })

  it('sk_live_ with short suffix → NOT flagged', async () => {
    writeFile('src/stripe.ts', `const key = "${livePrefix}short"\n`)
    const r = await securityAnalyzer.analyze(ctx())
    expect(r.tasks[2].done).toBe(true)
  })
})

describe('security analyzer — lockfile detection', () => {
  it('package-lock.json exists → lockfile=true', async () => {
    writeFile('package-lock.json', '{"lockfileVersion": 3}')
    const r = await securityAnalyzer.analyze(ctx())
    expect(r.tasks[3].done).toBe(true)
  })

  it('no package-lock.json → lockfile=false', async () => {
    const r = await securityAnalyzer.analyze(ctx())
    expect(r.tasks[3].done).toBe(false)
  })

  it('yarn.lock IS counted as a valid lockfile', async () => {
    writeFile('yarn.lock', '# yarn lockfile')
    const r = await securityAnalyzer.analyze(ctx())
    expect(r.tasks[3].done).toBe(true)
  })

  it('go.sum IS counted as a valid lockfile', async () => {
    writeFile('go.sum', 'golang.org/x/text v0.3.0 h1:abc=')
    const r = await securityAnalyzer.analyze(ctx())
    expect(r.tasks[3].done).toBe(true)
  })

  it('poetry.lock IS counted as a valid lockfile', async () => {
    writeFile('poetry.lock', '[[package]]')
    const r = await securityAnalyzer.analyze(ctx())
    expect(r.tasks[3].done).toBe(true)
  })
})

describe('security analyzer — multi-language file scanning', () => {
  it('secrets in .py files → flagged', async () => {
    writeFile('src/config.py', 'api_key = "abcdefghijklmnopqrstuvwxyz"\n')
    const r = await securityAnalyzer.analyze(ctx())
    expect(r.tasks[2].done).toBe(false)
  })

  it('secrets in .go files → flagged', async () => {
    writeFile('src/config.go', 'var apikey = "abcdefghijklmnopqrstuvwxyz"\n')
    const r = await securityAnalyzer.analyze(ctx())
    expect(r.tasks[2].done).toBe(false)
  })

  it('secrets in .rb files → flagged', async () => {
    writeFile('config.rb', 'API_KEY = "abcdefghijklmnopqrstuvwxyz"\n')
    const r = await securityAnalyzer.analyze(ctx())
    expect(r.tasks[2].done).toBe(false)
  })

  it('secrets in .java files → flagged', async () => {
    writeFile('src/Config.java', 'String token = "abcdefghijklmnopqrstuvwxyz";\n')
    const r = await securityAnalyzer.analyze(ctx())
    expect(r.tasks[2].done).toBe(false)
  })

  it('AWS key in .py file → flagged', async () => {
    writeFile('src/aws.py', 'access_key = "AKIAI44QH8DHBEXAMPLE"\n')
    const r = await securityAnalyzer.analyze(ctx())
    expect(r.tasks[2].done).toBe(false)
  })

  it('Stripe key in .go file → flagged', async () => {
    const stripeKey = ['sk', 'live'].join('_') + '_abcdefghijklmnopqrstuvwx'
    writeFile('payment.go', `key := "${stripeKey}"\n`)
    const r = await securityAnalyzer.analyze(ctx())
    expect(r.tasks[2].done).toBe(false)
  })

  it('safe .py file with env vars → not flagged', async () => {
    writeFile('src/config.py', 'api_key = os.environ.get("API_KEY")\n')
    const r = await securityAnalyzer.analyze(ctx())
    expect(r.tasks[2].done).toBe(true)
  })
})

describe('security analyzer — stress / edge cases', () => {
  it('node_modules is skipped for secret scanning', async () => {
    writeFile('node_modules/bad-lib/index.ts', 'const api_key = "abcdefghijklmnopqrstuvwxyz"\n')
    const r = await securityAnalyzer.analyze(ctx())
    expect(r.tasks[2].done).toBe(true) // no secrets in src
  })

  it('.git directory is skipped', async () => {
    writeFile('.git/config.ts', 'const secret = "abcdefghijklmnopqrstuvwxyz"\n')
    const r = await securityAnalyzer.analyze(ctx())
    expect(r.tasks[2].done).toBe(true)
  })

  it('non-js/ts files are skipped for secret scanning', async () => {
    writeFile('src/secrets.md', 'api_key = "abcdefghijklmnopqrstuvwxyz"\n')
    const r = await securityAnalyzer.analyze(ctx())
    expect(r.tasks[2].done).toBe(true)
  })

  it('.gitignore with leading/trailing whitespace around .env', async () => {
    writeFile('.gitignore', '  .env  \n')
    const r = await securityAnalyzer.analyze(ctx())
    // .trim() is applied, so "  .env  " → ".env" should match
    expect(r.tasks[0].done).toBe(true)
  })

  it('.gitignore with .env.local but not .env → env-ignored=false', async () => {
    writeFile('.gitignore', '.env.local\n')
    const r = await securityAnalyzer.analyze(ctx())
    expect(r.tasks[0].done).toBe(false) // needs exact ".env"
  })

  it('multiple secrets across files — still caught', async () => {
    writeFile('src/a.ts', 'const x = "safe"\n')
    writeFile('src/b.ts', 'const token = "abcdefghijklmnopqrstuvwx"\n')
    const r = await securityAnalyzer.analyze(ctx())
    expect(r.tasks[2].done).toBe(false)
  })

  it('deeply nested secret → caught', async () => {
    writeFile('src/lib/deep/nested/config.ts', 'const api_key = "abcdefghijklmnopqrstuvwxyz"\n')
    const r = await securityAnalyzer.analyze(ctx())
    expect(r.tasks[2].done).toBe(false)
  })

  it('worst case: .env exists + secrets in code + no gitignore + no lockfile → 0%', async () => {
    writeFile('.env', 'SECRET=bad')
    writeFile('src/config.ts', 'const api_key = "abcdefghijklmnopqrstuvwxyz"\n')
    const r = await securityAnalyzer.analyze(ctx())
    expect(r.percent).toBe(0)
    expect(r.tasks.every((t) => !t.done)).toBe(true)
  })

  it('best case: all good → 100%', async () => {
    writeFile('.gitignore', '.env\nnode_modules\n')
    writeFile('package-lock.json', '{}')
    writeFile('src/index.ts', 'const key = process.env.API_KEY\n')
    const r = await securityAnalyzer.analyze(ctx())
    expect(r.percent).toBe(100)
  })

  it('very large source file with no secrets', async () => {
    const big = '// safe code\n'.repeat(100_000)
    writeFile('src/big.ts', big)
    const r = await securityAnalyzer.analyze(ctx())
    expect(r.tasks[2].done).toBe(true)
  })

  it('AWS key embedded in middle of large file → caught', async () => {
    const before = '// code\n'.repeat(5_000)
    const after = '// more\n'.repeat(5_000)
    writeFile('src/big.ts', before + 'const k = "AKIAI44QH8DHBEXAMPLE"\n' + after)
    const r = await securityAnalyzer.analyze(ctx())
    expect(r.tasks[2].done).toBe(false)
  })
})
