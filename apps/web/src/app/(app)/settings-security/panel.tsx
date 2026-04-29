'use client'

import { useState } from 'react'

type Factor = { id: string; friendly_name: string | null; status: string }

export function SecurityPanel({
  currentEmail,
  enrolledFactors,
}: {
  currentEmail: string
  enrolledFactors: Factor[]
}) {
  return (
    <div className="space-y-6">
      <PasswordCard />
      <EmailCard currentEmail={currentEmail} />
      <MfaCard initialFactors={enrolledFactors} />
    </div>
  )
}

function PasswordCard() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  async function submit() {
    setBusy(true); setMsg(null)
    try {
      const res = await fetch('/api/settings/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: current, new_password: next }),
      })
      const json = await res.json()
      if (!res.ok) {
        setMsg({ kind: 'err', text: json.error?.formErrors?.join(', ') ?? json.error ?? `HTTP ${res.status}` })
      } else {
        setMsg({ kind: 'ok', text: 'Đổi mật khẩu thành công.' })
        setCurrent(''); setNext('')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title="🔑 Đổi mật khẩu" subtitle="Mật khẩu mới ≥12 ký tự, bao gồm chữ thường + chữ hoa + số.">
      <Field label="Mật khẩu hiện tại">
        <input type="password" autoComplete="current-password" className={inp} value={current} onChange={(e) => setCurrent(e.target.value)} />
      </Field>
      <Field label="Mật khẩu mới">
        <input type="password" autoComplete="new-password" className={inp} value={next} onChange={(e) => setNext(e.target.value)} />
        <p className="mt-1 text-xs text-ink-dim">Độ dài: {next.length}/12 tối thiểu</p>
      </Field>
      <Action busy={busy} disabled={!current || next.length < 12} onClick={submit} label="Đổi mật khẩu" />
      <Msg msg={msg} />
    </Card>
  )
}

