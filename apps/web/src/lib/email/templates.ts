import { sendEmail, emailLayout } from './client'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://zenicloud.io'
const fmtMoney = (n: number) => {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`
  return `$${Math.round(n)}`
}

// ─── 1. Invite teammate ───────────────────────────────────────
export async function emailInviteTeammate(input: {
  to: string
  inviter_name: string
  tenant_name: string
  role: string
  invite_token: string
  expires_at: string
}) {
  const url = `${APP_URL}/auth/accept-invite?token=${encodeURIComponent(input.invite_token)}`
  const inner = `
    <h2 style="color:#e4c16e;margin:0 0 16px">Bạn được mời tham gia Zeniipo</h2>
    <p><b>${escape(input.inviter_name)}</b> mời bạn vào <b>${escape(input.tenant_name)}</b> với vai trò <b>${escape(input.role)}</b>.</p>
    <p>Click nút dưới để tạo tài khoản hoặc đăng nhập (link hết hạn ${escape(input.expires_at)}):</p>
    <p style="text-align:center;margin:24px 0">
      <a href="${url}" style="display:inline-block;padding:12px 28px;background:#e4c16e;color:#05070C;text-decoration:none;border-radius:6px;font-weight:600">Chấp nhận lời mời</a>
    </p>
    <p style="font-size:12px;color:#9ca3af">Hoặc copy URL: <code>${url}</code></p>`
  return sendEmail({
    to: input.to,
    subject: `Mời tham gia ${input.tenant_name} trên Zeniipo`,
    html: emailLayout(inner),
  })
}

// ─── 2. Billing receipt (after Stripe webhook) ────────────────
export async function emailBillingReceipt(input: {
  to: string
  plan: string
  amount_usd: number
  period_end: string
  invoice_url?: string
}) {
  const inner = `
    <h2 style="color:#e4c16e;margin:0 0 16px">Cảm ơn — đã thanh toán thành công</h2>
    <table style="width:100%;font-size:14px;border-collapse:collapse;margin:16px 0">
      <tr><td style="padding:8px 0;color:#9ca3af">Plan</td><td style="padding:8px 0;text-align:right"><b>${escape(input.plan)}</b></td></tr>
      <tr><td style="padding:8px 0;color:#9ca3af">Số tiền</td><td style="padding:8px 0;text-align:right"><b>${fmtMoney(input.amount_usd)}</b></td></tr>
      <tr><td style="padding:8px 0;color:#9ca3af">Kỳ kế tiếp</td><td style="padding:8px 0;text-align:right">${escape(input.period_end)}</td></tr>
    </table>
    ${input.invoice_url ? `<p style="text-align:center;margin:24px 0"><a href="${input.invoice_url}" style="color:#e4c16e">Xem hoá đơn chi tiết →</a></p>` : ''}
    <p style="font-size:12px;color:#9ca3af">Quản lý subscription tại <a href="${APP_URL}/billing" style="color:#e4c16e">/billing</a>.</p>`
  return sendEmail({
    to: input.to,
    subject: `Hoá đơn ${input.plan} · ${fmtMoney(input.amount_usd)}`,
    html: emailLayout(inner),
  })
}

// ─── 3. Weekly digest ─────────────────────────────────────────
export async function emailWeeklyDigest(input: {
  to: string
  tenant_name: string
  kpis_summary: Array<{ name: string; value: number; unit?: string; trend?: 'up' | 'down' | 'flat' }>
  open_tasks: number
  readiness_score: number | null
  events_this_week: number
}) {
  const trendArrow = (t?: string) => t === 'up' ? '↑' : t === 'down' ? '↓' : '→'
  const trendColor = (t?: string) => t === 'up' ? '#34d399' : t === 'down' ? '#f87171' : '#9ca3af'
  const rows = input.kpis_summary.slice(0, 6).map((k) =>
    `<tr><td style="padding:6px 0">${escape(k.name)}</td><td style="padding:6px 0;text-align:right"><b>${k.value.toLocaleString()}</b> <span style="color:#9ca3af">${escape(k.unit ?? '')}</span> <span style="color:${trendColor(k.trend)}">${trendArrow(k.trend)}</span></td></tr>`,
  ).join('')
  const inner = `
    <h2 style="color:#e4c16e;margin:0 0 8px">Tổng kết tuần · ${escape(input.tenant_name)}</h2>
    <p style="font-size:13px;color:#9ca3af;margin:0 0 16px">${input.events_this_week} sự kiện · ${input.open_tasks} task open · readiness ${input.readiness_score ?? '—'}/1000</p>
    <h3 style="font-size:14px;color:#e5e7eb;margin:16px 0 8px">KPI snapshot</h3>
    <table style="width:100%;font-size:14px;border-collapse:collapse">${rows || '<tr><td style="color:#9ca3af">Chưa có KPI tracking</td></tr>'}</table>
    <p style="text-align:center;margin:24px 0"><a href="${APP_URL}/dashboard" style="color:#e4c16e">Mở dashboard →</a></p>`
  return sendEmail({
    to: input.to,
    subject: `Tuần này tại ${input.tenant_name} · ${input.open_tasks} tasks · readiness ${input.readiness_score ?? '—'}/1000`,
    html: emailLayout(inner),
  })
}

// ─── 4. Council of 9 validation result ────────────────────────
export async function emailCouncilResult(input: {
  to: string
  idea_summary: string
  overall_score: number
  recommendation: 'go' | 'no_go' | 'pivot' | 'hold'
  top_concerns: string[]
}) {
  const recColor = input.recommendation === 'go' ? '#34d399' : input.recommendation === 'no_go' ? '#f87171' : '#facc15'
  const recLabel = { go: 'TIẾN HÀNH', no_go: 'KHÔNG ĐI', pivot: 'XOAY HƯỚNG', hold: 'TẠM HOÃN' }[input.recommendation]
  const concerns = input.top_concerns.slice(0, 5).map((c) => `<li style="margin:4px 0">${escape(c)}</li>`).join('')
  const inner = `
    <h2 style="color:#e4c16e;margin:0 0 16px">Council of 9 đã chấm điểm ý tưởng của bạn</h2>
    <div style="padding:16px;background:rgba(228,193,110,0.08);border-left:3px solid #e4c16e;border-radius:4px;font-size:13px;color:#cbd5e1;margin-bottom:16px">${escape(input.idea_summary.slice(0, 280))}${input.idea_summary.length > 280 ? '…' : ''}</div>
    <table style="width:100%;font-size:14px;border-collapse:collapse">
      <tr><td style="padding:8px 0;color:#9ca3af">Overall score</td><td style="padding:8px 0;text-align:right"><b style="font-size:18px;color:#e4c16e">${input.overall_score}/100</b></td></tr>
      <tr><td style="padding:8px 0;color:#9ca3af">Recommendation</td><td style="padding:8px 0;text-align:right"><b style="color:${recColor}">${recLabel}</b></td></tr>
    </table>
    ${concerns ? `<h3 style="font-size:14px;color:#e5e7eb;margin:16px 0 8px">Top concerns</h3><ul style="margin:0;padding-left:20px;font-size:13px;color:#cbd5e1">${concerns}</ul>` : ''}
    <p style="text-align:center;margin:24px 0"><a href="${APP_URL}/council" style="color:#e4c16e">Xem chi tiết →</a></p>`
  return sendEmail({
    to: input.to,
    subject: `Council kết luận: ${recLabel} · score ${input.overall_score}/100`,
    html: emailLayout(inner),
  })
}

// ─── 5. IPO journey milestone (phase promotion) ───────────────
export async function emailJourneyMilestone(input: {
  to: string
  tenant_name: string
  from_phase: number
  to_phase: number
  phase_name: string
  next_actions: string[]
}) {
  const actions = input.next_actions.slice(0, 5).map((a) => `<li style="margin:4px 0">${escape(a)}</li>`).join('')
  const inner = `
    <h2 style="color:#e4c16e;margin:0 0 16px">🎯 ${escape(input.tenant_name)} đã lên Phase ${input.to_phase}</h2>
    <p>Hành trình IPO của bạn vừa promote từ Phase ${input.from_phase} sang Phase ${input.to_phase}: <b>${escape(input.phase_name)}</b>.</p>
    ${actions ? `<h3 style="font-size:14px;color:#e5e7eb;margin:16px 0 8px">Ưu tiên 30 ngày tới</h3><ul style="margin:0;padding-left:20px;font-size:13px;color:#cbd5e1">${actions}</ul>` : ''}
    <p style="text-align:center;margin:24px 0"><a href="${APP_URL}/ipo-execution" style="color:#e4c16e">Xem roadmap →</a></p>
    <p style="font-size:12px;color:#6b7280;margin-top:16px">Cascade engine đã tự sinh OKR + readiness criteria mới cho Phase ${input.to_phase}.</p>`
  return sendEmail({
    to: input.to,
    subject: `🎯 Promoted to Phase ${input.to_phase} · ${input.phase_name}`,
    html: emailLayout(inner),
  })
}

// ─── helpers ──────────────────────────────────────────────────
function escape(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c] as string))
}
