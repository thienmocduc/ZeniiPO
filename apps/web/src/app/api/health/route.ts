import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Public healthcheck — used by uptime monitors, load balancers, and
 * Vercel/Netlify health probes. No auth, no rate-limit tax (it hits the
 * `/api/health` bypass in middleware).
 */
export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      time: new Date().toISOString(),
      version: '1.0.0',
    },
    { status: 200 }
  )
}
