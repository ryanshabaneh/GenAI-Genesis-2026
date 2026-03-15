// lib/stages.ts
// Maps analyzer percent scores to visual building stages.
// This is the bridge between a number (0–100) and how a building looks in the 3D
// scene — opacity, scale, and emissive glow all grow as the score improves.
// Building.tsx consumes STAGE_CONFIG to set Three.js material properties.

export type BuildingStage = 'foundation' | 'frame' | 'halfBuilt' | 'almostDone' | 'complete'

// Converts a 0–100 percent score into one of the five visual stages.
// Thresholds are at 25-point intervals to match the task scoring system (each task = 25%).
export function percentToStage(percent: number): BuildingStage {
  if (percent === 0) return 'foundation'
  if (percent <= 25) return 'frame'
  if (percent <= 50) return 'halfBuilt'
  if (percent <= 75) return 'almostDone'
  return 'complete'
}

// Visual parameters for each stage applied to the Three.js meshStandardMaterial.
// emissiveIntensity increases with stage so fully-built buildings glow and
// visually "pop" in the scene. scale drives physical box size.
export const STAGE_CONFIG: Record<
  BuildingStage,
  {
    opacity: number
    scale: number
    emissiveIntensity: number
    wireframe: boolean   // true = ghost outline only (foundation)
    roughness: number    // 1 = matte/raw, 0 = smooth/polished
    metalness: number
    scaffolding: boolean // overlay wireframe mesh for frame/halfBuilt
    description: string
  }
> = {
  foundation: {
    opacity: 0.22, scale: 0.3, emissiveIntensity: 0.0,
    wireframe: true,  roughness: 1.0, metalness: 0.0, scaffolding: false,
    description: 'Foundation laid',
  },
  frame: {
    opacity: 0.38, scale: 0.5, emissiveIntensity: 0.05,
    wireframe: false, roughness: 0.9, metalness: 0.0, scaffolding: true,
    description: 'Frame going up',
  },
  halfBuilt: {
    opacity: 0.62, scale: 0.7, emissiveIntensity: 0.1,
    wireframe: false, roughness: 0.65, metalness: 0.1, scaffolding: true,
    description: 'Half built',
  },
  almostDone: {
    opacity: 0.83, scale: 0.9, emissiveIntensity: 0.22,
    wireframe: false, roughness: 0.35, metalness: 0.25, scaffolding: false,
    description: 'Almost done',
  },
  complete: {
    opacity: 1.0,  scale: 1.0, emissiveIntensity: 0.45,
    wireframe: false, roughness: 0.15, metalness: 0.4, scaffolding: false,
    description: 'Complete',
  },
}
