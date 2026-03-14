import fs from 'fs'
import path from 'path'
import type { Analyzer, AnalyzerContext } from './base'
import type { AnalyzerResult, Task } from '../../types'

function grepSource(dir: string, pattern: RegExp): boolean {
  const walk = (current: string): boolean => {
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(current, { withFileTypes: true })
    } catch {
      return false
    }
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) {
        if (walk(full)) return true
      } else if (entry.isFile() && /\.[jt]sx?$/.test(entry.name)) {
        try {
          const src = fs.readFileSync(full, 'utf8')
          if (pattern.test(src)) return true
        } catch { /* ignore */ }
      }
    }
    return false
  }
  return walk(dir)
}

export const healthCheckAnalyzer: Analyzer = {
  buildingId: 'healthCheck',

  async analyze(ctx: AnalyzerContext): Promise<AnalyzerResult> {
    const hasHealthRoute = grepSource(ctx.repoPath, /['"](\/health|\/healthz)['"]/i)

    const hasHealthResponse = grepSource(
      ctx.repoPath,
      /status['"]\s*:\s*['"]ok|status['"]\s*:\s*['"]healthy/i
    )

    const hasReadinessRoute = grepSource(
      ctx.repoPath,
      /['"](\/ready|\/readiness|\/live|\/liveness)['"]/i
    )

    const tasks: Task[] = [
      { id: 'health-route', label: '/health or /healthz route defined', done: hasHealthRoute },
      { id: 'health-response', label: 'Returns { status: "ok" } or similar', done: hasHealthResponse },
      { id: 'health-readiness', label: 'Readiness/liveness endpoint defined', done: hasReadinessRoute },
    ]

    // health route 50%, response 25%, readiness 25%
    let percent = 0
    if (hasHealthRoute) percent += 50
    if (hasHealthResponse) percent += 25
    if (hasReadinessRoute) percent += 25

    return {
      buildingId: 'healthCheck',
      percent,
      tasks,
      details: { hasHealthRoute, hasHealthResponse, hasReadinessRoute },
    }
  },
}
