// lib/buildings.ts
// Static configuration for every building in ShipCity.
// Each entry maps a BuildingId to its display metadata (name, emoji, description)
// and its 3D position in the scene. This is the single place to change a building's
// name, position, or model path — the scene and panels both derive from it.

import type { BuildingId } from '@/types'

export interface BuildingConfig {
  id: BuildingId
  name: string
  emoji: string
  category: string
  description: string
  // [x, y, z] position in Three.js world units
  position: [number, number, number]
  // Path to the glTF model file under /public/models/ (not yet loaded — placeholder for v2)
  modelPath: string
}

export const BUILDINGS: BuildingConfig[] = [
  {
    id: 'tests',
    name: 'School',
    emoji: '🏫',
    category: 'Tests',
    description: 'Checks for test framework, test files, and test coverage',
    position: [-4, 0, -3],
    modelPath: '/models/school.glb',
  },
  {
    id: 'cicd',
    name: 'Factory',
    emoji: '🏭',
    category: 'CI/CD',
    description: 'Checks for GitHub Actions workflows and automated pipelines',
    position: [0, 0, -4],
    modelPath: '/models/factory.glb',
  },
  {
    id: 'docker',
    name: 'Shipping Dock',
    emoji: '🚢',
    category: 'Docker',
    description: 'Checks for Dockerfile, .dockerignore, and docker-compose setup',
    position: [4, 0, -3],
    modelPath: '/models/dock.glb',
  },
  {
    id: 'readme',
    name: 'Town Hall',
    emoji: '🏛️',
    category: 'README',
    description: 'Checks README quality: description, setup instructions, badges',
    position: [-3, 0, 1],
    modelPath: '/models/townhall.glb',
  },
  {
    id: 'envVars',
    name: 'Power Plant',
    emoji: '⚡',
    category: 'Env Vars',
    description: 'Checks for .env.example, gitignore rules, and dotenv setup',
    position: [3, 0, 1],
    modelPath: '/models/powerplant.glb',
  },
  {
    id: 'security',
    name: 'Vault',
    emoji: '🏦',
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
    emoji: '🚀',
    category: 'Deployment',
    description: 'Checks for deployment config: Vercel, Railway, Fly.io, Procfile',
    position: [4, 0, 4],
    modelPath: '/models/launchpad.glb',
  },
]
