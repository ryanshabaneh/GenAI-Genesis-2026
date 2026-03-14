// Quick script to run all 8 analyzers against a repo and print results.
// Usage: npx ts-node scripts/run-scanner.ts /path/to/repo

import path from 'path'
import fs from 'fs'

const repoPath = process.argv[2]
if (!repoPath) {
  console.error('Usage: npx ts-node scripts/run-scanner.ts /path/to/repo')
  process.exit(1)
}

async function main() {
  const abs = path.resolve(repoPath)
  const pkgPath = path.join(abs, 'package.json')
  const packageJson = fs.existsSync(pkgPath) ? JSON.parse(fs.readFileSync(pkgPath, 'utf8')) : null

  const ctx = { repoPath: abs, packageJson }

  // Import all analyzers
  const { documentationAnalyzer } = await import('../src/scanner/analyzers/documentation')
  const { testsAnalyzer } = await import('../src/scanner/analyzers/tests')
  const { envVarsAnalyzer } = await import('../src/scanner/analyzers/envVars')
  const { securityAnalyzer } = await import('../src/scanner/analyzers/security')
  const { loggingAnalyzer } = await import('../src/scanner/analyzers/logging')
  const { cicdAnalyzer } = await import('../src/scanner/analyzers/cicd')
  const { dockerAnalyzer } = await import('../src/scanner/analyzers/docker')
  const { deploymentAnalyzer } = await import('../src/scanner/analyzers/deployment')

  const analyzers = [
    documentationAnalyzer, testsAnalyzer, envVarsAnalyzer, securityAnalyzer,
    loggingAnalyzer, cicdAnalyzer, dockerAnalyzer, deploymentAnalyzer,
  ]

  console.log(`\nScanning: ${abs}\n`)
  console.log('='.repeat(60))

  let totalPercent = 0

  for (const analyzer of analyzers) {
    const result = await analyzer.analyze(ctx)
    totalPercent += result.percent

    const done = result.tasks.filter(t => t.done).length
    const total = result.tasks.length

    console.log(`\n📦 ${result.buildingId.toUpperCase()} — ${result.percent}% (${done}/${total} tasks)`)
    console.log('-'.repeat(40))

    for (const task of result.tasks) {
      const icon = task.done ? '✅' : '❌'
      console.log(`  ${icon} [${task.id}] ${task.label}`)
    }

    const details = Object.entries(result.details)
    if (details.length > 0) {
      console.log(`  Details: ${JSON.stringify(result.details)}`)
    }
  }

  const overall = Math.round(totalPercent / analyzers.length)
  console.log('\n' + '='.repeat(60))
  console.log(`\n🏙️  OVERALL SCORE: ${overall}%\n`)
}

main().catch(console.error)
