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
        // Chakra 6 · Ajna (third eye · indigo/deep blue-violet)
        // Chakra 7 · Sahasrara (crown · violet→white→gold)
        chakra: {
          6: {
            DEFAULT: '#4f46e5', // indigo-600 · primary Ajna
            deep: '#312e81',    // indigo-900
            glow: '#6366f1',    // indigo-500
            light: '#818cf8',   // indigo-400
          },
          7: {
            DEFAULT: '#a855f7', // purple-500 · primary Sahasrara
            violet: '#c084fc',  // purple-400
            crown: '#f5f1e8',   // ivory-crown
            gold: '#e4c16e',    // gold-crown
          },
        },
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
        // Chakra cosmic motion — gentle / nhẹ nhàng
        aurora: {
          '0%,100%': {
            transform: 'translate3d(0,0,0) scale(1)',
            'background-position': '0% 50%',
          },
          '50%': {
            transform: 'translate3d(2%, -1%, 0) scale(1.04)',
            'background-position': '100% 50%',
          },
        },
        'glow-pulse': {
          '0%,100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
        orbit: {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
        breathe: {
          '0%,100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.03)' },
        },
      },
      animation: {
        drift: 'drift 200s linear infinite',
        'pulse-soft': 'pulseSoft 2s infinite',
        'fade-up': 'fade-up 0.8s ease-out',
        aurora: 'aurora 20s ease-in-out infinite',
        'glow-pulse': 'glow-pulse 4s ease-in-out infinite',
        orbit: 'orbit 60s linear infinite',
        breathe: 'breathe 6s ease-in-out infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
export default config
