import type { BuildingId } from '@/types'

// Narration content for the contextual guidance layer.
// Each key maps to 2–3 short lines shown sequentially inside the panel.
// Tone: technical, observational, concise. Not roleplay or metaphor-heavy.

export const INTRO_NARRATION: string[] = [
  'This city represents the infrastructure behind your repository.',
  'Each structure corresponds to a production concern: testing, security, deployment, logging, configuration.',
  'Select a section from the menu to inspect how the project is set up.',
]

export const BUILDING_NARRATION: Record<BuildingId, string[]> = {
  envVars: [
    'This power station manages environment configuration.',
    'Production systems store credentials and secrets in environment variables, not source code.',
    "Use 'Auto Fix' to generate a secure environment template.",
  ],
  security: [
    'This vault represents repository security.',
    'Security checks detect exposed credentials and unsafe configuration before they reach production.',
    "Use 'Evaluate' to run a security inspection on the project.",
  ],
  tests: [
    'This academy represents automated testing.',
    'Tests verify that changes behave correctly before reaching production.',
    "Use 'Auto Fix' to generate test coverage for this project.",
  ],
  cicd: [
    'This factory represents CI/CD pipelines.',
    'Continuous integration automatically builds and validates code on every commit.',
    "Use 'Evaluate' to inspect the pipeline or 'Auto Fix' to generate one.",
  ],
  docker: [
    'This terminal represents application packaging.',
    'Containers ensure the application runs consistently across all environments.',
    "Use 'Auto Fix' to generate a Dockerfile for this repository.",
  ],
  documentation: [
    'This building represents project documentation.',
    'Clear documentation helps developers understand how to run and contribute to the system.',
    "Use 'Evaluate' to review the current README and setup instructions.",
  ],
  logging: [
    'This lighthouse represents logging and observability.',
    'Structured logs are the primary way to diagnose issues once code is running in production.',
    "Use 'Auto Fix' to enable structured logging.",
  ],
  deployment: [
    'This harbor represents deployment infrastructure.',
    'Deployment configuration defines how code moves from a repository into a running service.',
    "Use 'Auto Fix' to prepare deployment configuration.",
  ],
}
