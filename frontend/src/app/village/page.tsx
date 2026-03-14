// app/village/page.tsx
// Entry point for the /village route.
// Delegates to VillageClient which handles auth hydration and socket lifecycle.

import VillageClient from './VillageClient'

export default function VillagePage() {
  return <VillageClient />
}
