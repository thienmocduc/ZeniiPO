import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://zeniipo.com'
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/about', '/pricing', '/login', '/signup'],
        disallow: [
          '/api/',
          '/admin/',
          '/dashboard/',
          '/academy/handbook/',
          '/cap-table/',
          '/financials/',
          '/data-room/',
          '/settings/',
          '/vault/',
          '/ipo-execution/',
          '/users/',
        ],
      },
      {
        userAgent: ['GPTBot', 'CCBot', 'anthropic-ai', 'Claude-Web'],
        disallow: '/',
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  }
}
