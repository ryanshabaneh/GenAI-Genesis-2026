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
]

const PROCFILE_FILES = ['Procfile', 'Aptfile']

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
    const hasDeployScript = 'deploy' in scripts || 'predeploy' in scripts

    const hasProcfile = PROCFILE_FILES.some((name) =>
      fs.existsSync(path.join(ctx.repoPath, name))
    )

    const tasks: Task[] = [
      { id: 'deploy-config', label: 'Deployment config file found (vercel.json, fly.toml, etc.)', done: hasDeployConfig },
      { id: 'deploy-script', label: '"deploy" script in package.json', done: hasDeployScript },
      { id: 'deploy-procfile', label: 'Procfile or equivalent exists', done: hasProcfile },
    ]

    // deploy config 50%, script 25%, procfile 25%
    let percent = 0
    if (hasDeployConfig) percent += 50
    if (hasDeployScript) percent += 25
    if (hasProcfile) percent += 25

    return {
      buildingId: 'deployment',
      percent,
      tasks,
      details: { hasDeployConfig, hasDeployScript, hasProcfile },
    }
  },
}
