'use client'

// radial-gradient particle burst on click — pure CSS animation
// adds .animate class on click, removes after 700ms (animation duration)
// ::before fires top bubbles, ::after fires bottom bubbles
// color is set via --bubbly-color CSS var so it's token-driven

import { useState, useCallback } from 'react'

interface BubblyButtonProps {
  label: string
  onClick?: () => void
  color?: string      // css color/var() for bubble + bg, default amber
  className?: string
}

export default function BubblyButton({
  label,
  onClick,
  color = 'var(--blue)',
  className = '',
}: BubblyButtonProps) {
  const [animating, setAnimating] = useState(false)

  const handleClick = useCallback(() => {
    setAnimating(false)
    // force reflow so re-clicking always re-triggers
    void document.body.offsetWidth
    setAnimating(true)
    setTimeout(() => setAnimating(false), 700)
    onClick?.()
  }, [onClick])

  return (
    <button
      className={`bubbly-btn ${animating ? 'animate' : ''} ${className}`}
      style={{ '--bubbly-color': color } as React.CSSProperties}
      onClick={handleClick}
    >
      {label}
    </button>
  )
}
