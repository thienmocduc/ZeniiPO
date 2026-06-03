import { Resend } from 'resend'

let cached: Resend | null = null

export function getResend(): Resend | null {
  if (cached) return cached
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  cached = new Resend(key)
  return cached
}

export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY)
}

const FROM = process.env.RESEND_FROM ?? 'Zeniipo <noreply@zenicloud.io>'

export type SendEmailInput = {
  to: string | string[]
  subject: string
  html: string
  text?: string
  reply_to?: string
}

/**
 * Send a transactional email. Returns null silently when RESEND_API_KEY is
 * missing — Supabase Auth still sends its own confirmation/recovery emails
 * via its built-in SMTP. This wrapper is for app-level sends (invite,
 * billing receipt, weekly digest, council validation result, etc.).
 */
export async function sendEmail(input: SendEmailInput) {
  const r = getResend()
  if (!r) {
    console.warn('[email] RESEND_API_KEY missing — skipping send to', input.to)
    return null
  }
  try {
    const { data, error } = await r.emails.send({
      from: FROM,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: input.reply_to,
    })
    if (error) {
      console.error('[email] resend error:', error)
      return null
    }
    return data
  } catch (err) {
    console.error('[email] send failed:', err)
    return null
  }
}

/** Build a plain HTML wrapper with Zeniipo branding. Caller passes inner HTML. */
export function emailLayout(inner: string, footerNote?: string): string {
  return `<!doctype html>
<html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" />
<title>Zeniipo</title></head>
<body style="margin:0;padding:0;background:#05070C;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#e5e7eb">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px">
    <div style="text-align:center;padding:16px 0;border-bottom:1px solid rgba(255,255,255,0.08)">
      <span style="display:inline-flex;width:40px;height:40px;align-items:center;justify-content:center;border-radius:50%;border:1px solid #e4c16e;color:#e4c16e;font-style:italic;font-weight:600;font-size:18px">Z</span>
      <div style="font-family:monospace;font-size:10px;letter-spacing:0.18em;color:#9ca3af;margin-top:6px;text-transform:uppercase">Zeniipo · IPO Journey Platform</div>
    </div>
    <div style="padding:32px 8px;font-size:14px;line-height:1.65">${inner}</div>
    <div style="padding:16px 0;border-top:1px solid rgba(255,255,255,0.08);font-size:11px;color:#6b7280;text-align:center">
      ${footerNote ?? 'Email tự động — vui lòng không reply.'}<br/>
      <a href="https://zenicloud.io" style="color:#e4c16e;text-decoration:none">zenicloud.io</a>
    </div>
  </div>
</body></html>`
}
