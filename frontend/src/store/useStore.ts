// store/useStore.ts
// Single Zustand store for all global UI state.
// Components read slices via selector functions (e.g., `s => s.score`) to avoid
// unnecessary re-renders. Every mutation goes through an action defined here —
// no component writes state directly.

import { create } from 'zustand'
import type {
  BuildingId,
  BuildingState,
  BuildingStatus,
  CodeChange,
  DeploymentRecommendation,
  GitHubUser,
  Message,
  ScanStatus,
} from '@/types'
import { BUILDINGS } from '@/lib/buildings'

// Keep this list in sync with BuildingId in types/index.ts.
// It's the source of truth for initializing buildings on store creation.
const ALL_BUILDING_IDS: BuildingId[] = [
  'tests',
  'cicd',
  'docker',
  'documentation',
  'envVars',
  'security',
  'logging',
  'deployment',
]

// Creates a fresh idle BuildingState for every known building.
// Called once at store init so each building starts with a clean slate.
function makeInitialBuildings(): Record<BuildingId, BuildingState> {
  return Object.fromEntries(
    ALL_BUILDING_IDS.map((id) => [
      id,
      {
        id,
        status: 'idle' as BuildingStatus,
        percent: 0,
        tasks: [],
        chatHistory: [],
        implementStatus: 'idle' as const,
        taskFeedback: {},
        selectedTaskIds: [],
      },
    ])
  ) as unknown as Record<BuildingId, BuildingState>
}

// --- Store shape ---

interface ShipyardStore {
  repoUrl: string
  scanStatus: ScanStatus
  score: number
  buildings: Record<BuildingId, BuildingState>
  // Which building the right-side panel is currently showing
  activeBuilding: BuildingId | null
  // Accepted code changes waiting to be exported as a zip
  changesQueue: CodeChange[]
  // Text currently shown in the Scout dialogue bubble
  scoutDialogue: string
  // Authenticated GitHub user — null if not signed in
  githubUser: GitHubUser | null
  // Deployment recommendation from scanner
  deploymentRecommendation: DeploymentRecommendation | null
  // Platform the user chose to deploy to (from PlatformPicker)
  chosenPlatform: string | null

  // Actions
  setRepoUrl: (url: string) => void
  setScanStatus: (status: ScanStatus) => void
  setScore: (score: number) => void
  setBuildingStatus: (id: BuildingId, update: Partial<BuildingState>) => void
  setActiveBuilding: (id: BuildingId | null) => void
  addMessage: (buildingId: BuildingId, message: Message) => void
  addChange: (change: CodeChange) => void
  setScoutDialogue: (text: string) => void
  setGithubUser: (user: GitHubUser | null) => void
  setImplementStatus: (id: BuildingId, status: 'idle' | 'running') => void
  setTaskFeedback: (id: BuildingId, taskId: string, feedback: string) => void
  toggleTaskSelected: (id: BuildingId, taskId: string) => void
  setDeploymentRecommendation: (rec: DeploymentRecommendation) => void
  setChosenPlatform: (platform: string) => void
}

export const useStore = create<ShipyardStore>((set) => ({
  repoUrl: '',
  scanStatus: 'idle',
  score: 0,
  buildings: makeInitialBuildings(),
  activeBuilding: null,
  changesQueue: [],
  scoutDialogue: '',
  githubUser: null,
  deploymentRecommendation: null,
  chosenPlatform: null,

  setRepoUrl: (url) => set({ repoUrl: url }),

  setScanStatus: (status) => set({ scanStatus: status }),

  setScore: (score) => set({ score }),

  // Merges a partial update into a single building's state without touching others.
  // useSocket calls this on every 'result' WebSocket event.
  setBuildingStatus: (id, update) =>
    set((state) => {
      const updatedBuildings = {
        ...state.buildings,
        [id]: { ...state.buildings[id], ...update },
      }
      const score = Math.round(
        ALL_BUILDING_IDS.reduce((sum, bid) => sum + updatedBuildings[bid].percent, 0) /
          ALL_BUILDING_IDS.length
      )
      return { buildings: updatedBuildings, score }
    }),

  setActiveBuilding: (id) => set({ activeBuilding: id }),

  // Appends a message to the specified building's chat history.
  // Each building keeps its own history so conversations don't bleed across tabs.
  addMessage: (buildingId, message) =>
    set((state) => ({
      buildings: {
        ...state.buildings,
        [buildingId]: {
          ...state.buildings[buildingId],
          chatHistory: [...state.buildings[buildingId].chatHistory, message],
        },
      },
    })),

  addChange: (change) =>
    set((state) => ({
      changesQueue: [...state.changesQueue, change],
    })),

  setScoutDialogue: (text) => set({ scoutDialogue: text }),

  setGithubUser: (user) => set({ githubUser: user }),

  setImplementStatus: (id, status) =>
    set((state) => ({
      buildings: {
        ...state.buildings,
        [id]: { ...state.buildings[id], implementStatus: status },
      },
    })),

  setTaskFeedback: (id, taskId, feedback) =>
    set((state) => ({
      buildings: {
        ...state.buildings,
        [id]: {
          ...state.buildings[id],
          taskFeedback: { ...state.buildings[id].taskFeedback, [taskId]: feedback },
        },
      },
    })),

  setDeploymentRecommendation: (rec) => set({ deploymentRecommendation: rec }),

  setChosenPlatform: (platform) => set({ chosenPlatform: platform }),

  toggleTaskSelected: (id, taskId) =>
    set((state) => {
      const current = state.buildings[id].selectedTaskIds
      const next = current.includes(taskId)
        ? current.filter((t) => t !== taskId)
        : current.length >= 3 ? current : [...current, taskId]
      return {
        buildings: {
          ...state.buildings,
          [id]: { ...state.buildings[id], selectedTaskIds: next },
        },
      }
    }),
}))
