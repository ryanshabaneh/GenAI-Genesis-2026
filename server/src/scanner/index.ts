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
import { analyzeAllBuildings, mergeTasks } from '../agents/analyzer'
import type { BuildingId, DeploymentRecommendation } from '../types'
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

async function loadSinglePackageJson(filePath: string): Promise<Record<string, unknown> | null> {
  if (!fs.existsSync(filePath)) return null
  try {
    const raw = await fs.promises.readFile(filePath, 'utf8')
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return null
  }
}

/**
 * Load and merge package.json files from root + monorepo subdirectories.
 * Merges dependencies, devDependencies, and scripts so analyzers see
 * the full picture (e.g. vitest in server/package.json, next in frontend/package.json).
 */
async function loadPackageJson(repoPath: string): Promise<Record<string, unknown> | null> {
  const rootPkg = await loadSinglePackageJson(path.join(repoPath, 'package.json'))

  // Find monorepo subdirs with their own package.json
  const subPkgs: Record<string, unknown>[] = []
  const skip = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '.cache'])
  try {
    const entries = fs.readdirSync(repoPath, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory() || skip.has(entry.name)) continue
      const subPkg = await loadSinglePackageJson(path.join(repoPath, entry.name, 'package.json'))
      if (subPkg) subPkgs.push(subPkg)
    }
  } catch { /* ignore */ }

  if (subPkgs.length === 0) return rootPkg

  // Merge: root is base, overlay subdirectory deps/scripts
  const merged: Record<string, unknown> = rootPkg ? { ...rootPkg } : {}
  const mergeField = (field: string) => {
    const rootField = (merged[field] as Record<string, unknown>) ?? {}
    for (const sub of subPkgs) {
      const subField = sub[field] as Record<string, unknown> | undefined
      if (subField) Object.assign(rootField, subField)
    }
    if (Object.keys(rootField).length > 0) merged[field] = rootField
  }

  mergeField('dependencies')
  mergeField('devDependencies')
  mergeField('scripts')

  return Object.keys(merged).length > 0 ? merged : null
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
        const update: Record<string, unknown> = {
          results: {
            ...session.results,
            [analyzer.buildingId]: result,
          },
        }

        // Store deployment recommendation in the session
        if (analyzer.buildingId === 'deployment' && result.details?.['recommendation']) {
          update['deploymentRecommendation'] = result.details['recommendation'] as DeploymentRecommendation
        }

        updateSession(sessionId, update)
      }

      io.to(sessionId).emit('message', {
        type: 'result',
        building: result.buildingId,
        percent: result.percent,
        tasks: result.tasks,
      })

      // Emit deployment recommendation so frontend can show it
      if (analyzer.buildingId === 'deployment' && result.details?.['recommendation']) {
        io.to(sessionId).emit('message', {
          type: 'deploy:recommendation',
          recommendation: result.details['recommendation'],
        })
      }
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

  // Emit complete after Phase 1 so the frontend transitions to 3D scene immediately
  const heuristicSession = getSession(sessionId)
  const heuristicResults = Object.values(heuristicSession?.results ?? {})
  const heuristicScore =
    heuristicResults.length > 0
      ? Math.round(heuristicResults.reduce((sum, r) => sum + (r?.percent ?? 0), 0) / heuristicResults.length)
      : 0
  io.to(sessionId).emit('message', { type: 'complete', score: heuristicScore })

  // Phase 2: deep analysis — ONE LLM call for all buildings
  // Runs in background after frontend has transitioned to 3D scene.
  // Pass the deployment recommendation so the LLM generates platform-specific tasks
  const currentSession = getSession(sessionId)
  const allAgentTasks = await analyzeAllBuildings({
    repoPath,
    scanResults: results,
    deploymentRecommendation: currentSession?.deploymentRecommendation,
  })

  // Merge agent tasks into scanner results and notify frontend
  for (const result of results) {
    const agentTasks = allAgentTasks.get(result.buildingId) ?? []
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

  // Emit orchestrator:complete after Phase 2 so score bar updates
  const finalSession = getSession(sessionId)
  const allResults = Object.values(finalSession?.results ?? {})
  const finalScore =
    allResults.length > 0
      ? Math.round(allResults.reduce((sum, r) => sum + (r?.percent ?? 0), 0) / allResults.length)
      : 0
  io.to(sessionId).emit('message', { type: 'orchestrator:complete', score: finalScore })
}
