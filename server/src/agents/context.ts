import fs from 'fs'
import path from 'path'
import type { BuildingId } from '../types'

// Files to read per building type
const CONTEXT_FILES: Record<BuildingId, string[]> = {
  scripts: ['package.json'],
  tests: ['package.json', 'src', 'tests', '__tests__'],
  cicd: ['.github/workflows', 'package.json'],
  docker: ['Dockerfile', 'docker-compose.yml', 'docker-compose.yaml', '.dockerignore', 'package.json'],
  readme: ['README.md', 'package.json'],
  errorHandling: ['src', 'package.json'],
  envVars: ['.env.example', 'package.json', 'src'],
  logging: ['src', 'package.json'],
  linting: ['.eslintrc.json', '.eslintrc.js', 'eslint.config.js', 'eslint.config.mjs', '.prettierrc', 'package.json'],
  license: ['LICENSE', 'package.json'],
  security: ['.gitignore', '.env.example', 'package.json'],
  healthCheck: ['src', 'package.json'],
  deployment: ['vercel.json', 'fly.toml', 'railway.toml', 'Procfile', 'package.json'],
  hosting: ['src/index.ts', 'src/index.js', 'src/app.ts', 'src/app.js', 'src/server.ts', 'src/server.js', 'package.json'],
}

const MAX_FILE_SIZE = 8_000 // ~8KB per file to stay within context limits
const MAX_TOTAL_CHARS = 40_000 // cap total context

async function readFileIfExists(filePath: string): Promise<string | null> {
  if (!fs.existsSync(filePath)) return null
  try {
    const content = await fs.promises.readFile(filePath, 'utf8')
    // Truncate large files
    return content.length > MAX_FILE_SIZE ? content.slice(0, MAX_FILE_SIZE) + '\n... (truncated)' : content
  } catch {
    return null
  }
}

async function readDirFirstFiles(dirPath: string, maxFiles = 5): Promise<Array<{ file: string; content: string }>> {
  if (!fs.existsSync(dirPath)) return []
  const results: Array<{ file: string; content: string }> = []

  const walk = async (current: string, depth: number) => {
    if (results.length >= maxFiles || depth > 2) return
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(current, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (results.length >= maxFiles) break
      if (entry.name === 'node_modules' || entry.name === '.git') continue
      const full = path.join(current, entry.name)
      if (entry.isFile() && /\.[jt]sx?$/.test(entry.name)) {
        const content = await readFileIfExists(full)
        if (content) {
          results.push({ file: full, content })
        }
      } else if (entry.isDirectory()) {
        await walk(full, depth + 1)
      }
    }
  }

  await walk(dirPath, 0)
  return results
}

export async function buildAgentContext(buildingId: BuildingId, repoPath: string): Promise<string> {
  const targets = CONTEXT_FILES[buildingId] ?? ['package.json']
  const sections: string[] = []
  let totalChars = 0

  for (const target of targets) {
    if (totalChars >= MAX_TOTAL_CHARS) break

    const fullPath = path.join(repoPath, target)
    const stat = fs.existsSync(fullPath) ? fs.statSync(fullPath) : null

    if (!stat) continue

    if (stat.isFile()) {
      const content = await readFileIfExists(fullPath)
      if (content) {
        const section = `### File: ${target}\n\`\`\`\n${content}\n\`\`\``
        sections.push(section)
        totalChars += section.length
      }
    } else if (stat.isDirectory()) {
      const files = await readDirFirstFiles(fullPath)
      for (const { file, content } of files) {
        if (totalChars >= MAX_TOTAL_CHARS) break
        const relPath = path.relative(repoPath, file)
        const section = `### File: ${relPath}\n\`\`\`\n${content}\n\`\`\``
        sections.push(section)
        totalChars += section.length
      }
    }
  }

  if (sections.length === 0) {
    return 'No relevant files were found in the repository for this area.'
  }

  return `Here are the relevant files from the repository:\n\n${sections.join('\n\n')}`
}
