import fs from 'fs'
import path from 'path'
import type { Analyzer, AnalyzerContext } from './base'
import type { AnalyzerResult, Task } from '../../types'

const TEST_DEPS = ['jest', 'vitest', 'mocha', '@jest/core', 'jasmine', 'ava']
const TEST_FILE_PATTERNS = [/\.test\.[jt]sx?$/, /\.spec\.[jt]sx?$/]

function hasTestDep(pkg: Record<string, unknown> | null): boolean {
  if (!pkg) return false
  const deps = {
    ...(typeof pkg['dependencies'] === 'object' ? (pkg['dependencies'] as Record<string, unknown>) : {}),
    ...(typeof pkg['devDependencies'] === 'object' ? (pkg['devDependencies'] as Record<string, unknown>) : {}),
  }
  return TEST_DEPS.some((dep) => dep in deps)
}

function findTestFiles(dir: string, found: string[] = []): string[] {
  if (!fs.existsSync(dir)) return found

  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return found
  }

  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') {
        // Count all files in __tests__
        try {
          const inner = fs.readdirSync(fullPath)
          found.push(...inner.map((f) => path.join(fullPath, f)))
        } catch { /* ignore */ }
      } else {
        findTestFiles(fullPath, found)
      }
    } else if (entry.isFile() && TEST_FILE_PATTERNS.some((p) => p.test(entry.name))) {
      found.push(fullPath)
    }
  }

  return found
}

export const testsAnalyzer: Analyzer = {
  buildingId: 'tests',

  async analyze(ctx: AnalyzerContext): Promise<AnalyzerResult> {
    const hasDep = hasTestDep(ctx.packageJson)

    const testFiles = findTestFiles(ctx.repoPath)
    const hasTestFiles = testFiles.length > 0
    const hasManyTests = testFiles.length > 3

    const scripts =
      ctx.packageJson &&
      typeof ctx.packageJson['scripts'] === 'object' &&
      ctx.packageJson['scripts'] !== null
        ? (ctx.packageJson['scripts'] as Record<string, unknown>)
        : {}
    const hasTestScript = 'test' in scripts

    const tasks: Task[] = [
      { id: 'tests-dep', label: 'Test framework dependency installed', done: hasDep },
      { id: 'tests-files', label: 'Test files present in repo', done: hasTestFiles },
      { id: 'tests-script', label: '"test" script in package.json', done: hasTestScript },
      { id: 'tests-coverage', label: 'More than 3 test files', done: hasManyTests },
    ]

    const percent = tasks.filter((t) => t.done).length * 25

    return {
      buildingId: 'tests',
      percent,
      tasks,
      details: { hasDep, testFileCount: testFiles.length, hasTestScript },
    }
  },
}
