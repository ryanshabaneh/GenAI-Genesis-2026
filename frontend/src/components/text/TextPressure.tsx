'use client'

// mouse-proximity variable font effect — chars nearest cursor morph to max weight/width
// requires a variable font with wdth, wght, ital axes for full effect
// static fonts: cursor tracking still works, font axes just won't animate
// useGradient: skips inline color per-span so parent gradient-text shows through

import { useEffect, useRef, useState, useCallback } from 'react'

interface TextPressureProps {
  text: string
  fontFamily?: string
  fontUrl?: string        // omit if font already loaded globally
  weight?: boolean
  width?: boolean
  italic?: boolean
  alpha?: boolean
  flex?: boolean
  useGradient?: boolean   // skip inline textColor so bg-clip gradient shows through
  textColor?: string
  strokeColor?: string
  className?: string
  minFontSize?: number
}

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2)

const getAttr = (distance: number, maxDist: number, minVal: number, maxVal: number) =>
  Math.max(minVal, maxVal - Math.abs((maxVal * distance) / maxDist) + minVal)

export default function TextPressure({
  text = 'Shipyard',
  fontFamily = 'var(--font-display)',
  fontUrl,
  weight = true,
  width = true,
  italic = true,
  alpha = false,
  flex = true,
  useGradient = false,
  textColor = 'var(--white)',
  strokeColor = 'var(--blue)',
  className = '',
  minFontSize = 24,
}: TextPressureProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const titleRef     = useRef<HTMLHeadingElement>(null)
  const spansRef     = useRef<(HTMLSpanElement | null)[]>([])
  const mouseRef     = useRef({ x: 0, y: 0 })
  const cursorRef    = useRef({ x: 0, y: 0 })

  const [fontSize,    setFontSize]    = useState(minFontSize)
  const [scaleY,      setScaleY]      = useState(1)
  const [lineHeight,  setLineHeight]  = useState(1)

  const chars = text.split('')

  // track cursor + touch
  useEffect(() => {
    const onMove  = (e: MouseEvent) => { cursorRef.current = { x: e.clientX, y: e.clientY } }
    const onTouch = (e: TouchEvent) => { const t = e.touches[0]; cursorRef.current = { x: t.clientX, y: t.clientY } }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('touchmove', onTouch, { passive: true })
    if (containerRef.current) {
      const { left, top, width, height } = containerRef.current.getBoundingClientRect()
      mouseRef.current  = { x: left + width / 2, y: top + height / 2 }
      cursorRef.current = { ...mouseRef.current }
    }
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('touchmove', onTouch) }
  }, [])

  // fit font to container width
  const setSize = useCallback(() => {
    if (!containerRef.current || !titleRef.current) return
    const { width: cw, height: ch } = containerRef.current.getBoundingClientRect()
    const fs = Math.max(cw / (chars.length / 2), minFontSize)
    setFontSize(fs); setScaleY(1); setLineHeight(1)
    requestAnimationFrame(() => {
      if (!titleRef.current) return
      const th = titleRef.current.getBoundingClientRect().height
      if (th > 0) { const r = ch / th; setScaleY(r); setLineHeight(r) }
    })
  }, [chars.length, minFontSize])

  useEffect(() => {
    const debounced = (() => { let t: ReturnType<typeof setTimeout>; return () => { clearTimeout(t); t = setTimeout(setSize, 100) } })()
    debounced(); window.addEventListener('resize', debounced)
    return () => window.removeEventListener('resize', debounced)
  }, [setSize])

  // rAF animation loop — interpolates fontVariationSettings per char
  useEffect(() => {
    let raf: number
    const animate = () => {
      mouseRef.current.x += (cursorRef.current.x - mouseRef.current.x) / 15
      mouseRef.current.y += (cursorRef.current.y - mouseRef.current.y) / 15
      if (titleRef.current) {
        const maxDist = titleRef.current.getBoundingClientRect().width / 2
        spansRef.current.forEach(span => {
          if (!span) return
          const r = span.getBoundingClientRect()
          const d = dist(mouseRef.current, { x: r.x + r.width / 2, y: r.y + r.height / 2 })
          const wght  = weight ? Math.floor(getAttr(d, maxDist, 100, 900)) : 400
          const wdth  = width  ? Math.floor(getAttr(d, maxDist, 5,   200)) : 100
          const ital  = italic ? getAttr(d, maxDist, 0, 1).toFixed(2)      : '0'
          const opac  = alpha  ? getAttr(d, maxDist, 0, 1).toFixed(2)      : '1'
          span.style.fontVariationSettings = `'wght' ${wght}, 'wdth' ${wdth}, 'ital' ${ital}`
          if (alpha) span.style.opacity = opac
        })
      }
      raf = requestAnimationFrame(animate)
    }
    animate()
    return () => cancelAnimationFrame(raf)
  }, [weight, width, italic, alpha])

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', background: 'transparent' }}>
      {/* inject @font-face only if fontUrl provided — skip if font loaded globally */}
      {fontUrl && (
        <style>{`@font-face { font-family: '${fontFamily}'; src: url('${fontUrl}'); font-style: normal; }`}</style>
      )}
      <h1
        ref={titleRef}
        className={`${flex ? 'flex justify-between' : ''} ${className}`}
        style={{
          fontFamily,
          fontSize,
          lineHeight,
          transform: `scaleY(${scaleY})`,
          transformOrigin: 'center top',
          margin: 0,
          textAlign: 'center',
          userSelect: 'none',
          whiteSpace: 'nowrap',
          fontWeight: 100,
          width: '100%',
          // gradient mode: set up bg-clip, per-span color skipped below
          ...(useGradient ? {
            background: 'linear-gradient(135deg, var(--purple), var(--cyan))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          } : { color: textColor })
        }}
      >
        {chars.map((char, i) => (
          <span
            key={i}
            ref={el => { spansRef.current[i] = el }}
            data-char={char}
            style={{
              display: 'inline-block',
              // skip inline color in gradient mode so bg-clip shows through
              ...(!useGradient ? { color: textColor } : {})
            }}
          >
            {char}
          </span>
        ))}
      </h1>
    </div>
  )
}
