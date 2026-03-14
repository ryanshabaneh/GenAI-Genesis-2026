import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { loggingAnalyzer } from '../logging'
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
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'logging-test-'))
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

// ─── Execution-plan spec ──────────────────────────────────────────────────
// logging.ts — Watchtower
// Task 1: Structured logging library installed (winston/pino/etc) → +25%
// Task 2: Logging library imported in source files               → +25%
// Task 3: Structured/JSON logging format configured              → +25%
// Task 4: Logger config file found                               → +25%

describe('logging analyzer — structural', () => {
  it('always returns exactly 4 tasks', async () => {
    const r = await loggingAnalyzer.analyze(ctx())
    expect(r.tasks).toHaveLength(4)
  })

  it('has buildingId "logging"', async () => {
    const r = await loggingAnalyzer.analyze(ctx())
    expect(r.buildingId).toBe('logging')
  })

  it('percent equals done-count * 25', async () => {
    const r = await loggingAnalyzer.analyze(ctx())
    expect(r.percent).toBe(r.tasks.filter((t) => t.done).length * 25)
  })

  it('expected task ids match plan', async () => {
    const r = await loggingAnalyzer.analyze(ctx())
    const ids = r.tasks.map((t) => t.id)
    expect(ids).toEqual(['logging-dep', 'logging-import', 'logging-json', 'logging-config'])
  })
})

describe('logging analyzer — normal scenarios', () => {
  it('empty repo, null package.json → 0%', async () => {
    const r = await loggingAnalyzer.analyze(ctx())
    expect(r.percent).toBe(0)
    expect(r.tasks.every((t) => !t.done)).toBe(true)
  })

  it('winston in deps → dep=true, others false → 25%', async () => {
    const pkg = { dependencies: { winston: '^3.0.0' } }
    const r = await loggingAnalyzer.analyze(ctx(pkg))
    expect(r.percent).toBe(25)
    expect(r.tasks[0].done).toBe(true)
    expect(r.tasks[1].done).toBe(false)
  })

  it('pino in devDeps → dep=true', async () => {
    const pkg = { devDependencies: { pino: '^8.0.0' } }
    const r = await loggingAnalyzer.analyze(ctx(pkg))
    expect(r.tasks[0].done).toBe(true)
  })

  it('dep + import → 50%', async () => {
    const pkg = { dependencies: { winston: '^3.0.0' } }
    writeFile('src/app.ts', "import winston from 'winston'\nconst log = winston.createLogger()\n")
    const r = await loggingAnalyzer.analyze(ctx(pkg))
    expect(r.percent).toBe(50)
    expect(r.tasks[0].done).toBe(true) // dep
    expect(r.tasks[1].done).toBe(true) // import
  })

  it('dep + import + JSON logging → 75%', async () => {
    const pkg = { dependencies: { winston: '^3.0.0' } }
    writeFile('src/app.js', "const winston = require('winston')\nconst l = winston.createLogger({ format: winston.format.json() })\n")
    const r = await loggingAnalyzer.analyze(ctx(pkg))
    expect(r.percent).toBe(75)
    expect(r.tasks[0].done).toBe(true)
    expect(r.tasks[1].done).toBe(true)
    expect(r.tasks[2].done).toBe(true) // .json()
    expect(r.tasks[3].done).toBe(false) // no config file named logger.ts/etc
  })

  it('full setup → 100%', async () => {
    const pkg = { dependencies: { winston: '^3.0.0' } }
    writeFile('src/logger.ts', "import winston from 'winston'\nexport default winston.createLogger({ format: winston.format.json() })\n")
    const r = await loggingAnalyzer.analyze(ctx(pkg))
    expect(r.percent).toBe(100)
    expect(r.tasks.every((t) => t.done)).toBe(true)
  })
})

