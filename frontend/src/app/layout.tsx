// app/layout.tsx
// Next.js root layout — wraps every page with the shared HTML shell.
// Sets the Inter font, dark background, and page-level metadata.
// All pages automatically inherit this wrapper via the Next.js App Router.

import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'ShipCity',
  description: 'Turn your GitHub repo into a production-ready city.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      {/* bg-gray-950 gives the deep dark background consistent across landing and village */}
      <body className={`${inter.className} bg-gray-950 text-white min-h-screen`}>
        {children}
      </body>
    </html>
  )
}
