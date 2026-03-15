import type { Metadata } from 'next'
import { Gabarito, Nunito, JetBrains_Mono } from 'next/font/google'
import './globals.css'

// Gabarito — UI font (labels, descriptions, body copy)
const gabarito = Gabarito({
  subsets: ['latin'],
  variable: '--font-gabarito',
  weight: ['400', '500', '600', '700', '800', '900'],
  display: 'swap',
})

// Nunito — fallback while SFTSchriftedRound loads from local @font-face
const nunito = Nunito({
  subsets: ['latin'],
  variable: '--font-nunito',
  weight: ['400', '600', '700', '800', '900'],
  display: 'swap',
})

// JetBrains Mono — terminal output, code diffs, techy labels
const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono-jb',
  weight: ['400', '500', '600'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Shipyard',
  description: "Your project's a port town. We'll help you build it into a city.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${gabarito.variable} ${nunito.variable} ${mono.variable} font-ui bg-ink text-white min-h-screen`}>
        {children}
      </body>
    </html>
  )
}
