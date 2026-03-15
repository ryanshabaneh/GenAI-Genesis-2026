import { deduplicateAcrossBuildings } from '../src/agents/analyzer'
import type { BuildingId, Task } from '../src/types'
import fs from 'fs'

const dir = process.argv[2] || '/tmp/shipyard-pipeline-results'
const buildings: BuildingId[] = ['documentation','tests','envVars','security','logging','cicd','docker','deployment']
const input = new Map<BuildingId, Task[]>()

for (const b of buildings) {
  try {
    const raw = fs.readFileSync(`${dir}/${b}_tasks.json`, 'utf8')
    input.set(b, JSON.parse(raw))
  } catch { input.set(b, []) }
}

console.log('=== BEFORE DEDUP ===')
let beforeTotal = 0
for (const [b, tasks] of input) {
  beforeTotal += tasks.length
  console.log(`  ${b}: ${tasks.length} tasks`)
}

const result = deduplicateAcrossBuildings(input)

console.log('\n=== AFTER DEDUP ===')
let afterTotal = 0
for (const [b, tasks] of result) {
  afterTotal += tasks.length
  console.log(`\n  ${b}: ${tasks.length} tasks`)
  for (const t of tasks) {
    console.log(`    ❌ ${t.label.slice(0, 80)}`)
  }
}

console.log(`\n=== SUMMARY ===`)
console.log(`  Before: ${beforeTotal} tasks`)
console.log(`  After:  ${afterTotal} tasks`)
console.log(`  Removed: ${beforeTotal - afterTotal} duplicates`)
