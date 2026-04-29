'use client'

import { useEffect, useState, useCallback } from 'react'

type AuditRow = {
  id: string
  action: string
  target_table: string | null
  target_id: string | null
  actor_id: string | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
  before?: unknown
  after?: unknown
}

const ACTION_TONE: Record<string, string> = {
  INSERT: 'text-emerald-300',
  UPDATE: 'text-amber-300',
  DELETE: 'text-red-300',
  LOGIN: 'text-sky-300',
  LOGOUT: 'text-sky-300',
}

export function AuditLogViewer() {
  const [rows, setRows] = useState<AuditRow[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [action, setAction] = useState('')
  const [targetTable, setTargetTable] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [limit, setLimit] = useState(100)

  const [expanded, setExpanded] = useState<string | null>(null)

  const load = useCallback(async () => {
    setBusy(true); setError(null)
    try {
      const params = new URLSearchParams()
      if (action) params.set('action', action)
      if (targetTable) params.set('target_table', targetTable)
      params.set('limit', String(limit))
      const res = await fetch(`/api/audit?${params.toString()}`)
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? `HTTP ${res.status}`)
        return
      }
      let data = (json.data ?? []) as AuditRow[]
      // Date filter is server-side in /api/audit/export only. Mirror client-side here for snappy UX.
      if (from) data = data.filter((r) => r.created_at >= `${from}T00:00:00Z`)
      if (to) data = data.filter((r) => r.created_at <= `${to}T23:59:59Z`)
      setRows(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setBusy(false)
    }
  }, [action, targetTable, from, to, limit])

  useEffect(() => { load() }, [load])

  function downloadCsv() {
    const params = new URLSearchParams()
    if (action) params.set('action', action)
    if (targetTable) params.set('target_table', targetTable)
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    params.set('limit', '5000')
    window.location.href = `/api/audit/export?${params.toString()}`
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="rounded-lg border border-w8 bg-bg-2 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <Field label="Action">
            <select className={inp} value={action} onChange={(e) => setAction(e.target.value)}>
              <option value="">Tất cả</option>
              <option value="INSERT">INSERT</option>
              <option value="UPDATE">UPDATE</option>
              <option value="DELETE">DELETE</option>
              <option value="LOGIN">LOGIN</option>
              <option value="LOGOUT">LOGOUT</option>
            </select>
          </Field>
          <Field label="Target table">
            <input className={inp} placeholder="vd: ipo_journeys" value={targetTable} onChange={(e) => setTargetTable(e.target.value.trim())} />
          </Field>
          <Field label="Từ ngày">
            <input type="date" className={inp} value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="Đến ngày">
            <input type="date" className={inp} value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Field label="Limit">
            <select className={inp} value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value={500}>500</option>
            </select>
          </Field>
        </div>
        <div className="flex gap-2 justify-end mt-3">
          <button onClick={() => { setAction(''); setTargetTable(''); setFrom(''); setTo('') }} className="rounded border border-w8 px-3 py-1.5 text-sm text-ink-dim hover:bg-w4">
            Xóa lọc
          </button>
          <button onClick={load} disabled={busy} className="rounded bg-c5 px-3 py-1.5 text-sm text-ink hover:opacity-90 disabled:opacity-50">
            {busy ? 'Đang tải…' : 'Áp dụng'}
          </button>
          <button onClick={downloadCsv} className="rounded bg-gold px-3 py-1.5 text-sm font-medium text-bg hover:bg-gold-light">
            ⬇ Export CSV
          </button>
        </div>
      </div>

      {/* Result */}
      {error && (
        <div className="rounded border border-red-700 bg-red-900/30 p-3 text-sm text-red-200">{error}</div>
      )}

      <div className="rounded-lg border border-w8 bg-bg-2 overflow-hidden">
        <div className="px-4 py-2 border-b border-w8 flex items-center justify-between text-xs text-ink-dim">
          <span>{rows.length} bản ghi</span>
          <span>Tự động cập nhật mỗi lần áp dụng filter</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-w8 text-xs uppercase tracking-wider text-ink-dim">
                <th className="text-left px-4 py-2 font-normal">Thời gian</th>
                <th className="text-left px-4 py-2 font-normal">Action</th>
                <th className="text-left px-4 py-2 font-normal">Bảng</th>
                <th className="text-left px-4 py-2 font-normal">Target</th>
                <th className="text-left px-4 py-2 font-normal">Actor</th>
                <th className="text-left px-4 py-2 font-normal">IP</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !busy && (
                <tr><td colSpan={7} className="text-center text-ink-dim italic py-8">
                  Không có bản ghi audit nào với filter hiện tại.
                </td></tr>
              )}
              {rows.map((r) => {
                const isOpen = expanded === r.id
                return (
                  <RowFragment key={r.id}>
                    <tr className="border-b border-w8/40 hover:bg-w4/40">
                      <td className="px-4 py-2 font-mono text-xs text-ink-dim whitespace-nowrap">
                        {new Date(r.created_at).toLocaleString('vi-VN')}
                      </td>
                      <td className={`px-4 py-2 font-medium ${ACTION_TONE[r.action] ?? 'text-ink'}`}>{r.action}</td>
                      <td className="px-4 py-2 font-mono text-xs">{r.target_table ?? '—'}</td>
                      <td className="px-4 py-2 font-mono text-xs text-ink-dim">{r.target_id ? r.target_id.slice(0, 8) : '—'}</td>
                      <td className="px-4 py-2 font-mono text-xs text-ink-dim">{r.actor_id ? r.actor_id.slice(0, 8) : 'system'}</td>
                      <td className="px-4 py-2 font-mono text-xs text-ink-dim">{r.ip_address ?? '—'}</td>
                      <td className="px-2 py-2">
                        <button
                          aria-label={isOpen ? 'Thu gọn' : 'Mở rộng'}
                          onClick={() => setExpanded(isOpen ? null : r.id)}
                          className="text-ink-dim hover:text-gold-light"
                        >
                          {isOpen ? '▲' : '▼'}
                        </button>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="border-b border-w8/40 bg-bg/40">
                        <td colSpan={7} className="px-4 py-3">
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-xs font-mono">
                            <DiffPane title="Trước" value={r.before} />
                            <DiffPane title="Sau" value={r.after} />
                          </div>
                          {r.user_agent && (
                            <div className="mt-2 text-xs text-ink-dim font-mono break-all">UA: {r.user_agent}</div>
                          )}
                        </td>
                      </tr>
                    )}
                  </RowFragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function RowFragment({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

function DiffPane({ title, value }: { title: string; value: unknown }) {
  return (
    <div className="rounded border border-w8 p-3 bg-bg-2">
      <div className="text-2xs uppercase tracking-widest text-ink-dim mb-1">{title}</div>
      {value == null ? (
        <div className="text-ink-dim italic">—</div>
      ) : (
        <pre className="overflow-x-auto whitespace-pre-wrap break-all text-ink">{JSON.stringify(value, null, 2)}</pre>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-ink-dim mb-1">{label}</span>
      {children}
    </label>
  )
}

const inp = 'w-full rounded border border-w8 bg-bg px-2 py-1.5 text-sm text-ink focus:border-gold focus:outline-none'
