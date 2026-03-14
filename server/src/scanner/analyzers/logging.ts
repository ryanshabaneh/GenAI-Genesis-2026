import fs from 'fs'
import path from 'path'
import type { Analyzer, AnalyzerContext } from './base'
import type { AnalyzerResult, Task } from '../../types'

const LOGGING_DEPS = ['winston', 'pino', 'bunyan', 'log4js', 'morgan', 'loglevel']
const LOG_CONFIG_FILES = [
  'logger.js', 'logger.ts', 'logger.mjs',
  'logging.js', 'logging.ts',
  'log.js', 'log.ts',
]

function hasDepInPackageJson(pkg: Record<string, unknown> | null, names: string[]): boolean {
  if (!pkg) return false
  const deps = {
    ...(typeof pkg['dependencies'] === 'object' ? (pkg['dependencies'] as Record<string, unknown>) : {}),
    ...(typeof pkg['devDependencies'] === 'object' ? (pkg['devDependencies'] as Record<string, unknown>) : {}),
  }
  return names.some((name) => name in deps)
}

function hasConsoleLog(dir: string): boolean {
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
          if (/console\.log\s*\(/.test(src)) return true
        } catch { /* ignore */ }
      }
    }
    return false
  }
  return walk(dir)
}

function findLogConfig(dir: string): boolean {
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
      } else if (entry.isFile() && LOG_CONFIG_FILES.includes(entry.name)) {
        return true
      }
    }
    return false
  }
  return walk(dir)
}

export const loggingAnalyzer: Analyzer = {
  buildingId: 'logging',

  async analyze(ctx: AnalyzerContext): Promise<AnalyzerResult> {
    const hasLoggingDep = hasDepInPackageJson(ctx.packageJson, LOGGING_DEPS)
    const noConsoleLogs = !hasConsoleLog(ctx.repoPath)
    const hasLogConfig = findLogConfig(ctx.repoPath)

    const tasks: Task[] = [
      { id: 'logging-dep', label: 'Structured logging library installed (winston/pino/etc)', done: hasLoggingDep },
      { id: 'logging-no-console', label: 'No raw console.log in source files', done: noConsoleLogs },
      { id: 'logging-config', label: 'Logger config file found', done: hasLogConfig },
    ]

    // logging dep 50%, no-console 25%, config 25%
    let percent = 0
    if (hasLoggingDep) percent += 50
    if (noConsoleLogs) percent += 25
    if (hasLogConfig) percent += 25

    return {
      buildingId: 'logging',
      percent,
      tasks,
      details: { hasLoggingDep, noConsoleLogs, hasLogConfig },
    }
  },
}
