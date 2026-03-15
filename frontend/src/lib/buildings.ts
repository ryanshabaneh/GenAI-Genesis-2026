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
      primary: '#2DD4BF',
      secondary: '#0F766E',
      glow: 'rgba(45,212,191,0.22)',
      gradient: { from: '#0F766E', to: '#2DD4BF' },
    },
  },
  {
    id: 'security',
    name: 'Security Vault',
    category: 'Security',
    description: 'Checks for .gitignore, secret exposure, and basic security hygiene',
    position: [-4, 0, 4],
    modelPath: '/models/vault.glb',
    iconName: 'lock',
    isFoundation: true,
    theme: {
      primary: '#818CF8',
      secondary: '#3730A3',
      glow: 'rgba(129,140,248,0.22)',
      gradient: { from: '#3730A3', to: '#818CF8' },
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
      primary: '#60A5FA',
      secondary: '#1D4ED8',
      glow: 'rgba(96,165,250,0.22)',
      gradient: { from: '#1D4ED8', to: '#60A5FA' },
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
      primary: '#C4B5FD',
      secondary: '#6D28D9',
      glow: 'rgba(196,181,253,0.22)',
      gradient: { from: '#6D28D9', to: '#C4B5FD' },
    },
  },
  {
    id: 'docker',
    name: 'Cargo',
    category: 'Docker',
    description: 'Checks for Dockerfile, .dockerignore, and docker-compose setup',
    position: [4, 0, -3],
    modelPath: '/models/dock.glb',
    iconName: 'cube',
    foundationBlurb: "Your containers are only as airtight as the secrets inside them. Seal the Vault and Power Plant before loading cargo.",
    theme: {
      primary: '#7DD3FC',
      secondary: '#0369A1',
      glow: 'rgba(125,211,252,0.22)',
      gradient: { from: '#0369A1', to: '#7DD3FC' },
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
      primary: '#94A3B8',
      secondary: '#334155',
      glow: 'rgba(148,163,184,0.18)',
      gradient: { from: '#334155', to: '#94A3B8' },
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
      primary: '#6EE7B7',
      secondary: '#047857',
      glow: 'rgba(110,231,183,0.2)',
      gradient: { from: '#047857', to: '#6EE7B7' },
    },
  },
  {
    id: 'deployment',
    name: 'Shipping Port',
    category: 'Deployment',
    description: 'Checks for deployment config: Vercel, Railway, Fly.io, Procfile',
    position: [4, 0, 4],
    modelPath: '/models/launchpad.glb',
    iconName: 'rocket',
    foundationBlurb: "Ready to ship to the world? Your env vars have been waving at everyone since page one. Foundation first — then we launch.",
    theme: {
      primary: '#93C5FD',
      secondary: '#1E40AF',
      glow: 'rgba(147,197,253,0.22)',
      gradient: { from: '#1E40AF', to: '#93C5FD' },
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
  return `/3dicons/generic/dynamic/${iconName}/${iconName}-dynamic-clay.png`
}
