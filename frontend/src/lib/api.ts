// lib/api.ts
// Typed wrappers around every REST endpoint the server exposes.
// All fetch calls live here so the rest of the app never constructs URLs or
// reads raw Response objects — only strongly-typed results or thrown Errors.
// The base URL falls back to localhost for local dev.

import type { BuildingId, Message, Task } from '@/types'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

// POST /api/scan — kicks off a background scan for the given repo.
// Returns a sessionId immediately; actual results arrive over WebSocket.
export async function startScan(repoUrl: string): Promise<{ sessionId: string }> {
  const res = await fetch(`${API_BASE}/api/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ repoUrl }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Failed to start scan: ${text}`)
  }
  return res.json() as Promise<{ sessionId: string }>
}

// POST /api/chat — sends a user message to a building's specialist agent.
// Includes the full chat history so the agent has conversation context.
export async function sendChatMessage(params: {
  sessionId: string
  buildingId: BuildingId
  message: string
  history: Message[]
  taskIds?: string[]
}): Promise<{ reply: Message }> {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(params),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Chat request failed: ${text}`)
  }
  return res.json() as Promise<{ reply: Message }>
}

// POST /api/accept — persists accepted code files to the server session
// so they're included when the user requests a zip export.
// Returns the building's updated percent and task list so the UI can reflect progress.
export async function acceptChange(params: {
  sessionId: string
  buildingId: BuildingId
  files: { path: string; content: string; isNew: boolean }[]
}): Promise<{ percent: number; tasks: Task[]; score: number }> {
  const res = await fetch(`${API_BASE}/api/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(params),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Accept change failed: ${text}`)
  }
  return res.json() as Promise<{ percent: number; tasks: Task[]; score: number }>
}

// POST /api/export — downloads all accepted changes for this session as a zip.
// Returns raw Blob so the caller can trigger a browser download.
export async function exportChanges(params: {
  sessionId: string
  format: 'zip'
}): Promise<Blob> {
  const res = await fetch(`${API_BASE}/api/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(params),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Export failed: ${text}`)
  }
  return res.blob()
}

// POST /api/implement — runs the aider + evaluator loop for the given tasks.
// Progress streams via Socket.IO; this resolves once the full loop is done.
export async function implementTasks(params: {
  sessionId: string
  buildingId: BuildingId
  taskIds: string[]
  message?: string
}): Promise<{ success: boolean; completedTaskIds: string[]; percent: number; score: number }> {
  const res = await fetch(`${API_BASE}/api/implement`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(params),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Implement failed: ${text}`)
  }
  return res.json() as Promise<{ success: boolean; completedTaskIds: string[]; percent: number; score: number }>
}

// POST /api/evaluate — checks which tasks are now fulfilled in the repo.
// Returns per-task pass/fail with feedback and the updated percent + score.
export async function evaluateTasks(params: {
  sessionId: string
  buildingId: BuildingId
  taskIds?: string[]
}): Promise<{
  results: Array<{ taskId: string; pass: boolean; feedback?: string; summary?: string }>
  percent: number
  score: number
  skipped?: boolean
  message?: string
}> {
  const res = await fetch(`${API_BASE}/api/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(params),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Evaluate failed: ${text}`)
  }
  return res.json() as Promise<{
    results: Array<{ taskId: string; pass: boolean; feedback?: string; summary?: string }>
    percent: number
    score: number
    skipped?: boolean
    message?: string
  }>
}
