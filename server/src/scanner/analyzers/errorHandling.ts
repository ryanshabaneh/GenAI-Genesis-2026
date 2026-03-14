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

export const errorHandlingAnalyzer: Analyzer = {
  buildingId: 'errorHandling',

  async analyze(ctx: AnalyzerContext): Promise<AnalyzerResult> {
    // try/catch present anywhere in source
    const hasTryCatch = grepSource(ctx.repoPath, /try\s*\{/)

    // Express error middleware: app.use with 4-param function (err, req, res, next)
    const hasErrorMiddleware = grepSource(
      ctx.repoPath,
      /app\.use\s*\(\s*\(?\s*(err|error)\s*,\s*req/
    )

    // process.on uncaughtException / unhandledRejection
    const hasProcessHandlers = grepSource(
      ctx.repoPath,
      /process\.on\s*\(\s*['"]uncaughtException|process\.on\s*\(\s*['"]unhandledRejection/
    )

    const tasks: Task[] = [
      { id: 'error-trycatch', label: 'try/catch used in source files', done: hasTryCatch },
      { id: 'error-middleware', label: 'Express error middleware defined', done: hasErrorMiddleware },
      { id: 'error-process', label: 'process.on uncaught exception handler', done: hasProcessHandlers },
    ]

    // try/catch is worth 50%, each of the others 25%
    let percent = 0
    if (hasTryCatch) percent += 50
    if (hasErrorMiddleware) percent += 25
    if (hasProcessHandlers) percent += 25

    return {
      buildingId: 'errorHandling',
      percent,
      tasks,
      details: { hasTryCatch, hasErrorMiddleware, hasProcessHandlers },
    }
  },
}