describe('logging analyzer — import detection', () => {
  it('require("winston") detected', async () => {
    writeFile('src/index.ts', "const w = require('winston')\n")
    const r = await loggingAnalyzer.analyze(ctx())
    expect(r.tasks[1].done).toBe(true)
  })

  it('require("pino") detected', async () => {
    writeFile('src/index.ts', "const pino = require('pino')\n")
    const r = await loggingAnalyzer.analyze(ctx())
    expect(r.tasks[1].done).toBe(true)
  })

  it('import pino from "pino" detected', async () => {
    writeFile('src/app.ts', 'import pino from "pino"\n')
    const r = await loggingAnalyzer.analyze(ctx())
    expect(r.tasks[1].done).toBe(true)
  })

  it('import { createLogger } from "winston" detected', async () => {
    writeFile('src/app.ts', 'import { createLogger } from "winston"\n')
    const r = await loggingAnalyzer.analyze(ctx())
    expect(r.tasks[1].done).toBe(true)
  })

  it('unrelated imports are not detected', async () => {
    writeFile('src/app.ts', "import express from 'express'\n")
    const r = await loggingAnalyzer.analyze(ctx())
    expect(r.tasks[1].done).toBe(false)
  })

  it('falls back to repoPath when src/ does not exist', async () => {
    writeFile('app.ts', "import winston from 'winston'\n")
    const r = await loggingAnalyzer.analyze(ctx())
    expect(r.tasks[1].done).toBe(true)
  })
})

describe('logging analyzer — JSON logging detection', () => {
  it('.json() call detected', async () => {
    writeFile('src/logger.ts', 'format.json()\n')
    const r = await loggingAnalyzer.analyze(ctx())
    expect(r.tasks[2].done).toBe(true)
  })

  it('JSON.stringify in logger config detected', async () => {
    writeFile('src/logger.ts', 'const msg = JSON.stringify({ level, message })\n')
    const r = await loggingAnalyzer.analyze(ctx())
    expect(r.tasks[2].done).toBe(true)
  })

  it('format: "json" detected (case-insensitive)', async () => {
    writeFile('src/config.ts', "const logCfg = { format: 'JSON' }\n")
    const r = await loggingAnalyzer.analyze(ctx())
    expect(r.tasks[2].done).toBe(true)
  })

  it('pino() call detected as structured logging', async () => {
    writeFile('src/logger.ts', "const logger = pino()\n")
    const r = await loggingAnalyzer.analyze(ctx())
    expect(r.tasks[2].done).toBe(true)
  })

  it('no matching patterns → false', async () => {
    writeFile('src/logger.ts', 'console.log("hello")\n')
    const r = await loggingAnalyzer.analyze(ctx())
    expect(r.tasks[2].done).toBe(false)
  })
})

describe('logging analyzer — config file detection', () => {
  it('logger.ts in root → found', async () => {
    writeFile('logger.ts', 'export default {}\n')
    const r = await loggingAnalyzer.analyze(ctx())
    expect(r.tasks[3].done).toBe(true)
  })

  it('logger.js nested in src/ → found', async () => {
    writeFile('src/logger.js', 'module.exports = {}\n')
    const r = await loggingAnalyzer.analyze(ctx())
    expect(r.tasks[3].done).toBe(true)
  })

  it('logging.ts → found', async () => {
    writeFile('logging.ts', 'export default {}\n')
    const r = await loggingAnalyzer.analyze(ctx())
    expect(r.tasks[3].done).toBe(true)
  })

  it('log.js → found', async () => {
    writeFile('log.js', 'module.exports = {}\n')
    const r = await loggingAnalyzer.analyze(ctx())
    expect(r.tasks[3].done).toBe(true)
  })

  it('unrelated file name → not found', async () => {
    writeFile('utils.ts', 'export default {}\n')
    const r = await loggingAnalyzer.analyze(ctx())
    expect(r.tasks[3].done).toBe(false)
  })
})

describe('logging analyzer — Python support', () => {
  it('loguru in requirements.txt → dep detected', async () => {
    writeFile('requirements.txt', 'flask==2.0\nloguru==0.7\n')
    const r = await loggingAnalyzer.analyze(ctx())
    expect(r.tasks[0].done).toBe(true)
  })

  it('structlog in requirements.txt → dep detected', async () => {
    writeFile('requirements.txt', 'structlog\nrequests\n')
    const r = await loggingAnalyzer.analyze(ctx())
    expect(r.tasks[0].done).toBe(true)
  })

  it('import logging in .py → import detected', async () => {
    writeFile('src/app.py', 'import logging\nlogger = logging.getLogger(__name__)\n')
    const r = await loggingAnalyzer.analyze(ctx())
    expect(r.tasks[1].done).toBe(true)
  })

  it('from loguru import logger → import detected', async () => {
    writeFile('src/main.py', 'from loguru import logger\n')
    const r = await loggingAnalyzer.analyze(ctx())
    expect(r.tasks[1].done).toBe(true)
  })

  it('import structlog → import detected', async () => {
    writeFile('app.py', 'import structlog\nlog = structlog.get_logger()\n')
    const r = await loggingAnalyzer.analyze(ctx())
    expect(r.tasks[1].done).toBe(true)
  })

  it('structlog.processors → JSON logging detected', async () => {
    writeFile('src/log.py', 'structlog.processors.JSONRenderer()\n')
    const r = await loggingAnalyzer.analyze(ctx())
    expect(r.tasks[2].done).toBe(true)
  })

  it('logging.conf → config file detected', async () => {
    writeFile('logging.conf', '[loggers]\nkeys=root\n')
    const r = await loggingAnalyzer.analyze(ctx())
    expect(r.tasks[3].done).toBe(true)
  })

  it('logging.yaml → config file detected', async () => {
    writeFile('logging.yaml', 'version: 1\nhandlers:\n  console:\n')
    const r = await loggingAnalyzer.analyze(ctx())
    expect(r.tasks[3].done).toBe(true)
  })
})

