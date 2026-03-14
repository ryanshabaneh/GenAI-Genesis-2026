import type { Analyzer, AnalyzerContext } from './base'
import type { AnalyzerResult, Task } from '../../types'

const REQUIRED_SCRIPTS = ['start', 'build', 'dev', 'test', 'lint'] as const

export const scriptsAnalyzer: Analyzer = {
  buildingId: 'scripts',

  async analyze(ctx: AnalyzerContext): Promise<AnalyzerResult> {
    const scripts =
      ctx.packageJson &&
      typeof ctx.packageJson['scripts'] === 'object' &&
      ctx.packageJson['scripts'] !== null
        ? (ctx.packageJson['scripts'] as Record<string, unknown>)
        : {}

    const tasks: Task[] = REQUIRED_SCRIPTS.map((name) => ({
      id: `scripts-${name}`,
      label: `"${name}" script defined`,
      done: name in scripts,
    }))

    const doneCount = tasks.filter((t) => t.done).length
    // Each script is worth 20%
    const percent = doneCount * 20

    return {
      buildingId: 'scripts',
      percent,
      tasks,
      details: { scripts },
    }
  },
}
