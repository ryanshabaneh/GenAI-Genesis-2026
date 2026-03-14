import fs from 'fs'
import path from 'path'
import type { Analyzer, AnalyzerContext } from './base'
import type { AnalyzerResult, Task } from '../../types'

const NODE_TEST_DEPS = ['jest', 'vitest', 'mocha', '@jest/core', 'jasmine', 'ava']
const PYTHON_TEST_DEPS = ['pytest', 'nose', 'nose2', 'tox']
const TEST_FILE_PATTERNS = [
  /\.test\.[jt]sx?$/,
  /\.spec\.[jt]sx?$/,
  /^test_.+\.py$/,
  /^.+_test\.py$/,
  /^.+_test\.go$/,
]

function hasTestDepInPkg(pkg: Record<string, unknown> | null): boolean {
  if (!pkg) return false
  const deps = {
    ...(typeof pkg['dependencies'] === 'object' ? (pkg['dependencies'] as Record<string, unknown>) : {}),
    ...(typeof pkg['devDependencies'] === 'object' ? (pkg['devDependencies'] as Record<string, unknown>) : {}),
  }
  return NODE_TEST_DEPS.some((dep) => dep in deps)
}

function hasTestDepInRequirements(repoPath: string): boolean {
  const reqFile = path.join(repoPath, 'requirements.txt')
  if (!fs.existsSync(reqFile)) return false
  try {
    const content = fs.readFileSync(reqFile, 'utf8').toLowerCase()
    return PYTHON_TEST_DEPS.some((d) => content.includes(d))
  } catch { return false }
}

function hasGoTests(repoPath: string): boolean {
  return fs.existsSync(path.join(repoPath, 'go.mod'))
}

function hasTestDep(pkg: Record<string, unknown> | null, repoPath: string): boolean {
  return hasTestDepInPkg(pkg) || hasTestDepInRequirements(repoPath) || hasGoTests(repoPath)
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

function hasMakeTestTarget(repoPath: string): boolean {
  const makefile = path.join(repoPath, 'Makefile')
  if (!fs.existsSync(makefile)) return false
  try {
    const content = fs.readFileSync(makefile, 'utf8')
    return /^test\s*:/m.test(content)
  } catch { return false }
}

export const testsAnalyzer: Analyzer = {
  buildingId: 'tests',

  async analyze(ctx: AnalyzerContext): Promise<AnalyzerResult> {
    const hasDep = hasTestDep(ctx.packageJson, ctx.repoPath)

    const testFiles = findTestFiles(ctx.repoPath)
    const hasTestFiles = testFiles.length > 0
    const hasManyTests = testFiles.length > 3

    const scripts =
      ctx.packageJson &&
      typeof ctx.packageJson['scripts'] === 'object' &&
      ctx.packageJson['scripts'] !== null
        ? (ctx.packageJson['scripts'] as Record<string, unknown>)
        : {}
    const hasTestScript =
      'test' in scripts ||
      fs.existsSync(path.join(ctx.repoPath, 'pytest.ini')) ||
      fs.existsSync(path.join(ctx.repoPath, 'setup.cfg')) ||
      fs.existsSync(path.join(ctx.repoPath, 'tox.ini')) ||
      hasMakeTestTarget(ctx.repoPath)

    const tasks: Task[] = [
      { id: 'tests-dep', label: 'Test framework dependency installed', done: hasDep },
      { id: 'tests-files', label: 'Test files present in repo', done: hasTestFiles },
      { id: 'tests-script', label: 'Test runner configured (script, Makefile, pytest.ini, etc.)', done: hasTestScript },
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
