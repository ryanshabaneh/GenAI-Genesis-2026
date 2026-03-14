'use client'

// design-system button with full interactive state coverage
// renders <a> when href is provided <button> otherwise

import { type AnchorHTMLAttributes, type ButtonHTMLAttributes } from 'react'
import clsx from 'clsx'

// effect: optional btn-fx-* class from button-effects.css
// primary group: 'shimmer' | 'fill-center' | 'fill-sides' | 'gradient-shift'
// secondary group: 'lift' | 'glow' | 'offset' | 'border-draw' | 'corners'
type ButtonEffect = 'shimmer' | 'fill-center' | 'fill-sides' | 'gradient-shift' | 'lift' | 'glow' | 'offset' | 'border-draw' | 'corners'

type BaseProps = {
  variant?: 'primary' | 'ghost'
  effect?: ButtonEffect
  children: React.ReactNode
  className?: string
}

type AsButton = BaseProps & ButtonHTMLAttributes<HTMLButtonElement> & { href?: never }
type AsLink   = BaseProps & AnchorHTMLAttributes<HTMLAnchorElement>  & { href: string }

type ButtonProps = AsButton | AsLink

const VARIANT_CLASSES = {
  primary: [
    'bg-amber text-ink font-display font-black',
    'hover:brightness-110 hover:-translate-y-0.5',
    'active:scale-[0.97] active:brightness-90',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber',
    'disabled:opacity-40 disabled:pointer-events-none',
  ],
  ghost: [
    'bg-surface2 text-white font-ui font-semibold border border-white/[0.12]',
    'hover:bg-surface3 hover:border-white/[0.2] hover:-translate-y-0.5',
    'active:scale-[0.97]',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber',
    'disabled:opacity-40 disabled:pointer-events-none',
  ],
}

const BASE = 'inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-[999px] text-sm transition-all duration-[120ms] ease-linear cursor-pointer select-none'

export default function Button({ variant = 'primary', effect, children, className, ...props }: ButtonProps) {
  const classes = clsx(BASE, VARIANT_CLASSES[variant], effect && `btn-fx-${effect}`, className)

  if ('href' in props && props.href) {
    const { href, ...rest } = props as AsLink
    return <a href={href} className={classes} {...rest}>{children}</a>
  }

  return <button className={classes} {...(props as AsButton)}>{children}</button>
}
