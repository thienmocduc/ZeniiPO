'use client'

/**
 * V1DataBind — client-side data binder.
 *
 * Strategy: keep v1_8_FULL HTML byte-for-byte (server-rendered via V1Page),
 * then after mount fetch from the existing /api/* routes and patch DOM nodes
 * via stable selectors (IDs + class chains the chairman did NOT change).
 *
 * If a binding fails (e.g. Supabase 401, missing element), we leave the
 * static markup intact — the page is still rendered, just without live data.
 *
 * For pages where the tenant has no data yet, we paint an "empty state" into
 * the first big table so users know what they're looking at, instead of seeing
 * the seeded demo numbers from the Zeni Holdings template.
 */

import { useEffect, useState } from 'react'

type Json = Record<string, unknown> | null

type DataBindProps = {
  pageId: string
  /** Pre-fetched data (optional, used when caller does SSR fetch). */
  initialData?: Json
  children: React.ReactNode
}

const PAGE_API_MAP: Record<string, string> = {
  // Phase-1 core (already had patchers)
  'page-dash': '/api/dashboard',
  'page-okr': '/api/okrs',
  'page-tasks': '/api/tasks',
  'page-captable': '/api/cap-table',
  'page-fundraise': '/api/pipeline',
  'page-pnl': '/api/dashboard',
  'page-ipo': '/api/journeys',
  'page-roadmap': '/api/journeys',
  'page-agents': '/api/agents',
  // Chunk 3 — 35 additional pages
  'page-northstar': '/api/dashboard',
  'page-kpi': '/api/kpis',
  'page-schema': '/api/workflow',
  'page-dataroom': '/api/vault',
  'page-council': '/api/council',
  'page-datafow': '/api/dataflow',
  'page-team': '/api/team',
  'page-sops': '/api/modules?category=sops',
  'page-investors': '/api/investors',
  'page-pitch': '/api/pitch',
  'page-terms': '/api/glossary',
  'page-burn': '/api/burn',
  'page-unit': '/api/unit-metrics',
  'page-forecast': '/api/forecast',
  'page-playbook': '/api/modules?category=playbook',
  'page-compliance': '/api/readiness',
  'page-legal': '/api/modules?category=legal',
  'page-board': '/api/board',
  'page-audit': '/api/audit',
  'page-training': '/api/academy/progress',
  'page-sensitivity': '/api/sensitivity',
  'page-vh': '/api/valuation',
  'page-token': '/api/tokenomics',
  'page-comparables': '/api/comparables',
  'page-mktdata': '/api/market-data',
  'page-mktintel': '/api/market-intel',
  'page-nlq': '/api/nlq',
  'page-sales': '/api/sales',
  'page-plv': '/api/billing',
  'page-fclb': '/api/feedback',
  'page-gvdoc': '/api/modules?category=governance',
  'page-tcdoc': '/api/modules?category=terms',
  'page-admin': '/api/admin',
  'page-vault': '/api/vault',
  'page-settings': '/api/settings',
}

