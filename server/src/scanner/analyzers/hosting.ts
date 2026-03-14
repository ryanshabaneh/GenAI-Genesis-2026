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

export const hostingAnalyzer: Analyzer = {
  buildingId: 'hosting',

  async analyze(ctx: AnalyzerContext): Promise<AnalyzerResult> {
    // Server binds to process.env.PORT
    const bindsToPort = grepSource(ctx.repoPath, /process\.env\.PORT/)

    // CORS setup present (cors() call or Access-Control headers)
    const hasCors = grepSource(ctx.repoPath, /cors\s*\(|Access-Control-Allow-Origin/)

    // NODE_ENV check present
    const hasNodeEnvCheck = grepSource(ctx.repoPath, /process\.env\.NODE_ENV/)

    const tasks: Task[] = [
      { id: 'hosting-port', label: 'Server binds to process.env.PORT', done: bindsToPort },
      { id: 'hosting-cors', label: 'CORS configured', done: hasCors },
      { id: 'hosting-nodeenv', label: 'NODE_ENV environment check present', done: hasNodeEnvCheck },
    ]

    // PORT 50%, cors 25%, nodeenv 25%
    let percent = 0
    if (bindsToPort) percent += 50
    if (hasCors) percent += 25
    if (hasNodeEnvCheck) percent += 25

    return {
      buildingId: 'hosting',
      percent,
      tasks,
      details: { bindsToPort, hasCors, hasNodeEnvCheck },
    }
  },
}
