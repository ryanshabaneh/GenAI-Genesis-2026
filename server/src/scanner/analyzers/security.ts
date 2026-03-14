import fs from 'fs'
import path from 'path'
import type { Analyzer, AnalyzerContext } from './base'
import type { AnalyzerResult, Task } from '../../types'

// Patterns that suggest an API key or secret might be hardcoded
const SECRET_PATTERN = /(api[_-]?key|secret|password|token)\s*=\s*["'][^"']{8,}/i

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
      } else if (entry.isFile() && /\.[jt]sx?$/.test(entry.name)) {
        try {
          const src = fs.readFileSync(full, 'utf8')
          if (SECRET_PATTERN.test(src)) {
            found = true
          }
        } catch { /* ignore */ }
      }
    }
  }

  walk(dir)
  return found
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

    // Check if .env is actually tracked (bad!) by checking .git index
    // Simple heuristic: just check if .env file exists in repo root (shallow clone won't have git db easily)
    const envTracked = fs.existsSync(path.join(ctx.repoPath, '.env'))

    const noSecretPatterns = !scanForSecrets(ctx.repoPath)

    const tasks: Task[] = [
      { id: 'security-gitignore', label: '.gitignore file exists', done: hasGitignore },
      { id: 'security-env-ignored', label: '.env listed in .gitignore', done: envInGitignore },
      { id: 'security-env-not-committed', label: '.env not committed to repo', done: !envTracked },
      { id: 'security-no-secrets', label: 'No obvious hardcoded secrets found', done: noSecretPatterns },
    ]

    const percent = tasks.filter((t) => t.done).length * 25

    return {
      buildingId: 'security',
      percent,
      tasks,
      details: { hasGitignore, envInGitignore, envTracked, noSecretPatterns },
    }
  },
}