export function V1DataBind({ pageId, initialData, children }: DataBindProps) {
  const [data, setData] = useState<Json>(initialData ?? null)

  // Fetch JSON when no initial data was provided server-side.
  useEffect(() => {
    if (initialData) return
    const url = PAGE_API_MAP[pageId]
    if (!url) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(url, { credentials: 'same-origin' })
        if (!res.ok) return
        const json = await res.json()
        if (!cancelled) setData(json)
      } catch (err) {
        if (process.env.NODE_ENV !== 'production') console.error('[v1-data-bind]', pageId, err)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [pageId, initialData])

  // Apply patcher whenever data changes.
  useEffect(() => {
    if (!data) return
    const patcher = PAGE_PATCHERS[pageId]
    if (!patcher) return
    try {
      const r = patcher(data)
      if (r && typeof (r as Promise<void>).catch === 'function') {
        ;(r as Promise<void>).catch((err) => {
          if (process.env.NODE_ENV !== 'production') console.error('[v1-data-bind] patch async', pageId, err)
        })
      }
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') console.error('[v1-data-bind] patch', pageId, err)
    }
  }, [data, pageId])

  return <>{children}</>
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const fmtMoney = (n: number) => {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`
  return `$${Math.round(n)}`
}

const fmtNum = (n: number) => Number(n).toLocaleString()
const fmtDate = (s: string | null | undefined) => (s ? new Date(s).toLocaleDateString('vi-VN') : '—')

function setText(root: ParentNode, sel: string, val: string | number | null | undefined) {
  if (val == null) return
  const el = root.querySelector<HTMLElement>(sel)
  if (el) el.textContent = String(val)
}

function setHTML(root: ParentNode, sel: string, html: string) {
  const el = root.querySelector<HTMLElement>(sel)
  if (el) el.innerHTML = html
}

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c] as string))
}

/** Patch the 4 KPI cards in `.kpi-row` (in order). */
function patchKpiCards(
  root: ParentNode,
  cards: Array<{ value: string | number; label?: string; sub?: string } | null>,
) {
  const cardsEl = root.querySelectorAll<HTMLElement>('.kpi-row .kpi-card')
  cards.forEach((c, i) => {
    if (!c || !cardsEl[i]) return
    const v = cardsEl[i].querySelector<HTMLElement>('.kpi-v')
    const l = cardsEl[i].querySelector<HTMLElement>('.kpi-lbl')
    const s = cardsEl[i].querySelector<HTMLElement>('.kpi-sub')
    if (v) v.innerHTML = String(c.value)
    if (l && c.label) l.textContent = c.label
    if (s && c.sub) s.textContent = c.sub
  })
}

/** Replace tbody of the first `table.tbl` inside selector with rows.
 * If rows is empty, paint an empty state. */
function patchTable(
  root: ParentNode,
  cardSel: string,
  rows: string[],
  emptyMessage: string,
  colCount = 4,
) {
  const card = root.querySelector<HTMLElement>(cardSel) ?? root
  const tbody = card.querySelector<HTMLTableSectionElement>('table.tbl tbody')
  if (!tbody) return
  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${colCount}" style="text-align:center;color:var(--dim);font-style:italic;padding:18px">${escapeHtml(emptyMessage)}</td></tr>`
    return
  }
  tbody.innerHTML = rows.join('')
}

/** Patch the count `<em>· N items</em>` inside the first matching card heading. */
function patchCardCount(root: ParentNode, cardSel: string, count: number, suffix: string) {
  const card = root.querySelector<HTMLElement>(cardSel) ?? root
  const em = card.querySelector<HTMLElement>('.card-h h3 em')
  if (em) em.textContent = `· ${count} ${suffix}`
}

const STATUS_CLASS: Record<string, string> = {
  ok: 'ok', passed: 'ok', success: 'ok', completed: 'ok', closed: 'ok', won: 'ok',
  warn: 'warn', pending: 'warn', in_progress: 'warn', screen: 'warn', planning: 'warn',
  err: 'err', error: 'err', critical: 'err', alert: 'err', failed: 'err', rejected: 'err',
  info: 'info', dd: 'info', interview: 'info',
  dim: 'dim', new: 'new', open: 'new',
}
const stClass = (s: string) => STATUS_CLASS[String(s).toLowerCase()] ?? 'dim'

// ─────────────────────────────────────────────────────────────
// Patchers — Phase 1 core (existing 9)
// ─────────────────────────────────────────────────────────────

const PAGE_PATCHERS: Record<string, (raw: Json) => void | Promise<void>> = {
  'page-dash': (raw) => {
    const root = document.getElementById('page-dash')
    if (!root) return
    const d = (raw?.data ?? raw) as Record<string, unknown>
    const profile = d.profile as { display_name?: string; full_name?: string } | null
    const tenant = d.tenant as { name?: string } | null
    const journey = d.journey as { current_phase?: string; valuation_target?: number } | null
    const kpis = (d.kpis as Array<{ name: string; value: number; unit?: string }> | undefined) ?? []
    const readiness = d.readiness as { score?: number } | number | null

    const greetName = profile?.display_name || profile?.full_name || tenant?.name || ''
    if (greetName) setText(root, '#greetName', `${greetName}.`)
    if (tenant?.name) {
      setText(root, '#dashLede', `Đang vận hành ${tenant.name}. ${kpis.length} KPI live, ${journey?.current_phase ?? 'Phase 1'} active.`)
    } else {
      setText(root, '#dashLede', 'Bảng điều khiển trung tâm — moi KPI cập nhật theo thời gian thực.')
    }

    const kpiRow = root.querySelector<HTMLElement>('#kpiRow')
    if (kpiRow && kpis.length > 0) {
      const tone = ['gold', 'ok', '', 'warn']
      kpiRow.innerHTML = kpis.slice(0, 4).map((k, i) => {
        const value = typeof k.value === 'number' ? Number(k.value).toLocaleString() : k.value
        const unit = k.unit ? `<em>${k.unit}</em>` : ''
        return `<div class="kpi-card ${tone[i] ?? ''}"><div class="kpi-lbl">${escapeHtml(k.name)}</div><div class="kpi-v">${escapeHtml(String(value))}${unit}</div></div>`
      }).join('')
    } else if (kpiRow) {
      kpiRow.innerHTML = `<div class="kpi-card" style="grid-column:1/-1;text-align:center"><div class="kpi-lbl">Chưa có KPI</div><div class="kpi-v" style="font-size:1rem;color:var(--dim)">Tạo KPI đầu tiên ở /kpi-matrix</div></div>`
    }

    const score = typeof readiness === 'number' ? readiness : (readiness as { score?: number } | null)?.score
    if (typeof score === 'number') {
      setHTML(root, '#statCardBody',
        `<div style="display:flex;align-items:center;justify-content:center;padding:20px;flex-direction:column;gap:8px"><div class="gold mono" style="font-size:2.4rem;font-weight:600">${score}<em style="font-size:1rem;color:var(--dim)">/1000</em></div><div style="color:var(--dim);font-size:.78rem">IPO Readiness Score · live</div></div>`)
    }

    const tasks = (d.tasks as Array<{ title: string; status?: string }> | undefined) ?? []
    const events = (d.events as Array<{ type?: string }> | undefined) ?? []
    const alertsCount = root.querySelector<HTMLElement>('#alertsCount')
    if (alertsCount) alertsCount.textContent = `${tasks.length + events.length} items`
    const alertsList = root.querySelector<HTMLElement>('#alertsList')
    if (alertsList) {
      if (tasks.length === 0) {
        alertsList.innerHTML = `<div style="padding:18px;color:var(--dim);text-align:center;font-size:.8rem">Chưa có alert nào</div>`
      } else {
        alertsList.innerHTML = tasks.slice(0, 5).map((t) =>
          `<div style="padding:10px 12px;background:var(--w4);border-left:2px solid var(--c5);border-radius:3px;font-size:.78rem;color:var(--ink-2)"><b>${escapeHtml(t.title)}</b><div style="color:var(--dim);font-size:.7rem;margin-top:2px">${escapeHtml(t.status ?? 'open')}</div></div>`,
        ).join('')
      }
    }
  },

  'page-okr': (raw) => {
    const root = document.getElementById('page-okr')
    if (!root) return
    const d = raw as { data?: Array<{ id: string; title: string; tier?: string; description?: string; parent_id?: string | null }>, tree?: { roots: Array<{ id: string; title: string; tier?: string }>, byParent: Record<string, Array<{ id: string; title: string; tier?: string }>> } }
    const list = d?.data ?? []
    const tree = d?.tree

    setText(root, '#okrLede', `${list.length} OKR đang live · cascade từ Chairman xuống Individual.`)

    const byTier = list.reduce<Record<string, number>>((acc, o) => {
      const t = o.tier ?? 'misc'; acc[t] = (acc[t] ?? 0) + 1; return acc
    }, {})
    patchKpiCards(root, [
      { value: byTier.chairman ?? 0, label: 'Chairman' },
      { value: byTier.ceo ?? 0, label: 'CEO' },
      { value: byTier.c_level ?? byTier.clevel ?? 0, label: 'C-Level' },
      { value: (byTier.team ?? 0) + (byTier.individual ?? 0) + (byTier.kr ?? 0), label: 'Team / Indiv' },
    ])

    const body = root.querySelector<HTMLElement>('#okrTreeBody')
    if (body) {
      if (list.length === 0) {
        body.innerHTML = `<div style="padding:30px;color:var(--dim);text-align:center;font-size:.9rem">Chưa có OKR nào. Tạo OKR đầu tiên để bắt đầu cascade.</div>`
      } else if (tree) {
        const roots = tree.roots ?? []
        const byParent = tree.byParent ?? {}
        body.innerHTML = roots.map((r) => renderOkrNode(r, byParent, 0)).join('')
      } else {
        body.innerHTML = list.map((o) => `<div class="okr-node"><div class="okr-h"><b>${escapeHtml(o.title)}</b><span class="tag">${escapeHtml(o.tier ?? '')}</span></div><div style="color:var(--dim);font-size:.74rem;margin-top:4px">${escapeHtml(o.description ?? '')}</div></div>`).join('')
      }
    }
  },

  'page-tasks': (raw) => {
    const root = document.getElementById('page-tasks')
    if (!root) return
    const d = raw as { data?: Array<{ id: string; title: string; status?: string; priority?: string; due_date?: string }> }
    const tasks = d?.data ?? []
    setText(root, '#tasksLede', `${tasks.length} task đang track · OODA loop rolling 30 ngày.`)
    const body = root.querySelector<HTMLElement>('#tasksBody')
    if (!body) return
    if (tasks.length === 0) {
      body.innerHTML = `<div class="card"><div style="padding:24px;color:var(--dim);text-align:center;font-size:.9rem">Chưa có task. Click "+ Task mới" để tạo.</div></div>`
      return
    }
    const rows = tasks.map((t) => {
      const due = fmtDate(t.due_date)
      const status = t.status ?? 'open'
      return `<tr><td><strong>${escapeHtml(t.title)}</strong></td><td>${escapeHtml(t.priority ?? '—')}</td><td>${due}</td><td><span class="st ${stClass(status)}">${escapeHtml(status)}</span></td></tr>`
    }).join('')
    body.innerHTML = `<div class="card"><div class="card-h"><h3>Task list <em>· ${tasks.length} active</em></h3><span class="tag live">LIVE</span></div><table class="tbl"><thead><tr><th>Task</th><th>Priority</th><th>Due</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>`
  },

  'page-captable': (raw) => {
    const root = document.getElementById('page-captable')
    if (!root) return
    const d = raw as { data?: { snapshot_date?: string; total_shares?: number; valuation_usd?: number; share_price_usd?: number; holders?: unknown } | null }
    const snap = d?.data
    if (!snap) {
      patchKpiCards(root, [
        { value: '<em style="font-size:1rem;color:var(--dim)">No snapshot</em>' },
        { value: '<em style="font-size:1rem;color:var(--dim)">—</em>' },
        { value: '<em style="font-size:1rem;color:var(--dim)">—</em>' },
        { value: '<em style="font-size:1rem;color:var(--dim)">—</em>' },
      ])
      return
    }
    patchKpiCards(root, [
      typeof snap.total_shares === 'number' ? { value: `${(snap.total_shares / 1_000_000).toFixed(1)}<em>M</em>` } : null,
      typeof snap.valuation_usd === 'number' ? { value: fmtMoney(snap.valuation_usd) } : null,
      typeof snap.share_price_usd === 'number' ? { value: `$${snap.share_price_usd.toFixed(2)}` } : null,
      snap.snapshot_date ? { value: fmtDate(snap.snapshot_date) } : null,
    ])
  },

  'page-fundraise': (raw) => {
    const root = document.getElementById('page-fundraise')
    if (!root) return
    const d = raw as { data?: Array<{ id: string; investor_name: string; stage?: string; check_size?: number }> }
    const pipeline = d?.data ?? []
    const cards = root.querySelectorAll<HTMLElement>('.kpi-row .kpi-card .kpi-v')
    if (cards.length >= 4) cards[2].textContent = String(pipeline.length)
    const subs = root.querySelectorAll<HTMLElement>('.kpi-row .kpi-card .kpi-sub')
    if (subs.length >= 3) {
      const softCommit = pipeline.filter((p) => /soft/i.test(p.stage ?? '')).length
      const dd = pipeline.filter((p) => /dd|due/i.test(p.stage ?? '')).length
      subs[2].textContent = `${softCommit} soft commit · ${dd} DD active`
    }
    const tableBody = root.querySelector<HTMLTableSectionElement>('table.tbl tbody')
    if (tableBody && pipeline.length > 0) {
      tableBody.innerHTML = pipeline.slice(0, 14).map((p) => {
        const cs = typeof p.check_size === 'number' ? fmtMoney(p.check_size) : '—'
        const stage = p.stage ?? 'prospect'
        return `<tr><td><strong>${escapeHtml(p.investor_name)}</strong></td><td>${escapeHtml(stage)}</td><td class="num">${cs}</td><td>—</td><td>—</td><td><span class="st ${stClass(stage)}">${escapeHtml(stage)}</span></td><td>—</td></tr>`
      }).join('')
    } else if (tableBody) {
      tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--dim);padding:18px;font-style:italic">Chưa có investor nào trong pipeline. Bấm "+ Add investor" để bắt đầu.</td></tr>`
    }
  },

  'page-pnl': (raw) => {
    const root = document.getElementById('page-pnl')
    if (!root) return
    const d = (raw as { data?: { kpis?: Array<{ name: string; value: number; unit?: string }> } })?.data
    const kpis = d?.kpis ?? []
    const cards = root.querySelectorAll<HTMLElement>('.kpi-row .kpi-card')
    const findKpi = (rx: RegExp) => kpis.find((k) => rx.test(k.name))
    const rev = findKpi(/revenue|arr|mrr/i)
    const gm = findKpi(/gross\s*margin|gm/i)
    const burn = findKpi(/burn/i)
    const cash = findKpi(/cash|runway/i)
    const pairs: Array<[Element | undefined, { name: string; value: number; unit?: string } | undefined]> = [
      [cards[0], rev], [cards[1], gm], [cards[2], burn], [cards[3], cash],
    ]
    for (const [card, k] of pairs) {
      if (!card || !k) continue
      const v = card.querySelector<HTMLElement>('.kpi-v')
      if (v) v.innerHTML = `${fmtNum(Number(k.value))}<em>${escapeHtml(k.unit ?? '')}</em>`
      const lbl = card.querySelector<HTMLElement>('.kpi-lbl')
      if (lbl) lbl.textContent = k.name
    }
  },

  'page-ipo': async (raw) => {
    const root = document.getElementById('page-ipo')
    if (!root) return
    const d = raw as { data?: Array<{ id: string; current_phase?: string; target_year?: number; valuation_target?: number }> }
    const journey = d?.data?.[0]
    if (!journey?.id) return
    try {
      const res = await fetch(`/api/readiness?journey_id=${encodeURIComponent(journey.id)}`)
      if (!res.ok) return
      const r = (await res.json()) as { data?: { score?: { score?: number } } }
      const score = r?.data?.score
      const cards = root.querySelectorAll<HTMLElement>('.kpi-row .kpi-card .kpi-v')
      if (cards.length >= 4 && score) {
        if (journey.target_year) {
          const target = new Date(journey.target_year, 11, 31).getTime()
          const days = Math.max(0, Math.round((target - Date.now()) / 86_400_000))
          cards[0].innerHTML = `T-${fmtNum(days)}<em> days</em>`
        }
        if (typeof score.score === 'number') {
          const pct = Math.round((score.score / 1000) * 100)
          cards[1].innerHTML = `${pct}<em>/100</em>`
        }
        if (typeof journey.valuation_target === 'number') cards[2].innerHTML = fmtMoney(journey.valuation_target)
      }
    } catch { /* silent */ }
  },

  'page-roadmap': (raw) => {
    const root = document.getElementById('page-roadmap')
    if (!root) return
    const d = raw as { data?: Array<{ id: string; current_phase?: string; name?: string; target_year?: number }> }
    const journey = d?.data?.[0]
    if (!journey) return
    const cards = root.querySelectorAll<HTMLElement>('.kpi-row .kpi-card .kpi-v')
    if (cards.length >= 4) {
      if (journey.current_phase) cards[0].innerHTML = `${escapeHtml(String(journey.current_phase))}<em></em>`
      if (journey.target_year) {
        const target = new Date(journey.target_year, 11, 31).getTime()
        const days = Math.max(0, Math.round((target - Date.now()) / 86_400_000))
        cards[3].textContent = fmtNum(days)
      }
    }
    const subs = root.querySelectorAll<HTMLElement>('.kpi-row .kpi-card .kpi-sub')
    if (subs.length >= 1 && journey.current_phase) subs[0].textContent = `${journey.current_phase} active`
  },

  'page-agents': (raw) => {
    const root = document.getElementById('page-agents')
    if (!root) return
    const d = raw as { data?: Array<{ user_id: string; role?: string }> }
    const profiles = d?.data ?? []
    const cards = root.querySelectorAll<HTMLElement>('.kpi-row .kpi-card .kpi-v')
    if (cards.length >= 4) cards[0].innerHTML = `${profiles.length}<em>/108</em>`
    const subs = root.querySelectorAll<HTMLElement>('.kpi-row .kpi-card .kpi-chg')
    if (subs.length >= 1) {
      const pct = Math.round((profiles.length / 108) * 100)
      subs[0].textContent = `Phase 1 · ${pct}%`
    }
  },

  // ─────────────────────────────────────────────────────────────
  // Chunk 3 — 35 new patchers
  // ─────────────────────────────────────────────────────────────

  'page-northstar': (raw) => {
    const root = document.getElementById('page-northstar')
    if (!root) return
    const d = (raw as { data?: { journey?: { north_star_metric?: string; current_phase?: number; valuation_target?: number; target_year?: number }, kpis?: Array<{ name: string; value: number }> } })?.data
    const j = d?.journey
    const kpis = d?.kpis ?? []
    if (j) {
      patchKpiCards(root, [
        j.north_star_metric ? { value: escapeHtml(j.north_star_metric.slice(0, 12)) } : null,
        typeof j.valuation_target === 'number' ? { value: fmtMoney(j.valuation_target) } : null,
        j.current_phase ? { value: `Phase ${j.current_phase}` } : null,
        j.target_year ? { value: String(j.target_year) } : null,
      ])
    }
    const tbody = root.querySelector<HTMLTableSectionElement>('table.tbl tbody')
    if (tbody) {
      if (kpis.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--dim);padding:18px;font-style:italic">North Star metric chưa có KPI gắn. Vào /kpi-matrix tạo KPI đầu tiên.</td></tr>`
      } else {
        tbody.innerHTML = kpis.slice(0, 8).map((k) => `<tr><td><strong>${escapeHtml(k.name)}</strong></td><td class="num">${fmtNum(k.value)}</td><td>—</td><td><span class="st ok">live</span></td></tr>`).join('')
      }
    }
  },

  'page-kpi': (raw) => {
    const root = document.getElementById('page-kpi')
    if (!root) return
    const list = ((raw as { data?: Array<{ name: string; value: number; unit?: string; period?: string; trend?: string; category?: string }> })?.data) ?? []
    patchKpiCards(root, [
      { value: String(list.length), label: 'KPI tracked' },
      { value: String(new Set(list.map((k) => k.category ?? 'misc')).size), label: 'Categories' },
      { value: String(list.filter((k) => k.trend === 'up').length), label: 'Trending up' },
      { value: String(list.filter((k) => k.trend === 'down').length), label: 'Need attention' },
    ])
    const rows = list.slice(0, 30).map((k) => `<tr><td><strong>${escapeHtml(k.name)}</strong></td><td>${escapeHtml(k.category ?? '—')}</td><td class="num">${fmtNum(k.value)} ${escapeHtml(k.unit ?? '')}</td><td>${escapeHtml(k.period ?? '—')}</td><td><span class="st ${k.trend === 'up' ? 'ok' : k.trend === 'down' ? 'err' : 'dim'}">${escapeHtml(k.trend ?? '—')}</span></td></tr>`)
    patchTable(root, '.card', rows, 'Chưa có KPI. Bấm "+ KPI mới" hoặc POST /api/kpis để thêm.', 5)
  },

  'page-schema': (raw) => {
    const root = document.getElementById('page-schema')
    if (!root) return
    const d = (raw as { data?: { journey?: { current_phase?: number; name?: string }, gates?: Array<{ phase_num: number; gate_code: string; status: string; pass_score?: number }> } })?.data
    const gates = d?.gates ?? []
    const passed = gates.filter((g) => g.status === 'passed').length
    patchKpiCards(root, [
      d?.journey?.current_phase ? { value: `P${d.journey.current_phase}/10`, label: 'Current phase' } : null,
      { value: String(gates.length), label: 'Total gates' },
      { value: String(passed), label: 'Passed' },
      { value: `${gates.length ? Math.round((passed / gates.length) * 100) : 0}<em>%</em>`, label: 'Completion' },
    ])
    const rows = gates.slice(0, 50).map((g) => `<tr><td>P${g.phase_num}</td><td><strong>${escapeHtml(g.gate_code)}</strong></td><td class="num">${typeof g.pass_score === 'number' ? Math.round(g.pass_score) : '—'}%</td><td><span class="st ${stClass(g.status)}">${escapeHtml(g.status)}</span></td></tr>`)
    patchTable(root, '.card', rows, 'Workflow chưa có gate nào. Tạo journey trước.', 4)
  },

  'page-dataroom': (raw) => {
    const root = document.getElementById('page-dataroom')
    if (!root) return
    const d = (raw as { data?: { folders?: unknown[]; docs?: Array<{ id: string; title: string; mime_type?: string; file_size_bytes?: number; created_at: string }> } })?.data
    const docs = d?.docs ?? []
    const folders = d?.folders ?? []
    patchKpiCards(root, [
      { value: String(docs.length), label: 'Total docs' },
      { value: String(folders.length), label: 'Folders' },
      { value: `${(docs.reduce((a, d) => a + (d.file_size_bytes ?? 0), 0) / 1_000_000).toFixed(1)}<em>MB</em>`, label: 'Storage' },
      { value: String(docs.filter((d) => /pdf|presentation|spreadsheet/.test(d.mime_type ?? '')).length), label: 'Pitch + Reports' },
    ])
    const rows = docs.slice(0, 30).map((d) => `<tr><td><strong>${escapeHtml(d.title)}</strong></td><td>${escapeHtml(d.mime_type ?? '—')}</td><td class="num">${((d.file_size_bytes ?? 0) / 1024).toFixed(0)} KB</td><td>${fmtDate(d.created_at)}</td></tr>`)
    patchTable(root, '.card', rows, 'Data room trống. Upload tài liệu đầu tiên qua /vault.', 4)
  },

  'page-council': (raw) => {
    const root = document.getElementById('page-council')
    if (!root) return
    const d = (raw as { data?: Array<{ id: string; question: string; status?: string; created_at: string }> })?.data ?? []
    patchKpiCards(root, [
      { value: String(d.length), label: 'Decisions logged' },
      { value: String(d.filter((x) => x.status === 'approved').length), label: 'Approved' },
      { value: String(d.filter((x) => x.status === 'pending').length), label: 'Pending' },
      { value: String(d.filter((x) => x.status === 'rejected').length), label: 'Rejected' },
    ])
  },

  'page-datafow': (raw) => {
    const root = document.getElementById('page-datafow')
    if (!root) return
    const d = (raw as { data?: { events?: Array<{ event_type: string; created_at: string }>; by_type?: Record<string, number> } })?.data
    const events = d?.events ?? []
    const by = d?.by_type ?? {}
    const types = Object.keys(by)
    patchKpiCards(root, [
      { value: String(events.length), label: 'Events' },
      { value: String(types.length), label: 'Types' },
      { value: String(by.cascade ?? 0), label: 'Cascades' },
      { value: String(by.round_closed ?? 0), label: 'Round closures' },
    ])
    const rows = events.slice(0, 25).map((e) => `<tr><td><strong>${escapeHtml(e.event_type)}</strong></td><td>${fmtDate(e.created_at)}</td><td>—</td><td><span class="st info">recorded</span></td></tr>`)
    patchTable(root, '.card', rows, 'Chưa có event. Trigger sẽ ghi events khi có hoạt động.', 4)
  },

  'page-team': (raw) => {
    const root = document.getElementById('page-team')
    if (!root) return
    const d = (raw as { data?: { members?: Array<{ id: string; full_name?: string; email: string; role?: string; created_at: string }>; invites?: Array<{ id: string; email: string; role?: string; accepted_at?: string }> } })?.data
    const members = d?.members ?? []
    const invites = d?.invites ?? []
    const openInvites = invites.filter((i) => !i.accepted_at).length
    patchKpiCards(root, [
      { value: String(members.length), label: 'Current FTE' },
      { value: String(openInvites), label: 'Open invites' },
      { value: '0<em>%</em>', label: 'ESOP vested' },
      { value: '0<em>%</em>', label: 'Attrition YTD' },
    ])
    const cards = root.querySelectorAll<HTMLElement>('.col-2 .card')
    // Card 0: Hiring Pipeline → invitations
    if (cards[0]) {
      const tbody = cards[0].querySelector<HTMLTableSectionElement>('table.tbl tbody')
      if (tbody) {
        if (invites.length === 0) {
          tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--dim);padding:18px;font-style:italic">Chưa có invite nào.</td></tr>`
        } else {
          tbody.innerHTML = invites.slice(0, 10).map((i) => `<tr><td><strong>${escapeHtml(i.email)}</strong></td><td>${escapeHtml(i.role ?? '—')}</td><td><span class="st ${i.accepted_at ? 'ok' : 'warn'}">${i.accepted_at ? 'Accepted' : 'Pending'}</span></td><td class="num">—</td><td><span class="st dim">—</span></td></tr>`).join('')
        }
      }
    }
    // Card 1: Current Team → members
    if (cards[1]) {
      const tbody = cards[1].querySelector<HTMLTableSectionElement>('table.tbl tbody')
      if (tbody) {
        if (members.length === 0) {
          tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--dim);padding:18px;font-style:italic">Chưa có thành viên. Mời thành viên đầu tiên.</td></tr>`
        } else {
          tbody.innerHTML = members.slice(0, 20).map((m) => `<tr><td><strong>${escapeHtml(m.full_name ?? m.email)}</strong></td><td>${escapeHtml(m.role ?? '—')}</td><td class="num">—</td><td><span class="st ok">active</span></td></tr>`).join('')
        }
      }
    }
  },

  'page-sops': (raw) => {
    const root = document.getElementById('page-sops')
    if (!root) return
    const list = ((raw as { data?: Array<{ id: string; title?: string; name?: string; updated_at?: string; status?: string }> })?.data) ?? []
    patchKpiCards(root, [
      { value: String(list.length), label: 'Total SOPs' },
      { value: '0<em>%</em>', label: 'Compliance rate' },
      { value: String(list.filter((s) => s.updated_at && new Date(s.updated_at).getTime() > Date.now() - 7 * 86400000).length), label: 'Updated this wk' },
      { value: '0', label: 'Need review 30d' },
    ])
  },

  'page-investors': (raw) => {
    const root = document.getElementById('page-investors')
    if (!root) return
    const list = ((raw as { data?: Array<{ id: string; investor_name: string; firm_name?: string; stage?: string; target_check_usd?: number; committed_usd?: number; probability_pct?: number; next_action?: string }> })?.data) ?? []
    const totalTarget = list.reduce((a, i) => a + (i.target_check_usd ?? 0), 0)
    const totalCommit = list.reduce((a, i) => a + (i.committed_usd ?? 0), 0)
    patchKpiCards(root, [
      { value: String(list.length), label: 'Investors' },
      { value: fmtMoney(totalTarget), label: 'Target raise' },
      { value: fmtMoney(totalCommit), label: 'Committed' },
      { value: `${totalTarget ? Math.round((totalCommit / totalTarget) * 100) : 0}<em>%</em>`, label: 'Progress' },
    ])
    const rows = list.slice(0, 20).map((i) => `<tr><td><strong>${escapeHtml(i.investor_name)}</strong>${i.firm_name ? `<br/><span class="mono" style="font-size:.6rem;color:var(--dim)">${escapeHtml(i.firm_name)}</span>` : ''}</td><td>${escapeHtml(i.stage ?? '—')}</td><td class="num">${typeof i.target_check_usd === 'number' ? fmtMoney(i.target_check_usd) : '—'}</td><td class="num">${typeof i.probability_pct === 'number' ? `${i.probability_pct}%` : '—'}</td><td>${escapeHtml(i.next_action ?? '—')}</td></tr>`)
    patchTable(root, '.card', rows, 'Chưa có investor nào. Bấm "+ Add investor" để bắt đầu pipeline.', 5)
  },

  'page-pitch': (raw) => {
    const root = document.getElementById('page-pitch')
    if (!root) return
    const d = (raw as { data?: { decks?: Array<{ id: string; title: string; created_at: string }> } })?.data
    const decks = d?.decks ?? []
    patchKpiCards(root, [
      { value: String(decks.length), label: 'Decks uploaded' },
      { value: decks[0] ? fmtDate(decks[0].created_at) : '—', label: 'Latest version' },
      { value: '0', label: 'Investor views' },
      { value: '0', label: 'Avg time spent' },
    ])
  },

  'page-terms': () => { /* glossary — static for now */ },

  'page-burn': (raw) => {
    const root = document.getElementById('page-burn')
    if (!root) return
    const d = (raw as { data?: { latest?: Record<string, { value: number; unit?: string }> } })?.data
    const latest = d?.latest ?? {}
    patchKpiCards(root, [
      latest.monthly_burn ? { value: fmtMoney(latest.monthly_burn.value) } : { value: '—' },
      latest.cash_balance ? { value: fmtMoney(latest.cash_balance.value) } : { value: '—' },
      latest.runway_months ? { value: `${latest.runway_months.value}<em> mo</em>` } : { value: '—' },
      latest.gross_burn ? { value: fmtMoney(latest.gross_burn.value) } : { value: '—' },
    ])
  },

  'page-unit': (raw) => {
    const root = document.getElementById('page-unit')
    if (!root) return
    const d = (raw as { data?: { latest?: Record<string, { value: number; unit?: string }> } })?.data
    const latest = d?.latest ?? {}
    patchKpiCards(root, [
      latest.cac ? { value: fmtMoney(latest.cac.value), label: 'CAC' } : null,
      latest.ltv || latest.clv ? { value: fmtMoney((latest.ltv ?? latest.clv).value), label: 'LTV' } : null,
      latest.payback_months ? { value: `${latest.payback_months.value}<em> mo</em>`, label: 'Payback' } : null,
      latest.gross_margin ? { value: `${latest.gross_margin.value}<em>%</em>`, label: 'Gross margin' } : null,
    ])
  },

  'page-forecast': (raw) => {
    const root = document.getElementById('page-forecast')
    if (!root) return
    const d = (raw as { data?: { series?: Record<string, unknown[]>; projection?: Record<string, Array<{ period: string; value: number }>> } })?.data
    const proj = d?.projection ?? {}
    const arr = proj.arr ?? proj.mrr ?? proj.revenue ?? []
    const burn = proj.monthly_burn ?? []
    const last = arr[arr.length - 1]
    const lastBurn = burn[burn.length - 1]
    patchKpiCards(root, [
      last ? { value: fmtMoney(last.value), label: 'Revenue 6mo proj' } : { value: '—' },
      lastBurn ? { value: fmtMoney(lastBurn.value), label: 'Burn 6mo proj' } : { value: '—' },
      { value: String(Object.keys(proj).length), label: 'Series projected' },
      { value: '6<em> mo</em>', label: 'Horizon' },
    ])
  },

  'page-playbook': (raw) => {
    const root = document.getElementById('page-playbook')
    if (!root) return
    const list = ((raw as { data?: Array<{ id: string; name?: string; title?: string; description?: string }> })?.data) ?? []
    patchKpiCards(root, [
      { value: String(list.length), label: 'Modules' },
      { value: '10', label: 'Phases' },
      { value: '40', label: 'Sections' },
      { value: '✅', label: 'Live' },
    ])
  },

  'page-compliance': (raw) => {
    const root = document.getElementById('page-compliance')
    if (!root) return
    const d = (raw as { data?: Array<{ category: string; status?: string; score_pct?: number; weight?: number }> })?.data ?? []
    const passed = d.filter((c) => c.status === 'passed').length
    patchKpiCards(root, [
      { value: String(d.length), label: 'Criteria' },
      { value: String(passed), label: 'Passed' },
      { value: `${d.length ? Math.round((passed / d.length) * 100) : 0}<em>%</em>`, label: 'Completion' },
      { value: String(new Set(d.map((c) => c.category)).size), label: 'Categories' },
    ])
  },

  'page-legal': (raw) => {
    const root = document.getElementById('page-legal')
    if (!root) return
    const list = ((raw as { data?: Array<{ id: string; title?: string }> })?.data) ?? []
    patchKpiCards(root, [
      { value: String(list.length), label: 'Legal docs' },
      { value: '0', label: 'Active licenses' },
      { value: '0', label: 'Expiring 30d' },
      { value: '0', label: 'Open issues' },
    ])
  },

  'page-board': (raw) => {
    const root = document.getElementById('page-board')
    if (!root) return
    const list = ((raw as { data?: Array<{ id: string; full_name?: string; email: string; role: string; created_at: string }> })?.data) ?? []
    const founders = list.filter((m) => /chr|ceo|founder/i.test(m.role)).length
    const investors = list.filter((m) => /investor/i.test(m.role)).length
    const indep = list.filter((m) => /board/i.test(m.role)).length
    patchKpiCards(root, [
      { value: String(list.length), label: 'Board members', sub: `${founders} founder · ${investors} investor · ${indep} indep` },
      { value: '0', label: 'Meetings YTD' },
      { value: '0', label: 'Resolutions YTD' },
      { value: '—', label: 'Next meeting' },
    ])
    const cards = root.querySelectorAll<HTMLElement>('.col-2 .card')
    if (cards[0]) {
      const tbody = cards[0].querySelector<HTMLTableSectionElement>('table.tbl tbody')
      if (tbody) {
        if (list.length === 0) {
          tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--dim);padding:18px;font-style:italic">Chưa có board member.</td></tr>`
        } else {
          tbody.innerHTML = list.map((m) => `<tr><td><strong>${escapeHtml(m.full_name ?? m.email)}</strong><br/><span class="mono" style="font-size:.6rem;color:var(--dim)">${escapeHtml(m.role)}</span></td><td>${escapeHtml(m.role)}</td><td><span class="gold">Class A</span></td><td class="num">—</td></tr>`).join('')
        }
      }
    }
    if (cards[1]) {
      const tbody = cards[1].querySelector<HTMLTableSectionElement>('table.tbl tbody')
      if (tbody) tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--dim);padding:18px;font-style:italic">Chưa có resolution. Tạo resolution đầu tiên qua "+ New resolution".</td></tr>`
    }
  },

  'page-audit': (raw) => {
    const root = document.getElementById('page-audit')
    if (!root) return
    const list = ((raw as { data?: Array<{ id: string; action: string; target_table?: string; actor_id?: string; created_at: string }> })?.data) ?? []
    patchKpiCards(root, [
      { value: String(list.length), label: 'Audit entries' },
      { value: String(new Set(list.map((l) => l.action)).size), label: 'Action types' },
      { value: String(new Set(list.map((l) => l.actor_id).filter(Boolean)).size), label: 'Actors' },
      { value: list[0] ? fmtDate(list[0].created_at) : '—', label: 'Latest' },
    ])
    const rows = list.slice(0, 30).map((l) => `<tr><td>${fmtDate(l.created_at)}</td><td><strong>${escapeHtml(l.action)}</strong></td><td>${escapeHtml(l.target_table ?? '—')}</td><td><span class="mono" style="font-size:.65rem;color:var(--dim)">${escapeHtml(String(l.actor_id ?? '—').slice(0, 8))}</span></td></tr>`)
    patchTable(root, '.card', rows, 'Audit log trống. Tất cả thay đổi quan trọng sẽ được ghi tại đây.', 4)
  },

  'page-training': (raw) => {
    const root = document.getElementById('page-training')
    if (!root) return
    const d = (raw as { data?: Array<{ drill_id: string; status?: string; score?: number }> })?.data ?? []
    const completed = d.filter((p) => p.status === 'completed').length
    patchKpiCards(root, [
      { value: String(d.length), label: 'Drills attempted' },
      { value: String(completed), label: 'Completed' },
      { value: `${d.length ? Math.round((completed / d.length) * 100) : 0}<em>%</em>`, label: 'Pass rate' },
      { value: '16', label: 'Total drills available' },
    ])
  },

  'page-sensitivity': (raw) => {
    const root = document.getElementById('page-sensitivity')
    if (!root) return
    const d = (raw as { data?: { base?: Record<string, number>; matrix?: Array<Array<{ projected_revenue: number }>> } })?.data
    const base = d?.base ?? {}
    patchKpiCards(root, [
      { value: fmtMoney(base.arr ?? base.mrr ?? base.revenue ?? 0), label: 'Base revenue' },
      { value: `${base.growth_rate ?? 0}<em>%</em>`, label: 'Growth' },
      { value: `${base.gross_margin ?? 0}<em>%</em>`, label: 'GM' },
      { value: '5×5', label: 'Scenarios' },
    ])
  },

  'page-vh': (raw) => {
    const root = document.getElementById('page-vh')
    if (!root) return
    const d = (raw as { data?: { journey?: { valuation_target?: number; current_phase?: number; target_year?: number }; cap_history?: unknown[]; comparables?: unknown[] } })?.data
    const j = d?.journey
    patchKpiCards(root, [
      typeof j?.valuation_target === 'number' ? { value: fmtMoney(j.valuation_target), label: 'Target valuation' } : { value: '—' },
      j?.current_phase ? { value: `Phase ${j.current_phase}`, label: 'Phase' } : { value: '—' },
      { value: String(d?.cap_history?.length ?? 0), label: 'Cap snapshots' },
      { value: String(d?.comparables?.length ?? 0), label: 'Comparables' },
    ])
  },

  'page-token': (raw) => {
    const root = document.getElementById('page-token')
    if (!root) return
    const list = ((raw as { data?: Array<{ id: string; token_symbol: string; pool_name: string; allocation_pct: number; vested_amount?: number; total_supply?: number }> })?.data) ?? []
    const totalPct = list.reduce((a, t) => a + Number(t.allocation_pct), 0)
    patchKpiCards(root, [
      { value: String(list.length), label: 'Pools' },
      { value: `${totalPct.toFixed(1)}<em>%</em>`, label: 'Allocated' },
      { value: list[0] ? escapeHtml(list[0].token_symbol) : '—', label: 'Token' },
      { value: list[0]?.total_supply ? fmtNum(list[0].total_supply) : '—', label: 'Total supply' },
    ])
  },

  'page-comparables': (raw) => {
    const root = document.getElementById('page-comparables')
    if (!root) return
    const list = ((raw as { data?: Array<{ id: string; company_name: string; ticker?: string; ev_revenue_multiple?: number; ev_ebitda_multiple?: number; pe_ratio?: number; growth_rate_pct?: number }> })?.data) ?? []
    const avgEvRev = list.length ? list.reduce((a, c) => a + (c.ev_revenue_multiple ?? 0), 0) / list.length : 0
    patchKpiCards(root, [
      { value: String(list.length), label: 'Comp companies' },
      { value: avgEvRev ? `${avgEvRev.toFixed(1)}×` : '—', label: 'Avg EV/Rev' },
      { value: '—', label: 'Median P/E' },
      { value: '—', label: 'Industry' },
    ])
    const rows = list.slice(0, 20).map((c) => `<tr><td><strong>${escapeHtml(c.company_name)}</strong>${c.ticker ? `<br/><span class="mono" style="font-size:.6rem;color:var(--dim)">${escapeHtml(c.ticker)}</span>` : ''}</td><td class="num">${c.ev_revenue_multiple?.toFixed(1) ?? '—'}×</td><td class="num">${c.ev_ebitda_multiple?.toFixed(1) ?? '—'}×</td><td class="num">${c.pe_ratio?.toFixed(1) ?? '—'}</td><td class="num">${c.growth_rate_pct?.toFixed(1) ?? '—'}%</td></tr>`)
    patchTable(root, '.card', rows, 'Chưa có comp. Bấm "+ Add comparable" để thêm peer company.', 5)
  },

  'page-mktdata': (raw) => {
    const root = document.getElementById('page-mktdata')
    if (!root) return
    const list = ((raw as { data?: Array<{ id: string; metric_type: string; region?: string; value_numeric?: number; value_unit?: string; confidence?: string }> })?.data) ?? []
    const tam = list.find((m) => m.metric_type === 'tam')
    const sam = list.find((m) => m.metric_type === 'sam')
    const som = list.find((m) => m.metric_type === 'som')
    const growth = list.find((m) => m.metric_type === 'growth_rate')
    patchKpiCards(root, [
      tam?.value_numeric ? { value: fmtMoney(tam.value_numeric), label: 'TAM' } : null,
      sam?.value_numeric ? { value: fmtMoney(sam.value_numeric), label: 'SAM' } : null,
      som?.value_numeric ? { value: fmtMoney(som.value_numeric), label: 'SOM' } : null,
      growth?.value_numeric ? { value: `${growth.value_numeric}<em>%</em>`, label: 'Growth' } : null,
    ])
  },

  'page-mktintel': (raw) => {
    const root = document.getElementById('page-mktintel')
    if (!root) return
    const list = ((raw as { data?: Array<{ id: string; category: string; severity?: string; title: string; created_at: string }> })?.data) ?? []
    patchKpiCards(root, [
      { value: String(list.length), label: 'Signals' },
      { value: String(list.filter((i) => i.severity === 'critical' || i.severity === 'alert').length), label: 'Alerts' },
      { value: String(new Set(list.map((i) => i.category)).size), label: 'Categories' },
      { value: list[0] ? fmtDate(list[0].created_at) : '—', label: 'Latest' },
    ])
  },

  'page-nlq': (raw) => {
    const root = document.getElementById('page-nlq')
    if (!root) return
    const list = ((raw as { data?: Array<{ id: string; query_text: string; status?: string; duration_ms?: number; created_at: string }> })?.data) ?? []
    const success = list.filter((q) => q.status === 'success').length
    const avgMs = list.length ? Math.round(list.reduce((a, q) => a + (q.duration_ms ?? 0), 0) / list.length) : 0
    patchKpiCards(root, [
      { value: String(list.length), label: 'Queries' },
      { value: `${list.length ? Math.round((success / list.length) * 100) : 0}<em>%</em>`, label: 'Success' },
      { value: `${avgMs}<em>ms</em>`, label: 'Avg latency' },
      { value: list[0] ? fmtDate(list[0].created_at) : '—', label: 'Latest' },
    ])
  },

  'page-sales': (raw) => {
    const root = document.getElementById('page-sales')
    if (!root) return
    const d = (raw as { data?: { kpis?: Array<{ name: string; value: number }>; pipeline?: unknown[] } })?.data
    const findKpi = (n: string) => d?.kpis?.find((k) => k.name === n)?.value
    patchKpiCards(root, [
      findKpi('mrr') != null ? { value: fmtMoney(findKpi('mrr')!), label: 'MRR' } : null,
      findKpi('arr') != null ? { value: fmtMoney(findKpi('arr')!), label: 'ARR' } : null,
      findKpi('new_customers') != null ? { value: fmtNum(findKpi('new_customers')!), label: 'New customers' } : null,
      findKpi('churn_pct') != null ? { value: `${findKpi('churn_pct')!}<em>%</em>`, label: 'Churn' } : null,
    ])
  },

  'page-plv': (raw) => {
    const root = document.getElementById('page-plv')
    if (!root) return
    const d = (raw as { data?: { tiers?: Array<{ tier_code: string; name_vi: string; price_usd_month: number; features: unknown }>; current_subscription?: { plan?: string; status?: string } } })?.data
    const tiers = d?.tiers ?? []
    const sub = d?.current_subscription
    patchKpiCards(root, [
      { value: sub?.plan ?? 'Free', label: 'Current plan' },
      { value: sub?.status ?? 'active', label: 'Status' },
      { value: String(tiers.length), label: 'Tiers available' },
      { value: tiers[0] ? `$${tiers[0].price_usd_month}` : '—', label: 'Starting' },
    ])
  },

  'page-fclb': (raw) => {
    const root = document.getElementById('page-fclb')
    if (!root) return
    const list = ((raw as { data?: Array<{ id: string; category: string; status: string; severity: string; title: string }> })?.data) ?? []
    patchKpiCards(root, [
      { value: String(list.length), label: 'Total feedback' },
      { value: String(list.filter((f) => f.status === 'open').length), label: 'Open' },
      { value: String(list.filter((f) => f.status === 'resolved').length), label: 'Resolved' },
      { value: String(list.filter((f) => f.severity === 'critical' || f.severity === 'high').length), label: 'High priority' },
    ])
  },

  'page-gvdoc': (raw) => {
    const root = document.getElementById('page-gvdoc')
    if (!root) return
    const list = ((raw as { data?: Array<{ id: string; title?: string; name?: string }> })?.data) ?? []
    patchKpiCards(root, [
      { value: String(list.length), label: 'Governance docs' },
      { value: '—', label: 'Last reviewed' },
      { value: '—', label: 'Pending sign' },
      { value: '—', label: 'Compliance' },
    ])
  },

  'page-tcdoc': (raw) => {
    const root = document.getElementById('page-tcdoc')
    if (!root) return
    const list = ((raw as { data?: unknown[] })?.data) ?? []
    patchKpiCards(root, [
      { value: String(list.length), label: 'Term docs' },
      { value: '—', label: 'Latest version' },
      { value: '—', label: 'Active jurisdictions' },
      { value: '—', label: 'Last updated' },
    ])
  },

  'page-admin': (raw) => {
    const root = document.getElementById('page-admin')
    if (!root) return
    const d = (raw as { data?: { tenants?: unknown[]; users?: unknown[]; journeys?: unknown[]; counts?: { tenants: number; users: number; journeys: number } } })?.data
    const c = d?.counts
    patchKpiCards(root, [
      { value: String(c?.tenants ?? 0), label: 'Tenants' },
      { value: String(c?.users ?? 0), label: 'Users' },
      { value: String(c?.journeys ?? 0), label: 'Journeys' },
      { value: '—', label: 'Subscriptions' },
    ])
  },

  'page-vault': (raw) => {
    const root = document.getElementById('page-vault')
    if (!root) return
    const d = (raw as { data?: { folders?: unknown[]; docs?: Array<{ id: string; title: string; mime_type?: string; file_size_bytes?: number; created_at: string }> } })?.data
    const folders = d?.folders ?? []
    const docs = d?.docs ?? []
    patchKpiCards(root, [
      { value: String(docs.length), label: 'Total assets' },
      { value: String(folders.length), label: 'Folders' },
      { value: `${(docs.reduce((a, d) => a + (d.file_size_bytes ?? 0), 0) / 1_000_000).toFixed(1)}<em>MB</em>`, label: 'Storage' },
      { value: docs[0] ? fmtDate(docs[0].created_at) : '—', label: 'Latest upload' },
    ])
    const rows = docs.slice(0, 30).map((d) => `<tr><td><strong>${escapeHtml(d.title)}</strong></td><td>${escapeHtml(d.mime_type ?? '—')}</td><td class="num">${((d.file_size_bytes ?? 0) / 1024).toFixed(0)} KB</td><td>${fmtDate(d.created_at)}</td></tr>`)
    patchTable(root, '.card', rows, 'Vault trống. Upload tài liệu đầu tiên.', 4)
  },

  'page-settings': (raw) => {
    const root = document.getElementById('page-settings')
    if (!root) return
    const d = (raw as { data?: { auth?: { email: string; last_sign_in_at?: string }; profile?: { full_name?: string; role: string }; tenant?: { name: string; plan?: string } } })?.data
    const a = d?.auth
    const p = d?.profile
    const t = d?.tenant
    patchKpiCards(root, [
      { value: p?.full_name ?? a?.email ?? '—', label: 'Account' },
      { value: p?.role ?? '—', label: 'Role' },
      { value: t?.name ?? '—', label: 'Tenant' },
      { value: t?.plan ?? 'free', label: 'Plan' },
    ])
  },
}

type OkrNode = { id: string; title: string; tier?: string; description?: string }
function renderOkrNode(node: OkrNode, byParent: Record<string, OkrNode[]>, depth: number): string {
  const children = byParent[node.id] ?? []
  const indent = depth * 16
  const tier = (node.tier ?? '').toUpperCase()
  const childrenHtml = children.map((c) => renderOkrNode(c, byParent, depth + 1)).join('')
  return `<div class="okr-node" style="margin-left:${indent}px"><div class="okr-h"><b>${escapeHtml(node.title)}</b>${tier ? `<span class="tag">${escapeHtml(tier)}</span>` : ''}</div>${node.description ? `<div style="color:var(--dim);font-size:.74rem;margin-top:4px">${escapeHtml(node.description)}</div>` : ''}${childrenHtml}</div>`
}
