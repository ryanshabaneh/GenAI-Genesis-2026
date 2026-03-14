import fs from 'fs'
import path from 'path'
import type { Analyzer, AnalyzerContext } from './base'
import type { AnalyzerResult, Task } from '../../types'

const DOTENV_DEPS = ['dotenv', 'dotenv-safe', 'dotenv-flow', 'env-var']

function hasDepInPackageJson(pkg: Record<string, unknown> | null, names: string[]): boolean {
  if (!pkg) return false
  const deps = {
    ...(typeof pkg['dependencies'] === 'object' ? (pkg['dependencies'] as Record<string, unknown>) : {}),
    ...(typeof pkg['devDependencies'] === 'object' ? (pkg['devDependencies'] as Record<string, unknown>) : {}),
  }
  return names.some((name) => name in deps)
}

export const envVarsAnalyzer: Analyzer = {
  buildingId: 'envVars',

  async analyze(ctx: AnalyzerContext): Promise<AnalyzerResult> {
    const hasEnvExample = fs.existsSync(path.join(ctx.repoPath, '.env.example'))

    let envInGitignore = false
    const gitignorePath = path.join(ctx.repoPath, '.gitignore')
    if (fs.existsSync(gitignorePath)) {
      const content = await fs.promises.readFile(gitignorePath, 'utf8')
      envInGitignore = content.split('\n').some((line) => line.trim() === '.env')
    }

    // Check for hardcoded localhost:PORT patterns (e.g., 'localhost:3000' literally in source)
    // Simple heuristic — scan .js/.ts files in src/ for hardcoded localhost URLs
    let noHardcodedPorts = true
    const srcDir = path.join(ctx.repoPath, 'src')
    if (fs.existsSync(srcDir)) {
      const checkDir = (dir: string) => {
        let entries: fs.Dirent[]
        try {
          entries = fs.readdirSync(dir, { withFileTypes: true })
        } catch {
          return
        }
        for (const entry of entries) {
          if (entry.name === 'node_modules') continue
          const full = path.join(dir, entry.name)
          if (entry.isDirectory()) {
            checkDir(full)
          } else if (entry.isFile() && /\.[jt]sx?$/.test(entry.name)) {
            try {
              const src = fs.readFileSync(full, 'utf8')
              if (/localhost:\d{4,5}/.test(src)) {
                noHardcodedPorts = false
              }
            } catch { /* ignore */ }
          }
        }
      }
      checkDir(srcDir)
    }

    const hasDotenvDep = hasDepInPackageJson(ctx.packageJson, DOTENV_DEPS)

    const tasks: Task[] = [
      { id: 'env-example', label: '.env.example file exists', done: hasEnvExample },
      { id: 'env-gitignore', label: '.env in .gitignore', done: envInGitignore },
      { id: 'env-no-hardcode', label: 'No hardcoded localhost ports in source', done: noHardcodedPorts },
      { id: 'env-dotenv', label: 'dotenv or similar dep installed', done: hasDotenvDep },
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
