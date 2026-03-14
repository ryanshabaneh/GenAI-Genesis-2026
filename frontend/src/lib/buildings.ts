// lib/buildings.ts
// Static configuration for every building in ShipCity.
// Each entry maps a BuildingId to its display metadata (name, emoji, description)
// and its 3D position in the scene. This is the single place to change a building's
// name, position, or model path — the scene and panels both derive from it.

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
    id: 'scripts',
    name: 'Roads',
    category: 'Scripts',
    description: 'Checks for essential package.json scripts (start, build, dev, test, lint)',
    position: [0, 0, 0],
    modelPath: '/models/roads.glb',
  },
  {
    id: 'tests',
    name: 'School',
    category: 'Tests',
    description: 'Checks for test framework, test files, and test coverage',
    position: [-15, 0, -15],
    modelPath: '/models/school.glb',
  },
  {
    id: 'cicd',
    name: 'Factory',
    category: 'CI/CD',
    description: 'Checks for GitHub Actions workflows and automated pipelines',
    position: [15, 0, -15],
    modelPath: '/models/factory.glb',
  },
  {
    id: 'docker',
    name: 'Shipping Dock',
    category: 'Docker',
    description: 'Checks for Dockerfile, .dockerignore, and docker-compose setup',
    position: [-15, 0, 15],
    modelPath: '/models/dock.glb',
  },
  {
    id: 'readme',
    name: 'Town Hall',
    category: 'README',
    description: 'Checks README quality: description, setup instructions, badges',
    position: [15, 0, 15],
    modelPath: '/models/townhall.glb',
  },
  {
    id: 'errorHandling',
    name: 'Hospital',
    category: 'Error Handling',
    description: 'Checks for try/catch, error middleware, and uncaught exception handlers',
    position: [-20, 0, 0],
    modelPath: '/models/hospital.glb',
  },
  {
    id: 'envVars',
    name: 'Power Plant',
    category: 'Env Vars',
    description: 'Checks for .env.example, gitignore rules, and dotenv setup',
    position: [20, 0, 0],
    modelPath: '/models/powerplant.glb',
  },
  {
    id: 'logging',
    name: 'Watchtower',
    category: 'Logging',
    description: 'Checks for structured logging library and absence of raw console.log',
    position: [0, 0, -20],
    modelPath: '/models/watchtower.glb',
  },
  {
    id: 'linting',
    name: 'Police Station',
    category: 'Linting',
    description: 'Checks for ESLint, Prettier config, and lint scripts',
    position: [0, 0, 20],
    modelPath: '/models/police.glb',
  },
  {
    id: 'license',
    name: 'Courthouse',
    category: 'License',
    description: 'Checks for LICENSE file and package.json license field',
    position: [-10, 0, -20],
    modelPath: '/models/courthouse.glb',
  },
  {
    id: 'security',
    name: 'Vault',
    category: 'Security',
    description: 'Checks for .gitignore, secret exposure, and basic security hygiene',
    position: [10, 0, -20],
    modelPath: '/models/vault.glb',
  },
  {
    id: 'healthCheck',
    name: 'Pharmacy',
    category: 'Health Check',
    description: 'Checks for /health and /readiness endpoints in route files',
    position: [-10, 0, 20],
    modelPath: '/models/pharmacy.glb',
  },
  {
    id: 'deployment',
    name: 'Launch Pad',
    category: 'Deployment',
    description: 'Checks for deployment config: Vercel, Railway, Fly.io, Procfile',
    position: [10, 0, 20],
    modelPath: '/models/launchpad.glb',
  },
  {
    id: 'hosting',
    name: 'Server Room',
    category: 'Hosting',
    description: 'Checks for PORT env binding, CORS setup, and NODE_ENV production handling',
    position: [0, 0, 10],
    modelPath: '/models/serverroom.glb',
  },
]
