import fs from 'fs'
import path from 'path'
import type { Analyzer, AnalyzerContext } from './base'
import type { AnalyzerResult, Task } from '../../types'

const ESLINT_FILES = [
  '.eslintrc',
  '.eslintrc.js',
  '.eslintrc.cjs',
  '.eslintrc.json',
  '.eslintrc.yaml',
  '.eslintrc.yml',
  'eslint.config.js',
  'eslint.config.mjs',
]

const PRETTIER_FILES = [
  '.prettierrc',
  '.prettierrc.js',
  '.prettierrc.json',
  '.prettierrc.yaml',
  '.prettierrc.yml',
  'prettier.config.js',
  'prettier.config.mjs',
]

function fileExists(dir: string, names: string[]): boolean {
  return names.some((name) => fs.existsSync(path.join(dir, name)))
}

function hasEslintInPackageJson(pkg: Record<string, unknown> | null): boolean {
  if (!pkg) return false
  return 'eslintConfig' in pkg || 'eslint' in pkg
}

export const lintingAnalyzer: Analyzer = {
  buildingId: 'linting',

  async analyze(ctx: AnalyzerContext): Promise<AnalyzerResult> {
    const hasEslintFile = fileExists(ctx.repoPath, ESLINT_FILES)
    const hasEslintPkg = hasEslintInPackageJson(ctx.packageJson)
    const hasEslint = hasEslintFile || hasEslintPkg

    const hasPrettier = fileExists(ctx.repoPath, PRETTIER_FILES)

    const scripts =
      ctx.packageJson &&
      typeof ctx.packageJson['scripts'] === 'object' &&
      ctx.packageJson['scripts'] !== null
        ? (ctx.packageJson['scripts'] as Record<string, unknown>)
        : {}
    const hasLintScript = 'lint' in scripts

    const tasks: Task[] = [
      { id: 'linting-eslint', label: 'ESLint configured', done: hasEslint },
      { id: 'linting-prettier', label: 'Prettier configured', done: hasPrettier },
      { id: 'linting-script', label: 'Lint script in package.json', done: hasLintScript },
    ]

    // ESLint is worth 50%, prettier 25%, lint script 25%
    let percent = 0
    if (hasEslint) percent += 50
    if (hasPrettier) percent += 25
    if (hasLintScript) percent += 25

    return {
      buildingId: 'linting',
      percent,
      tasks,
      details: { hasEslint, hasPrettier, hasLintScript },
    }
  },
}
