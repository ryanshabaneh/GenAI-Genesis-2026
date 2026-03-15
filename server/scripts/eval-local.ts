// Scan a LOCAL directory (no cloning). Usage: npx ts-node scripts/eval-local.ts <path>

import path from 'path'
import fs from 'fs'

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
  documentationAnalyzer, testsAnalyzer, envVarsAnalyzer, securityAnalyzer,
  loggingAnalyzer, cicdAnalyzer, dockerAnalyzer, deploymentAnalyzer,
]

// Same monorepo merge logic as scanner/index.ts
async function loadMergedPackageJson(repoPath: string) {
  const load = (p: string) => {
    if (!fs.existsSync(p)) return null
    try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return null }
  }

  const rootPkg = load(path.join(repoPath, 'package.json'))
  const skip = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '.cache'])
  const subPkgs: Record<string, unknown>[] = []

  try {
    for (const entry of fs.readdirSync(repoPath, { withFileTypes: true })) {
      if (!entry.isDirectory() || skip.has(entry.name)) continue
      const sub = load(path.join(repoPath, entry.name, 'package.json'))
      if (sub) subPkgs.push(sub)
    }
  } catch {}

  if (subPkgs.length === 0) return rootPkg

  const merged: Record<string, unknown> = rootPkg ? { ...rootPkg } : {}
  for (const field of ['dependencies', 'devDependencies', 'scripts']) {
    const base = (merged[field] as Record<string, unknown>) ?? {}
    for (const sub of subPkgs) {
      const sf = sub[field] as Record<string, unknown> | undefined
      if (sf) Object.assign(base, sf)
    }
    if (Object.keys(base).length > 0) merged[field] = base
  }

  return Object.keys(merged).length > 0 ? merged : null
}

async function main() {
  const repoPath = path.resolve(process.argv[2] ?? '..')
  console.log(`\nScanning: ${repoPath}\n`)

  const packageJson = await loadMergedPackageJson(repoPath)
  const ctx: AnalyzerContext = { repoPath, packageJson }

  console.log('═'.repeat(60))
  for (const a of ANALYZERS) {
    const r = await a.analyze(ctx)
    const icon = r.percent === 100 ? '✅' : r.percent >= 50 ? '🟡' : '🔴'
    console.log(`\n${icon} ${r.buildingId.toUpperCase()} — ${r.percent}%`)
    for (const t of r.tasks) console.log(`  ${t.done ? '✓' : '✗'} ${t.label}`)
    for (const [k, v] of Object.entries(r.details)) {
      if (Array.isArray(v) && v.length > 0) console.log(`    ${k}: [${v.join(', ')}]`)
      else if (v !== null && v !== undefined && typeof v !== 'object') console.log(`    ${k}: ${v}`)
    }
  }
  const results = await Promise.all(ANALYZERS.map((a) => a.analyze(ctx)))
  const score = Math.round(results.reduce((s, r) => s + r.percent, 0) / results.length)
  console.log(`\n${'═'.repeat(60)}\n  OVERALL: ${score}%\n${'═'.repeat(60)}\n`)
}

main().catch(console.error)
