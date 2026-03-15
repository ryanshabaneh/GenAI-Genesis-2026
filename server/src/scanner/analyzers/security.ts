import fs from 'fs'
import path from 'path'
import type { Analyzer, AnalyzerContext } from './base'
import type { AnalyzerResult, Task } from '../../types'

const SECRET_PATTERNS: RegExp[] = [
  /(?:api_key|apikey|secret|token)\s*=\s*['"][a-zA-Z0-9]{16,}/i,
  /AKIA[0-9A-Z]{16}/,
  /sk_live_[a-zA-Z0-9]{24,}/,
]

const ENV_SECRET_PATTERN =
  /^[A-Z_]*(KEY|SECRET|TOKEN|PASSWORD|PRIVATE|CREDENTIAL)[A-Z_]*\s*=\s*\S{8,}/m

const SOURCE_EXT = /\.[jt]sx?$|\.py$|\.go$|\.rb$|\.java$/

function scanForSecrets(dir: string): boolean {
  let found = false

  const walk = (current: string) => {
    if (found) return
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(current, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) {
        walk(full)
      } else if (entry.isFile()) {
        if (SOURCE_EXT.test(entry.name)) {
          try {
            const src = fs.readFileSync(full, 'utf8')
            if (SECRET_PATTERNS.some((p) => p.test(src))) found = true
          } catch { /* ignore */ }
        } else if (/^\.env($|\.)/.test(entry.name)) {
          try {
            const src = fs.readFileSync(full, 'utf8')
            if (SECRET_PATTERNS.some((p) => p.test(src))) found = true
            if (ENV_SECRET_PATTERN.test(src)) found = true
          } catch { /* ignore */ }
        }
      }
    }
  }

  walk(dir)
  return found
}

const LOCKFILES = [
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'go.sum',
  'Gemfile.lock',
  'poetry.lock',
  'Pipfile.lock',
]

function hasLockfileInSubdirs(repoPath: string): boolean {
  const skip = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '.cache'])
  try {
    for (const entry of fs.readdirSync(repoPath, { withFileTypes: true })) {
      if (!entry.isDirectory() || skip.has(entry.name)) continue
      if (LOCKFILES.some((f) => fs.existsSync(path.join(repoPath, entry.name, f)))) return true
    }
  } catch {}
  return false
}

export const securityAnalyzer: Analyzer = {
  buildingId: 'security',

  async analyze(ctx: AnalyzerContext): Promise<AnalyzerResult> {
    const gitignorePath = path.join(ctx.repoPath, '.gitignore')
    const hasGitignore = fs.existsSync(gitignorePath)

    let envInGitignore = false
    if (hasGitignore) {
      const content = await fs.promises.readFile(gitignorePath, 'utf8')
      envInGitignore = content.split('\n').some((line) => line.trim() === '.env')
    }

    const envTracked = fs.existsSync(path.join(ctx.repoPath, '.env'))
    const noSecretPatterns = !scanForSecrets(ctx.repoPath)
    const hasLockfile = LOCKFILES.some((f) => fs.existsSync(path.join(ctx.repoPath, f))) ||
      hasLockfileInSubdirs(ctx.repoPath)

    const tasks: Task[] = [
      { id: 'security-env-ignored', label: '.env listed in .gitignore', done: envInGitignore },
      { id: 'security-env-not-committed', label: '.env not committed to repo', done: !envTracked },
      { id: 'security-no-secrets', label: 'No hardcoded secrets (API keys, AWS, Stripe)', done: noSecretPatterns },
      { id: 'security-lockfile', label: 'Dependency lockfile exists (audit possible)', done: hasLockfile },
    ]

    const percent = tasks.filter((t) => t.done).length * 25

    return {
      buildingId: 'security',
      percent,
      tasks,
      details: { hasGitignore, envInGitignore, envTracked, noSecretPatterns, hasLockfile, envScanned: true },
    }
  },
}
