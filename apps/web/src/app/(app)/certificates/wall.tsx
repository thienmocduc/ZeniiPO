'use client'

import { useEffect, useState } from 'react'

type Cert = {
  id: string
  kind: 'level' | 'master'
  level_num: number | null
  cert_code: string
  title_vi: string
  title_en: string
  holder_name: string | null
  company_name: string | null
  issued_at: string
}

export function CertificateWall() {
  const [certs, setCerts] = useState<Cert[]>([])
  const [busy, setBusy] = useState(true)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/certificates', { credentials: 'same-origin' })
        const json = await res.json()
        if (res.ok) setCerts(json.data ?? [])
      } finally { setBusy(false) }
    })()
  }, [])

  function copyVerify(code: string) {
    const url = `${window.location.origin}/verify?code=${code}`
    navigator.clipboard?.writeText(url)
    setCopied(code)
    setTimeout(() => setCopied(null), 1500)
  }

  if (busy) return <div className="h-40 rounded-xl bg-w4 animate-pulse" />
  if (certs.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-w8 bg-bg-2 p-10 text-center text-ink-dim">
        Chưa có chứng nhận. Hoàn thành Cấp 1 · Khai Tâm để nhận chứng nhận đầu tiên.
        <div className="mt-3"><a href="/khai-tam" className="text-gold-light hover:underline">Bắt đầu Khai Tâm →</a></div>
      </div>
    )
  }

  const master = certs.find((c) => c.kind === 'master')
  const levels = certs.filter((c) => c.kind === 'level').sort((a, b) => (a.level_num ?? 0) - (b.level_num ?? 0))

  return (
    <div className="space-y-6">
      {master && (
        <div className="rounded-2xl border-2 border-gold bg-gradient-to-br from-gold/10 via-violet-900/10 to-bg-2 p-8 text-center shadow-[0_0_40px_rgba(228,193,110,0.15)]">
          <div className="text-4xl mb-2">👑</div>
          <div className="text-xs uppercase tracking-[0.3em] text-gold-light">Danh hiệu cao nhất</div>
          <h2 className="font-serif text-2xl text-gold-light mt-2">{master.title_vi}</h2>
          <p className="text-sm text-ink mt-1">{master.holder_name ?? ''}{master.company_name ? ` · ${master.company_name}` : ''}</p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-gold/40 bg-bg/40 px-4 py-1.5">
            <span className="font-mono text-sm text-gold-light">{master.cert_code}</span>
            <button onClick={() => copyVerify(master.cert_code)} className="text-xs text-ink-dim hover:text-gold-light">
              {copied === master.cert_code ? '✓ đã copy' : 'copy link verify'}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {levels.map((c) => (
          <div key={c.id} className="rounded-xl border border-w8 bg-bg-2 p-5">
            <div className="flex items-start justify-between">
              <div className="text-2xl">🎓</div>
              <span className="text-2xs uppercase tracking-widest text-emerald-300">Đã cấp</span>
            </div>
            <h3 className="font-serif text-lg text-ink mt-2">{c.title_vi}</h3>
            <p className="text-xs text-ink-dim mt-1">{c.title_en}</p>
            <div className="mt-3 pt-3 border-t border-w8 flex items-center justify-between">
              <span className="font-mono text-xs text-gold-light">{c.cert_code}</span>
              <button onClick={() => copyVerify(c.cert_code)} className="text-xs text-ink-dim hover:text-gold-light">
                {copied === c.cert_code ? '✓ copied' : 'verify link'}
              </button>
            </div>
            <div className="text-2xs text-ink-dim mt-1">{new Date(c.issued_at).toLocaleDateString('vi-VN')}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
