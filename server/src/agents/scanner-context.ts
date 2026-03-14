// server/src/agents/scanner-context.ts
// Builds a preprompt from the scanner's findings for a specific building.
// This gives agents a concrete starting point: what the scanner found,
// what's done, what's not, and the raw details from heuristic checks.
// The agent can then go deeper — but it doesn't start from zero.

import type { AnalyzerResult, BuildingId, Session } from '../types'

/**
 * Convert scanner AnalyzerResult into a preprompt string that gets injected
 * into the agent's system context. Includes task status and scanner details.
 */
export function buildScannerPreprompt(result: AnalyzerResult | undefined): string {
  if (!result) return ''

  const { buildingId, percent, tasks, details } = result

  const taskLines = tasks.map((t) => {
    if (t.done) return `  [x] ${t.label} (id: ${t.id})`
    const fb = t.feedback ? ` — Last evaluation: ${t.feedback}` : ''
    return `  [ ] ${t.label} (id: ${t.id})${fb}`
  })

  const doneCount = tasks.filter((t) => t.done).length
  const totalCount = tasks.length

  // Format the details object as human-readable findings
  const findings = Object.entries(details)
    .map(([key, value]) => `  - ${key}: ${JSON.stringify(value)}`)
    .join('\n')

  return `## Scanner Analysis (pre-computed, heuristic-based)

The automated scanner already analyzed this repository for the "${buildingId}" category.

**Current score: ${percent}% (${doneCount}/${totalCount} tasks complete)**

### Task checklist:
${taskLines.join('\n')}

### Scanner findings:
${findings || '  (no additional details)'}

Use these findings as your starting point. The scanner uses simple heuristic checks
(file existence, regex patterns, dependency detection). Your analysis should go deeper —
check code quality, correctness, and completeness beyond what the scanner can detect.
Focus your work on the incomplete tasks listed above.`
}

/**
 * Build a change log context block showing what's been done across all buildings.
 * Used to give per-building agents awareness of project-wide changes.
 * Optionally excludes a building (the one currently being chatted with) to avoid redundancy.
 */
export function buildChangeLogContext(
  session: Session,
  excludeBuilding?: BuildingId
): string {
  const lines: string[] = []

  const buildingIds = Object.keys(session.results) as BuildingId[]
  for (const bid of buildingIds) {
    if (bid === excludeBuilding) continue
    const result = session.results[bid]
    if (!result) continue

    const taskLines = result.tasks.map((t) => {
      if (t.done) {
        const logEntry = session.changeLog.find((e) => e.taskId === t.id)
        const summary = logEntry ? ` — ${logEntry.summary}` : ''
        return `    [x] ${t.label}${summary}`
      }
      return `    [ ] ${t.label}`
    })

    lines.push(`  **${bid}** (${calculatePercent(result.tasks)}%):`)
    lines.push(...taskLines)
  }

  if (lines.length === 0) return ''

  return `## Project-Wide Progress (Other Buildings)

${lines.join('\n')}`
}

/**
 * Calculate building percent from actual task completion ratio.
 * This is the single source of truth for percent — used by accept, orchestrator, etc.
 */
export function calculatePercent(tasks: Array<{ done: boolean }>): number {
  if (tasks.length === 0) return 0
  const doneCount = tasks.filter((t) => t.done).length
  return Math.round((doneCount / tasks.length) * 100)
}
