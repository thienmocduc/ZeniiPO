import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET: list enrolled factors
export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data, error } = await supabase.auth.mfa.listFactors()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// POST: enroll new TOTP factor → returns qr_code + secret + factor_id (caller must verify next).
export async function POST() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Zeniipo ${new Date().toISOString()}` })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// PATCH: verify pending factor with 6-digit code from authenticator app.
const VerifySchema = z.object({
  factor_id: z.string().uuid(),
  code: z.string().regex(/^\d{6}$/, 'Code phải là 6 chữ số'),
})
export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}))
  const parsed = VerifySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const supabase = await createServerClient()
  const challenge = await supabase.auth.mfa.challenge({ factorId: parsed.data.factor_id })
  if (challenge.error) return NextResponse.json({ error: challenge.error.message }, { status: 400 })
  const verify = await supabase.auth.mfa.verify({
    factorId: parsed.data.factor_id,
    challengeId: challenge.data.id,
    code: parsed.data.code,
  })
  if (verify.error) return NextResponse.json({ error: verify.error.message }, { status: 400 })
  return NextResponse.json({ data: verify.data })
}

// DELETE: unenroll a factor.
const UnenrollSchema = z.object({ factor_id: z.string().uuid() })
export async function DELETE(req: Request) {
  const body = await req.json().catch(() => ({}))
  const parsed = UnenrollSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const supabase = await createServerClient()
  const { data, error } = await supabase.auth.mfa.unenroll({ factorId: parsed.data.factor_id })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
