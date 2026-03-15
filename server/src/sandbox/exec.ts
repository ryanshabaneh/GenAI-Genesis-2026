// server/src/sandbox/exec.ts
// Sandboxed command execution in cloned repo directories.
// Strips all env vars except PATH so secrets never leak to subprocess.
// Whitelisted commands only — no user input reaches the shell.

import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

/** Commands that can be run. Args are hardcoded — no user input. */
const COMMANDS: Record<string, { cmd: string; args: string[]; timeout: number }> = {
  install:  { cmd: 'npm', args: ['install', '--ignore-scripts'],  timeout: 60_000 },
  build:    { cmd: 'npm', args: ['run', 'build'],                 timeout: 60_000 },
  lint:     { cmd: 'npm', args: ['run', 'lint'],                  timeout: 30_000 },
  typecheck:{ cmd: 'npx', args: ['tsc', '--noEmit'],              timeout: 30_000 },
}

export interface ExecResult {
  success: boolean
  command: string
  stdout: string
  stderr: string
  durationMs: number
}

/**
 * Run a whitelisted command in a cloned repo directory.
 * Environment is stripped to PATH only — no secrets leak.
 */
export async function runSandboxed(
  repoPath: string,
  commandKey: string
): Promise<ExecResult> {
  const spec = COMMANDS[commandKey]
  if (!spec) {
    return {
      success: false,
      command: commandKey,
      stdout: '',
      stderr: `Unknown command: ${commandKey}. Allowed: ${Object.keys(COMMANDS).join(', ')}`,
      durationMs: 0,
    }
  }

  const start = Date.now()

  try {
    const { stdout, stderr } = await execFileAsync(spec.cmd, spec.args, {
      cwd: repoPath,
      timeout: spec.timeout,
      maxBuffer: 5 * 1024 * 1024, // 5MB
      env: {
        PATH: process.env.PATH ?? '',
        HOME: repoPath,
        NODE_ENV: 'production',
        // Nothing else — no API keys, no secrets
      },
    })

    return {
      success: true,
      command: `${spec.cmd} ${spec.args.join(' ')}`,
      stdout: stdout.slice(-2000), // keep last 2KB
      stderr: stderr.slice(-2000),
      durationMs: Date.now() - start,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const stderr = (err as { stderr?: string })?.stderr ?? ''
    const stdout = (err as { stdout?: string })?.stdout ?? ''

    return {
      success: false,
      command: `${spec.cmd} ${spec.args.join(' ')}`,
      stdout: stdout.slice(-2000),
      stderr: (stderr || msg).slice(-2000),
      durationMs: Date.now() - start,
    }
  }
}

/** Run build verification: install (if needed) then build. */
export async function verifyBuild(repoPath: string): Promise<{
  installResult?: ExecResult
  buildResult: ExecResult
}> {
  const fs = await import('fs')
  const path = await import('path')

  // Install if node_modules doesn't exist
  let installResult: ExecResult | undefined
  if (!fs.existsSync(path.join(repoPath, 'node_modules'))) {
    installResult = await runSandboxed(repoPath, 'install')
    if (!installResult.success) {
      return {
        installResult,
        buildResult: {
          success: false,
          command: 'npm run build',
          stdout: '',
          stderr: 'Skipped — install failed',
          durationMs: 0,
        },
      }
    }
  }

  const buildResult = await runSandboxed(repoPath, 'build')
  return { installResult, buildResult }
}

/**
 * Start the app, wait a few seconds, check if it's alive.
 * Kills the process after the check regardless of outcome.
 * Returns whether the process stayed alive and optionally if a health endpoint responded.
 */
export async function verifyStart(repoPath: string): Promise<{
  success: boolean
  stdout: string
  stderr: string
  durationMs: number
  healthCheck?: { status: number; ok: boolean } | null
}> {
  const { spawn } = await import('child_process')
  const fs = await import('fs')
  const path = await import('path')
  const http = await import('http')

  // Detect the start command
  let startCmd = 'npm'
  let startArgs = ['run', 'start']

  // Check if package.json has a start script
  const pkgPath = path.join(repoPath, 'package.json')
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
      if (!pkg.scripts?.start) {
        // Try dev script as fallback
        if (pkg.scripts?.dev) {
          startArgs = ['run', 'dev']
        } else {
          return {
            success: false,
            stdout: '',
            stderr: 'No "start" or "dev" script found in package.json',
            durationMs: 0,
          }
        }
      }
    } catch { /* proceed with defaults */ }
  }

  const start = Date.now()
  const PORT = 54321 // unlikely to conflict

  return new Promise((resolve) => {
    const child = spawn(startCmd, startArgs, {
      cwd: repoPath,
      timeout: 15_000,
      env: {
        PATH: process.env.PATH ?? '',
        HOME: repoPath,
        NODE_ENV: 'production',
        PORT: String(PORT),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (d: Buffer) => { stdout += d.toString().slice(-2000) })
    child.stderr.on('data', (d: Buffer) => { stderr += d.toString().slice(-2000) })

    let settled = false
    const finish = (result: Parameters<typeof resolve>[0]) => {
      if (settled) return
      settled = true
      child.kill('SIGTERM')
      setTimeout(() => { child.kill('SIGKILL') }, 1000)
      resolve(result)
    }

    // If process exits before our check, it crashed on start
    child.on('exit', (code) => {
      finish({
        success: false,
        stdout: stdout.slice(-2000),
        stderr: (stderr || `Process exited with code ${code}`).slice(-2000),
        durationMs: Date.now() - start,
      })
    })

    child.on('error', (err) => {
      finish({
        success: false,
        stdout: '',
        stderr: err.message.slice(0, 2000),
        durationMs: Date.now() - start,
      })
    })

    // Wait 5 seconds, then check if process is alive + try health endpoint
    setTimeout(async () => {
      // If process already exited, the 'exit' handler will have resolved
      if (settled) return

      // Process is still alive — try a health check on the PORT
      let healthCheck: { status: number; ok: boolean } | null = null
      try {
        healthCheck = await new Promise<{ status: number; ok: boolean }>((res, rej) => {
          const req = http.get(`http://127.0.0.1:${PORT}/`, (resp) => {
            res({ status: resp.statusCode ?? 0, ok: (resp.statusCode ?? 0) < 500 })
          })
          req.on('error', () => rej(null))
          req.setTimeout(2000, () => { req.destroy(); rej(null) })
        })
      } catch {
        // Health check failed — process is alive but not serving yet, or no route
        // Still counts as success since the process didn't crash
        healthCheck = null
      }

      finish({
        success: true,
        stdout: stdout.slice(-2000),
        stderr: stderr.slice(-2000),
        durationMs: Date.now() - start,
        healthCheck,
      })
    }, 5000)
  })
}
