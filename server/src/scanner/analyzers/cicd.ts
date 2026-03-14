import fs from 'fs'
import path from 'path'
import type { Analyzer, AnalyzerContext } from './base'
import type { AnalyzerResult, Task } from '../../types'

const OTHER_CI_CONFIGS = [
  '.gitlab-ci.yml',
  '.travis.yml',
  'Jenkinsfile',
  'bitbucket-pipelines.yml',
  'azure-pipelines.yml',
]

function collectCiFiles(repoPath: string) {
  const workflowsDir = path.join(repoPath, '.github', 'workflows')
  const hasGHWorkflows = fs.existsSync(workflowsDir)
  const circleCiDir = path.join(repoPath, '.circleci')
  const hasCircleCi = fs.existsSync(circleCiDir)

  const ciFiles: string[] = []

  if (hasGHWorkflows) {
    try {
      const files = fs
        .readdirSync(workflowsDir)
        .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
      for (const f of files) ciFiles.push(path.join(workflowsDir, f))
    } catch { /* ignore */ }
  }

  if (hasCircleCi) {
    const cfg = path.join(circleCiDir, 'config.yml')
    if (fs.existsSync(cfg)) ciFiles.push(cfg)
  }

  for (const name of OTHER_CI_CONFIGS) {
    const full = path.join(repoPath, name)
    if (fs.existsSync(full)) ciFiles.push(full)
  }

  return { hasConfig: hasGHWorkflows || hasCircleCi || ciFiles.length > 0, ciFiles }
}

const STEP_PATTERN = /\b(npm (run )?(test|build)|yarn (test|build)|pnpm (test|build)|run-tests|jest|vitest|pytest|go test|make test|make build|gradle\s+build|mvn\s+(test|package))/i
const TRIGGER_PATTERN = /on:\s*(push|pull_request|merge_request|\[.*?(push|pull_request).*?\])|on:\s*\n\s+(push|pull_request)|branches:/i

export const cicdAnalyzer: Analyzer = {
  buildingId: 'cicd',

  async analyze(ctx: AnalyzerContext): Promise<AnalyzerResult> {
    const { hasConfig, ciFiles } = collectCiFiles(ctx.repoPath)

    let hasTestOrBuildStep = false
    let hasTrigger = false
    for (const filePath of ciFiles) {
      try {
        const content = await fs.promises.readFile(filePath, 'utf8')
        if (STEP_PATTERN.test(content)) hasTestOrBuildStep = true
        if (TRIGGER_PATTERN.test(content)) hasTrigger = true
      } catch { /* ignore */ }
    }

    const tasks: Task[] = [
      { id: 'cicd-dir', label: 'CI/CD configuration found (GitHub Actions, GitLab CI, etc.)', done: hasConfig },
      { id: 'cicd-file', label: 'At least one CI/CD pipeline file exists', done: ciFiles.length > 0 },
      { id: 'cicd-step', label: 'Pipeline includes test or build step', done: hasTestOrBuildStep },
      { id: 'cicd-trigger', label: 'Pipeline triggers on push or pull/merge request', done: hasTrigger },
    ]

    const percent = tasks.filter((t) => t.done).length * 25

    return {
      buildingId: 'cicd',
      percent,
      tasks,
      details: { ciFileCount: ciFiles.length, hasTestOrBuildStep, hasTrigger },
    }
  },
}
