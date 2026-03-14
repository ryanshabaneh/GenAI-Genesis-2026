'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useSearchParams } from 'next/navigation'
import { FiGithub } from 'react-icons/fi'
import { SplitHeader } from '@/components/text'
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
      {/* landing — header + subheader + cube CTA, scooted up for city visibility */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-8 px-6 -translate-y-16">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col items-center gap-4 text-center"
        >
          {/* logo mark */}
          <div className="w-14 h-14 rounded-[16px] bg-amber flex items-center justify-center animate-bob glow-blue hover:scale-110 transition-transform duration-[150ms] cursor-pointer">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="8" stroke="#090C12" strokeWidth="2.5"/>
              <circle cx="12" cy="12" r="3" fill="#090C12"/>
            </svg>
          </div>

          <SplitHeader left="Ship" right="Crossing" />

          <p
            className="text-white/60 font-ui leading-relaxed max-w-xs"
            style={{ fontSize: 'clamp(1rem, 2.2vw, 1.25rem)' }}
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
          />
        </motion.div>
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
