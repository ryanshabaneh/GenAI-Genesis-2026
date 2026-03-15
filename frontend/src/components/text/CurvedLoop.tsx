'use client'

import { useRef, useEffect, useState, useMemo, useId } from 'react'
import type { FC, PointerEvent } from 'react'
import '@/styles/CurvedLoop.css'

interface CurvedLoopProps {
  marqueeText?: string
  speed?: number
  className?: string
  curveAmount?: number
  direction?: 'left' | 'right'
  interactive?: boolean
}

const CurvedLoop: FC<CurvedLoopProps> = ({
  marqueeText = '',
  speed = 2,
  className,
  curveAmount = 0,
  direction = 'left',
  interactive = false,
}) => {
  const text = useMemo(() => {
    const hasTrailing = /\s|\u00A0$/.test(marqueeText)
    return (hasTrailing ? marqueeText.replace(/\s+$/, '') : marqueeText) + '\u00A0'
  }, [marqueeText])

  const measureRef  = useRef<SVGTextElement | null>(null)
  const textPathRef = useRef<SVGTextPathElement | null>(null)
  const [spacing, setSpacing] = useState(0)
  const [offset, setOffset]   = useState(0)

  const identifier = useId()
  const pathIdentifier     = `curve-${identifier}`
  const gradientIdentifier = `loop-gradient-${identifier}`
  const pathDefinition     = `M-100,40 Q500,${40 + curveAmount} 1540,40`

  const dragActive  = useRef(false)
  const lastPointerX = useRef(0)
  const currentDirection = useRef<'left' | 'right'>(direction)
  const pointerVelocity  = useRef(0)

  const totalText = spacing
    ? Array(Math.ceil(1800 / spacing) + 2).fill(text).join('')
    : text

  const ready = spacing > 0

  useEffect(() => {
    if (measureRef.current) setSpacing(measureRef.current.getComputedTextLength())
  }, [text, className])

  useEffect(() => {
    if (!spacing || !textPathRef.current) return
    const initial = -spacing
    textPathRef.current.setAttribute('startOffset', initial + 'px')
    setOffset(initial)
  }, [spacing])

  useEffect(() => {
    if (!spacing || !ready) return
    let frame = 0
    const step = () => {
      if (!dragActive.current && textPathRef.current) {
        const delta = currentDirection.current === 'right' ? speed : -speed
        const current = parseFloat(textPathRef.current.getAttribute('startOffset') || '0')
        let next = current + delta
        if (next <= -spacing) next += spacing
        if (next > 0) next -= spacing
        textPathRef.current.setAttribute('startOffset', next + 'px')
        setOffset(next)
      }
      frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [spacing, speed, ready])

  const onPointerDown = (event: PointerEvent) => {
    if (!interactive) return
    dragActive.current = true
    lastPointerX.current = event.clientX
    pointerVelocity.current = 0
    ;(event.target as HTMLElement).setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: PointerEvent) => {
    if (!interactive || !dragActive.current || !textPathRef.current) return
    const delta = event.clientX - lastPointerX.current
    lastPointerX.current = event.clientX
    pointerVelocity.current = delta
    const current = parseFloat(textPathRef.current.getAttribute('startOffset') || '0')
    let next = current + delta
    if (next <= -spacing) next += spacing
    if (next > 0) next -= spacing
    textPathRef.current.setAttribute('startOffset', next + 'px')
    setOffset(next)
  }

  const endDrag = () => {
    if (!interactive) return
    dragActive.current = false
    currentDirection.current = pointerVelocity.current > 0 ? 'right' : 'left'
  }

  return (
    <div
      className="curved-loop-jacket"
      style={{ cursor: interactive ? (dragActive.current ? 'grabbing' : 'grab') : 'auto', visibility: ready ? 'visible' : 'hidden' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
    >
      <svg className={`curved-loop-svg ${className ?? ''}`} viewBox="0 0 1440 120">
        <defs>
          <linearGradient id={gradientIdentifier} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="#A78BFA" />
            <stop offset="35%"  stopColor="#00D4FF" />
            <stop offset="65%"  stopColor="#3ECFB2" />
            <stop offset="100%" stopColor="#A78BFA" />
          </linearGradient>
          <path id={pathIdentifier} d={pathDefinition} fill="none" stroke="transparent" />
        </defs>
        <text ref={measureRef} xmlSpace="preserve" style={{ visibility: 'hidden', opacity: 0, pointerEvents: 'none' }}>
          {text}
        </text>
        {ready && (
          <text xmlSpace="preserve" fill={`url(#${gradientIdentifier})`}>
            <textPath ref={textPathRef} href={`#${pathIdentifier}`} startOffset={offset + 'px'} xmlSpace="preserve">
              {totalText}
            </textPath>
          </text>
        )}
      </svg>
    </div>
  )
}

export default CurvedLoop
