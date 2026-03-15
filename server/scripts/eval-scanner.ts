// server/scripts/eval-scanner.ts
// Clone a repo and run the heuristic scanner, print results for manual evaluation.
// Usage: npx ts-node scripts/eval-scanner.ts <repo-url>

import path from 'path'
import os from 'os'
import fs from 'fs'
import { cloneRepo } from '../src/scanner/clone'

// Import all analyzers directly
import { documentationAnalyzer } from '../src/scanner/analyzers/documentation'
import { testsAnalyzer } from '../src/scanner/analyzers/tests'
import { envVarsAnalyzer } from '../src/scanner/analyzers/envVars'
import { securityAnalyzer } from '../src/scanner/analyzers/security'
import { loggingAnalyzer } from '../src/scanner/analyzers/logging'
import { cicdAnalyzer } from '../src/scanner/analyzers/cicd'
import { dockerAnalyzer } from '../src/scanner/analyzers/docker'
import { deploymentAnalyzer } from '../src/scanner/analyzers/deployment'
import type { AnalyzerContext } from '../src/scanner/analyzers/base'
import type { AnalyzerResult } from '../src/types'

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

async function main() {
  const repoUrl = process.argv[2]
  if (!repoUrl) {
    console.error('Usage: npx ts-node scripts/eval-scanner.ts <repo-url>')
    process.exit(1)
  }

  const tmpDir = path.join(os.tmpdir(), 'shipcity-eval')
  console.log(`\n📦 Cloning ${repoUrl}...\n`)

  const repoPath = await cloneRepo(repoUrl, tmpDir)
  console.log(`   Cloned to: ${repoPath}\n`)

  // Load package.json
  let packageJson: Record<string, unknown> | null = null
  const pkgPath = path.join(repoPath, 'package.json')
  if (fs.existsSync(pkgPath)) {
    packageJson = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
  }

  const ctx: AnalyzerContext = { repoPath, packageJson }
  const results: AnalyzerResult[] = []

  console.log('═'.repeat(70))
  console.log(`  SCANNER RESULTS: ${repoUrl}`)
  console.log('═'.repeat(70))

  for (const analyzer of ANALYZERS) {
    try {
      const result = await analyzer.analyze(ctx)
      results.push(result)

      const icon = result.percent === 100 ? '✅' : result.percent >= 50 ? '🟡' : '🔴'
      console.log(`\n${icon} ${result.buildingId.toUpperCase()} — ${result.percent}%`)
      console.log('─'.repeat(50))

      for (const task of result.tasks) {
        const check = task.done ? '  ✓' : '  ✗'
        console.log(`${check} ${task.label}`)
      }

      // Print interesting details
      const detailKeys = Object.keys(result.details)
      if (detailKeys.length > 0) {
        console.log('  Details:')
        for (const [key, value] of Object.entries(result.details)) {
          if (value === true || value === false || typeof value === 'number' || typeof value === 'string') {
            console.log(`    ${key}: ${value}`)
          } else if (Array.isArray(value) && value.length > 0) {
            console.log(`    ${key}: [${value.join(', ')}]`)
          } else if (value === null) {
            console.log(`    ${key}: null`)
          }
        }
      }
    } catch (err) {
      console.log(`\n❌ ${analyzer.buildingId.toUpperCase()} — FAILED`)
      console.log(`  Error: ${err instanceof Error ? err.message : err}`)
    }
  }

  // Overall score
  const totalPercent = results.reduce((sum, r) => sum + r.percent, 0)
  const score = results.length > 0 ? Math.round(totalPercent / results.length) : 0
  console.log('\n' + '═'.repeat(70))
  console.log(`  OVERALL SCORE: ${score}%`)
  console.log('═'.repeat(70) + '\n')
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
