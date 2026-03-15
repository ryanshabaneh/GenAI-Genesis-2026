import fs from 'fs'
import path from 'path'
import type { Analyzer, AnalyzerContext } from './base'
import type { AnalyzerResult, Task } from '../../types'

const NODE_DOTENV_DEPS = ['dotenv', 'dotenv-safe', 'dotenv-flow', 'env-var']
const PYTHON_DOTENV_DEPS = ['python-dotenv', 'environs', 'django-environ', 'decouple']
const GO_DOTENV_MODS = ['github.com/joho/godotenv', 'github.com/caarlos0/env']

function hasDepInPackageJson(pkg: Record<string, unknown> | null, names: string[]): boolean {
  if (!pkg) return false
  const deps = {
    ...(typeof pkg['dependencies'] === 'object' ? (pkg['dependencies'] as Record<string, unknown>) : {}),
    ...(typeof pkg['devDependencies'] === 'object' ? (pkg['devDependencies'] as Record<string, unknown>) : {}),
  }
  return names.some((name) => name in deps)
}

function hasDotenvInRequirements(repoPath: string): boolean {
  const reqFile = path.join(repoPath, 'requirements.txt')
  if (!fs.existsSync(reqFile)) return false
  try {
    const content = fs.readFileSync(reqFile, 'utf8').toLowerCase()
    return PYTHON_DOTENV_DEPS.some((d) => content.includes(d))
  } catch { return false }
}

function hasDotenvInGoMod(repoPath: string): boolean {
  const goMod = path.join(repoPath, 'go.mod')
  if (!fs.existsSync(goMod)) return false
  try {
    const content = fs.readFileSync(goMod, 'utf8')
    return GO_DOTENV_MODS.some((m) => content.includes(m))
  } catch { return false }
}

/** Check if a file exists in any immediate subdirectory (monorepo support) */
function findInSubdirs(repoPath: string, filename: string): boolean {
  const skip = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '.cache'])
  try {
    for (const entry of fs.readdirSync(repoPath, { withFileTypes: true })) {
      if (!entry.isDirectory() || skip.has(entry.name)) continue
      if (fs.existsSync(path.join(repoPath, entry.name, filename))) return true
    }
  } catch {}
  return false
}

const SOURCE_EXT = /\.[jt]sx?$|\.py$|\.go$|\.rb$/

export const envVarsAnalyzer: Analyzer = {
  buildingId: 'envVars',

  async analyze(ctx: AnalyzerContext): Promise<AnalyzerResult> {
    const hasEnvExample =
      fs.existsSync(path.join(ctx.repoPath, '.env.example')) ||
      fs.existsSync(path.join(ctx.repoPath, '.env.template')) ||
      findInSubdirs(ctx.repoPath, '.env.example') ||
      findInSubdirs(ctx.repoPath, '.env.template')

    let envInGitignore = false
    const gitignorePath = path.join(ctx.repoPath, '.gitignore')
    if (fs.existsSync(gitignorePath)) {
      const content = await fs.promises.readFile(gitignorePath, 'utf8')
      envInGitignore = content.split('\n').some((line) => line.trim() === '.env')
    }

    let noHardcodedPorts = true
    const srcDir = path.join(ctx.repoPath, 'src')
    const searchDir = fs.existsSync(srcDir) ? srcDir : ctx.repoPath
    const checkDir = (dir: string) => {
      let entries: fs.Dirent[]
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true })
      } catch {
        return
      }
      for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          checkDir(full)
        } else if (entry.isFile() && SOURCE_EXT.test(entry.name)) {
          try {
            const src = fs.readFileSync(full, 'utf8')
            if (/localhost:\d{4,5}/.test(src)) {
              noHardcodedPorts = false
            }
          } catch { /* ignore */ }
        }
      }
    }
    checkDir(searchDir)

    const hasDotenvDep =
      hasDepInPackageJson(ctx.packageJson, NODE_DOTENV_DEPS) ||
      hasDotenvInRequirements(ctx.repoPath) ||
      hasDotenvInGoMod(ctx.repoPath)

    const tasks: Task[] = [
      { id: 'env-example', label: '.env.example or .env.template exists', done: hasEnvExample },
      { id: 'env-gitignore', label: '.env in .gitignore', done: envInGitignore },
      { id: 'env-no-hardcode', label: 'No hardcoded localhost ports in source', done: noHardcodedPorts },
      { id: 'env-dotenv', label: 'dotenv or env management library installed', done: hasDotenvDep },
    ]

    const percent = tasks.filter((t) => t.done).length * 25

    return {
      buildingId: 'envVars',
      percent,
      tasks,
      details: { hasEnvExample, envInGitignore, noHardcodedPorts, hasDotenvDep },
    }
  },
}
