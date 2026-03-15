'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useSearchParams } from 'next/navigation'
import { FiGithub } from 'react-icons/fi'
import { SplitHeader } from '@/components/text'
import CurvedLoop from '@/components/text/CurvedLoop'
import LighthouseLogo from '@/components/landing/LighthouseLogo'
import GameModal from './GameModal'
import BubblyButton from './buttonstyles/BubblyButton'
import WaterButton from './buttonstyles/WaterButton'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

const AUTH_ERRORS: Record<string, string> = {
  denied: 'GitHub sign-in was cancelled.',
  error:  'Something went wrong on our end — try again?',
}

export default function LoginOverlay() {
  const params    = useSearchParams()
  const authError = params.get('auth') ? AUTH_ERRORS[params.get('auth')!] : null

  // always false on server — useEffect opens it client-side if auth error in URL
  const [isAuthOpen, setIsAuthOpen] = useState(false)
  useEffect(() => { if (authError) setIsAuthOpen(true) }, [])

  return (
    <>
      {/* landing — header + subheader + CTA, shifted up to reveal more land */}
      <div className="absolute inset-0 flex flex-col items-center justify-center px-6 -translate-y-32">

        {/* glowing orbs rising from the bottom */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {([
            { size: 7,  left: '12%', delay: '0s',   dur: '9s'  },
            { size: 13, left: '27%', delay: '2.5s', dur: '12s' },
            { size: 5,  left: '48%', delay: '0.8s', dur: '7s'  },
            { size: 10, left: '63%', delay: '4s',   dur: '10s' },
            { size: 16, left: '80%', delay: '1.2s', dur: '14s' },
            { size: 6,  left: '38%', delay: '6s',   dur: '8s'  },
            { size: 9,  left: '90%', delay: '3s',   dur: '11s' },
          ] as const).map((orb, i) => (
            <div
              key={i}
              className="landing-orb"
              style={{ width: orb.size, height: orb.size, left: orb.left, animationDelay: orb.delay, animationDuration: orb.dur }}
            />
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col items-center text-center"
        >
          {/* logo mark — halo sits behind it, both bob together */}
          <div className="animate-bob relative" style={{ marginBottom: '2.5rem' }}>
            <div className="lighthouse-glow-halo" />
            <LighthouseLogo size={120} />
          </div>

          <div style={{ marginBottom: '0.75rem' }}>
            <SplitHeader left="Ship" right="Yard" />
          </div>

          <p
            className="text-white/60 leading-relaxed max-w-xs"
            style={{ fontSize: 'clamp(1rem, 2.2vw, 1.25rem)', marginBottom: '3rem', fontFamily: "'Gabarito', sans-serif", fontWeight: 400 }}
          >
            Every codebase deserves to ship.<br />Fix what's broken, then set sail.
          </p>
        </motion.div>

        {/* water CTA — triggers auth modal */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
        >
          <WaterButton
            label="Cast Off"
            onClick={() => setIsAuthOpen(true)}
            className="water-btn--lg"
          />
        </motion.div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 pointer-events-none" style={{ opacity: 0.32 }}>
        <CurvedLoop
          marqueeText="a deep dive into your codebase ✦ bridge the gap ✦ "
          speed={1.1}
          curveAmount={-18}
          direction="left"
          interactive={false}
        />
      </div>

      {/* auth modal — spring pop on button click */}
      <GameModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        icon={<FiGithub />}
      >
        <h3 className="text-white font-display font-black text-xl mb-1">
          Connect GitHub
        </h3>
        <p className="text-white/60 text-sm font-ui mb-5">
          Read-only access. Until you need us.
        </p>

        {authError && (
          <p className="text-white/80 text-xs font-ui bg-white/10 rounded-full px-4 py-1.5 mb-3">
            {authError}
          </p>
        )}

        {/* bubble burst plays for 400ms before navigating — feels intentional */}
        <BubblyButton
          label="Cast Off with GitHub"
          onClick={() => setTimeout(() => { window.location.href = `${API_URL}/api/auth/github` }, 400)}
          className="w-full bubbly-gradient"
        />
      </GameModal>
    </>
  )
}
