// server/src/agents/aider.ts
// Thin wrapper around the aider CLI. Spawns aider in non-interactive mode
// with --message, lets it use its tree-sitter repo map for context and
// apply edits directly to files on disk. Returns the git diff of what changed.

import { execFile } from 'child_process'
import { promisify } from 'util'
import type { BuildingId } from '../types'

const execFileAsync = promisify(execFile)

const AIDER_TIMEOUT = 120_000 // 2 minutes per call
const MAP_TOKENS = 2048

export interface AiderResult {
  /** raw git diff output showing what aider changed */
  diff: string
  /** list of files that were modified or created */
  changedFiles: Array<{ path: string; content: string }>
  /** whether aider exited successfully */
  success: boolean
  /** stderr or error message if something went wrong */
  error?: string
}

/**
 * Build the aider --message string. Aider is now a pure executor — the agent
 * has already processed the task into specific instructions.
 */
function buildMessage(taskDescription: string): string {
  return taskDescription
}

/**
 * Call aider CLI in non-interactive mode. It reads the repo via tree-sitter
 * repo map, generates code, and writes files directly to disk.
 *
 * After aider exits we run git diff to capture exactly what changed.
 */
export async function callAider(params: {
  buildingId: BuildingId
  repoPath: string
  taskDescription: string
  model?: string
}): Promise<AiderResult> {
  const {
    buildingId,
    repoPath,
    taskDescription,
    model = 'anthropic/claude-sonnet-4-6',
  } = params

  const message = buildMessage(taskDescription)

  const args = [
    '--message', message,
    '--yes',               // no confirmation prompts
    '--no-auto-commits',   // we manage git ourselves
    '--no-stream',         // not watching stdout interactively
    '--map-tokens', String(MAP_TOKENS),
    '--model', model,
  ]

  try {
    // Run aider in the cloned repo directory
    await execFileAsync('aider', args, {
      cwd: repoPath,
      timeout: AIDER_TIMEOUT,
      env: { ...process.env },
      maxBuffer: 10 * 1024 * 1024, // 10MB
    })

    // Capture what aider changed via git diff
    const { stdout: diff } = await execFileAsync('git', ['diff'], {
      cwd: repoPath,
      maxBuffer: 10 * 1024 * 1024,
    })

    // Also get list of untracked (new) files aider may have created
    const { stdout: untrackedRaw } = await execFileAsync(
      'git', ['ls-files', '--others', '--exclude-standard'],
      { cwd: repoPath }
    )

    // Parse changed files from diff + untracked files
    const changedFiles = await collectChangedFiles(repoPath, diff, untrackedRaw)

    return { diff, changedFiles, success: true }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown aider error'
    console.error(`Aider error for ${buildingId}:`, errorMsg)
    return { diff: '', changedFiles: [], success: false, error: errorMsg }
  }
}

/**
 * Collect the actual file contents for everything aider modified or created.
 * We need these to pass to the evaluator and to store as AcceptedChanges.
 */
async function collectChangedFiles(
  repoPath: string,
  diff: string,
  untrackedRaw: string
): Promise<Array<{ path: string; content: string }>> {
  const { readFile } = await import('fs/promises')
  const { join } = await import('path')

  const files: Array<{ path: string; content: string }> = []
  const seen = new Set<string>()

  // Extract modified file paths from diff headers (--- a/path, +++ b/path)
  const diffPathPattern = /^\+\+\+ b\/(.+)$/gm
  let match: RegExpExecArray | null
  while ((match = diffPathPattern.exec(diff)) !== null) {
    const filePath = match[1]
    if (filePath && !seen.has(filePath)) {
      seen.add(filePath)
    }
  }

  // Add untracked (new) files
  const untrackedFiles = untrackedRaw.trim().split('\n').filter(Boolean)
  for (const f of untrackedFiles) {
    if (!seen.has(f)) seen.add(f)
  }

  // Read current content of each changed file
  for (const filePath of seen) {
    try {
      const content = await readFile(join(repoPath, filePath), 'utf8')
      files.push({ path: filePath, content })
    } catch {
      // File might have been deleted — skip
    }
  }

  return files
}

/**
 * Reset aider's changes in the repo so the next building starts clean.
 * Called after we've captured the diff and stored the changes.
 */
export async function resetAiderChanges(repoPath: string): Promise<void> {
  try {
    // Restore modified files
    await execFileAsync('git', ['checkout', '.'], { cwd: repoPath })
    // Remove untracked files aider created
    await execFileAsync('git', ['clean', '-fd'], { cwd: repoPath })
  } catch (err) {
    console.error('Failed to reset aider changes:', err)
  }
}
