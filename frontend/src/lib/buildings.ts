import type { BuildingId } from '@/types'

export interface BuildingConfig {
  id: BuildingId
  name: string
  category: string
  description: string
  position: [number, number, number]
  modelPath: string
}

export const BUILDINGS: BuildingConfig[] = [
  {
    id: 'tests',
    name: 'School',
    category: 'Tests',
    description: 'Checks for test framework, test files, and test coverage',
    position: [-4, 0, -3],
    modelPath: '/models/school.glb',
  },
  {
    id: 'cicd',
    name: 'Factory',
    category: 'CI/CD',
    description: 'Checks for GitHub Actions workflows and automated pipelines',
    position: [0, 0, -4],
    modelPath: '/models/factory.glb',
  },
  {
    id: 'docker',
    name: 'Shipping Dock',
    category: 'Docker',
    description: 'Checks for Dockerfile, .dockerignore, and docker-compose setup',
    position: [4, 0, -3],
    modelPath: '/models/dock.glb',
  },
  {
    id: 'documentation',
    name: 'Town Hall',
    emoji: '🏛️',
    category: 'Documentation',
    description: 'Checks README quality: description, setup instructions, badges',
    position: [-3, 0, 1],
    modelPath: '/models/townhall.glb',
  },
  {
    id: 'envVars',
    name: 'Power Plant',
    category: 'Env Vars',
    description: 'Checks for .env.example, gitignore rules, and dotenv setup',
    position: [3, 0, 1],
    modelPath: '/models/powerplant.glb',
  },
  {
    id: 'security',
    name: 'Vault',
    category: 'Security',
    description: 'Checks for .gitignore, secret exposure, and basic security hygiene',
    position: [-4, 0, 4],
    modelPath: '/models/vault.glb',
  },
  {
    id: 'logging',
    name: 'Watchtower',
    emoji: '🗼',
    category: 'Logging',
    description: 'Checks for structured logging library and absence of raw console.log',
    position: [0, 0, 4],
    modelPath: '/models/watchtower.glb',
  },
  {
    id: 'deployment',
    name: 'Launch Pad',
    category: 'Deployment',
    description: 'Checks for deployment config: Vercel, Railway, Fly.io, Procfile',
    position: [4, 0, 4],
    modelPath: '/models/launchpad.glb',
  },
]
