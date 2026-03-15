'use client'

import { useInView, useMotionValue, useSpring } from 'framer-motion'
import { useCallback, useEffect, useRef } from 'react'

interface CountUpProps {
  to: number
  from?: number
  direction?: 'up' | 'down'
  delay?: number
  duration?: number
  className?: string
  startWhen?: boolean
  separator?: string
  onStart?: () => void
  onEnd?: () => void
}

export default function CountUp({
  to,
  from = 0,
  direction = 'up',
  delay = 0,
  duration = 2,
  className = '',
  startWhen = true,
  separator = '',
  onStart,
  onEnd,
}: CountUpProps) {
  const ref         = useRef<HTMLSpanElement>(null)
  const motionValue = useMotionValue(direction === 'down' ? to : from)
  const springValue = useSpring(motionValue, {
    damping:   20 + 40 * (1 / duration),
    stiffness: 100 * (1 / duration),
  })
  const isInView = useInView(ref, { once: true, margin: '0px' })

  const decimals = Math.max(
    ...[from, to].map(n => { const s = n.toString(); return s.includes('.') && parseInt(s.split('.')[1]) !== 0 ? s.split('.')[1].length : 0 })
  )

  const format = useCallback((val: number) => {
    const opts: Intl.NumberFormatOptions = {
      useGrouping: !!separator,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }
    const s = Intl.NumberFormat('en-US', opts).format(val)
    return separator ? s.replace(/,/g, separator) : s
  }, [decimals, separator])

  // set initial text without triggering spring
  useEffect(() => {
    if (ref.current) ref.current.textContent = format(direction === 'down' ? to : from)
  }, [from, to, direction, format])

  // fire spring when in view
  useEffect(() => {
    if (!isInView || !startWhen) return
    onStart?.()
    const t1 = setTimeout(() => motionValue.set(direction === 'down' ? from : to), delay * 1000)
    const t2 = setTimeout(() => onEnd?.(), (delay + duration) * 1000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [isInView, startWhen, motionValue, direction, from, to, delay, duration, onStart, onEnd])

  // update DOM text on each spring tick
  useEffect(() => {
    return springValue.on('change', (val: number) => {
      if (ref.current) ref.current.textContent = format(val)
    })
  }, [springValue, format])

  return <span ref={ref} className={className} />
}
