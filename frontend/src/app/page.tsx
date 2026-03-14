// app/page.tsx
// Landing page — the entry point users see first.
// Its only job is to collect the GitHub URL via URLInput and kick off the scan.
// After useScan resolves, URLInput navigates the user to /village automatically.

import URLInput from '@/components/landing/URLInput'

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="mb-10 text-center">
        <h1 className="text-5xl font-bold tracking-tight mb-3">🏙️ ShipCity</h1>
        <p className="text-gray-400 text-lg max-w-md">
          Paste your GitHub repo URL and watch it transform into a production-ready city.
        </p>
      </div>
      <URLInput />
    </main>
  )
}
