'use client'

// components/landing/URLInput.tsx
// The single input form on the landing page.
// Validates the URL client-side (must be a GitHub repo), triggers useScan,
// then navigates to /village. Also provides loading and error feedback.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useScan } from '@/hooks/useScan'
import clsx from 'clsx'

// Light validation — we only check the prefix, not full URL parsing,
// to avoid blocking edge-case valid GitHub URLs
function isValidGitHubUrl(url: string): boolean {
  return url.startsWith('https://github.com/') || url.startsWith('github.com/')
}

export default function URLInput() {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()
  const { startScan, isScanning } = useScan()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const trimmed = url.trim()
    if (!isValidGitHubUrl(trimmed)) {
      setError('Please enter a valid GitHub repository URL.')
      return
    }

    // startScan fires the POST, joins the WebSocket room, then we navigate.
    // Navigation happens here rather than inside useScan so the hook stays
    // router-agnostic and testable.
    await startScan(trimmed)
    router.push('/village')
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 w-full max-w-lg">
      <div className="flex gap-2">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://github.com/user/repo"
          disabled={isScanning}
          className={clsx(
            'flex-1 px-4 py-3 rounded-lg bg-gray-800 border text-white placeholder-gray-500',
            'focus:outline-none focus:ring-2 focus:ring-blue-500',
            // Red border signals a validation error without needing an extra icon
            error ? 'border-red-500' : 'border-gray-700'
          )}
        />
        <button
          type="submit"
          disabled={isScanning || url.trim() === ''}
          className={clsx(
            'px-6 py-3 rounded-lg font-semibold transition-colors',
            isScanning
              ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-500 text-white'
          )}
        >
          {isScanning ? 'Analyzing…' : 'Analyze'}
        </button>
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
    </form>
  )
}
