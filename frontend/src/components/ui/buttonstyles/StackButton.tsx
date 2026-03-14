'use client'

interface StackButtonProps {
  icon: React.ReactNode     
  onClick?: () => void
  color?: string            
  size?: number | string    
  className?: string
}

export default function StackButton({
  icon,
  onClick,
  color = 'var(--amber)',
  size = 60,
  className = '',
}: StackButtonProps) {
  return (
    <li
      className={`stack-btn ${className}`}
      style={{ '--stack-color': color, '--stack-size': `${size}px` } as React.CSSProperties}
      onClick={onClick}
    >
      {/* 4 shadow faces + 1 icon face */}
      <span /><span /><span /><span />
      <span className="stack-btn__icon">{icon}</span>
    </li>
  )
}
