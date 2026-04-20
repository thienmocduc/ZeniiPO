import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx,js,jsx,mdx}'],
  theme: {
    extend: {
      colors: {
        bg: '#05070C',
        'bg-2': '#0B0F1A',
        panel: { DEFAULT: '#10182A', 2: '#151F36' },
        ink: { DEFAULT: '#E3E7EF', 2: '#B8BECC', dim: '#6B7282', mute: '#4B5161' },
        ivory: '#F5F1E8',
        gold: { DEFAULT: '#C9A84C', light: '#E4C16E', dark: '#8B7834' },
        layer: { 1: '#E4C16E', 2: '#a855f7', 3: '#06b6d4', 4: '#4ade80', 5: '#fb923c' },
        ok: '#4ade80',
        warn: '#fbbf24',
        err: '#f87171',
        w: {
          4: 'rgba(255,255,255,.04)',
          6: 'rgba(255,255,255,.06)',
          8: 'rgba(255,255,255,.08)',
          12: 'rgba(255,255,255,.12)',
          16: 'rgba(255,255,255,.16)',
        },
      },
      fontFamily: {
        display: ['Fraunces', 'serif'],
        serif: ['"Cormorant Garamond"', 'serif'],
        sans: ['"Noto Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      fontSize: { '2xs': ['0.68rem', { lineHeight: '1.2' }] },
      letterSpacing: { widest: '0.25em', 'wider-plus': '0.3em' },
      borderRadius: { DEFAULT: '4px', card: '6px' },
      spacing: { navW: '240px', topH: '64px' },
      transitionTimingFunction: { ease: 'cubic-bezier(0.22, 1, 0.36, 1)' },
      keyframes: {
        drift: {
          from: { transform: 'translate(0,0)' },
          to: { transform: 'translate(-400px,-400px)' },
        },
        pulseSoft: { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.4' } },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(30px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        drift: 'drift 200s linear infinite',
        'pulse-soft': 'pulseSoft 2s infinite',
        'fade-up': 'fade-up 0.8s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
export default config
