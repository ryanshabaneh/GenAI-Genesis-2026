import path from 'path'
import fs from 'fs'
import simpleGit from 'simple-git'

export async function cloneRepo(repoUrl: string, destDir: string): Promise<string> {
  let normalizedUrl = repoUrl.trim()
  if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
    normalizedUrl = `https://${normalizedUrl}`
  }

  const repoSlug = normalizedUrl
    .replace(/^https?:\/\//, '')
    .replace(/\.git$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')

  const clonePath = path.join(destDir, repoSlug)

  if (fs.existsSync(clonePath)) {
    const gitDir = path.join(clonePath, '.git')
    if (fs.existsSync(gitDir)) {
      return clonePath
    }
    // Directory exists but isn't a valid git repo (partial clone) — remove and re-clone
    fs.rmSync(clonePath, { recursive: true, force: true })
  }

  fs.mkdirSync(destDir, { recursive: true })

  const git = simpleGit()
  await git.clone(normalizedUrl, clonePath, ['--depth', '1'])

  return clonePath
}
