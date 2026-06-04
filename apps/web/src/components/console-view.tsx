'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

// ─── types (mirror /api/console) ─────────────────────────────────
type TenantRow = {
  id: string; name: string; slug: string; plan: string; owner_email: string | null
  users_count: number; phase: number | null; journey_name: string | null
  readiness: number | null; okr_count: number; created_at: string
  last_active: string | null; active_30d: boolean; is_test: boolean
  parent_tenant_id: string | null
}
type UserRow = { id: string; email: string | null; full_name: string | null; role: string | null; tenant_name: string | null; is_super: boolean; last_active: string | null }
type Subsidiary = { id: string; name: string; slug: string; phase: number | null; readiness: number | null; okr_count: number; users_count: number; cash_usd: number | null; runway_months: number | null; mrr_usd: number | null }
type ConsoleData = {
  operator: {
    counts: { tenants_total: number; tenants_real: number; tenants_test: number; users: number; users_total: number; journeys: number; active_30d: number }
    revenue: { mrr_usd: number; active_subs: number; by_plan: Record<string, number> }
    signups_by_month: Array<{ month: string; count: number }>
    recent_signups: Array<{ name: string; slug: string; plan: string | null; created_at: string; owner_email: string | null }>
  }
  tenants: TenantRow[]
  users: UserRow[]
  holdings: {
    parent: { id: string; name: string; slug: string } | null
    subsidiaries: Subsidiary[]
    rollup: { companies: number; avg_readiness: number | null; total_cash_usd: number; total_okrs: number; total_mrr_usd: number }
    candidates: Array<{ id: string; name: string; slug: string }>
  }
  health: { events_24h: number; events_7d: number; recent_events: Array<{ event_type: string; created_at: string; tenant_id: string | null }>; last_event_at: string | null }
  needs_migration: boolean
}

// ─── helpers ─────────────────────────────────────────────────────
const fmtMoney = (n: number) => {
  if (n >= 1_000_000_000) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1_000_000) return `$${(n / 1e6).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1e3).toFixed(1)}K`
  return `$${Math.round(n)}`
}
const fmtDate = (s: string | null | undefined) => (s ? new Date(s).toLocaleDateString('vi-VN') : '—')
const fmtAgo = (s: string | null | undefined) => {
  if (!s) return '—'
  const d = Date.now() - new Date(s).getTime()
  const days = Math.floor(d / 86_400_000)
  if (days === 0) return 'hôm nay'
  if (days === 1) return 'hôm qua'
  if (days < 30) return `${days} ngày trước`
  if (days < 365) return `${Math.floor(days / 30)} tháng trước`
  return `${Math.floor(days / 365)} năm trước`
}

