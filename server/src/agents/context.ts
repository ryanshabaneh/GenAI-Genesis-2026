import fs from 'fs'
import path from 'path'
import type { BuildingId } from '../types'

// Files to read per building type — these are the starting points.
// The context builder also follows imports from these files to find related code.
const CONTEXT_FILES: Record<BuildingId, string[]> = {
  tests: ['package.json', 'src', 'tests', '__tests__'],
  cicd: ['.github/workflows', 'package.json'],
  docker: ['Dockerfile', 'docker-compose.yml', 'docker-compose.yaml', '.dockerignore', 'package.json'],
  documentation: ['README.md', 'package.json'],
  envVars: ['.env.example', 'package.json', 'src'],
  security: ['.gitignore', '.env.example', 'package.json'],
  logging: ['src', 'package.json'],
  deployment: ['vercel.json', 'fly.toml', 'railway.toml', 'render.yaml', 'Procfile', 'Dockerfile', 'package.json', 'netlify.toml', 'wrangler.toml'],
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

/**
 * Extract import/require paths from a source file's content.
 * Returns relative paths (e.g., './auth', '../utils/db') only — skips npm packages.
 */
function extractLocalImports(content: string): string[] {
  const imports: string[] = []
  // Match: import ... from './path' or require('./path')
  const pattern = /(?:from\s+['"](\.[^'"]+)['"])|(?:require\s*\(\s*['"](\.[^'"]+)['"]\s*\))/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(content)) !== null) {
    const importPath = match[1] ?? match[2]
    if (importPath) imports.push(importPath)
  }
  return imports
}

/**
 * Resolve an import path to an actual file on disk.
 * Tries common extensions (.ts, .tsx, .js, .jsx) and /index variants.
 */
function resolveImport(importPath: string, fromFile: string, repoPath: string): string | null {
  const fromDir = path.dirname(fromFile)
  const base = path.resolve(fromDir, importPath)
  const extensions = ['.ts', '.tsx', '.js', '.jsx']

  // Try exact path with extensions
  for (const ext of extensions) {
    const candidate = base + ext
    if (fs.existsSync(candidate)) return candidate
  }

  // Try as directory with index file
  for (const ext of extensions) {
    const candidate = path.join(base, `index${ext}`)
    if (fs.existsSync(candidate)) return candidate
  }

  return null
}

/**
 * Given a set of seed files, follow their local imports one level deep
 * and return additional files that should be included in context.
 */
async function followImports(
  seedFiles: Array<{ file: string; content: string }>,
  repoPath: string,
  alreadyIncluded: Set<string>,
  maxExtra: number
): Promise<Array<{ file: string; content: string }>> {
  const extra: Array<{ file: string; content: string }> = []

  for (const { content, file } of seedFiles) {
    if (extra.length >= maxExtra) break

    const imports = extractLocalImports(content)
    for (const imp of imports) {
      if (extra.length >= maxExtra) break

      const resolved = resolveImport(imp, file, repoPath)
      if (!resolved || alreadyIncluded.has(resolved)) continue

      alreadyIncluded.add(resolved)
      const importedContent = await readFileIfExists(resolved)
      if (importedContent) {
        extra.push({ file: resolved, content: importedContent })
      }
    }
  }

  return extra
}

/**
 * Generate a compact directory tree of the repo (just file names, no content).
 * Helps the agent understand the project structure.
 */
function getProjectTree(repoPath: string, maxDepth = 3): string {
  const lines: string[] = []

  const walk = (dir: string, prefix: string, depth: number) => {
    if (depth > maxDepth || lines.length > 60) return
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }

    // Sort: directories first, then files
    entries.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1
      if (!a.isDirectory() && b.isDirectory()) return 1
      return a.name.localeCompare(b.name)
    })

    const skip = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '.cache'])
    const filtered = entries.filter((e) => !skip.has(e.name))

    for (let i = 0; i < filtered.length; i++) {
      if (lines.length > 60) break
      const entry = filtered[i]
      const isLast = i === filtered.length - 1
      const connector = isLast ? '└── ' : '├── '
      const childPrefix = isLast ? '    ' : '│   '

      lines.push(`${prefix}${connector}${entry.name}${entry.isDirectory() ? '/' : ''}`)

      if (entry.isDirectory()) {
        walk(path.join(dir, entry.name), prefix + childPrefix, depth + 1)
      }
    }
  }

  walk(repoPath, '', 0)
  return lines.join('\n')
}

export async function buildAgentContext(buildingId: BuildingId, repoPath: string): Promise<string> {
  const targets = CONTEXT_FILES[buildingId] ?? ['package.json']
  const sections: string[] = []
  let totalChars = 0
  const includedFiles = new Set<string>()
  const seedFiles: Array<{ file: string; content: string }> = []

  // Add project tree as first section (compact overview)
  const tree = getProjectTree(repoPath)
  if (tree) {
    const treeSection = `### Project Structure\n\`\`\`\n${tree}\n\`\`\``
    sections.push(treeSection)
    totalChars += treeSection.length
  }

  // Read the primary context files
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
        includedFiles.add(fullPath)
        if (/\.[jt]sx?$/.test(target)) {
          seedFiles.push({ file: fullPath, content })
        }
      }
    } else if (stat.isDirectory()) {
      const files = await readDirFirstFiles(fullPath)
      for (const { file, content } of files) {
        if (totalChars >= MAX_TOTAL_CHARS) break
        const relPath = path.relative(repoPath, file)
        const section = `### File: ${relPath}\n\`\`\`\n${content}\n\`\`\``
        sections.push(section)
        totalChars += section.length
        includedFiles.add(file)
        seedFiles.push({ file, content })
      }
    }
  }

  // Follow imports from seed files to find related code the agent might need
  if (totalChars < MAX_TOTAL_CHARS && seedFiles.length > 0) {
    const maxExtra = Math.min(5, Math.floor((MAX_TOTAL_CHARS - totalChars) / MAX_FILE_SIZE))
    const extraFiles = await followImports(seedFiles, repoPath, includedFiles, maxExtra)

    for (const { file, content } of extraFiles) {
      if (totalChars >= MAX_TOTAL_CHARS) break
      const relPath = path.relative(repoPath, file)
      const section = `### File: ${relPath} (imported)\n\`\`\`\n${content}\n\`\`\``
      sections.push(section)
      totalChars += section.length
    }
  }

  if (sections.length === 0) {
    return 'No relevant files were found in the repository for this area.'
  }

  return `Here are the relevant files from the repository:\n\n${sections.join('\n\n')}`
}
