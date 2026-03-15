import fs from 'fs'
import path from 'path'
import type { Analyzer, AnalyzerContext } from './base'
import type { AnalyzerResult, DeploymentRecommendation, Task } from '../../types'

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

/** Build a concrete deployment recommendation from detected project info. */
function buildRecommendation(projectInfo: {
  framework: string | null
  isFullStack: boolean
  isStaticSite: boolean
  hasDatabase: boolean
  detectedServices: string[]
  detectedPlatform: string | null
}): DeploymentRecommendation {
  const { framework, isFullStack, isStaticSite, hasDatabase, detectedServices, detectedPlatform } = projectInfo

  // If platform already detected, recommend completing that setup
  if (detectedPlatform) {
    const platformSteps: Record<string, string[]> = {
      vercel: [
        'Run `npx vercel` or connect your GitHub repo at vercel.com/new',
        'Set environment variables in Vercel dashboard → Settings → Environment Variables',
        'Push to main branch — Vercel auto-deploys on push',
        'Check deployment at your-project.vercel.app',
      ],
      netlify: [
        'Connect your GitHub repo at app.netlify.com/start',
        'Set build command and publish directory in netlify.toml',
        'Add environment variables in Netlify dashboard → Site settings → Environment',
        'Push to main branch — Netlify auto-deploys on push',
      ],
      railway: [
        'Run `railway login` then `railway init` in your project',
        'Add services: `railway add` (Postgres, Redis, etc.)',
        'Set environment variables: `railway variables set KEY=VALUE`',
        'Deploy: `railway up` or connect GitHub for auto-deploy',
      ],
      'fly.io': [
        'Run `fly launch` to initialize (uses existing fly.toml)',
        'Set secrets: `fly secrets set KEY=VALUE`',
        'Deploy: `fly deploy`',
        'Check status: `fly status` and `fly logs`',
      ],
      render: [
        'Connect your GitHub repo at dashboard.render.com/new',
        'Render reads render.yaml for service configuration',
        'Add environment variables in the Render dashboard',
        'Push to main branch — Render auto-deploys',
      ],
      cloudflare: [
        'Run `npx wrangler deploy` or connect at dash.cloudflare.com/workers',
        'Set secrets: `npx wrangler secret put KEY`',
        'Configure routes in wrangler.toml',
        'Push to main for auto-deploy via Cloudflare Pages',
      ],
    }

    return {
      platform: detectedPlatform,
      reason: `${detectedPlatform} config already exists in your project`,
      framework,
      services: detectedServices,
      steps: platformSteps[detectedPlatform] ?? [`Deploy using your existing ${detectedPlatform} configuration`],
    }
  }

  // Choose platform based on framework + services
  let platform: string
  let reason: string

  const hasSupabase = detectedServices.includes('supabase')
  const hasWebSockets = detectedServices.includes('redis') || framework === 'backend'

  if (framework === 'nextjs') {
    platform = 'vercel'
    reason = 'Next.js has native zero-config support on Vercel'
  } else if (isStaticSite) {
    platform = 'vercel'
    reason = `${framework ?? 'Static site'} deploys instantly on Vercel with zero config`
  } else if (hasWebSockets || (isFullStack && hasDatabase && !hasSupabase)) {
    platform = 'railway'
    reason = `Full-stack app${hasDatabase ? ' with database' : ''}${hasWebSockets ? ' and real-time features' : ''} — Railway handles this natively`
  } else if (isFullStack && hasSupabase) {
    platform = 'vercel'
    reason = 'Full-stack with Supabase — Vercel + Supabase is the standard pairing'
  } else if (isFullStack) {
    platform = 'railway'
    reason = 'Full-stack backend app — Railway provides the simplest deployment experience'
  } else {
    platform = 'vercel'
    reason = 'Best default for most projects — zero config, generous free tier'
  }

  const steps: string[] = []
  switch (platform) {
    case 'vercel':
      steps.push(
        'Install Vercel CLI: `npm i -g vercel`',
        'Run `vercel` in your project root to link and deploy',
        'Set environment variables: `vercel env add` or in the dashboard',
        ...(hasDatabase ? ['Ensure your database (Supabase/Neon/PlanetScale) allows external connections'] : []),
        'Connect GitHub repo in Vercel dashboard for auto-deploy on push',
        'Your app will be live at your-project.vercel.app',
      )
      break
    case 'railway':
      steps.push(
        'Install Railway CLI: `npm i -g @railway/cli`',
        'Run `railway login` then `railway init`',
        ...(hasDatabase ? ['Add database: `railway add` → select Postgres/Redis'] : []),
        'Set environment variables: `railway variables set KEY=VALUE`',
        'Deploy: `railway up` or connect GitHub for auto-deploy',
        'Get your public URL: `railway domain`',
      )
      break
  }

  return { platform, reason, framework, services: detectedServices, steps }
}