export function ConsoleView() {
  const [data, setData] = useState<ConsoleData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'operator' | 'holdings'>('operator')

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/console', { credentials: 'same-origin' })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(j.error ?? `HTTP ${res.status}`); return
      }
      const j = await res.json()
      setData(j.data as ConsoleData)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="px-6 py-6 max-w-[1240px] mx-auto">
      <header className="mb-6">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-ink-dim mb-2">
          <span className="h-2 w-2 rounded-full bg-gold shadow-[0_0_10px] shadow-gold" /> Zeni Console
        </div>
        <h1 className="font-serif text-3xl text-ink">Điều hành toàn nền tảng</h1>
        <p className="mt-1 text-sm text-ink-dim">Operator (vận hành SaaS · mọi khách hàng) và Holdings (tập đoàn Zeni · công ty con) trong một bảng điều khiển.</p>
      </header>

      <div className="flex gap-2 border-b border-w8 mb-6">
        <Tab active={tab === 'operator'} onClick={() => setTab('operator')}>Operator · Vận hành nền tảng</Tab>
        <Tab active={tab === 'holdings'} onClick={() => setTab('holdings')}>Holdings · Tập đoàn Zeni</Tab>
        <button onClick={load} className="ml-auto self-center text-xs text-ink-dim hover:text-gold px-3 py-1 rounded border border-w8 mb-2">↻ Làm mới</button>
      </div>

      {loading && <div className="py-20 text-center text-ink-dim">Đang tải dữ liệu toàn hệ thống…</div>}
      {error && <div className="rounded border border-red-700 bg-red-900/30 p-4 text-sm text-red-200">Lỗi: {error}</div>}

      {data && !loading && tab === 'operator' && <Operator data={data} />}
      {data && !loading && tab === 'holdings' && <Holdings data={data} reload={load} />}
    </div>
  )
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${active ? 'border-gold text-ink' : 'border-transparent text-ink-dim hover:text-ink'}`}>
      {children}
    </button>
  )
}

// ─── OPERATOR TAB ────────────────────────────────────────────────
function Operator({ data }: { data: ConsoleData }) {
  const { operator, tenants, users, health } = data
  const c = operator.counts
  const [showTest, setShowTest] = useState(false)
  const rows = useMemo(() => (showTest ? tenants : tenants.filter((t) => !t.is_test)), [tenants, showTest])
  const maxSignup = Math.max(1, ...operator.signups_by_month.map((s) => s.count))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="Khách hàng thật" value={c.tenants_real} sub={`${c.tenants_test} test`} tone="gold" />
        <Stat label="Người dùng" value={c.users} sub={`${c.users_total} tổng`} />
        <Stat label="IPO Journeys" value={c.journeys} />
        <Stat label="Active 30 ngày" value={c.active_30d} sub={`/${c.tenants_real} khách`} tone="ok" />
        <Stat label="MRR" value={fmtMoney(operator.revenue.mrr_usd)} sub={`${operator.revenue.active_subs} sub active`} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card title="Khách hàng mới · 6 tháng">
          <div className="flex items-end gap-2 h-32 px-1">
            {operator.signups_by_month.map((s) => (
              <div key={s.month} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full rounded-t bg-gold/70 hover:bg-gold transition" style={{ height: `${(s.count / maxSignup) * 100}%`, minHeight: s.count ? 6 : 1 }} title={`${s.count}`} />
                <span className="text-[10px] text-ink-dim">{s.month.slice(5)}</span>
                <span className="text-[10px] text-ink">{s.count}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Phân bổ gói">
          <div className="space-y-2">
            {Object.entries(operator.revenue.by_plan).map(([plan, n]) => {
              const total = Object.values(operator.revenue.by_plan).reduce((a, b) => a + b, 0) || 1
              return (
                <div key={plan} className="flex items-center gap-3">
                  <span className="w-24 text-xs text-ink-2 capitalize">{plan}</span>
                  <div className="flex-1 h-2 rounded-full bg-w8 overflow-hidden"><div className="h-full bg-c5" style={{ width: `${(n / total) * 100}%` }} /></div>
                  <span className="w-8 text-right text-xs text-ink-dim">{n}</span>
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      <Card title={`Khách hàng (${rows.length})`} action={
        <label className="flex items-center gap-1.5 text-xs text-ink-dim cursor-pointer">
          <input type="checkbox" checked={showTest} onChange={(e) => setShowTest(e.target.checked)} className="accent-gold" /> hiện test/demo
        </label>
      }>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead><tr className="text-left text-xs text-ink-dim border-b border-w8">
              <th className="py-2 pr-3 font-medium">Công ty</th><th className="py-2 px-3 font-medium">Gói</th><th className="py-2 px-3 font-medium">Owner</th>
              <th className="py-2 px-3 font-medium text-right">Users</th><th className="py-2 px-3 font-medium text-right">Phase</th>
              <th className="py-2 px-3 font-medium text-right">Readiness</th><th className="py-2 px-3 font-medium">Tạo</th><th className="py-2 px-3 font-medium">Hoạt động</th>
            </tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={8} className="py-6 text-center text-ink-dim italic">Không có khách hàng nào.</td></tr>}
              {rows.map((t) => (
                <tr key={t.id} className="border-b border-w8/50 hover:bg-w4">
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-ink">{t.name}</span>
                      {t.is_test && <span className="text-[9px] px-1.5 py-0.5 rounded bg-w8 text-ink-dim">test</span>}
                      {t.active_30d && !t.is_test && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" title="active 30d" />}
                    </div>
                    <span className="text-[10px] text-ink-dim font-mono">{t.slug}</span>
                  </td>
                  <td className="py-2 px-3"><span className="text-xs capitalize text-ink-2">{t.plan}</span></td>
                  <td className="py-2 px-3 text-xs text-ink-dim">{t.owner_email ?? '—'}</td>
                  <td className="py-2 px-3 text-right text-ink-2">{t.users_count}</td>
                  <td className="py-2 px-3 text-right text-ink-2">{t.phase != null ? `P${t.phase}` : '—'}</td>
                  <td className="py-2 px-3 text-right">{t.readiness != null ? <span className="text-gold">{t.readiness}</span> : <span className="text-ink-dim">—</span>}</td>
                  <td className="py-2 px-3 text-xs text-ink-dim">{fmtDate(t.created_at)}</td>
                  <td className="py-2 px-3 text-xs text-ink-dim">{fmtAgo(t.last_active)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card title={`Người dùng (${users.length})`}>
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-bg-2"><tr className="text-left text-xs text-ink-dim border-b border-w8">
                <th className="py-2 pr-3 font-medium">Email</th><th className="py-2 px-3 font-medium">Role</th><th className="py-2 px-3 font-medium">Tenant</th><th className="py-2 px-3 font-medium">Active</th>
              </tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-w8/50">
                    <td className="py-1.5 pr-3 text-xs text-ink">{u.email}{u.is_super && <span className="ml-1 text-[9px] px-1 py-0.5 rounded bg-gold/20 text-gold">SUPER</span>}</td>
                    <td className="py-1.5 px-3 text-xs uppercase text-ink-2">{u.role ?? '—'}</td>
                    <td className="py-1.5 px-3 text-xs text-ink-dim">{u.tenant_name ?? '—'}</td>
                    <td className="py-1.5 px-3 text-xs text-ink-dim">{fmtAgo(u.last_active)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="Sức khỏe hệ thống" action={<span className="text-xs text-ink-dim">{health.events_24h} sự kiện / 24h · {health.events_7d} / 7d</span>}>
          <div className="space-y-1.5 max-h-80 overflow-y-auto">
            {health.recent_events.length === 0 && <div className="text-ink-dim text-sm italic py-4 text-center">Chưa có sự kiện.</div>}
            {health.recent_events.map((e, i) => (
              <div key={i} className="flex items-center justify-between text-xs border-l-2 border-c5 bg-w4 px-3 py-1.5 rounded-r">
                <span className="font-mono text-ink-2">{e.event_type}</span>
                <span className="text-ink-dim">{fmtAgo(e.created_at)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

// ─── HOLDINGS TAB ────────────────────────────────────────────────
function Holdings({ data, reload }: { data: ConsoleData; reload: () => void }) {
  const { holdings, needs_migration } = data
  const [busy, setBusy] = useState(false)
  const [pick, setPick] = useState('')
  const [err, setErr] = useState<string | null>(null)

  async function setParent(tenant_id: string, parent_tenant_id: string | null) {
    setBusy(true); setErr(null)
    try {
      const res = await fetch('/api/console', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_parent', tenant_id, parent_tenant_id }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setErr(j.needs_migration ? 'Cần apply migration 023 trước.' : (typeof j.error === 'string' ? j.error : 'Lỗi cập nhật')); return }
      setPick(''); reload()
    } catch (e) { setErr(e instanceof Error ? e.message : 'Network error') } finally { setBusy(false) }
  }

  const r = holdings.rollup

  return (
    <div className="space-y-6">
      {needs_migration && (
        <div className="rounded border border-amber-600/50 bg-amber-900/20 p-3 text-sm text-amber-200">
          ⚠ Quan hệ công ty con chưa bật — cần apply <span className="font-mono">migration 023</span> lên DB. Sau khi apply, gán công ty con tại đây.
        </div>
      )}

      <div className="rounded-xl border border-w8 bg-bg-2 p-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gold/15 flex items-center justify-center font-serif text-gold text-lg">Z</div>
          <div>
            <div className="font-serif text-xl text-ink">{holdings.parent?.name ?? 'Zeni Holdings'}</div>
            <div className="text-xs text-ink-dim">Công ty mẹ · {r.companies} công ty con</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="Công ty con" value={r.companies} tone="gold" />
        <Stat label="Readiness TB" value={r.avg_readiness != null ? `${r.avg_readiness}` : '—'} sub="/1000" />
        <Stat label="Tổng tiền mặt" value={fmtMoney(r.total_cash_usd)} />
        <Stat label="Tổng OKR" value={r.total_okrs} />
        <Stat label="Tổng MRR" value={fmtMoney(r.total_mrr_usd)} />
      </div>

      <Card title={`Công ty con (${holdings.subsidiaries.length})`} action={
        <div className="flex items-center gap-2">
          <select value={pick} onChange={(e) => setPick(e.target.value)} disabled={busy || holdings.candidates.length === 0}
            className="rounded border border-w8 bg-bg px-2 py-1 text-xs text-ink focus:border-gold focus:outline-none">
            <option value="">{holdings.candidates.length ? '+ Thêm công ty con…' : 'Hết ứng viên'}</option>
            {holdings.candidates.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button disabled={!pick || busy} onClick={() => holdings.parent && setParent(pick, holdings.parent.id)}
            className="rounded bg-gold px-3 py-1 text-xs font-medium text-bg hover:bg-gold-light disabled:opacity-40">Gán</button>
        </div>
      }>
        {err && <div className="mb-3 rounded border border-red-700 bg-red-900/30 p-2 text-xs text-red-200">{err}</div>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead><tr className="text-left text-xs text-ink-dim border-b border-w8">
              <th className="py-2 pr-3 font-medium">Công ty</th><th className="py-2 px-3 font-medium text-right">Phase</th>
              <th className="py-2 px-3 font-medium text-right">Readiness</th><th className="py-2 px-3 font-medium text-right">OKR</th>
              <th className="py-2 px-3 font-medium text-right">Tiền mặt</th><th className="py-2 px-3 font-medium text-right">Runway</th><th className="py-2 px-3" />
            </tr></thead>
            <tbody>
              {holdings.subsidiaries.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-ink-dim italic">Chưa có công ty con. Dùng dropdown để gán.</td></tr>}
              {holdings.subsidiaries.map((s) => (
                <tr key={s.id} className="border-b border-w8/50 hover:bg-w4">
                  <td className="py-2 pr-3"><span className="font-medium text-ink">{s.name}</span><span className="block text-[10px] text-ink-dim font-mono">{s.slug}</span></td>
                  <td className="py-2 px-3 text-right text-ink-2">{s.phase != null ? `P${s.phase}` : '—'}</td>
                  <td className="py-2 px-3 text-right">{s.readiness != null ? <span className="text-gold">{s.readiness}</span> : <span className="text-ink-dim">—</span>}</td>
                  <td className="py-2 px-3 text-right text-ink-2">{s.okr_count}</td>
                  <td className="py-2 px-3 text-right text-ink-2">{s.cash_usd != null ? fmtMoney(s.cash_usd) : '—'}</td>
                  <td className="py-2 px-3 text-right text-ink-2">{s.runway_months != null ? `${s.runway_months} mo` : '—'}</td>
                  <td className="py-2 px-3 text-right"><button disabled={busy} onClick={() => setParent(s.id, null)} className="text-xs text-ink-dim hover:text-red-300">Gỡ</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

// ─── shared UI ───────────────────────────────────────────────────
function Stat({ label, value, sub, tone }: { label: string; value: string | number; sub?: string; tone?: 'gold' | 'ok' }) {
  return (
    <div className="rounded-xl border border-w8 bg-bg-2 p-4">
      <div className="text-[11px] uppercase tracking-wide text-ink-dim">{label}</div>
      <div className={`mt-1 font-serif text-2xl ${tone === 'gold' ? 'text-gold' : tone === 'ok' ? 'text-emerald-300' : 'text-ink'}`}>{value}</div>
      {sub && <div className="text-[11px] text-ink-dim mt-0.5">{sub}</div>}
    </div>
  )
}

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-w8 bg-bg-2 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-serif text-base text-ink">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  )
}
