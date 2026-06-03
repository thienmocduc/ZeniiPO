'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Cockpit = {
  profile: { full_name: string | null; role: string | null } | null
  tenant: { name: string; slug: string; plan: string } | null
  journey: {
    name?: string; current_phase?: number; valuation_target?: number; exit_venue?: string
    target_year?: number; industry?: string; north_star_metric?: string
    days_to_ipo: number | null; unlocked_levels: number; total_levels: number
    current_level: { num: number; name: string; state: string; color: string } | null
    levels: { level: number; state: string; color: string; name: string }[]
  }
  readiness: { score: number | null; max: number; breakdown: Record<string, { score: number }> | null }
  runway: { p50_months: number; p10_months: number; survival: number; ending_arr_p50: number } | null
  cap_table: { founder_pct: number | null; esop_pct: number | null; total_shares: number; valuation_usd: number | null } | null
  certificates: { total: number; has_master: boolean }
  tasks: { id: string; title: string; status: string; priority: string; due_date: string | null }[]
  kpis: { name: string; value: number; unit: string | null; trend: string | null }[]
  recent_events: { event_type: string; created_at: string }[]
  next_actions: string[]
}

const fmtUsd = (n: number | null | undefined) => {
  if (n == null) return '—'
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`
  return `$${Math.round(n)}`
}

export function Cockpit() {
  const [d, setD] = useState<Cockpit | null>(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/cockpit', { credentials: 'same-origin' })
        const json = await res.json()
        if (!res.ok) { setError(json.error ?? `HTTP ${res.status}`); return }
        setD(json.data)
      } catch (e) { setError(e instanceof Error ? e.message : 'Network error') } finally { setBusy(false) }
    })()
  }, [])

  if (busy) return <div className="space-y-4">{[0,1,2].map(i=><div key={i} className="h-32 rounded-xl bg-w4 animate-pulse" />)}</div>
  if (error) return <div className="rounded border border-red-700 bg-red-900/30 p-4 text-sm text-red-200">{error}</div>
  if (!d) return null

  const j = d.journey
  const readinessPct = d.readiness.score != null ? Math.round((d.readiness.score / d.readiness.max) * 100) : null
  const runwayTone = d.runway ? (d.runway.p10_months >= 12 ? 'text-emerald-300' : d.runway.p10_months >= 6 ? 'text-amber-300' : 'text-red-300') : 'text-ink-dim'
  const founderTone = d.cap_table?.founder_pct != null ? (d.cap_table.founder_pct >= 65 ? 'text-emerald-300' : d.cap_table.founder_pct >= 50 ? 'text-amber-300' : 'text-red-300') : 'text-ink-dim'

  return (
    <div className="space-y-6">
      {/* Hero: where on 0→IPO */}
      <div className="rounded-2xl border border-w8 bg-gradient-to-br from-bg-2 via-bg-2 to-violet-950/20 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.28em] text-gold-light">Command Cockpit</div>
            <h1 className="font-serif text-2xl text-ink mt-1">
              Chào {d.profile?.full_name ?? d.tenant?.name ?? 'Chairman'}.
            </h1>
            <p className="text-sm text-ink-dim mt-1">
              {d.tenant?.name ?? ''} · {j.industry ?? '—'} · mục tiêu {j.exit_venue?.toUpperCase() ?? 'IPO'} {j.target_year ?? ''}
              {j.north_star_metric ? ` · North Star: ${j.north_star_metric}` : ''}
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-serif text-gold-light">{j.days_to_ipo != null ? `T-${j.days_to_ipo.toLocaleString()}` : '—'}</div>
            <div className="text-xs text-ink-dim">ngày tới rung chuông</div>
          </div>
        </div>

        {/* 7-level journey strip */}
        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-ink-dim">Hành trình 7 tầng · đang ở <b className="text-ink">{j.current_level?.name ?? '—'}</b></span>
            <span className="font-mono text-sm text-gold-light">{j.unlocked_levels}/{j.total_levels}</span>
          </div>
          <div className="flex gap-1.5">
            {j.levels.map((lv) => (
              <Link key={lv.level} href="/journey" title={`Cấp ${lv.level} · ${lv.name} · ${lv.state}`}
                className="flex-1 h-2.5 rounded-full transition hover:opacity-80"
                style={{ background: lv.state === 'locked' ? 'rgba(255,255,255,0.08)' : lv.color, opacity: lv.state === 'unlocked' ? 1 : lv.state === 'locked' ? 0.3 : 0.6 }} />
            ))}
          </div>
        </div>
      </div>

      {/* 4 key vitals */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Vital label="IPO Readiness" value={readinessPct != null ? `${readinessPct}%` : '—'} sub={d.readiness.score != null ? `${d.readiness.score}/${d.readiness.max}` : 'chưa chấm'} href="/ipo-execution" tone={readinessPct != null && readinessPct >= 70 ? 'text-emerald-300' : 'text-gold-light'} />
        <Vital label="Runway (P10)" value={d.runway ? `${d.runway.p10_months}t` : '—'} sub={d.runway ? `P50 ${d.runway.p50_months}t · sống sót ${Math.round((d.runway.survival??0)*100)}%` : 'chạy Financial Model'} href="/financial-model" tone={runwayTone} />
        <Vital label="Founder %" value={d.cap_table?.founder_pct != null ? `${d.cap_table.founder_pct}%` : '—'} sub={d.cap_table ? `ESOP ${d.cap_table.esop_pct ?? 0}% · ${(d.cap_table.total_shares??0).toLocaleString()} CP` : 'dựng cap table'} href="/cap-table" tone={founderTone} />
        <Vital label="Chứng nhận" value={`${d.certificates.total}`} sub={d.certificates.has_master ? 'IPO-Ready Founder 👑' : 'theo tiến độ cấp'} href="/certificates" tone={d.certificates.has_master ? 'text-gold-light' : 'text-ink'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Next actions */}
        <div className="rounded-xl border border-w8 bg-bg-2 p-5">
          <h2 className="font-medium text-ink mb-3">Việc cần làm tiếp</h2>
          {d.next_actions.length === 0 ? (
            <p className="text-sm text-emerald-300">✓ Mọi thứ đang đúng nhịp.</p>
          ) : (
            <ul className="space-y-2">
              {d.next_actions.map((a, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-ink-2">
                  <span className="text-gold-light mt-0.5">▸</span><span>{a}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* KPIs */}
        <div className="rounded-xl border border-w8 bg-bg-2 p-5">
          <h2 className="font-medium text-ink mb-3">KPI snapshot</h2>
          {d.kpis.length === 0 ? <p className="text-sm text-ink-dim italic">Chưa có KPI tracking.</p> : (
            <div className="space-y-2">
              {d.kpis.slice(0, 6).map((k, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-ink-dim">{k.name}</span>
                  <span className="text-ink font-medium">{Number(k.value).toLocaleString()} <span className="text-ink-dim text-xs">{k.unit ?? ''}</span>
                    {k.trend === 'up' && <span className="text-emerald-300"> ↑</span>}
                    {k.trend === 'down' && <span className="text-red-300"> ↓</span>}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Open tasks */}
        <div className="rounded-xl border border-w8 bg-bg-2 p-5">
          <h2 className="font-medium text-ink mb-3">Task đang mở</h2>
          {d.tasks.length === 0 ? <p className="text-sm text-ink-dim italic">Không có task mở.</p> : (
            <div className="space-y-2">
              {d.tasks.slice(0, 6).map((t) => (
                <div key={t.id} className="flex items-center justify-between text-sm border-b border-w8/40 pb-1.5">
                  <span className="text-ink-2 truncate">{t.title}</span>
                  <span className={`text-2xs px-1.5 py-0.5 rounded ${t.status==='in_progress'?'text-sky-300':'text-amber-300'}`}>{t.status}</span>
                </div>
              ))}
            </div>
          )}
          <Link href="/task-cascade" className="mt-3 inline-block text-xs text-gold-light hover:underline">Xem tất cả task →</Link>
        </div>
      </div>

      {/* Quick links to pillars */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {[
          { href: '/journey', label: 'Hành trình', ic: '✦' },
          { href: '/khai-tam', label: 'Khai Tâm', ic: '📖' },
          { href: '/financial-model', label: 'Financial', ic: '∿' },
          { href: '/cap-table', label: 'Cap Table', ic: '◈' },
          { href: '/certificates', label: 'Chứng nhận', ic: '🎓' },
          { href: '/ipo-execution', label: 'IPO Ready', ic: '◎' },
        ].map((l) => (
          <Link key={l.href} href={l.href} className="rounded-lg border border-w8 bg-bg-2 p-3 text-center hover:border-gold/40 hover:bg-w4 transition">
            <div className="text-xl">{l.ic}</div>
            <div className="text-xs text-ink-dim mt-1">{l.label}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}

function Vital({ label, value, sub, href, tone }: { label: string; value: string; sub: string; href: string; tone: string }) {
  return (
    <Link href={href} className="rounded-xl border border-w8 bg-bg-2 p-4 hover:border-gold/40 transition block">
      <div className="text-2xs uppercase tracking-widest text-ink-dim">{label}</div>
      <div className={`font-serif text-2xl mt-1 ${tone}`}>{value}</div>
      <div className="text-xs text-ink-dim mt-1">{sub}</div>
    </Link>
  )
}
