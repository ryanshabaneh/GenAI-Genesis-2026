import type { BuildingId } from '@/types'

export interface BuildingTheme {
  primary: string
  secondary: string
  glow: string
  gradient: { from: string; via?: string; to: string }
}

export interface BuildingConfig {
  id: BuildingId
  name: string
  category: string
  description: string
  position: [number, number, number]
  modelPath: string
  // folder name inside /3dicons/generic/dynamic/ — use iconPath() helper for full src
  iconName: string
  theme: BuildingTheme
  // power plant + vault must be healthy before other buildings are well-founded
  isFoundation?: boolean
  // shown in BuildingPanel OVERVIEW when foundation buildings aren't complete (educational, never blocking)
  foundationBlurb?: string
}

export const BUILDINGS: BuildingConfig[] = [
  {
    id: 'envVars',
    name: 'Power Plant',
    category: 'Env Vars',
    description: 'Checks for .env.example, gitignore rules, and dotenv setup',
    position: [3, 0, 1],
    modelPath: '/models/powerplant.glb',
    iconName: 'flash',
    isFoundation: true,
    theme: {
      primary: '#3ECFB2',
      secondary: '#22C55E',
      glow: 'rgba(62,207,178,0.6)',
      gradient: { from: '#22C55E', to: '#3ECFB2' },
    },
  },
  {
    id: 'security',
    name: 'Vault',
    category: 'Security',
    description: 'Checks for .gitignore, secret exposure, and basic security hygiene',
    position: [-4, 0, 4],
    modelPath: '/models/vault.glb',
    iconName: 'shield',
    isFoundation: true,
    theme: {
      primary: '#EF4444',
      secondary: '#A78BFA',
      glow: 'rgba(239,68,68,0.55)',
      gradient: { from: '#EF4444', via: '#C026D3', to: '#A78BFA' },
    },
  },
  {
    id: 'tests',
    name: 'School',
    category: 'Tests',
    description: 'Checks for test framework, test files, and test coverage',
    position: [-4, 0, -3],
    modelPath: '/models/school.glb',
    iconName: 'tick',
    foundationBlurb: "Tests without a secure environment are like grading papers in a hurricane. Lock down the Power Plant and Vault first — then we'll grade on a curve.",
    theme: {
      primary: '#00D4FF',
      secondary: '#4A78D4',
      glow: 'rgba(0,212,255,0.55)',
      gradient: { from: '#4A78D4', to: '#00D4FF' },
    },
  },
  {
    id: 'cicd',
    name: 'Factory',
    category: 'CI/CD',
    description: 'Checks for GitHub Actions workflows and automated pipelines',
    position: [0, 0, -4],
    modelPath: '/models/factory.glb',
    iconName: 'setting',
    foundationBlurb: "Automating your pipeline is great. Automating the leaking of your secrets? Slightly less great. Wire up the Power Plant and Vault first.",
    theme: {
      primary: '#A78BFA',
      secondary: '#4A78D4',
      glow: 'rgba(167,139,250,0.55)',
      gradient: { from: '#A78BFA', to: '#4A78D4' },
    },
  },
  {
    id: 'docker',
    name: 'Container Terminal',
    category: 'Docker',
    description: 'Checks for Dockerfile, .dockerignore, and docker-compose setup',
    position: [4, 0, -3],
    modelPath: '/models/dock.glb',
    iconName: 'cube',
    foundationBlurb: "Your containers are only as airtight as the secrets inside them. Seal the Vault and Power Plant before loading cargo.",
    theme: {
      primary: '#3ECFB2',
      secondary: '#00D4FF',
      glow: 'rgba(62,207,178,0.55)',
      gradient: { from: '#00D4FF', to: '#3ECFB2' },
    },
  },
  {
    id: 'documentation',
    name: 'Town Hall',
    category: 'Documentation',
    description: 'Checks README quality: description, setup instructions, badges',
    position: [-3, 0, 1],
    modelPath: '/models/townhall.glb',
    iconName: 'file-text',
    foundationBlurb: "Great docs. Would be a shame if someone found a hardcoded API key in the examples. Secure the foundation first, then tell the world.",
    theme: {
      primary: '#FFC940',
      secondary: '#F59E0B',
      glow: 'rgba(255,201,64,0.55)',
      gradient: { from: '#F59E0B', to: '#FFC940' },
    },
  },
  {
    id: 'logging',
    name: 'Watchtower',
    category: 'Logging',
    description: 'Checks for structured logging library and absence of raw console.log',
    position: [0, 0, 4],
    modelPath: '/models/watchtower.glb',
    iconName: 'bell',
    foundationBlurb: "Logging everything — including whatever's in your .env? Bold choice. Patch the Power Plant and Vault first, then we can watch properly.",
    theme: {
      primary: '#FB923C',
      secondary: '#FFC940',
      glow: 'rgba(251,146,60,0.55)',
      gradient: { from: '#FFC940', to: '#FB923C' },
    },
  },
  {
    id: 'deployment',
    name: 'Shipping Dock',
    category: 'Deployment',
    description: 'Checks for deployment config: Vercel, Railway, Fly.io, Procfile',
    position: [4, 0, 4],
    modelPath: '/models/launchpad.glb',
    iconName: 'rocket',
    foundationBlurb: "Ready to ship to the world? Your env vars have been waving at everyone since page one. Foundation first — then we launch.",
    theme: {
      primary: '#4A78D4',
      secondary: '#A78BFA',
      glow: 'rgba(74,120,212,0.55)',
      gradient: { from: '#4A78D4', via: '#7C3AED', to: '#A78BFA' },
    },
  },
]

export function getBuildingConfig(id: BuildingId): BuildingConfig {
  return BUILDINGS.find((b) => b.id === id)!
}

export function getFoundationBuildings(): BuildingConfig[] {
  return BUILDINGS.filter((b) => b.isFoundation)
}

export function iconPath(iconName: string): string {
  return `/3dicons/generic/dynamic/${iconName}/${iconName}-dynamic-gradient.png`
}
