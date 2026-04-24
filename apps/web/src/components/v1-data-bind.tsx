'use client'

/**
 * V1DataBind — client-side data binder.
 *
 * Strategy: keep v1_8_FULL HTML byte-for-byte (server-rendered via V1Page),
 * then after mount fetch from the existing /api/* routes and patch DOM nodes
 * via stable selectors (IDs + class chains the chairman did NOT change).
 *
 * Adding `data-bind="..."` to source.html is forbidden — instead we rely on
 * the rich set of IDs already present (`#dashLede`, `#kpiRow`, `#okrKpiRow`,
 * `#tasksBody`, `#alertsList`, `#statCardBody`, ...) and on stable structural
 * selectors (`#page-X .kpi-row .kpi-card:nth-child(N) .kpi-v`).
 *
 * If a binding fails (e.g. Supabase 401, missing element), we leave the
 * static markup intact — the page is still rendered, just without live data.
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
  'page-dash': '/api/dashboard',
  'page-okr': '/api/okrs',
  'page-tasks': '/api/tasks',
  'page-captable': '/api/cap-table',
  'page-fundraise': '/api/pipeline',
  'page-pnl': '/api/dashboard',
  // ipo-execution requires journey_id; we resolve via /api/journeys then call readiness.
  'page-ipo': '/api/journeys',
  'page-roadmap': '/api/journeys',
  // dataroom: no dedicated list endpoint — leave static. (TODO once /api/data-room exists)
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
        // Silent — leave static markup intact.
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
// Patchers — one per pageId. Each receives the parsed JSON
// envelope returned by /api/<route>.
// ─────────────────────────────────────────────────────────────

const fmtMoney = (n: number) => {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`
  return `$${Math.round(n)}`
}

function setText(root: ParentNode, sel: string, val: string | number | null | undefined) {
  if (val == null) return
  const el = root.querySelector<HTMLElement>(sel)
  if (el) el.textContent = String(val)
}

function setHTML(root: ParentNode, sel: string, html: string) {
  const el = root.querySelector<HTMLElement>(sel)
  if (el) el.innerHTML = html
}

const PAGE_PATCHERS: Record<string, (raw: Json) => void | Promise<void>> = {
  // ─── Dashboard ────────────────────────────────────────────
  'page-dash': (raw) => {
    const root = document.getElementById('page-dash')
    if (!root) return
    const d = (raw?.data ?? raw) as Record<string, unknown>
    const profile = d.profile as { display_name?: string; full_name?: string } | null
    const tenant = d.tenant as { name?: string } | null
    const journey = d.journey as { current_phase?: string; valuation_target?: number } | null
    const kpis = (d.kpis as Array<{ name: string; value: number; unit?: string }> | undefined) ?? []
    const readiness = d.readiness as { score?: number; total_criteria?: number } | number | null

    // Greeting
    const greetName = profile?.display_name || profile?.full_name || tenant?.name || ''
    if (greetName) setText(root, '#greetName', `${greetName}.`)
    if (tenant?.name) {
      setText(root, '#dashLede', `Đang vận hành ${tenant.name}. ${kpis.length} KPI live, ${journey?.current_phase ?? 'Phase 1'} active.`)
    } else {
      setText(root, '#dashLede', 'Bảng điều khiển trung tâm — moi KPI cập nhật theo thời gian thực.')
    }

    // KPI row — render a card per kpi (max 4).
    const kpiRow = root.querySelector<HTMLElement>('#kpiRow')
    if (kpiRow && kpis.length > 0) {
      const tone = ['gold', 'ok', '', 'warn']
      kpiRow.innerHTML = kpis.slice(0, 4).map((k, i) => {
        const value = typeof k.value === 'number' ? Number(k.value).toLocaleString() : k.value
        const unit = k.unit ? `<em>${k.unit}</em>` : ''
        return `<div class="kpi-card ${tone[i] ?? ''}"><div class="kpi-lbl">${escapeHtml(k.name)}</div><div class="kpi-v">${escapeHtml(String(value))}${unit}</div></div>`
      }).join('')
    }

    // Readiness ring → write into #statCardBody
    const score = typeof readiness === 'number' ? readiness : (readiness as { score?: number } | null)?.score
    if (typeof score === 'number') {
      setHTML(
        root,
        '#statCardBody',
        `<div style="display:flex;align-items:center;justify-content:center;padding:20px;flex-direction:column;gap:8px"><div class="gold mono" style="font-size:2.4rem;font-weight:600">${score}<em style="font-size:1rem;color:var(--dim)">/1000</em></div><div style="color:var(--dim);font-size:.78rem">IPO Readiness Score · live</div></div>`,
      )
    }

    // Alerts count + list
    const tasks = (d.tasks as Array<{ title: string; status?: string }> | undefined) ?? []
    const events = (d.events as Array<{ type?: string; payload?: Record<string, unknown> }> | undefined) ?? []
    const alertsCount = root.querySelector<HTMLElement>('#alertsCount')
    if (alertsCount) alertsCount.textContent = `${tasks.length + events.length} items`
    const alertsList = root.querySelector<HTMLElement>('#alertsList')
    if (alertsList && tasks.length > 0) {
      alertsList.innerHTML = tasks.slice(0, 5).map((t) => {
        return `<div style="padding:10px 12px;background:var(--w4);border-left:2px solid var(--c5);border-radius:3px;font-size:.78rem;color:var(--ink-2)"><b>${escapeHtml(t.title)}</b><div style="color:var(--dim);font-size:.7rem;margin-top:2px">${escapeHtml(t.status ?? 'open')}</div></div>`
      }).join('')
    }
  },

  // ─── OKRs ────────────────────────────────────────────────
  'page-okr': (raw) => {
    const root = document.getElementById('page-okr')
    if (!root) return
    const d = raw as { data?: Array<{ id: string; title: string; tier?: string; description?: string; parent_id?: string | null }>, tree?: { roots: Array<{ id: string; title: string; tier?: string }>, byParent: Record<string, Array<{ id: string; title: string; tier?: string }>> } }
    const list = d?.data ?? []
    const tree = d?.tree

    setText(root, '#okrLede', `${list.length} OKR đang live · cascade từ Chairman xuống Individual. Mỗi node trace ngược lên Chairman.`)

    // KPI mini-row by tier counts.
    const byTier = list.reduce<Record<string, number>>((acc, o) => {
      const t = o.tier ?? 'misc'
      acc[t] = (acc[t] ?? 0) + 1
      return acc
    }, {})
    const kpiRow = root.querySelector<HTMLElement>('#okrKpiRow')
    if (kpiRow) {
      const cards = [
        { lbl: 'Chairman', v: byTier.chairman ?? 0, tone: 'gold' },
        { lbl: 'CEO', v: byTier.ceo ?? 0, tone: 'ok' },
        { lbl: 'C-Level', v: byTier.c_level ?? byTier.clevel ?? 0, tone: '' },
        { lbl: 'Team / Indiv', v: (byTier.team ?? 0) + (byTier.individual ?? 0) + (byTier.kr ?? 0), tone: 'warn' },
      ]
      kpiRow.innerHTML = cards.map((c) => `<div class="kpi-card ${c.tone}"><div class="kpi-lbl">${c.lbl}</div><div class="kpi-v">${c.v}</div></div>`).join('')
    }

    // Cascade tree
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

  // ─── Tasks ────────────────────────────────────────────────
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
      const due = t.due_date ? new Date(t.due_date).toLocaleDateString('vi-VN') : '—'
      const status = t.status ?? 'open'
      const stClass = status === 'done' ? 'ok' : status === 'in_progress' ? 'info' : 'warn'
      return `<tr><td><strong>${escapeHtml(t.title)}</strong></td><td>${escapeHtml(t.priority ?? '—')}</td><td>${due}</td><td><span class="st ${stClass}">${escapeHtml(status)}</span></td></tr>`
    }).join('')
    body.innerHTML = `<div class="card"><div class="card-h"><h3>Task list <em>· ${tasks.length} active</em></h3><span class="tag live">LIVE</span></div><table class="tbl"><thead><tr><th>Task</th><th>Priority</th><th>Due</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>`
  },

  // ─── Cap Table ────────────────────────────────────────────
  'page-captable': (raw) => {
    const root = document.getElementById('page-captable')
    if (!root) return
    const d = raw as { data?: { snapshot_date?: string; total_shares?: number; founder_pct?: number; esop_pct?: number; investor_pct?: number; payload?: unknown } | null }
    const snap = d?.data
    if (!snap) return

    const cards = root.querySelectorAll<HTMLElement>('.kpi-row .kpi-card .kpi-v')
    if (cards.length >= 4) {
      if (typeof snap.total_shares === 'number') {
        const m = snap.total_shares / 1_000_000
        cards[0].innerHTML = `${m.toFixed(1)}<em>M</em>`
      }
      if (typeof snap.founder_pct === 'number') cards[1].innerHTML = `${snap.founder_pct.toFixed(1)}<em>%</em>`
      if (typeof snap.esop_pct === 'number') cards[2].innerHTML = `${snap.esop_pct.toFixed(1)}<em>%</em>`
      if (typeof snap.investor_pct === 'number') cards[3].innerHTML = `${snap.investor_pct.toFixed(1)}<em>%</em>`
    }
  },

  // ─── Fundraise (governance route → /api/pipeline) ────────
  'page-fundraise': (raw) => {
    const root = document.getElementById('page-fundraise')
    if (!root) return
    const d = raw as { data?: Array<{ id: string; investor_name: string; stage?: string; check_size?: number }> }
    const pipeline = d?.data ?? []

    const cards = root.querySelectorAll<HTMLElement>('.kpi-row .kpi-card .kpi-v')
    if (cards.length >= 4) {
      cards[2].textContent = String(pipeline.length)
    }
    const subs = root.querySelectorAll<HTMLElement>('.kpi-row .kpi-card .kpi-sub')
    if (subs.length >= 3) {
      const softCommit = pipeline.filter((p) => /soft/i.test(p.stage ?? '')).length
      const dd = pipeline.filter((p) => /dd|due/i.test(p.stage ?? '')).length
      subs[2].textContent = `${softCommit} soft commit · ${dd} DD active`
    }

    // Replace Top Investor table body if present.
    const tableBody = root.querySelector<HTMLTableSectionElement>('table.tbl tbody')
    if (tableBody && pipeline.length > 0) {
      tableBody.innerHTML = pipeline.slice(0, 14).map((p) => {
        const cs = typeof p.check_size === 'number' ? fmtMoney(p.check_size) : '—'
        const stage = p.stage ?? 'prospect'
        const stClass = /commit|won/i.test(stage) ? 'ok' : /dd/i.test(stage) ? 'info' : /reject/i.test(stage) ? 'dim' : 'warn'
        return `<tr><td><strong>${escapeHtml(p.investor_name)}</strong></td><td>${escapeHtml(stage)}</td><td class="num">${cs}</td><td>—</td><td>—</td><td><span class="st ${stClass}">${escapeHtml(stage)}</span></td><td>—</td></tr>`
      }).join('')
    }
  },

  // ─── Financials (P&L) — uses /api/dashboard kpis subset ─
  'page-pnl': (raw) => {
    const root = document.getElementById('page-pnl')
    if (!root) return
    const d = (raw as { data?: { kpis?: Array<{ name: string; value: number; unit?: string }> } })?.data
    const kpis = d?.kpis ?? []
    if (kpis.length === 0) return

    // Map first 4 KPIs by name onto the 4 kpi-cards: Revenue, GM, Net Burn, Cash.
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
      if (v) {
        const num = Number(k.value)
        const unit = k.unit ?? ''
        v.innerHTML = `${isFinite(num) ? num.toLocaleString() : k.value}<em>${escapeHtml(unit)}</em>`
      }
      const lbl = card.querySelector<HTMLElement>('.kpi-lbl')
      if (lbl) lbl.textContent = k.name
    }
  },

  // ─── IPO Execution — readiness criteria via /api/readiness ──
  'page-ipo': async (raw) => {
    const root = document.getElementById('page-ipo')
    if (!root) return
    const d = raw as { data?: Array<{ id: string; current_phase?: string; target_year?: number; valuation_target?: number }> }
    const journey = d?.data?.[0]
    if (!journey?.id) return

    // Fetch readiness for this journey.
    try {
      const res = await fetch(`/api/readiness?journey_id=${encodeURIComponent(journey.id)}`)
      if (!res.ok) return
      const r = (await res.json()) as { data?: { score?: { score?: number; total_criteria?: number; completed_criteria?: number }, criteria?: unknown[] } }
      const score = r?.data?.score
      const cards = root.querySelectorAll<HTMLElement>('.kpi-row .kpi-card .kpi-v')
      if (cards.length >= 4 && score) {
        // Card 0: Time to IPO (target_year ⇒ days remaining)
        if (journey.target_year) {
          const target = new Date(journey.target_year, 11, 31).getTime()
          const days = Math.max(0, Math.round((target - Date.now()) / 86_400_000))
          cards[0].innerHTML = `T-${days.toLocaleString()}<em> days</em>`
        }
        // Card 1: Readiness — score / 100 normalized
        if (typeof score.score === 'number') {
          const pct = Math.round((score.score / 1000) * 100)
          cards[1].innerHTML = `${pct}<em>/100</em>`
        }
        // Card 2: Expected raise from valuation_target if present.
        if (typeof journey.valuation_target === 'number') {
          cards[2].innerHTML = `${fmtMoney(journey.valuation_target)}`
        }
      }
    } catch {
      // Silent.
    }
  },

  // ─── Users (Agents page) — counts from user_profiles ─────
  'page-agents': (raw) => {
    const root = document.getElementById('page-agents')
    if (!root) return
    const d = raw as { data?: Array<{ user_id: string; role?: string; display_name?: string }> }
    const profiles = d?.data ?? []
    const cards = root.querySelectorAll<HTMLElement>('.kpi-row .kpi-card .kpi-v')
    if (cards.length >= 4) {
      // Card 0: Agents online → total profiles. Keep `/108` suffix.
      cards[0].innerHTML = `${profiles.length}<em>/108</em>`
      // Card 1: Tasks tuần này — leave static (would need /api/tasks).
      // Card 3: Escalations — leave static.
    }
    // Roles breakdown sub-line on card 0.
    const subs = root.querySelectorAll<HTMLElement>('.kpi-row .kpi-card .kpi-chg')
    if (subs.length >= 1) {
      const pct = Math.round((profiles.length / 108) * 100)
      subs[0].textContent = `Phase 1 · ${pct}%`
    }
  },

  // ─── Roadmap / Milestones — current_phase from journey ───
  'page-roadmap': (raw) => {
    const root = document.getElementById('page-roadmap')
    if (!root) return
    const d = raw as { data?: Array<{ id: string; current_phase?: string; name?: string; target_year?: number }> }
    const journey = d?.data?.[0]
    if (!journey) return

    const cards = root.querySelectorAll<HTMLElement>('.kpi-row .kpi-card .kpi-v')
    if (cards.length >= 4) {
      if (journey.current_phase) cards[0].innerHTML = `${escapeHtml(journey.current_phase)}<em></em>`
      if (journey.target_year) {
        const target = new Date(journey.target_year, 11, 31).getTime()
        const days = Math.max(0, Math.round((target - Date.now()) / 86_400_000))
        cards[3].textContent = days.toLocaleString()
      }
    }
    const subs = root.querySelectorAll<HTMLElement>('.kpi-row .kpi-card .kpi-sub')
    if (subs.length >= 1 && journey.current_phase) {
      subs[0].textContent = `${journey.current_phase} active`
    }
  },
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c] as string))
}

type OkrNode = { id: string; title: string; tier?: string; description?: string }
function renderOkrNode(node: OkrNode, byParent: Record<string, OkrNode[]>, depth: number): string {
  const children = byParent[node.id] ?? []
  const indent = depth * 16
  const tier = (node.tier ?? '').toUpperCase()
  const childrenHtml = children.map((c) => renderOkrNode(c, byParent, depth + 1)).join('')
  return `<div class="okr-node" style="margin-left:${indent}px"><div class="okr-h"><b>${escapeHtml(node.title)}</b>${tier ? `<span class="tag">${escapeHtml(tier)}</span>` : ''}</div>${node.description ? `<div style="color:var(--dim);font-size:.74rem;margin-top:4px">${escapeHtml(node.description)}</div>` : ''}${childrenHtml}</div>`
}
