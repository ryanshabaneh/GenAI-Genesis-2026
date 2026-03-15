import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {},
    colors: {
      ink: 'var(--ink)',
      deep: 'var(--deep)',
      surface: 'var(--surface)',
      surface2: 'var(--surface2)',
      surface3: 'var(--surface3)',
      blue: {
        DEFAULT: 'var(--blue)',
        border: 'var(--blue-border)',
        dim: 'var(--blue-dim)',
      },
      teal: {
        DEFAULT: 'var(--teal)',
        border: 'var(--teal-border)',
        dim: 'var(--teal-dim)',
      },
      cyan: {
        DEFAULT: 'var(--cyan)',
        border: 'var(--cyan-border)',
        dim: 'var(--cyan-dim)',
      },
      purple: {
        DEFAULT: 'var(--purple)',
        border: 'var(--purple-border)',
        dim: 'var(--purple-dim)',
      },
      fog: {
        DEFAULT: 'var(--fog)',
        light: 'var(--fog-light)',
      },
      white: {
        DEFAULT: 'var(--white)',
      },
    },
    transitionDuration: {
      fast: '120ms',
      mid: '220ms',
      slow: '380ms',
    },
    fontFamily: {
      display: ['var(--font-display)', 'sans-serif'],
      action:  ['var(--font-action)',  'sans-serif'],
      ui:      ['var(--font-ui)',      'sans-serif'],
      mono:    ['var(--font-mono)',    'monospace'],
    }
  },
  plugins: [],
}

export default config
