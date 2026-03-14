import fs from 'fs'
import path from 'path'
import type { Server as SocketIOServer } from 'socket.io'
import type { AnalyzerContext } from './analyzers/base'
import type { AnalyzerResult } from '../types'
import { testsAnalyzer } from './analyzers/tests'
import { cicdAnalyzer } from './analyzers/cicd'
import { dockerAnalyzer } from './analyzers/docker'
import { readmeAnalyzer } from './analyzers/readme'
import { envVarsAnalyzer } from './analyzers/envVars'
import { securityAnalyzer } from './analyzers/security'
import { loggingAnalyzer } from './analyzers/logging'
import { deploymentAnalyzer } from './analyzers/deployment'
import { getSession, updateSession } from '../session/store'

// The 8 buildings from the execution plan
const ANALYZERS = [
  readmeAnalyzer,
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

  for (const analyzer of ANALYZERS) {
    // Emit scanning event
    io.to(sessionId).emit('message', { type: 'scanning', building: analyzer.buildingId })

    try {
      const result = await analyzer.analyze(ctx)
      results.push(result)

      // Persist to session
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

  // Calculate overall score: average of all percents
  const score =
    results.length > 0
      ? Math.round(results.reduce((sum, r) => sum + r.percent, 0) / results.length)
      : 0

  io.to(sessionId).emit('message', { type: 'complete', score })
}
