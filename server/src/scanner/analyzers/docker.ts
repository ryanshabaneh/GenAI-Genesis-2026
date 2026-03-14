import fs from 'fs'
import path from 'path'
import type { Analyzer, AnalyzerContext } from './base'
import type { AnalyzerResult, Task } from '../../types'

export const dockerAnalyzer: Analyzer = {
  buildingId: 'docker',

  async analyze(ctx: AnalyzerContext): Promise<AnalyzerResult> {
    const dockerfilePath = path.join(ctx.repoPath, 'Dockerfile')
    const hasDockerfile = fs.existsSync(dockerfilePath)
    const hasDockerignore = fs.existsSync(path.join(ctx.repoPath, '.dockerignore'))
    const hasDockerCompose =
      fs.existsSync(path.join(ctx.repoPath, 'docker-compose.yml')) ||
      fs.existsSync(path.join(ctx.repoPath, 'docker-compose.yaml'))

    let hasMultiStageOrCopy = false
    if (hasDockerfile) {
      try {
        const content = fs.readFileSync(dockerfilePath, 'utf8')
        const fromStatements = content.match(/^FROM\s+/gim) || []
        const hasMultiStage = fromStatements.length > 1 || /^FROM\s+.*\bAS\b/im.test(content)
        const hasCopy = /^COPY\s+/m.test(content)
        hasMultiStageOrCopy = hasMultiStage || hasCopy
      } catch { /* ignore */ }
    }

    const tasks: Task[] = [
      { id: 'docker-file', label: 'Dockerfile exists', done: hasDockerfile },
      { id: 'docker-ignore', label: '.dockerignore exists', done: hasDockerignore },
      { id: 'docker-compose', label: 'docker-compose.yml exists', done: hasDockerCompose },
      { id: 'docker-multistage', label: 'Multi-stage build or proper COPY usage in Dockerfile', done: hasMultiStageOrCopy },
    ]

    const percent = tasks.filter((t) => t.done).length * 25

    return {
      buildingId: 'docker',
      percent,
      tasks,
      details: { hasDockerfile, hasDockerignore, hasDockerCompose, hasMultiStageOrCopy },
    }
  },
}
