import fs from 'fs'
import path from 'path'
import type { Analyzer, AnalyzerContext } from './base'
import type { AnalyzerResult, Task } from '../../types'

export const dockerAnalyzer: Analyzer = {
  buildingId: 'docker',

  async analyze(ctx: AnalyzerContext): Promise<AnalyzerResult> {
    const hasDockerfile = fs.existsSync(path.join(ctx.repoPath, 'Dockerfile'))
    const hasDockerignore = fs.existsSync(path.join(ctx.repoPath, '.dockerignore'))
    const hasDockerCompose =
      fs.existsSync(path.join(ctx.repoPath, 'docker-compose.yml')) ||
      fs.existsSync(path.join(ctx.repoPath, 'docker-compose.yaml'))

    const tasks: Task[] = [
      { id: 'docker-file', label: 'Dockerfile exists', done: hasDockerfile },
      { id: 'docker-ignore', label: '.dockerignore exists', done: hasDockerignore },
      { id: 'docker-compose', label: 'docker-compose.yml exists', done: hasDockerCompose },
    ]

    // Dockerfile 50%, dockerignore 25%, compose 25%
    let percent = 0
    if (hasDockerfile) percent += 50
    if (hasDockerignore) percent += 25
    if (hasDockerCompose) percent += 25

    return {
      buildingId: 'docker',
      percent,
      tasks,
      details: { hasDockerfile, hasDockerignore, hasDockerCompose },
    }
  },
}