describe('logging analyzer — Go support', () => {
  it('go.uber.org/zap in go.mod → dep detected', async () => {
    writeFile('go.mod', 'module myapp\n\nrequire go.uber.org/zap v1.27.0\n')
    const r = await loggingAnalyzer.analyze(ctx())
    expect(r.tasks[0].done).toBe(true)
  })

  it('github.com/sirupsen/logrus in go.mod → dep detected', async () => {
    writeFile('go.mod', 'module myapp\n\nrequire github.com/sirupsen/logrus v1.9.0\n')
    const r = await loggingAnalyzer.analyze(ctx())
    expect(r.tasks[0].done).toBe(true)
  })

  it('"go.uber.org/zap" import in .go file → import detected', async () => {
    writeFile('src/main.go', 'import "go.uber.org/zap"\nfunc main() { zap.NewProduction() }\n')
    const r = await loggingAnalyzer.analyze(ctx())
    expect(r.tasks[1].done).toBe(true)
  })

  it('zap.NewProduction → JSON logging detected', async () => {
    writeFile('src/logger.go', 'logger, _ := zap.NewProduction()\n')
    const r = await loggingAnalyzer.analyze(ctx())
    expect(r.tasks[2].done).toBe(true)
  })

  it('zerolog usage → JSON logging detected', async () => {
    writeFile('src/main.go', 'log := zerolog.New(os.Stdout)\n')
    const r = await loggingAnalyzer.analyze(ctx())
    expect(r.tasks[2].done).toBe(true)
  })
})

describe('logging analyzer — stress / edge cases', () => {
  it('node_modules directory is skipped for import scan', async () => {
    writeFile('node_modules/winston/index.js', "module.exports = require('winston')\n")
    const r = await loggingAnalyzer.analyze(ctx())
    expect(r.tasks[1].done).toBe(false)
  })

  it('.git directory is skipped', async () => {
    writeFile('.git/hooks/pre-commit.js', "import winston from 'winston'\n")
    const r = await loggingAnalyzer.analyze(ctx())
    expect(r.tasks[1].done).toBe(false)
  })

  it('non-js/ts files are skipped for import scan', async () => {
    writeFile('src/notes.md', "import winston from 'winston'\n")
    const r = await loggingAnalyzer.analyze(ctx())
    expect(r.tasks[1].done).toBe(false)
  })

  it('deeply nested logger config file found', async () => {
    writeFile('src/lib/core/logger.ts', 'export const logger = {}\n')
    const r = await loggingAnalyzer.analyze(ctx())
    expect(r.tasks[3].done).toBe(true)
  })

  it('all deps checked: bunyan, log4js, morgan, loglevel', async () => {
    for (const dep of ['bunyan', 'log4js', 'morgan', 'loglevel']) {
      const pkg = { dependencies: { [dep]: '^1.0.0' } }
      const r = await loggingAnalyzer.analyze(ctx(pkg))
      expect(r.tasks[0].done).toBe(true)
    }
  })

  it('package.json with no deps → dep=false', async () => {
    const pkg = { name: 'test', scripts: {} }
    const r = await loggingAnalyzer.analyze(ctx(pkg))
    expect(r.tasks[0].done).toBe(false)
  })

  it('large source file still scans for imports', async () => {
    const big = "import pino from 'pino'\n" + '// filler\n'.repeat(50_000)
    writeFile('src/big.ts', big)
    const r = await loggingAnalyzer.analyze(ctx())
    expect(r.tasks[1].done).toBe(true)
  })
})