function EmailCard({ currentEmail }: { currentEmail: string }) {
  const [next, setNext] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  async function submit() {
    setBusy(true); setMsg(null)
    try {
      const res = await fetch('/api/settings/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_email: next }),
      })
      const json = await res.json()
      if (!res.ok) {
        setMsg({ kind: 'err', text: json.error?.formErrors?.join(', ') ?? json.error ?? `HTTP ${res.status}` })
      } else {
        setMsg({ kind: 'ok', text: json.data.message })
        setNext('')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title="📧 Đổi email đăng nhập" subtitle={`Hiện tại: ${currentEmail}`}>
      <Field label="Email mới">
        <input type="email" className={inp} value={next} onChange={(e) => setNext(e.target.value)} placeholder="new@example.com" />
      </Field>
      <p className="text-xs text-ink-dim">
        Sau khi gửi, hệ thống email confirm tới CẢ email cũ và mới. Click cả 2 link để hoàn tất.
      </p>
      <Action busy={busy} disabled={!next.includes('@')} onClick={submit} label="Gửi yêu cầu đổi email" />
      <Msg msg={msg} />
    </Card>
  )
}

function MfaCard({ initialFactors }: { initialFactors: Factor[] }) {
  const [factors, setFactors] = useState<Factor[]>(initialFactors)
  const [enrollment, setEnrollment] = useState<{ factor_id: string; qr_code: string; secret: string } | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  async function refreshFactors() {
    const res = await fetch('/api/settings/mfa')
    if (!res.ok) return
    const j = await res.json()
    setFactors((j.data?.totp ?? []).map((f: { id: string; friendly_name: string | null; status: string }) => ({
      id: f.id, friendly_name: f.friendly_name ?? null, status: f.status,
    })))
  }

  async function enroll() {
    setBusy(true); setMsg(null)
    try {
      const res = await fetch('/api/settings/mfa', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) {
        setMsg({ kind: 'err', text: json.error?.message ?? json.error ?? `HTTP ${res.status}` })
        return
      }
      const totp = json.data?.totp ?? json.data
      setEnrollment({ factor_id: json.data.id, qr_code: totp?.qr_code ?? '', secret: totp?.secret ?? '' })
    } finally { setBusy(false) }
  }

  async function verify() {
    if (!enrollment) return
    setBusy(true); setMsg(null)
    try {
      const res = await fetch('/api/settings/mfa', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ factor_id: enrollment.factor_id, code }),
      })
      const json = await res.json()
      if (!res.ok) {
        setMsg({ kind: 'err', text: json.error?.formErrors?.join(', ') ?? json.error ?? `HTTP ${res.status}` })
        return
      }
      setMsg({ kind: 'ok', text: 'MFA đã bật. Lần sau đăng nhập sẽ cần code.' })
      setEnrollment(null); setCode('')
      refreshFactors()
    } finally { setBusy(false) }
  }

  async function unenroll(id: string) {
    if (!confirm('Tắt MFA cho factor này?')) return
    setBusy(true); setMsg(null)
    try {
      const res = await fetch('/api/settings/mfa', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ factor_id: id }),
      })
      if (res.ok) {
        setMsg({ kind: 'ok', text: 'Đã tắt factor MFA.' })
        refreshFactors()
      } else {
        const j = await res.json()
        setMsg({ kind: 'err', text: j.error ?? `HTTP ${res.status}` })
      }
    } finally { setBusy(false) }
  }

  return (
    <Card title="🔒 Xác thực 2 bước (MFA · TOTP)" subtitle="Dùng Authy / Google Authenticator / 1Password để quét QR.">
      {factors.length > 0 && (
        <div className="space-y-2 mb-4">
          {factors.map((f) => (
            <div key={f.id} className="flex items-center justify-between rounded border border-w8 bg-w4 px-3 py-2 text-sm">
              <span><strong>{f.friendly_name ?? 'TOTP'}</strong> · <span className="text-ink-dim">{f.status}</span></span>
              <button className="text-xs text-red-300 hover:underline" onClick={() => unenroll(f.id)} disabled={busy}>Tắt</button>
            </div>
          ))}
        </div>
      )}

      {!enrollment ? (
        <Action busy={busy} disabled={false} onClick={enroll} label="+ Bật MFA mới" />
      ) : (
        <div className="space-y-3">
          {enrollment.qr_code && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={enrollment.qr_code} alt="QR" className="mx-auto h-44 w-44 rounded bg-white p-2" />
          )}
          <p className="text-xs text-ink-dim text-center">Hoặc nhập secret thủ công: <code className="text-gold-light">{enrollment.secret}</code></p>
          <Field label="Mã 6 chữ số từ app">
            <input className={inp} maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
          </Field>
          <div className="flex gap-2">
            <Action busy={busy} disabled={code.length !== 6} onClick={verify} label="Xác nhận" />
            <button className={btnSec} onClick={() => { setEnrollment(null); setCode('') }} disabled={busy}>Huỷ</button>
          </div>
        </div>
      )}
      <Msg msg={msg} />
    </Card>
  )
}

// ─── small UI atoms ──────────────────────────────────────────

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-w8 bg-bg-2 p-5">
      <h2 className="text-base font-medium text-ink">{title}</h2>
      {subtitle && <p className="mt-1 text-xs text-ink-dim">{subtitle}</p>}
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  )
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-xs text-ink-dim">{label}</span>{children}</label>
}
function Action({ busy, disabled, onClick, label }: { busy: boolean; disabled: boolean; onClick: () => void; label: string }) {
  return (
    <button className={btnPri} onClick={onClick} disabled={busy || disabled}>
      {busy ? 'Đang xử lý…' : label}
    </button>
  )
}
function Msg({ msg }: { msg: { kind: 'ok' | 'err'; text: string } | null }) {
  if (!msg) return null
  return (
    <div className={`mt-2 rounded border px-3 py-2 text-sm ${
      msg.kind === 'ok' ? 'border-green-700 bg-green-900/30 text-green-200' : 'border-red-700 bg-red-900/30 text-red-200'
    }`}>{msg.text}</div>
  )
}

const inp = 'w-full rounded border border-w8 bg-bg px-3 py-2 text-sm text-ink focus:border-gold focus:outline-none'
const btnPri = 'rounded bg-gold px-4 py-2 text-sm font-medium text-bg hover:bg-gold-light disabled:cursor-not-allowed disabled:opacity-50'
const btnSec = 'rounded border border-w8 px-4 py-2 text-sm text-ink hover:bg-w4'