/**
 * Scan source files for process.env.XYZ references and return the var names.
 * Used to cross-reference against .env.example to find undocumented vars.
 */
function findEnvVarsUsedInSource(repoPath: string): string[] {
  const vars = new Set<string>()
  const srcDir = path.join(repoPath, 'src')
  const searchDir = fs.existsSync(srcDir) ? srcDir : repoPath

  const walk = (dir: string) => {
    let entries: fs.Dirent[]
    try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) { walk(full) }
      else if (entry.isFile() && SOURCE_FILE_EXT.test(entry.name)) {
        try {
          const src = fs.readFileSync(full, 'utf8')
          // process.env.VAR_NAME or process.env['VAR_NAME'] or process.env["VAR_NAME"]
          const patterns = [
            /process\.env\.([A-Z_][A-Z0-9_]*)/g,
            /process\.env\[['"]([A-Z_][A-Z0-9_]*)['"]\]/g,
          ]
          for (const pattern of patterns) {
            let m: RegExpExecArray | null
            while ((m = pattern.exec(src)) !== null) {
              if (m[1] !== 'NODE_ENV' && m[1] !== 'PORT') vars.add(m[1])
            }
          }
        } catch { /* ignore */ }
      }
    }
  }
  walk(searchDir)
  return [...vars]
}

/**
 * Read .env.example and return the var names it documents.
 */
function getDocumentedEnvVars(repoPath: string): string[] {
  const candidates = ['.env.example', '.env.template']
  for (const name of candidates) {
    const filePath = path.join(repoPath, name)
    if (!fs.existsSync(filePath)) continue
    try {
      const content = fs.readFileSync(filePath, 'utf8')
      return content.split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'))
        .map((line) => line.split('=')[0].trim())
        .filter((v) => v.length > 0)
    } catch { /* ignore */ }
  }
  return []
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

    // --- New: env var completeness check ---
    const usedVars = findEnvVarsUsedInSource(ctx.repoPath)
    const documentedVars = getDocumentedEnvVars(ctx.repoPath)
    const undocumentedVars = usedVars.filter((v) => !documentedVars.includes(v))
    const envVarsDocumented = undocumentedVars.length === 0 && usedVars.length > 0

    // --- New: database readiness check ---
    const { hasDatabase, detectedServices } = projectInfo
    let dbConfigReady = true // default true if no DB
    if (hasDatabase) {
      // Check if there's a DATABASE_URL or equivalent connection config
      const hasDbUrl = documentedVars.some((v) =>
        /DATABASE|DB_|MONGO|REDIS|SUPABASE_URL|POSTGRES/i.test(v)
      ) || usedVars.some((v) =>
        /DATABASE|DB_|MONGO|REDIS|SUPABASE_URL|POSTGRES/i.test(v)
      )
      // Check if there's a db config file (prisma schema, etc.)
      const hasPrismaSchema = fs.existsSync(path.join(ctx.repoPath, 'prisma', 'schema.prisma'))
      const hasDbConfig = hasDbUrl || hasPrismaSchema ||
        detectedServices.includes('supabase') || detectedServices.includes('firebase')
      dbConfigReady = hasDbConfig
    }

    const tasks: Task[] = [
      { id: 'deploy-config', label: 'Deployment config file present (vercel.json, fly.toml, Procfile, etc.)', done: hasDeployConfig },
      { id: 'deploy-build', label: 'Build script configured (npm run build or equivalent)', done: hasBuildScript },
      { id: 'deploy-start', label: 'Start entrypoint configured (start script, Procfile, main.*)', done: hasStartScript },
      { id: 'deploy-port', label: 'PORT configured via environment variable', done: hasEnvPort },
      { id: 'deploy-env-complete', label: 'All environment variables documented in .env.example', done: envVarsDocumented },
      // These are verified by running the actual commands (Verify Build button)
      { id: 'deploy-build-verify', label: 'Build passes (npm run build succeeds)', done: false },
      { id: 'deploy-start-verify', label: 'App starts without crashing (runs for 5s)', done: false },
    ]

    // Only add DB task if project uses a database
    if (hasDatabase) {
      tasks.push({
        id: 'deploy-db-config',
        label: 'Database connection configured (DATABASE_URL, Prisma schema, or service SDK)',
        done: dbConfigReady,
      })
    }

    const percent = Math.round((tasks.filter((t) => t.done).length / tasks.length) * 100)
    const recommendation = buildRecommendation(projectInfo)

    return {
      buildingId: 'deployment',
      percent,
      tasks,
      details: {
        hasDeployConfig,
        hasBuildScript,
        hasStartScript,
        hasEnvPort,
        envVarsDocumented,
        undocumentedVars,
        dbConfigReady,
        ...projectInfo,
        recommendation,
      },
    }
  },
}
