import fs from 'fs'
import path from 'path'
import type { Analyzer, AnalyzerContext } from './base'
import type { AnalyzerResult, Task } from '../../types'

const NODE_LOGGING_DEPS = ['winston', 'pino', 'bunyan', 'log4js', 'morgan', 'loglevel']
const PYTHON_LOGGING_DEPS = ['loguru', 'structlog', 'python-json-logger']
const GO_LOGGING_MODS = ['go.uber.org/zap', 'github.com/sirupsen/logrus', 'github.com/rs/zerolog', 'log/slog']

const LOG_CONFIG_FILES = [
  'logger.js', 'logger.ts', 'logger.mjs',
  'logging.js', 'logging.ts',
  'log.js', 'log.ts',
  'logging.conf', 'logging.ini', 'logging.yaml', 'logging.yml',
]

const SOURCE_EXT = /\.[jt]sx?$|\.py$|\.go$/

function hasDepInPackageJson(pkg: Record<string, unknown> | null, names: string[]): boolean {
  if (!pkg) return false
  const deps = {
    ...(typeof pkg['dependencies'] === 'object' ? (pkg['dependencies'] as Record<string, unknown>) : {}),
    ...(typeof pkg['devDependencies'] === 'object' ? (pkg['devDependencies'] as Record<string, unknown>) : {}),
  }
  return names.some((name) => name in deps)
}

function hasDepInRequirements(repoPath: string): boolean {
  const reqFile = path.join(repoPath, 'requirements.txt')
  if (!fs.existsSync(reqFile)) return false
  try {
    const content = fs.readFileSync(reqFile, 'utf8').toLowerCase()
    return PYTHON_LOGGING_DEPS.some((d) => content.includes(d))
  } catch { return false }
}

function hasDepInGoMod(repoPath: string): boolean {
  const goMod = path.join(repoPath, 'go.mod')
  if (!fs.existsSync(goMod)) return false
  try {
    const content = fs.readFileSync(goMod, 'utf8')
    return GO_LOGGING_MODS.some((m) => content.includes(m))
  } catch { return false }
}

const IMPORT_PATTERN = new RegExp(
  [
    // Node: require('winston') / import ... from 'pino'
    ...NODE_LOGGING_DEPS.map((l) => `(require\\s*\\(\\s*['"]${l}['"]\\)|import\\s+.*?['"]${l}['"])`),
    // Python: import logging / from loguru import / import structlog
    String.raw`import\s+logging\b`,
    ...PYTHON_LOGGING_DEPS.map((l) => `(import\\s+${l}\\b|from\\s+${l}\\b)`),
    // Go: "go.uber.org/zap" / "github.com/sirupsen/logrus"
    ...GO_LOGGING_MODS.map((m) => `"${m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`),
  ].join('|'),
)

function hasLoggingImport(repoPath: string): boolean {
  const srcDir = path.join(repoPath, 'src')
  const searchDir = fs.existsSync(srcDir) ? srcDir : repoPath
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
      } else if (entry.isFile() && SOURCE_EXT.test(entry.name)) {
        try {
          const src = fs.readFileSync(full, 'utf8')
          if (IMPORT_PATTERN.test(src)) return true
        } catch { /* ignore */ }
      }
    }
    return false
  }
  return walk(searchDir)
}

const JSON_LOG_PATTERNS = [
  /\.json\s*\(\s*\)/,                    // winston format.json()
  /JSON\.stringify/,                      // manual JSON logging
  /format\s*:.*json/i,                   // format: 'json'
  /pino\s*\(/,                           // pino() defaults to JSON
  /JSONFormatter|json_logger/i,          // Python python-json-logger
  /structlog\.dev\.ConsoleRenderer|structlog\.processors/,  // Python structlog
  /jsonHandler|json_handler/i,           // Python JSON handler
  /zap\.NewProduction|zap\.NewDevelopment/,  // Go zap (JSON by default)
  /zerolog/,                             // Go zerolog (JSON by default)
  /logrus\.SetFormatter.*JSON|JSONFormatter/i, // Go logrus JSON
]

function hasStructuredJsonLogging(repoPath: string): boolean {
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
      } else if (entry.isFile() && SOURCE_EXT.test(entry.name)) {
        try {
          const src = fs.readFileSync(full, 'utf8')
          if (JSON_LOG_PATTERNS.some((p) => p.test(src))) return true
        } catch { /* ignore */ }
      }
    }
    return false
  }
  return walk(repoPath)
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
    const hasLoggingDep =
      hasDepInPackageJson(ctx.packageJson, NODE_LOGGING_DEPS) ||
      hasDepInRequirements(ctx.repoPath) ||
      hasDepInGoMod(ctx.repoPath)
    const hasImport = hasLoggingImport(ctx.repoPath)
    const hasJsonLogging = hasStructuredJsonLogging(ctx.repoPath)
    const hasLogConfig = findLogConfig(ctx.repoPath)

    const tasks: Task[] = [
      { id: 'logging-dep', label: 'Structured logging library installed (winston/pino/etc)', done: hasLoggingDep },
      { id: 'logging-import', label: 'Logging library imported in source files', done: hasImport },
      { id: 'logging-json', label: 'Structured/JSON logging format configured', done: hasJsonLogging },
      { id: 'logging-config', label: 'Logger config file found', done: hasLogConfig },
    ]

    const percent = tasks.filter((t) => t.done).length * 25

    return {
      buildingId: 'logging',
      percent,
      tasks,
      details: { hasLoggingDep, hasImport, hasJsonLogging, hasLogConfig },
    }
  },
}
