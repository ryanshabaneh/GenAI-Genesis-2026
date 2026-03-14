// test-full-pipeline.ts
// Runs the full scanner → analysis agent pipeline against a repo
// and prints a detailed report of all tasks found.
// Usage: npx ts-node scripts/test-full-pipeline.ts /path/to/repo

import path from 'path'
import fs from 'fs'

const repoPath = process.argv[2]
if (!repoPath) {
  console.error('Usage: npx ts-node scripts/test-full-pipeline.ts /path/to/repo')
  process.exit(1)
}

async function main() {
  const abs = path.resolve(repoPath)
  const pkgPath = path.join(abs, 'package.json')
  const packageJson = fs.existsSync(pkgPath) ? JSON.parse(fs.readFileSync(pkgPath, 'utf8')) : null
  const ctx = { repoPath: abs, packageJson }

  const { documentationAnalyzer } = await import('../src/scanner/analyzers/documentation')
  const { testsAnalyzer } = await import('../src/scanner/analyzers/tests')
  const { envVarsAnalyzer } = await import('../src/scanner/analyzers/envVars')
  const { securityAnalyzer } = await import('../src/scanner/analyzers/security')
  const { loggingAnalyzer } = await import('../src/scanner/analyzers/logging')
  const { cicdAnalyzer } = await import('../src/scanner/analyzers/cicd')
  const { dockerAnalyzer } = await import('../src/scanner/analyzers/docker')
  const { deploymentAnalyzer } = await import('../src/scanner/analyzers/deployment')
  const { analyzeForTasks, mergeTasks } = await import('../src/agents/analyzer')
  const { calculatePercent } = await import('../src/agents/scanner-context')

  const analyzers = [
    documentationAnalyzer, testsAnalyzer, envVarsAnalyzer, securityAnalyzer,
    loggingAnalyzer, cicdAnalyzer, dockerAnalyzer, deploymentAnalyzer,
  ]

  console.log(`\n${'═'.repeat(60)}`)
  console.log(`  FULL PIPELINE TEST: ${abs}`)
  console.log(`${'═'.repeat(60)}\n`)

  // Phase 1: heuristic scan
  console.log('─── PHASE 1: HEURISTIC SCAN (no LLM) ───\n')

  const scanResults = []
  for (const analyzer of analyzers) {
    const result = await analyzer.analyze(ctx)
    scanResults.push(result)
    const done = result.tasks.filter(t => t.done).length
    console.log(`  ${result.buildingId.padEnd(15)} ${result.percent}% (${done}/${result.tasks.length} tasks)`)
  }

  const heuristicScore = Math.round(scanResults.reduce((s, r) => s + r.percent, 0) / scanResults.length)
  console.log(`\n  Heuristic score: ${heuristicScore}%\n`)

  // Phase 2: deep analysis
  console.log('─── PHASE 2: DEEP ANALYSIS (LLM) ───\n')

  const enrichedResults = []
  for (const result of scanResults) {
    process.stdout.write(`  Analyzing ${result.buildingId}... `)

    try {
      const agentTasks = await analyzeForTasks({
        buildingId: result.buildingId,
        repoPath: abs,
        scanResult: result,
      })

      const merged = mergeTasks(result.tasks, agentTasks)
      const percent = calculatePercent(merged)

      enrichedResults.push({ ...result, tasks: merged, percent, agentTaskCount: agentTasks.length })
      console.log(`+${agentTasks.length} tasks (${merged.length} total, ${percent}%)`)
    } catch (err) {
      enrichedResults.push({ ...result, agentTaskCount: 0 })
      console.log(`FAILED: ${err instanceof Error ? err.message : 'unknown'}`)
    }
  }

  // Detailed report
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`  DETAILED REPORT`)
  console.log(`${'═'.repeat(60)}`)

  let totalDone = 0
  let totalTasks = 0

  for (const result of enrichedResults) {
    const done = result.tasks.filter(t => t.done).length
    totalDone += done
    totalTasks += result.tasks.length

    console.log(`\n┌─ ${result.buildingId.toUpperCase()} — ${result.percent}% (${done}/${result.tasks.length})`)
    console.log('│')

    // Scanner tasks first
    const scannerTaskIds = new Set(scanResults.find(r => r.buildingId === result.buildingId)!.tasks.map(t => t.id))

    for (const task of result.tasks) {
      const icon = task.done ? '✅' : '❌'
      const source = scannerTaskIds.has(task.id) ? '(scanner)' : '(agent)'
      console.log(`│  ${icon} [${task.id}] ${task.label} ${source}`)
    }

    console.log('└' + '─'.repeat(50))
  }

  const finalScore = Math.round(enrichedResults.reduce((s, r) => s + r.percent, 0) / enrichedResults.length)

  console.log(`\n${'═'.repeat(60)}`)
  console.log(`  SUMMARY`)
  console.log(`${'═'.repeat(60)}`)
  console.log(`  Total tasks:     ${totalTasks} (${scanResults.reduce((s, r) => s + r.tasks.length, 0)} scanner + ${totalTasks - scanResults.reduce((s, r) => s + r.tasks.length, 0)} agent)`)
  console.log(`  Tasks complete:  ${totalDone}/${totalTasks}`)
  console.log(`  Heuristic score: ${heuristicScore}%`)
  console.log(`  Final score:     ${finalScore}%`)
  console.log(`${'═'.repeat(60)}\n`)
}

main().catch(console.error)
