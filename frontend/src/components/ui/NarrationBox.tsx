'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface NarrationBoxProps {
  lines: string[]
}

// Lightweight contextual narration strip.
// Shows lines one at a time with Next / Skip controls.
// Does not block any panel interaction — sits above content, can be dismissed.
export default function NarrationBox({ lines }: NarrationBoxProps) {
  const [idx, setIdx]           = useState(0)
  const [dismissed, setDismiss] = useState(false)

  if (dismissed || lines.length === 0) return null

  const isLast = idx === lines.length - 1

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.2 }}
        className="mx-5 mt-4 mb-1 rounded-[10px] overflow-hidden"
        style={{
          background:     'rgba(74,138,212,0.07)',
          border:         '1px solid rgba(74,138,212,0.18)',
          boxShadow:      'inset 0 1px 0 rgba(255,255,255,0.5)',
        }}
      >
        {/* line counter */}
        <div className="flex items-center justify-between px-3 pt-2 pb-0">
          <span
            className="text-[9px] font-mono uppercase tracking-[2px]"
            style={{ color: 'rgba(74,138,212,0.55)' }}
          >
            {idx + 1} / {lines.length}
          </span>
          <button
            onClick={() => setDismiss(true)}
            className="text-[11px] leading-none transition-opacity duration-[120ms] hover:opacity-100"
            style={{ color: 'rgba(26,51,85,0.35)' }}
            aria-label="Dismiss narration"
          >
            ✕
          </button>
        </div>

        {/* narration line */}
        <AnimatePresence mode="wait">
          <motion.p
            key={idx}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.15 }}
            className="px-3 pt-1.5 pb-2 text-xs font-ui leading-relaxed"
            style={{ color: 'rgba(26,51,85,0.75)' }}
          >
            {lines[idx]}
          </motion.p>
        </AnimatePresence>

        {/* nav controls */}
        <div className="flex items-center gap-1 px-3 pb-2.5">
          {idx > 0 && (
            <button
              onClick={() => setIdx(idx - 1)}
              className="text-[10px] font-mono transition-opacity duration-[120ms] hover:opacity-100"
              style={{ color: 'rgba(74,138,212,0.55)' }}
            >
              ← back
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={() => isLast ? setDismiss(true) : setIdx(idx + 1)}
            className="text-[10px] font-mono transition-opacity duration-[120ms] hover:opacity-100"
            style={{ color: 'rgba(74,138,212,0.80)' }}
          >
            {isLast ? 'got it' : 'next →'}
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
