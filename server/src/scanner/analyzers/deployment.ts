import fs from 'fs'
import path from 'path'
import type { Analyzer, AnalyzerContext } from './base'
import type { AnalyzerResult, Task } from '../../types'

const DEPLOY_CONFIG_FILES = [
  'vercel.json',
  'railway.toml',
  'railway.json',
  'fly.toml',
  'render.yaml',
  'netlify.toml',
  'Procfile',
]

const SOURCE_FILE_EXT = /\.[jt]sx?$|\.py$|\.go$|\.rb$/
const PORT_PATTERNS = [
  /process\.env\.PORT/,                         // Node
  /os\.environ(?:\.get)?\s*[\(\[]\s*['"]PORT['"]/,  // Python os.environ.get("PORT") / os.environ["PORT"]
  /os\.getenv\s*\(\s*['"]PORT['"]/i,            // Python os.getenv / Go os.Getenv
  /ENV\s*\[\s*['"]PORT['"]\]/,                  // Ruby
]

function usesEnvPort(repoPath: string): boolean {
  const srcDir = path.join(repoPath, 'src')
  const searchDir = fs.existsSync(srcDir) ? srcDir : repoPath
  const walk = (current: string): boolean => {
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(current, { withFileTypes: true })
    } catch {
      return false
    }
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) {
        if (walk(full)) return true
      } else if (entry.isFile() && SOURCE_FILE_EXT.test(entry.name)) {
        try {
          const src = fs.readFileSync(full, 'utf8')
          if (PORT_PATTERNS.some((p) => p.test(src))) return true
        } catch { /* ignore */ }
      }
    }
    return false
  }
  return walk(searchDir)
}

/** Check for Go cmd/subdir/main.go pattern (standard Go project layout) */
function hasMainGoInCmd(repoPath: string): boolean {
  const cmdDir = path.join(repoPath, 'cmd')
  if (!fs.existsSync(cmdDir)) return false
  try {
    const entries = fs.readdirSync(cmdDir, { withFileTypes: true })
    return entries.some((e) =>
      e.isDirectory() && fs.existsSync(path.join(cmdDir, e.name, 'main.go'))
    )
  } catch {
    return false
  }
}

/** Detect the project's framework and type from package.json and file structure */
function detectProjectType(ctx: AnalyzerContext): {
  framework: string | null
  isFullStack: boolean
  isStaticSite: boolean
  hasDatabase: boolean
  detectedServices: string[]
  detectedPlatform: string | null
} {
  const deps = {
    ...(ctx.packageJson?.['dependencies'] as Record<string, string> ?? {}),
    ...(ctx.packageJson?.['devDependencies'] as Record<string, string> ?? {}),
  }

  // Framework detection
  let framework: string | null = null
  if (deps['next']) framework = 'nextjs'
  else if (deps['nuxt'] || deps['nuxt3']) framework = 'nuxt'
  else if (deps['@sveltejs/kit']) framework = 'sveltekit'
  else if (deps['@remix-run/node'] || deps['@remix-run/react']) framework = 'remix'
  else if (deps['gatsby']) framework = 'gatsby'
  else if (deps['astro']) framework = 'astro'
  else if (deps['express'] || deps['fastify'] || deps['@nestjs/core'] || deps['hono'] || deps['koa']) framework = 'backend'
  else if (deps['react'] || deps['vue'] || deps['svelte'] || deps['@angular/core']) framework = 'spa'

  // Full-stack vs static
  const isFullStack = framework === 'backend' || framework === 'nextjs' || framework === 'nuxt' || framework === 'sveltekit' || framework === 'remix'
  const isStaticSite = framework === 'spa' || framework === 'gatsby' || framework === 'astro'

  // Database / service detection
  const detectedServices: string[] = []
  if (deps['@supabase/supabase-js'] || deps['@supabase/ssr'] || deps['@supabase/auth-helpers-nextjs']) detectedServices.push('supabase')
  if (deps['@prisma/client'] || deps['prisma']) detectedServices.push('prisma')
  if (deps['pg'] || deps['postgres'] || deps['@neondatabase/serverless']) detectedServices.push('postgres')
  if (deps['mongoose'] || deps['mongodb']) detectedServices.push('mongodb')
  if (deps['redis'] || deps['ioredis'] || deps['@upstash/redis']) detectedServices.push('redis')
  if (deps['@aws-sdk/client-s3'] || deps['aws-sdk']) detectedServices.push('aws')
  if (deps['firebase'] || deps['firebase-admin']) detectedServices.push('firebase')
  if (deps['drizzle-orm']) detectedServices.push('drizzle')
  if (deps['typeorm']) detectedServices.push('typeorm')
  if (deps['stripe']) detectedServices.push('stripe')

  const hasDatabase = detectedServices.some((s) =>
    ['supabase', 'prisma', 'postgres', 'mongodb', 'redis', 'drizzle', 'typeorm', 'firebase'].includes(s)
  )

  // Check .env.example for DATABASE_URL patterns
  const envExample = path.join(ctx.repoPath, '.env.example')
  if (fs.existsSync(envExample)) {
    try {
      const envContent = fs.readFileSync(envExample, 'utf8')
      if (/DATABASE_URL/i.test(envContent) && !hasDatabase) detectedServices.push('database-url')
      if (/SUPABASE/i.test(envContent) && !detectedServices.includes('supabase')) detectedServices.push('supabase')
      if (/REDIS/i.test(envContent) && !detectedServices.includes('redis')) detectedServices.push('redis')
    } catch { /* ignore */ }
  }

  // Detect existing platform from config files
  let detectedPlatform: string | null = null
  if (fs.existsSync(path.join(ctx.repoPath, 'vercel.json'))) detectedPlatform = 'vercel'
  else if (fs.existsSync(path.join(ctx.repoPath, 'netlify.toml'))) detectedPlatform = 'netlify'
  else if (fs.existsSync(path.join(ctx.repoPath, 'fly.toml'))) detectedPlatform = 'fly.io'
  else if (fs.existsSync(path.join(ctx.repoPath, 'railway.toml')) || fs.existsSync(path.join(ctx.repoPath, 'railway.json'))) detectedPlatform = 'railway'
  else if (fs.existsSync(path.join(ctx.repoPath, 'render.yaml'))) detectedPlatform = 'render'
  else if (fs.existsSync(path.join(ctx.repoPath, 'wrangler.toml'))) detectedPlatform = 'cloudflare'

  // Detect from Vercel-specific deps even without vercel.json
  if (!detectedPlatform && (deps['@vercel/analytics'] || deps['@vercel/og'] || deps['@vercel/postgres'] || deps['@vercel/kv'])) {
    detectedPlatform = 'vercel'
  }

  return { framework, isFullStack, isStaticSite, hasDatabase, detectedServices, detectedPlatform }
}

export const deploymentAnalyzer: Analyzer = {
  buildingId: 'deployment',

  async analyze(ctx: AnalyzerContext): Promise<AnalyzerResult> {
    const hasDeployConfig = DEPLOY_CONFIG_FILES.some((name) =>
      fs.existsSync(path.join(ctx.repoPath, name))
    )

    const scripts =
      ctx.packageJson &&
      typeof ctx.packageJson['scripts'] === 'object' &&
      ctx.packageJson['scripts'] !== null
        ? (ctx.packageJson['scripts'] as Record<string, unknown>)
        : {}
    const hasBuildScript =
      'build' in scripts ||
      fs.existsSync(path.join(ctx.repoPath, 'Makefile')) ||
      fs.existsSync(path.join(ctx.repoPath, 'build.gradle')) ||
      fs.existsSync(path.join(ctx.repoPath, 'pyproject.toml')) ||
      fs.existsSync(path.join(ctx.repoPath, 'go.mod'))   // Go: go build
    const hasStartScript =
      'start' in scripts ||
      fs.existsSync(path.join(ctx.repoPath, 'Procfile')) ||
      fs.existsSync(path.join(ctx.repoPath, 'main.py')) ||
      fs.existsSync(path.join(ctx.repoPath, 'main.go')) ||
      hasMainGoInCmd(ctx.repoPath)                        // Go: cmd/*/main.go
    const hasEnvPort = usesEnvPort(ctx.repoPath)

    const projectInfo = detectProjectType(ctx)

    const tasks: Task[] = [
      { id: 'deploy-config', label: 'Deployment config file found (vercel.json, fly.toml, Procfile, etc.)', done: hasDeployConfig },
      { id: 'deploy-build', label: 'Build system detected (package.json script, Makefile, etc.)', done: hasBuildScript },
      { id: 'deploy-start', label: 'Start entrypoint detected (start script, Procfile, main.*)', done: hasStartScript },
      { id: 'deploy-port', label: 'PORT configured via environment variable', done: hasEnvPort },
    ]

    const percent = tasks.filter((t) => t.done).length * 25

    return {
      buildingId: 'deployment',
      percent,
      tasks,
      details: {
        hasDeployConfig,
        hasBuildScript,
        hasStartScript,
        hasEnvPort,
        ...projectInfo,
      },
    }
  },
}
