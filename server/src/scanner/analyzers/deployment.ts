import fs from 'fs'
import path from 'path'
import type { Analyzer, AnalyzerContext } from './base'
import type { AnalyzerResult, Task } from '../../types'

const DEPLOY_CONFIG_FILES = [
  'vercel.json',
  'railway.toml',
  'railway.json',
  'fly.toml',
  'render.yaml',
  'netlify.toml',
  'Procfile',
]

const SOURCE_FILE_EXT = /\.[jt]sx?$|\.py$|\.go$|\.rb$/
const PORT_PATTERNS = [
  /process\.env\.PORT/,                         // Node
  /os\.environ(?:\.get)?\s*[\(\[]\s*['"]PORT['"]/,  // Python os.environ.get("PORT") / os.environ["PORT"]
  /os\.getenv\s*\(\s*['"]PORT['"]/i,            // Python os.getenv / Go os.Getenv
  /ENV\s*\[\s*['"]PORT['"]\]/,                  // Ruby
]

function usesEnvPort(repoPath: string): boolean {
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
      } else if (entry.isFile() && SOURCE_FILE_EXT.test(entry.name)) {
        try {
          const src = fs.readFileSync(full, 'utf8')
          if (PORT_PATTERNS.some((p) => p.test(src))) return true
        } catch { /* ignore */ }
      }
    }
    return false
  }
  return walk(searchDir)
}

export const deploymentAnalyzer: Analyzer = {
  buildingId: 'deployment',

  async analyze(ctx: AnalyzerContext): Promise<AnalyzerResult> {
    const hasDeployConfig = DEPLOY_CONFIG_FILES.some((name) =>
      fs.existsSync(path.join(ctx.repoPath, name))
    )

    const scripts =
      ctx.packageJson &&
      typeof ctx.packageJson['scripts'] === 'object' &&
      ctx.packageJson['scripts'] !== null
        ? (ctx.packageJson['scripts'] as Record<string, unknown>)
        : {}
    const hasBuildScript =
      'build' in scripts ||
      fs.existsSync(path.join(ctx.repoPath, 'Makefile')) ||
      fs.existsSync(path.join(ctx.repoPath, 'build.gradle')) ||
      fs.existsSync(path.join(ctx.repoPath, 'pyproject.toml'))
    const hasStartScript =
      'start' in scripts ||
      fs.existsSync(path.join(ctx.repoPath, 'Procfile')) ||
      fs.existsSync(path.join(ctx.repoPath, 'main.py')) ||
      fs.existsSync(path.join(ctx.repoPath, 'main.go'))
    const hasEnvPort = usesEnvPort(ctx.repoPath)

    const tasks: Task[] = [
      { id: 'deploy-config', label: 'Deployment config file found (vercel.json, fly.toml, Procfile, etc.)', done: hasDeployConfig },
      { id: 'deploy-build', label: 'Build system detected (package.json script, Makefile, etc.)', done: hasBuildScript },
      { id: 'deploy-start', label: 'Start entrypoint detected (start script, Procfile, main.*)', done: hasStartScript },
      { id: 'deploy-port', label: 'PORT configured via environment variable', done: hasEnvPort },
    ]

    const percent = tasks.filter((t) => t.done).length * 25

    return {
      buildingId: 'deployment',
      percent,
      tasks,
      details: { hasDeployConfig, hasBuildScript, hasStartScript, hasEnvPort },
    }
  },
}
