// lib/tutorial.ts
// All Scout NPC dialogue strings in one place.
// Centralizing them here means we never have UI copy scattered across components,
// and it's easy to iterate on tone without touching component logic.
// The setScoutDialogue store action is called with these strings at trigger points
// throughout the app (scan events, building clicks, milestones, etc.).

export const SCOUT_DIALOGUES = {
  welcome: "Welcome to ShipCity! I'm Scout. Let me take a look at your project...",

  scanStart: 'Surveying the land...',

  // Shown in the ScoreBar area after all analyzers complete
  scanComplete: (score: number) =>
    `Your village is ${score}% production ready. Let's build it up!`,

  // Triggered when the user clicks a building with 0% score
  buildingEmpty: (name: string) =>
    `This empty lot? That's where your ${name} would go...`,

  // Triggered when the user clicks a partially-built building
  buildingPartial: (name: string, percent: number) =>
    `Your ${name} is ${percent}% done — good start!`,

  // Triggered when the user clicks a fully complete building
  buildingComplete: (name: string) =>
    `The ${name} is already in great shape — nice work!`,

  celebrate50: "50% production ready! The town is really coming together!",

  // Fired after a user accepts changes that push a building to 100%
  celebrate100Building: (name: string) =>
    `The ${name} is complete! Look at it shine!`,

  celebrate100:
    "100%! ShipCity is fully built! Your project is production ready. Time to deploy!",

  // Shown when an agent opens in BuildingPanel
  agentGreet: (name: string) =>
    `I'm your ${name} specialist. What would you like to improve?`,

  // Fired after the user accepts a code change
  codeAccepted: (name: string) =>
    `Nice! The ${name} changes have been queued. Keep going!`,

  // Idle nudge shown when the user hasn't clicked anything yet
  nudge: "Click on any building to chat with its specialist agent.",

  exportReady: "All changes are ready to export. Download your improved project!",
}
