'use client'

import { useMemo } from 'react'
import CountUp from '@/components/text/CountUp'

interface PolyProgressProps {
  value: number
  segments?: number
  height?: number
  className?: string
  animated?: boolean
  showLabel?: boolean
  labelClassName?: string
  title?: string
}

const GRADIENT_STOPS = [
  { pos: 0,    color: '#A78BFA' },
  { pos: 0.25, color: '#4A78D4' },
  { pos: 0.5,  color: '#00D4FF' },
  { pos: 0.75, color: '#3ECFB2' },
  { pos: 1.0,  color: '#FFC940' },
]

function lerpColor(a: string, b: string, t: number): string {
  const parse = (h: string) => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)]
  const [ar,ag,ab] = parse(a)
  const [br,bg,bb] = parse(b)
  return `rgb(${Math.round(ar+(br-ar)*t)},${Math.round(ag+(bg-ag)*t)},${Math.round(ab+(bb-ab)*t)})`
}

function gradientColor(pos: number): string {
  for (let i = 0; i < GRADIENT_STOPS.length - 1; i++) {
    const a = GRADIENT_STOPS[i], b = GRADIENT_STOPS[i+1]
    if (pos <= b.pos) return lerpColor(a.color, b.color, (pos - a.pos) / (b.pos - a.pos))
  }
  return GRADIENT_STOPS[GRADIENT_STOPS.length - 1].color
}

function chevronPoints(x: number, w: number, h: number, tip: number, isFirst: boolean): string {
  const mid = h / 2
  const pts = isFirst
    ? [`${x},0`, `${x+w-tip},0`, `${x+w},${mid}`, `${x+w-tip},${h}`, `${x},${h}`]
    : [`${x},0`, `${x+w-tip},0`, `${x+w},${mid}`, `${x+w-tip},${h}`, `${x},${h}`, `${x+tip},${mid}`]
  return pts.join(' ')
}

export default function PolyProgress({
  value,
  segments = 10,
  height = 20,
  className = '',
  animated = true,
  showLabel = false,
  labelClassName = '',
  title,
}: PolyProgressProps) {
  const v       = Math.max(0, Math.min(100, value))
  const totalW  = 100
  const tip     = 6
  const overlap = tip
  const segW    = (totalW + overlap * (segments - 1)) / segments
  const filled  = useMemo(() => (v / 100) * segments, [v, segments])

  const edgeIdx   = Math.floor(filled)
  const edgeColor = gradientColor(Math.min(1, (edgeIdx + 0.5) / segments))
  const glowFilter = animated && v > 0
    ? `drop-shadow(0 0 5px ${edgeColor}cc) drop-shadow(0 0 14px ${edgeColor}55)`
    : undefined

  const label = (
    <span
      className={`font-display font-black tabular-nums gradient-progress-text gradient-shift-text ${animated && v > 0 ? 'animate-bob' : ''} ${labelClassName}`}
      style={{ fontSize: '0.75rem', minWidth: '2.5rem', textAlign: 'right', display: 'inline-block' }}
    >
      <CountUp to={Math.round(v)} duration={0.8} />%
    </span>
  )

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {(title || (showLabel && title !== undefined)) && (
        <div className="flex items-center justify-between">
          {title && (
            <span className="text-fog text-[10px] font-display font-black uppercase tracking-[1.5px]">{title}</span>
          )}
          {showLabel && label}
        </div>
      )}

      <div className="flex items-center gap-2.5">
        <div
          className="flex-1 relative"
          style={{
            height,
            borderRadius: 4,
            background: 'rgba(255,255,255,0.04)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07), inset 0 0 0 1px rgba(255,255,255,0.06)',
          }}
        >
          <svg
            viewBox={`0 0 ${totalW} ${height}`}
            preserveAspectRatio="none"
            width="100%"
            height={height}
            style={{ display: 'block', overflow: 'visible' }}
          >
            <defs>
              <clipPath id={`poly-clip-${v}-${segments}`}>
                <rect x="0" y="0" width={`${v}%`} height={height} />
              </clipPath>
              <linearGradient id={`shimmer-${segments}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%"   stopColor="white" stopOpacity="0" />
                <stop offset="45%"  stopColor="white" stopOpacity="0.45" />
                <stop offset="55%"  stopColor="white" stopOpacity="0.45" />
                <stop offset="100%" stopColor="white" stopOpacity="0" />
              </linearGradient>
            </defs>

            {Array.from({ length: segments }).map((_, i) => (
              <polygon key={`t${i}`}
                points={chevronPoints(i*(segW-overlap), segW, height, tip, i===0)}
                fill="rgba(255,255,255,0.04)"
                stroke="rgba(255,255,255,0.09)"
                strokeWidth="0.6"
              />
            ))}

            <g clipPath={`url(#poly-clip-${v}-${segments})`} style={{ filter: glowFilter }}>
              {Array.from({ length: segments }).map((_, i) => {
                const isFull = i < Math.floor(filled)
                const isEdge = i === Math.floor(filled)
                return (
                  <polygon key={`f${i}`}
                    points={chevronPoints(i*(segW-overlap), segW, height, tip, i===0)}
                    fill={gradientColor((i+0.5)/segments)}
                    opacity={isFull ? 1 : isEdge ? 0.5 : 0}
                    style={animated && isFull ? { animation: `poly-glow 2.4s ease-in-out ${i*0.07}s infinite` } : undefined}
                  />
                )
              })}

              {animated && v > 0 && v < 100 && (
                <polygon
                  points={chevronPoints(edgeIdx*(segW-overlap), segW, height, tip, edgeIdx===0)}
                  fill="white"
                  style={{ animation: 'scan-pulse 1.6s ease-in-out infinite', opacity: 0 }}
                />
              )}

              {animated && v > 0 && (
                <rect
                  x="0" y="0"
                  width={`${Math.max(25, v)}%`}
                  height={height}
                  fill={`url(#shimmer-${segments})`}
                  style={{ animation: 'poly-shimmer 2s ease-in-out infinite', opacity: 0.45 }}
                />
              )}
            </g>
          </svg>
        </div>

        {showLabel && !title && label}
      </div>
    </div>
  )
}
