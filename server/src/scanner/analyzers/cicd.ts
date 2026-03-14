import fs from 'fs'
import path from 'path'
import type { Analyzer, AnalyzerContext } from './base'
import type { AnalyzerResult, Task } from '../../types'

export const cicdAnalyzer: Analyzer = {
  buildingId: 'cicd',

  async analyze(ctx: AnalyzerContext): Promise<AnalyzerResult> {
    const workflowsDir = path.join(ctx.repoPath, '.github', 'workflows')
    const hasWorkflowDir = fs.existsSync(workflowsDir)

    let workflowFiles: string[] = []
    if (hasWorkflowDir) {
      try {
        workflowFiles = fs
          .readdirSync(workflowsDir)
          .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
      } catch { /* ignore */ }
    }

    const hasWorkflowFile = workflowFiles.length > 0

    // Check if any workflow mentions test or build steps
    let hasTestOrBuildStep = false
    for (const file of workflowFiles) {
      try {
        const content = await fs.promises.readFile(path.join(workflowsDir, file), 'utf8')
        if (/\b(npm (run )?(test|build)|yarn (test|build)|pnpm (test|build)|run-tests|jest|vitest)/i.test(content)) {
          hasTestOrBuildStep = true
          break
        }
      } catch { /* ignore */ }
    }

    const tasks: Task[] = [
      { id: 'cicd-dir', label: '.github/workflows/ directory exists', done: hasWorkflowDir },
      { id: 'cicd-file', label: 'At least one workflow .yml file found', done: hasWorkflowFile },
      { id: 'cicd-step', label: 'Workflow includes test or build step', done: hasTestOrBuildStep },
    ]

    // dir 50%, file 25%, step 25%
    let percent = 0
    if (hasWorkflowDir) percent += 50
    if (hasWorkflowFile) percent += 25
    if (hasTestOrBuildStep) percent += 25

    return {
      buildingId: 'cicd',
      percent,
      tasks,
      details: { workflowFileCount: workflowFiles.length, hasTestOrBuildStep },
    }
  },
}
