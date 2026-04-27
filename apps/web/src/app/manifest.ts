import type { MetadataRoute } from 'next'

/**
 * PWA manifest — Next 15 convention. Served at /manifest.webmanifest.
 *
 * `start_url`: '/dashboard' so the home-screen tap drops users straight into
 * the app (auth middleware redirects to /login if no session).
 * `display`: 'standalone' so iOS / Android render without browser chrome.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Zeniipo · IPO Journey Platform',
    short_name: 'Zeniipo',
    description:
      'Nền tảng điều hành IPO từ Day-0 đến ring-bell. 10 phase, 44 module, 108 AI agent.',
    id: '/?source=pwa',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#05070C',
    theme_color: '#05070C',
    lang: 'vi',
    categories: ['business', 'finance', 'productivity'],
    icons: [
      {
        src: '/icon',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any',
      },
    ],
    shortcuts: [
      {
        name: 'Dashboard',
        short_name: 'Home',
        url: '/dashboard',
      },
      {
        name: 'Cap Table',
        short_name: 'Cap',
        url: '/cap-table',
      },
      {
        name: 'OKRs',
        url: '/okrs',
      },
      {
        name: 'Tasks',
        url: '/tasks',
      },
    ],
  }
}
