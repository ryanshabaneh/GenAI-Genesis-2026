import path from 'path'
import fs from 'fs'
import simpleGit from 'simple-git'

export async function cloneRepo(repoUrl: string, destDir: string): Promise<string> {
  // Normalize URL: handle both github.com/user/repo and https://github.com/user/repo
  let normalizedUrl = repoUrl.trim()
  if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
    normalizedUrl = `https://${normalizedUrl}`
  }

  // Strip trailing .git if present for consistent naming
  const repoSlug = normalizedUrl
    .replace(/^https?:\/\//, '')
    .replace(/\.git$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')

  const clonePath = path.join(destDir, repoSlug)

  // If already cloned, skip
  if (fs.existsSync(clonePath)) {
    return clonePath
  }

  fs.mkdirSync(clonePath, { recursive: true })

  const git = simpleGit()
  await git.clone(normalizedUrl, clonePath, ['--depth', '1'])

  return clonePath
}
