import type { Metadata } from 'next'
import { Exo_2, Nunito, JetBrains_Mono } from 'next/font/google'
import './globals.css'

// Exo 2 headers + TextPressure
const exo2 = Exo_2({
  subsets: ['latin'],
  variable: '--font-exo2',
  weight: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
  display: 'swap',
})

// Nunito — body/UI font (SFTschrifted falls back here until @font-face loads)
const nunito = Nunito({
  subsets: ['latin'],
  variable: '--font-nunito',
  weight: ['400', '600', '700', '800', '900'],
  display: 'swap',
})

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono-jb',
  weight: ['400', '600'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'ShipCity',
  description: 'Your project\'s a port town. We\'ll help you build it into a city.'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${exo2.variable} ${nunito.variable} ${mono.variable} font-ui bg-ink text-white min-h-screen`}>
        {children}
      </body>
    </html>
  )
}
