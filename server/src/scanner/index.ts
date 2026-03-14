import fs from 'fs'
import path from 'path'
import type { Server as SocketIOServer } from 'socket.io'
import type { AnalyzerContext } from './analyzers/base'
import type { AnalyzerResult, Task } from '../types'
import { testsAnalyzer } from './analyzers/tests'
import { cicdAnalyzer } from './analyzers/cicd'
import { dockerAnalyzer } from './analyzers/docker'
import { documentationAnalyzer } from './analyzers/documentation'
import { envVarsAnalyzer } from './analyzers/envVars'
import { securityAnalyzer } from './analyzers/security'
import { loggingAnalyzer } from './analyzers/logging'
import { deploymentAnalyzer } from './analyzers/deployment'
import { getSession, updateSession } from '../session/store'
import { analyzeForTasks, mergeTasks, deduplicateAcrossBuildings } from '../agents/analyzer'
import type { BuildingId } from '../types'
import { calculatePercent } from '../agents/scanner-context'

// The 8 buildings from the execution plan
const ANALYZERS = [
  documentationAnalyzer,
  testsAnalyzer,
  envVarsAnalyzer,
  securityAnalyzer,
  loggingAnalyzer,
  cicdAnalyzer,
  dockerAnalyzer,
  deploymentAnalyzer,
]

async function loadPackageJson(repoPath: string): Promise<Record<string, unknown> | null> {
  const pkgPath = path.join(repoPath, 'package.json')
  if (!fs.existsSync(pkgPath)) return null
  try {
    const raw = await fs.promises.readFile(pkgPath, 'utf8')
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return null
  }
}

export async function runScan(
  sessionId: string,
  repoPath: string,
  io: SocketIOServer
): Promise<void> {
  const packageJson = await loadPackageJson(repoPath)

  const ctx: AnalyzerContext = { repoPath, packageJson }
  const results: AnalyzerResult[] = []

  // Phase 1: heuristic scan (fast, no LLM)
  for (const analyzer of ANALYZERS) {
    io.to(sessionId).emit('message', { type: 'scanning', building: analyzer.buildingId })

    try {
      const result = await analyzer.analyze(ctx)
      results.push(result)

      // Persist heuristic results immediately so buildings appear fast
      const session = getSession(sessionId)
      if (session) {
        updateSession(sessionId, {
          results: {
            ...session.results,
            [analyzer.buildingId]: result,
          },
        })
      }

      io.to(sessionId).emit('message', {
        type: 'result',
        building: result.buildingId,
        percent: result.percent,
        tasks: result.tasks,
      })
    } catch (err) {
      console.error(`Analyzer ${analyzer.buildingId} failed:`, err)
      io.to(sessionId).emit('message', {
        type: 'result',
        building: analyzer.buildingId,
        percent: 0,
        tasks: [],
      })
    }
  }

  // Phase 2: deep analysis (LLM, reads actual code, adds tasks)
  // Runs after all heuristic results are in so the frontend isn't blocked
  const allAgentTasks = new Map<BuildingId, Task[]>()

  for (const result of results) {
    try {
      const agentTasks = await analyzeForTasks({
        buildingId: result.buildingId,
        repoPath,
        scanResult: result,
      })
      allAgentTasks.set(result.buildingId, agentTasks)
    } catch (err) {
      console.error(`Analysis agent for ${result.buildingId} failed:`, err)
      allAgentTasks.set(result.buildingId, [])
    }
  }

  // Dedup cross-building overlap (e.g. "hardcoded secret" → keep in security only)
  const dedupedTasks = await deduplicateAcrossBuildings(allAgentTasks)

  // Merge deduped agent tasks into scanner results and notify frontend
  for (const result of results) {
    const agentTasks = dedupedTasks.get(result.buildingId) ?? []
    if (agentTasks.length === 0) continue

    const mergedTasks = mergeTasks(result.tasks, agentTasks)
    const percent = calculatePercent(mergedTasks)

    const session = getSession(sessionId)
    if (session) {
      const enrichedResult: AnalyzerResult = {
        ...result,
        tasks: mergedTasks,
        percent,
      }

      updateSession(sessionId, {
        results: {
          ...session.results,
          [result.buildingId]: enrichedResult,
        },
      })

      io.to(sessionId).emit('message', {
        type: 'result',
        building: result.buildingId,
        percent,
        tasks: mergedTasks,
      })
    }
  }

  // Calculate overall score from final enriched state
  const session = getSession(sessionId)
  const allResults = Object.values(session?.results ?? {})
  const score =
    allResults.length > 0
      ? Math.round(allResults.reduce((sum, r) => sum + (r?.percent ?? 0), 0) / allResults.length)
      : 0

  io.to(sessionId).emit('message', { type: 'complete', score })
}
