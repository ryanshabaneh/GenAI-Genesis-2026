import type { Metadata } from 'next'
import { Nunito, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const nunito = Nunito({
  subsets: ['latin'],
  variable: '--font-nunito',
  weight: ['400', '600', '700', '800', '900'],
})

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono-jb',
  weight: ['400', '600'],
})

export const metadata: Metadata = {
  title: 'ShipCity',
  description: 'Turn your GitHub repo into a production-ready city.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${nunito.variable} ${mono.variable} font-ui bg-ink text-white min-h-screen`}>
        {children}
      </body>
    </html>
  )
}
