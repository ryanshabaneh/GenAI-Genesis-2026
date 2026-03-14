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
  GitHubUser,
  Message,
  ScanStatus,
} from '@/types'
import { BUILDINGS } from '@/lib/buildings'

// Derived from BUILDINGS config — buildings.ts is the single source of truth
const ALL_BUILDING_IDS: BuildingId[] = BUILDINGS.map((b) => b.id)

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
      },
    ])
  ) as unknown as Record<BuildingId, BuildingState>
}

// --- Store shape ---

interface ShipCityStore {
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
}

export const useStore = create<ShipCityStore>((set) => ({
  repoUrl: '',
  scanStatus: 'idle',
  score: 0,
  buildings: makeInitialBuildings(),
  activeBuilding: null,
  changesQueue: [],
  scoutDialogue: '',
  githubUser: null,

  setRepoUrl: (url) => set({ repoUrl: url }),

  setScanStatus: (status) => set({ scanStatus: status }),

  setScore: (score) => set({ score }),

  // Merges a partial update into a single building's state without touching others.
  // useSocket calls this on every 'result' WebSocket event.
  setBuildingStatus: (id, update) =>
    set((state) => ({
      buildings: {
        ...state.buildings,
        [id]: {
          ...state.buildings[id],
          ...update,
        },
      },
    })),

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
}))
