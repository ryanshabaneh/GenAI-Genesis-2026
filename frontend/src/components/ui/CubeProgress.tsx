'use client'

import '@/styles/CubeProgress.css'

interface CubeProgressProps {
  value: number
  height?: number
  animated?: boolean
  // [from, via, to] hex or rgb — defaults to global aurora gradient
  colors?: [string, string, string]
  className?: string
}

// glow color tracks the leading-edge (c3) with reduced opacity
function glowFromColor(c3: string): string {
  // convert #RRGGBB to rgba
  if (c3.startsWith('#') && c3.length === 7) {
    const r = parseInt(c3.slice(1, 3), 16)
    const g = parseInt(c3.slice(3, 5), 16)
    const b = parseInt(c3.slice(5, 7), 16)
    return `rgba(${r},${g},${b},0.58)`
  }
  return 'rgba(6,182,212,0.58)'
}

export default function CubeProgress({
  value,
  height = 32,
  animated = true,
  colors,
  className = '',
}: CubeProgressProps) {
  const v  = Math.max(0, Math.min(100, value))
  const c1 = colors?.[0] ?? '#4F46E5'
  const c2 = colors?.[1] ?? '#06B6D4'
  const c3 = colors?.[2] ?? '#10B981'

  return (
    <div
      className={`cube-progress ${animated ? 'cube-progress--animated' : ''} ${className}`}
      style={{
        height:               height * 2,
        '--cube-h':           `${height}px`,
        '--cube-per':         `${v}%`,
        '--cube-c1':          c1,
        '--cube-c2':          c2,
        '--cube-c3':          c3,
        '--cube-glow':        glowFromColor(c3),
        '--cube-perspective': `${height * 7}px`,
      } as React.CSSProperties}
    >
      <ul className="cube-progress__inner">
        <li className="cube-progress__top" />
        <li className="cube-progress__bottom" />
        <li className="cube-progress__front" />
        <li className="cube-progress__back" />
      </ul>
    </div>
  )
}
