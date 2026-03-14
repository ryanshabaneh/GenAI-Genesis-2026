import type { AnalyzerResult, BuildingId } from '../../types'

export interface AnalyzerContext {
  repoPath: string
  packageJson: Record<string, unknown> | null
}

export interface Analyzer {
  buildingId: BuildingId
  analyze(ctx: AnalyzerContext): Promise<AnalyzerResult>
}
