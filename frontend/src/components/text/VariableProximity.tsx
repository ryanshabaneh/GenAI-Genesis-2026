'use client'

import { forwardRef, useMemo, useRef, useEffect, HTMLAttributes, RefObject } from 'react'

interface VariableProximityProps extends HTMLAttributes<HTMLSpanElement> {
  label: string
  fromFontVariationSettings: string
  toFontVariationSettings: string
  containerRef: RefObject<HTMLElement>
  radius?: number
  falloff?: 'linear' | 'exponential' | 'gaussian'
  className?: string
  onClick?: () => void
}

const VariableProximity = forwardRef<HTMLSpanElement, VariableProximityProps>((props, ref) => {
  const {
    label,
    fromFontVariationSettings,
    toFontVariationSettings,
    containerRef,
    radius = 100,
    falloff = 'gaussian',
    className = '',
    onClick,
    style,
    ...rest
  } = props

  const letterRefs  = useRef<(HTMLSpanElement | null)[]>([])
  const mousePos    = useRef({ x: 0, y: 0 })
  const lastPos     = useRef<{ x: number | null; y: number | null }>({ x: null, y: null })

  // track mouse relative to containerRef
  useEffect(() => {
    const update = (x: number, y: number) => {
      if (containerRef?.current) {
        const r = containerRef.current.getBoundingClientRect()
        mousePos.current = { x: x - r.left, y: y - r.top }
      } else {
        mousePos.current = { x, y }
      }
    }
    const onMouse = (e: MouseEvent) => update(e.clientX, e.clientY)
    const onTouch = (e: TouchEvent) => { const t = e.touches[0]; update(t.clientX, t.clientY) }
    window.addEventListener('mousemove', onMouse)
    window.addEventListener('touchmove', onTouch)
    return () => { window.removeEventListener('mousemove', onMouse); window.removeEventListener('touchmove', onTouch) }
  }, [containerRef])

  const parsed = useMemo(() => {
    const parse = (s: string) => new Map(s.split(',').map(p => {
      const [axis, val] = p.trim().split(' ')
      return [axis.replace(/['"]/g, ''), parseFloat(val)] as [string, number]
    }))
    const from = parse(fromFontVariationSettings)
    const to   = parse(toFontVariationSettings)
    return Array.from(from.entries()).map(([axis, fromVal]) => ({ axis, fromVal, toVal: to.get(axis) ?? fromVal }))
  }, [fromFontVariationSettings, toFontVariationSettings])

  const calcFalloff = (d: number) => {
    const n = Math.min(Math.max(1 - d / radius, 0), 1)
    if (falloff === 'exponential') return n ** 2
    if (falloff === 'gaussian')    return Math.exp(-((d / (radius / 2)) ** 2) / 2)
    return n
  }

  // rAF loop — skip if mouse hasn't moved
  useEffect(() => {
    let raf: number
    const loop = () => {
      const { x, y } = mousePos.current
      if (lastPos.current.x !== x || lastPos.current.y !== y) {
        lastPos.current = { x, y }
        const containerRect = containerRef?.current?.getBoundingClientRect()
        letterRefs.current.forEach(el => {
          if (!el || !containerRect) return
          const r  = el.getBoundingClientRect()
          const cx = r.left + r.width  / 2 - containerRect.left
          const cy = r.top  + r.height / 2 - containerRect.top
          const d  = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2)
          if (d >= radius) { el.style.fontVariationSettings = fromFontVariationSettings; return }
          const fv = calcFalloff(d)
          el.style.fontVariationSettings = parsed
            .map(({ axis, fromVal, toVal }) => `'${axis}' ${fromVal + (toVal - fromVal) * fv}`)
            .join(', ')
        })
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [parsed, fromFontVariationSettings, radius, containerRef])

  const words = label.split(' ')
  let idx = 0

  return (
    <span ref={ref} className={`variable-proximity ${className}`} onClick={onClick} style={{ display: 'inline', ...style }} {...rest}>
      {words.map((word, wi) => (
        <span key={wi} style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>
          {word.split('').map(letter => {
            const i = idx++
            return (
              <span
                key={i}
                ref={(e: HTMLSpanElement | null) => { letterRefs.current[i] = e }}
                style={{ display: 'inline-block' }}
                aria-hidden="true"
              >
                {letter}
              </span>
            )
          })}
          {wi < words.length - 1 && <span style={{ display: 'inline-block' }}>&nbsp;</span>}
        </span>
      ))}
      <span className="sr-only">{label}</span>
    </span>
  )
})

VariableProximity.displayName = 'VariableProximity'
export default VariableProximity
