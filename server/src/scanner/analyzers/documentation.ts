import fs from 'fs'
import path from 'path'
import type { Analyzer, AnalyzerContext } from './base'
import type { AnalyzerResult, Task } from '../../types'

const README_NAMES = ['README.md', 'README.MD', 'readme.md', 'Readme.md']
const SETUP_KEYWORDS = ['install', 'setup', 'usage', 'getting started', 'quick start']
const BADGE_PATTERN = /!\[.*?\]\(https?:\/\/.*?(badge|shield|img\.shields)/i

export const documentationAnalyzer: Analyzer = {
  buildingId: 'documentation',

  async analyze(ctx: AnalyzerContext): Promise<AnalyzerResult> {
    let readmeContent: string | null = null

    for (const name of README_NAMES) {
      const filePath = path.join(ctx.repoPath, name)
      if (fs.existsSync(filePath)) {
        readmeContent = await fs.promises.readFile(filePath, 'utf8')
        break
      }
    }

    const exists = readmeContent !== null
    const lower = readmeContent?.toLowerCase() ?? ''

    const hasSetup = SETUP_KEYWORDS.some((kw) => lower.includes(kw))
    const hasDescription = exists && lower.length > 100
    const hasBadges = exists && BADGE_PATTERN.test(readmeContent ?? '')

    const tasks: Task[] = [
      { id: 'docs-exists', label: 'README file exists', done: exists },
      { id: 'docs-setup', label: 'Includes setup/usage instructions', done: hasSetup },
      { id: 'docs-description', label: 'Has a meaningful description', done: hasDescription },
      { id: 'docs-badges', label: 'Includes badges or shields', done: hasBadges },
    ]

    const percent = tasks.filter((t) => t.done).length * 25

    return {
      buildingId: 'documentation',
      percent,
      tasks,
      details: { exists, hasSetup, hasDescription, hasBadges },
    }
  },
}
