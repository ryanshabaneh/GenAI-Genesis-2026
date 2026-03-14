// server/src/types/index.ts
// Canonical type definitions for the server.
// Session, AnalyzerResult, AcceptedChange, and WsEvent are the shared data
// contracts between routes, analyzers, agents, and Socket.IO events.
// Keep this in sync with the frontend's types/index.ts where types overlap.

// BuildingId — one per analyzer module and one per building in the village scene.
export type BuildingId =
  | 'tests'
  | 'cicd'
  | 'docker'
  | 'documentation'
  | 'envVars'
  | 'security'
  | 'logging'
  | 'deployment'

export interface Task {
  id: string
  label: string
  done: boolean
}

// AnalyzerResult is what every analyzer returns after inspecting the cloned repo.
// percent is always a multiple of 25 (each task is worth 25 or 50 points).
// details is an open bag of analyzer-specific data for debugging.
export interface AnalyzerResult {
  buildingId: BuildingId
  percent: number // 0 | 25 | 50 | 75 | 100
  tasks: Task[]
  details: Record<string, unknown>
}

// Session is the in-memory record for one user's scan and chat session.
// repoPath is set after cloneRepo completes (starts empty).
// results accumulate as each analyzer finishes.
export interface Session {
  id: string
  repoUrl: string
  repoPath: string
  results: Partial<Record<BuildingId, AnalyzerResult>>
  changes: AcceptedChange[]
  createdAt: number
}

// AcceptedChange is appended to the session when a user accepts a code suggestion.
// files are the raw content to write into the zip on export.
export interface AcceptedChange {
  id: string
  buildingId: BuildingId
  files: { path: string; content: string; isNew: boolean }[]
  acceptedAt: number
}

// Message is the shape used for agent chat history passed between client and server.
export interface Message {
  role: 'user' | 'assistant'
  content: string
}

// AgentReply extends Message with optional parsed code blocks from the assistant.
export interface AgentReply extends Message {
  codeBlocks?: Array<{ path: string; content: string; language: string }>
}

// EvaluatorResult is the output of the quality-check evaluator subagent.
export interface EvaluatorResult {
  pass: boolean
  feedback: string
}

// WebSocket event shapes emitted to the session room during and after a scan.
export type WsEvent =
  | { type: 'scanning'; building: BuildingId }
  | { type: 'result'; building: BuildingId; percent: number; tasks: Task[] }
  | { type: 'complete'; score: number }
  | { type: 'error'; message: string }
  | { type: 'agent:start'; building: BuildingId }
  | { type: 'agent:iteration'; building: BuildingId; iteration: number; maxIterations: number; feedback: string }
  | { type: 'agent:complete'; building: BuildingId; percent: number; files: string[] }
  | { type: 'agent:error'; building: BuildingId; error: string }
  | { type: 'orchestrator:complete'; score: number }
