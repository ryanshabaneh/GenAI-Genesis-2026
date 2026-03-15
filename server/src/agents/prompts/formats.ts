// server/src/agents/prompts/formats.ts
// Central source of truth for all agent response format instructions.
// Every agent that needs structured output imports its format string from here.
// See server/docs/response-formats.md for the full spec.

/**
 * Chat agent: conversational responses with optional code blocks.
 * Appended to each building's system prompt for chat mode.
 */
export const CHAT_FORMAT = `IMPORTANT: Always confirm with the user before suggesting any code modifications. Describe what you plan to change and why, then wait for the user's approval before outputting code blocks.

When the user confirms, output each file like this:
// File: path/to/file
\`\`\`language
...code...
\`\`\`

Use the actual file path where the code should live. Use the correct language tag (typescript, yaml, dockerfile, markdown, toml, etc.).`

/**
 * Implementation agent: precise instructions for aider (code editor).
 * Appended to the building system prompt when in implementation mode.
 */
export const IMPLEMENTATION_FORMAT = `Your output will be given to a code editing tool (aider) that has full access to the repository via tree-sitter.
Be specific: name exact files to create or modify, and describe the changes precisely.
Do NOT use the "// File:" code block format — the code editor will handle file creation.
Focus on what to implement, not explaining concepts.
Give clear, step-by-step implementation instructions that a code editor can follow mechanically.`

/**
 * Analyzer agent: JSON array of tasks (per-building format, used in eval scripts).
 */
export const ANALYZER_FORMAT = `Return ONLY a JSON array of task objects. No markdown, no explanation, just the array:
[
  { "id": "unique-id", "label": "Human-readable task description", "done": false },
  ...
]`

/**
 * Evaluator agent: raw JSON object (no markdown fences).
 * Used as the system prompt for callEvaluator() and evaluateRepoState().
 */
export const EVALUATOR_FORMAT = `Respond with ONLY a JSON object — no markdown fences, no explanation:
{ "pass": true, "feedback": "", "summary": "Brief 1-2 sentence summary of what was accomplished" }

If the code fails any check, set pass to false and explain what needs fixing in feedback:
{ "pass": false, "feedback": "The test file imports a module that doesn't exist.", "summary": "Attempted to add unit tests but imports are broken" }`

/**
 * Repo evaluator: same JSON shape as EVALUATOR_FORMAT but for checking repo state.
 */
export const REPO_EVALUATOR_FORMAT = `Respond with ONLY a JSON object — no markdown fences, no explanation:
{ "pass": true, "feedback": "", "summary": "Brief 1-2 sentence summary of what exists in the repo" }

If the task is NOT fulfilled:
{ "pass": false, "feedback": "Explain what's missing or incomplete", "summary": "" }`
