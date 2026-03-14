// types/index.ts
// Central type definitions shared across the entire frontend.
// Every domain concept (buildings, messages, scan state, websocket events) lives here
// so components and hooks stay in sync without importing from each other.

// BuildingId — one value per production-readiness category.
// Each ID maps to exactly one analyzer on the server and one 3D building in the scene.
export type BuildingId =
  | 'tests'
  | 'cicd'
  | 'docker'
  | 'documentation'
  | 'envVars'
  | 'security'
  | 'logging'
  | 'deployment'

// BuildingStatus drives the visual state of a building in the 3D scene.
// 'idle' → hasn't been scanned yet; 'scanning' → in-flight; the rest reflect score.
export type BuildingStatus = 'idle' | 'scanning' | 'empty' | 'partial' | 'complete'

export interface Task {
  id: string
  label: string
  done: boolean
}

// BuildingState is the per-building slice of global store state.
// It combines scanner results (percent, tasks) with per-building chat history,
// so each building's agent conversation is isolated and persistent within the session.
export interface BuildingState {
  id: BuildingId
  status: BuildingStatus
  percent: number // 0 | 25 | 50 | 75 | 100
  tasks: Task[]
  chatHistory: Message[]
}

export type MessageRole = 'user' | 'assistant'

// Message represents a single turn in a building's agent chat.
// codeBlocks are parsed out of the assistant's response and rendered
// in CodePreview so the user can accept/reject them individually.
export interface Message {
  id: string
  role: MessageRole
  content: string
  codeBlocks?: CodeBlock[]
  timestamp: number
}

// CodeBlock carries a single file suggestion from the agent.
// path is the repo-relative path; content is the full file text.
export interface CodeBlock {
  path: string
  content: string
  language: string
}

// CodeChange is written to the session's changesQueue when the user
// clicks Accept on a CodePreview. The queue is later zipped for export.
export interface CodeChange {
  id: string
  buildingId: BuildingId
  files: { path: string; content: string; isNew: boolean }[]
  acceptedAt: number
}

export type ScanStatus = 'idle' | 'scanning' | 'complete' | 'error'

// GitHubUser is the public user summary returned by GET /api/auth/me.
// The access token never leaves the server — this is all the frontend needs.
export interface GitHubUser {
  login: string
  name: string | null
  avatarUrl: string
}

// WebSocket message shapes from server — discriminated union keyed on `type`.
// useSocket.ts switches on these to drive store updates in real time.
export type WsMessage =
  | { type: 'scanning'; building: BuildingId }
  | { type: 'result'; building: BuildingId; percent: number; tasks: Task[] }
  | { type: 'complete'; score: number }
  | { type: 'error'; message: string }
