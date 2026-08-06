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
import { openFormModal, apiSend, toast, num, wireButtonByText, wireEach, ensureHeaderButton, type Field } from '@/components/v1-actions'

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
  'page-pnl': '/api/financials',
  'page-ipo': '/api/journeys',
  'page-roadmap': '/api/roadmap',
  'page-agents': '/api/agents',
  // Chunk 3 — 35 additional pages
  'page-northstar': '/api/masterplan',
  'page-kpi': '/api/kpis',
  'page-schema': '/api/workflow',
  'page-dataroom': '/api/vault',
  'page-council': '/api/council',
  'page-datafow': '/api/dataflow',
  'page-team': '/api/team',
  'page-sops': '/api/sops',
  'page-investors': '/api/investors',
  'page-pitch': '/api/pitch',
  'page-terms': '/api/glossary',
  'page-burn': '/api/burn',
  'page-unit': '/api/unit-economics',
  'page-forecast': '/api/forecast',
  'page-playbook': '/api/modules?category=playbook',
  'page-compliance': '/api/readiness',
  'page-legal': '/api/compliance',
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
  'page-dash': async (raw) => {
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

    // OKR Focus — replace the static demo (ANIMA) tree with this tenant's real OKRs.
    try {
      const okrRes = await fetch('/api/okrs', { credentials: 'same-origin' })
      if (okrRes.ok) {
        const oj = (await okrRes.json()) as { data?: Array<{ id: string; title: string; tier?: string; description?: string }>; tree?: { roots: OkrNode[]; byParent: Record<string, OkrNode[]> } }
        const list = oj?.data ?? []
        const tree = oj?.tree
        const tag = root.querySelector<HTMLElement>('#okrFocusTag')
        if (tag) tag.textContent = `LIVE · ${list.length} O`
        const focus = root.querySelector<HTMLElement>('#okrFocus')
        if (focus) {
          if (list.length === 0) {
            focus.innerHTML = `<div style="padding:20px;color:var(--dim);text-align:center;font-size:.82rem">Chưa có OKR. Tạo OKR đầu tiên ở /okrs.</div>`
          } else if (tree?.roots) {
            focus.innerHTML = tree.roots.map((r) => renderOkrNode(r, tree.byParent ?? {}, 0)).join('')
          } else {
            focus.innerHTML = list.map((o) => `<div class="okr-node"><div class="okr-h"><b>${escapeHtml(o.title)}</b>${o.tier ? `<span class="tag">${escapeHtml(o.tier.toUpperCase())}</span>` : ''}</div></div>`).join('')
          }
        }
      }
    } catch { /* leave static markup intact */ }
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
    type Fin = { id: string; period: string; revenue: number; cogs: number; opex_sales: number; opex_rnd: number; opex_ga: number; other_income: number; capex: number; cash_balance?: number; accounts_receivable?: number; inventory?: number; accounts_payable?: number }
    const ebitdaOf = (f: Fin) => f.revenue - f.cogs - f.opex_sales - f.opex_rnd - f.opex_ga + f.other_income
    const render = (list: Fin[]) => {
      const cur = list[0]
      const gm = cur && cur.revenue > 0 ? ((cur.revenue - cur.cogs) / cur.revenue) * 100 : 0
      patchKpiCards(root, [
        { value: cur ? fmtMoney(cur.revenue) : '—', label: 'Doanh thu tháng', sub: cur ? String(cur.period).slice(0, 7) : 'chưa có dữ liệu' },
        { value: cur ? `${gm.toFixed(1)}<em>%</em>` : '—', label: 'Gross margin' },
        { value: cur ? fmtMoney(ebitdaOf(cur)) : '—', label: 'EBITDA' },
        { value: cur?.cash_balance != null ? fmtMoney(cur.cash_balance) : '—', label: 'Cash cuối kỳ' },
      ])
      const rows = list.slice(0, 24).map((f) => {
        const e = ebitdaOf(f)
        return `<tr><td><strong>${String(f.period).slice(0, 7)}</strong></td><td class="num">${fmtMoney(f.revenue)}</td><td class="num">${fmtMoney(f.revenue - f.cogs)}</td><td class="num" style="color:${e >= 0 ? 'var(--ok,#4fc79a)' : 'var(--err,#e0685f)'}">${fmtMoney(e)}</td><td class="num">${f.cash_balance != null ? fmtMoney(f.cash_balance) : '—'}</td></tr>`
      })
      patchTable(root, '.card', rows, 'Chưa có tháng tài chính. Bấm "+ Tháng" nhập P&L đầu tiên — mọi KPI sẽ tự dẫn xuất từ đây.', 5)
    }
    const refresh = async () => { const r = await apiSend('/api/financials', 'GET'); if (r.ok) render((r.data as Fin[]) ?? []) }
    render(((raw as { data?: Fin[] })?.data) ?? [])

    // Panel kết quả hàm khớp (tạo 1 lần).
    let panel = root.querySelector<HTMLElement>('#fin-derive-panel')
    if (!panel) {
      panel = document.createElement('div')
      panel.id = 'fin-derive-panel'
      panel.style.cssText = 'margin:14px 0;padding:14px;border:1px solid var(--line,#2a2a3f);border-radius:12px;background:var(--panel,rgba(255,255,255,.02));display:none'
      const kpiRow = root.querySelector('.kpi-row')
      if (kpiRow?.parentNode) kpiRow.parentNode.insertBefore(panel, kpiRow.nextSibling)
      else root.appendChild(panel)
    }
    const box = panel

    ensureHeaderButton(root, 'za-add-month', '+ Tháng', async () => {
      const now = new Date()
      const defPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const v = await openFormModal({
        title: 'Nhập P&L + cashflow tháng',
        fields: [
          { name: 'period', label: 'Tháng (YYYY-MM)', required: true, value: defPeriod },
          { name: 'revenue', label: 'Doanh thu', type: 'number', required: true },
          { name: 'cogs', label: 'COGS (giá vốn)', type: 'number' },
          { name: 'opex_sales', label: 'OPEX · Sales & Marketing', type: 'number' },
          { name: 'opex_rnd', label: 'OPEX · R&D', type: 'number' },
          { name: 'opex_ga', label: 'OPEX · G&A', type: 'number' },
          { name: 'other_income', label: 'Thu nhập khác', type: 'number' },
          { name: 'capex', label: 'CAPEX', type: 'number' },
          { name: 'cash_balance', label: 'Cash cuối tháng', type: 'number' },
          { name: 'accounts_receivable', label: 'Phải thu (AR)', type: 'number' },
          { name: 'inventory', label: 'Tồn kho', type: 'number' },
          { name: 'accounts_payable', label: 'Phải trả (AP)', type: 'number' },
        ],
        submitLabel: 'Lưu tháng',
      })
      if (!v) return
      const res = await apiSend('/api/financials', 'POST', {
        period: v.period, revenue: num(v.revenue) ?? 0, cogs: num(v.cogs) ?? 0,
        opex_sales: num(v.opex_sales) ?? 0, opex_rnd: num(v.opex_rnd) ?? 0, opex_ga: num(v.opex_ga) ?? 0,
        other_income: num(v.other_income) ?? 0, capex: num(v.capex) ?? 0,
        cash_balance: num(v.cash_balance), accounts_receivable: num(v.accounts_receivable),
        inventory: num(v.inventory), accounts_payable: num(v.accounts_payable),
      })
      if (res.ok) { toast('Đã lưu tháng'); void refresh() } else toast(res.error ?? 'Lỗi lưu', 'err')
    })

    ensureHeaderButton(root, 'za-derive', '🔄 Hàm khớp KPI ↔ Vốn', async () => {
      box.style.display = 'block'
      box.innerHTML = `<div style="color:var(--dim);padding:8px">Đang chạy hàm dẫn xuất: P&L → KPI → đối chiếu gọi vốn…</div>`
      const r = await apiSend('/api/financials/derive', 'POST', {})
      if (!r.ok) { box.innerHTML = `<div style="color:var(--err,#e0685f);padding:8px">${escapeHtml(r.error ?? 'Lỗi hàm khớp')}</div>`; return }
      const d = r.data as { financial: Record<string, number | string | null>; funding: { burn_avg_3m: number; cash_need_usd: number; open_target_usd: number; runway_months: number | null; open_rounds: Array<{ round_name: string; status: string; target_raise_usd: number }> }; mismatches: Array<{ severity: string; message: string }> }
      const f = d.financial; const fu = d.funding
      const sevColor = (s: string) => (s === 'critical' ? 'var(--err,#e0685f)' : s === 'warn' ? 'var(--gold,#e4c16e)' : 'var(--dim)')
      box.innerHTML = `
        <strong>🔄 Kết quả hàm khớp — kỳ ${escapeHtml(String(f.period ?? ''))}</strong>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:10px 0">
          ${[
            ['GM', `${f.gross_margin_pct}%`], ['EBITDA', fmtMoney(Number(f.ebitda ?? 0))],
            ['Burn TB 3T', fmtMoney(Number(fu.burn_avg_3m ?? 0))], ['Runway', fu.runway_months != null ? `${fu.runway_months} tháng` : '—'],
            ['CCC', `${f.ccc_days} ngày (DSO ${f.dso}·DIO ${f.dio}·DPO ${f.dpo})`],
            ['Cần vốn (hàm)', fmtMoney(fu.cash_need_usd)], ['Round đang mở', fmtMoney(fu.open_target_usd)],
          ].map(([l, v2]) => `<div style="padding:8px;border:1px solid var(--line,#2a2a3f);border-radius:8px"><div style="font-size:.65rem;color:var(--dim);text-transform:uppercase">${l}</div><strong>${v2}</strong></div>`).join('')}
        </div>
        <div style="font-size:.8rem;color:var(--ok,#4fc79a)">✓ 11 KPI tài chính đã tự cập nhật vào KPI Matrix (category finance_derived) — mọi dashboard giờ khớp với P&L.</div>
        ${d.mismatches.length ? `<div style="margin-top:10px"><strong>⚠ Lệch cần xử lý:</strong>${d.mismatches.map((m) => `<div style="margin-top:6px;padding:8px;border-left:3px solid ${sevColor(m.severity)};background:rgba(255,255,255,.02);font-size:.82rem">${escapeHtml(m.message)}</div>`).join('')}</div>` : `<div style="margin-top:8px;color:var(--ok,#4fc79a)">✓ Không có lệch giữa P&L ↔ KPI ↔ chiến lược gọi vốn.</div>`}`
      toast('Hàm khớp đã chạy — KPI đồng bộ')
    })
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
    type Gate = { key: string; label: string; pass: boolean }
    type Phase = { phase: number; title: string; mission: string; dashboard_focus?: string; gates: Gate[]; gates_passed: number; gates_total: number; status: 'done' | 'current' | 'upcoming' }
    type Road = { journey?: { current_phase: number; north_star_metric?: string; valuation_target?: number; target_year?: number } | null; phases?: Phase[]; snapshot?: { readiness?: number; runway?: number | null; finMonths?: number } }
    const BMC_LABELS: Record<string, string> = {
      customer_segments: '👥 Phân khúc KH', value_propositions: '💎 Giá trị cốt lõi', channels: '📣 Kênh',
      customer_relationships: '🤝 Quan hệ KH', revenue_streams: '💰 Dòng doanh thu', key_resources: '🔑 Nguồn lực',
      key_activities: '⚙ Hoạt động chính', key_partnerships: '🧩 Đối tác', cost_structure: '🧾 Cơ cấu chi phí',
    }
    const render = (d: Road) => {
      const phases = d.phases ?? []
      const cur = phases.find((p) => p.status === 'current')
      patchKpiCards(root, [
        { value: `${d.journey?.current_phase ?? 1}<em>/10</em>`, label: 'Bước hiện tại', sub: cur?.title ?? '' },
        { value: cur ? `${cur.gates_passed}/${cur.gates_total}` : '—', label: 'Gates bước này', sub: 'đạt đủ để lên bước' },
        { value: String(d.snapshot?.readiness ?? 0), label: 'IPO Readiness' },
        { value: d.journey?.target_year ? String(d.journey.target_year) : '—', label: 'Năm mục tiêu', sub: d.journey?.north_star_metric ? `NSM: ${d.journey.north_star_metric}` : '' },
      ])
      // Panel 10 bước (tạo/refresh).
      let panel = root.querySelector<HTMLElement>('#roadmap-phases')
      if (!panel) {
        panel = document.createElement('div')
        panel.id = 'roadmap-phases'
        panel.style.cssText = 'margin:14px 0;display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px'
        const kpiRow = root.querySelector('.kpi-row')
        if (kpiRow?.parentNode) kpiRow.parentNode.insertBefore(panel, kpiRow.nextSibling)
        else root.appendChild(panel)
      }
      panel.innerHTML = phases.map((p) => {
        const border = p.status === 'current' ? 'var(--gold,#e4c16e)' : p.status === 'done' ? 'var(--ok,#4fc79a)' : 'var(--line,#2a2a3f)'
        const badge = p.status === 'current' ? '● ĐANG Ở ĐÂY' : p.status === 'done' ? '✓ XONG' : ''
        return `<div style="border:1px solid ${border};border-radius:12px;padding:12px;background:var(--panel,rgba(255,255,255,.02))">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:6px">
            <strong>${p.phase}. ${escapeHtml(String(p.title))}</strong>
            <span style="font-size:.62rem;color:${border};font-weight:700;white-space:nowrap">${badge}</span>
          </div>
          <div style="font-size:.75rem;color:var(--ink-2,#b3b2aa);margin:6px 0">${escapeHtml(String(p.mission))}</div>
          <div style="font-size:.72rem;margin-top:6px">${p.gates.map((g) => `<div style="margin-top:3px;color:${g.pass ? 'var(--ok,#4fc79a)' : 'var(--dim,#737b8e)'}">${g.pass ? '✓' : '○'} ${escapeHtml(g.label)}</div>`).join('')}</div>
          ${p.dashboard_focus ? `<div style="font-size:.62rem;color:var(--dim);margin-top:8px;text-transform:uppercase;letter-spacing:.04em">📊 ${escapeHtml(String(p.dashboard_focus))}</div>` : ''}
        </div>`
      }).join('')
    }
    render(((raw as { data?: Road })?.data) ?? {})
    const refreshRoad = async () => { const r = await apiSend('/api/roadmap', 'GET'); if (r.ok) render(r.data as Road) }

    // ── BMC editor panel (bước 1 — nhập idea) ──
    let bmc = root.querySelector<HTMLElement>('#bmc-panel')
    if (!bmc) {
      bmc = document.createElement('div')
      bmc.id = 'bmc-panel'
      bmc.style.cssText = 'margin:14px 0;padding:14px;border:1px solid var(--line,#2a2a3f);border-radius:12px;background:var(--panel,rgba(255,255,255,.02))'
      const phasesPanel = root.querySelector('#roadmap-phases')
      if (phasesPanel?.parentNode) phasesPanel.parentNode.insertBefore(bmc, phasesPanel.nextSibling)
      else root.appendChild(bmc)
    }
    const bmcBox = bmc
    const renderBmc = async () => {
      const r = await apiSend('/api/canvas', 'GET')
      if (!r.ok) { bmcBox.innerHTML = `<div style="color:var(--dim)">Business Model Canvas: ${escapeHtml(r.error ?? 'chưa tải được (cần migration 025)')}</div>`; return }
      const blocks = (r.data as { blocks?: Array<{ block_key: string; items: string[] }> })?.blocks ?? []
      bmcBox.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><strong>🗺 Business Model Canvas — vòng nhập IDEA (bấm khối để sửa)</strong><span style="font-size:.72rem;color:var(--dim)">${blocks.filter((b) => b.items.length > 0).length}/9 khối có nội dung</span></div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px">
        ${blocks.map((b) => `<div data-bmc="${b.block_key}" style="border:1px solid ${b.items.length ? 'var(--ok,#4fc79a)' : 'var(--line,#2a2a3f)'};border-radius:10px;padding:10px;cursor:pointer;min-height:84px">
          <div style="font-size:.7rem;font-weight:700;margin-bottom:5px">${BMC_LABELS[b.block_key] ?? b.block_key}</div>
          ${b.items.length ? b.items.slice(0, 4).map((i) => `<div style="font-size:.72rem;color:var(--ink-2,#b3b2aa)">• ${escapeHtml(i)}</div>`).join('') : '<div style="font-size:.7rem;color:var(--dim);font-style:italic">trống — bấm để nhập</div>'}
        </div>`).join('')}</div>`
      wireEach(bmcBox, '[data-bmc]', async (el) => {
        const key = el.getAttribute('data-bmc')
        if (!key) return
        const blk = blocks.find((b) => b.block_key === key)
        const v = await openFormModal({
          title: `${BMC_LABELS[key] ?? key} — mỗi dòng 1 ý`,
          fields: [{ name: 'items', label: 'Nội dung (mỗi dòng 1 ý)', type: 'textarea', value: (blk?.items ?? []).join('\n') }],
          submitLabel: 'Lưu khối',
        })
        if (!v) return
        const items = String(v.items ?? '').split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 20)
        const res = await apiSend('/api/canvas', 'POST', { block_key: key, items })
        if (res.ok) { toast('Đã lưu khối BMC'); void renderBmc(); void refreshRoad() } else toast(res.error ?? 'Lỗi lưu', 'err')
      })
    }
    void renderBmc()
  },

  'page-agents': (raw) => {
    const root = document.getElementById('page-agents')
    if (!root) return
    type ActionRow = {
      id: string
      agent_code: string
      action_type: string
      title: string
      confidence?: number
    }
    type Payload = {
      data?: {
        configured?: Array<{ agent_code?: string; status?: string }>
        catalog?: Array<{ agent_code: string }>
        engine?: {
          schedules?: Array<{ agent_code: string; cadence?: string; autonomy?: string; enabled?: boolean }>
          actions_pending?: ActionRow[]
          runs_recent?: Array<{ id: string; status?: string; cost_usd?: number }>
        }
      }
    }
    const TYPE_LABEL: Record<string, string> = {
      create_task: '📋 Tạo task',
      upsert_kpi: '📈 Ghi KPI',
      raise_alert: '🚨 Cảnh báo',
      log_insight: '💡 Insight',
    }
    const render = (p: Payload) => {
      const configured = p?.data?.configured ?? []
      const catalog = p?.data?.catalog ?? []
      const eng = p?.data?.engine ?? {}
      const scheds = eng.schedules ?? []
      const pending = eng.actions_pending ?? []
      const runs = eng.runs_recent ?? []
      const autoOn = scheds.filter((s) => s.enabled).length

      patchKpiCards(root, [
        { value: `${configured.length}<em>/${catalog.length || 108}</em>`, label: 'Agents active' },
        { value: String(autoOn), label: 'Lịch tự động ON', sub: scheds.length ? `${scheds.filter((s) => s.autonomy === 'auto').length} full-auto · còn lại chờ duyệt` : 'Engine tick 15ph — chưa có lịch' },
        { value: String(runs.length), label: 'Runs gần nhất', sub: runs.length ? `chi phí ~$${runs.reduce((a, r) => a + (Number(r.cost_usd) || 0), 0).toFixed(3)}` : 'chưa chạy' },
        { value: String(pending.length), label: 'Actions chờ duyệt', sub: pending.length ? 'duyệt bên dưới ⬇' : 'sạch hàng đợi' },
      ])

      // Inject (or refresh) the approval-queue panel above the dept grid.
      let panel = root.querySelector<HTMLElement>('#agent-actions-panel')
      if (!panel) {
        panel = document.createElement('div')
        panel.id = 'agent-actions-panel'
        panel.style.cssText = 'margin:14px 0;padding:14px;border:1px solid var(--line,#2a2a3f);border-radius:12px;background:var(--panel,rgba(255,255,255,.02))'
        const grid = root.querySelector('.agent-g')
        if (grid?.parentNode) grid.parentNode.insertBefore(panel, grid)
        else root.appendChild(panel)
      }
      const rowsHtml = pending
        .map((a) => {
          const conf = typeof a.confidence === 'number' ? `${Math.round(a.confidence * 100)}%` : '—'
          return `<tr>
            <td><span style="font-family:monospace;font-size:.75rem;color:var(--dim)">${escapeHtml(a.agent_code)}</span></td>
            <td>${TYPE_LABEL[a.action_type] ?? escapeHtml(a.action_type)}</td>
            <td><strong>${escapeHtml(a.title)}</strong></td>
            <td class="num">${conf}</td>
            <td style="white-space:nowrap">
              <button data-approve="${a.id}" style="background:var(--ok,#22c55e);color:#08130b;border:0;border-radius:6px;padding:4px 10px;cursor:pointer;font-weight:700">✓ Duyệt</button>
              <button data-reject="${a.id}" style="background:none;border:1px solid var(--line,#2a2a3f);color:var(--dim);border-radius:6px;padding:4px 10px;cursor:pointer;margin-left:6px">✕ Từ chối</button>
            </td>
          </tr>`
        })
        .join('')
      panel.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:10px">
          <strong>⚡ Hành động supagent chờ duyệt (${pending.length})</strong>
          <span style="font-size:.75rem;color:var(--dim)">Engine tự chạy 12 chief theo lịch · duyệt 1-click để thực thi</span>
        </div>
        ${
          pending.length === 0
            ? `<div style="color:var(--dim);font-style:italic;padding:8px 0">Không có đề xuất chờ duyệt. Supagents sẽ đề xuất sau chu kỳ chạy kế tiếp.</div>`
            : `<div style="overflow-x:auto"><table class="tbl" style="width:100%"><thead><tr><th>Agent</th><th>Loại</th><th>Đề xuất</th><th>Tin cậy</th><th></th></tr></thead><tbody>${rowsHtml}</tbody></table></div>`
        }`

      wireEach(panel, 'button[data-approve]', async (el) => {
        const id = el.getAttribute('data-approve')
        if (!id) return
        const r = await apiSend('/api/agents/actions', 'PATCH', { id, decision: 'approve' })
        if (r.ok) { toast('Đã thực thi ✓'); void refresh() } else toast(r.error ?? 'Lỗi duyệt', 'err')
      })
      wireEach(panel, 'button[data-reject]', async (el) => {
        const id = el.getAttribute('data-reject')
        if (!id) return
        const r = await apiSend('/api/agents/actions', 'PATCH', { id, decision: 'reject' })
        if (r.ok) { toast('Đã từ chối'); void refresh() } else toast(r.error ?? 'Lỗi', 'err')
      })
    }
    const refresh = async () => {
      const r = await apiSend('/api/agents', 'GET')
      if (r.ok) render({ data: r.data } as Payload)
    }
    render(raw as Payload)
  },

  // ─────────────────────────────────────────────────────────────
  // Chunk 3 — 35 new patchers
  // ─────────────────────────────────────────────────────────────

  'page-northstar': (raw) => {
    const root = document.getElementById('page-northstar')
    if (!root) return
    type Yr = { id: string; year: number; phase?: number; revenue_target?: number; gross_margin_target_pct?: number; ebitda_target?: number; headcount_target?: number; funding_target?: number; funding_round_code?: string; valuation_target?: number; key_milestone?: string }
    type Mp = { years?: Yr[]; journey?: { current_phase?: number; target_year?: number; valuation_target?: number; north_star_metric?: string } | null }
    const thisYear = new Date().getFullYear()
    const render = (d: Mp) => {
      const years = d.years ?? []
      const j = d.journey
      const cur = years.find((y) => y.year === thisYear)
      const last = years[years.length - 1]
      patchKpiCards(root, [
        { value: j?.north_star_metric ? escapeHtml(j.north_star_metric.slice(0, 14)) : '—', label: 'North Star metric' },
        { value: cur?.revenue_target != null ? fmtMoney(cur.revenue_target) : '—', label: `Doanh thu KH ${thisYear}` },
        { value: years.length ? `${years[0].year}–${last.year}` : '—', label: 'Tầm kế hoạch', sub: `${years.length} năm` },
        { value: last?.valuation_target != null ? fmtMoney(last.valuation_target) : (j?.valuation_target != null ? fmtMoney(j.valuation_target) : '—'), label: 'Định giá đích' },
      ])
      const rows = years.map((y) => {
        const isCur = y.year === thisYear
        return `<tr${isCur ? ' style="background:rgba(228,193,110,.06)"' : ''}><td><strong>${y.year}</strong>${y.phase ? `<br/><span style="font-size:.6rem;color:var(--dim)">bước ${y.phase}/10</span>` : ''}<button data-del="${y.id}" title="Xoá" style="float:right;background:none;border:0;color:var(--dim);cursor:pointer;font-size:.8rem">✕</button></td><td class="num">${y.revenue_target != null ? fmtMoney(y.revenue_target) : '—'}</td><td class="num">${y.gross_margin_target_pct != null ? `${y.gross_margin_target_pct}%` : '—'}</td><td class="num">${y.headcount_target ?? '—'}</td><td>${y.funding_target != null ? `${fmtMoney(y.funding_target)}${y.funding_round_code ? ` <span style="font-size:.6rem;color:var(--dim)">${escapeHtml(y.funding_round_code)}</span>` : ''}` : '—'}<br/><span style="font-size:.68rem;color:var(--ink-2,#b3b2aa)">${escapeHtml(y.key_milestone ?? '')}</span></td></tr>`
      })
      patchTable(root, '.card', rows, 'Chưa có masterplan. Bấm "+ Năm kế hoạch" — lập bản đồ tài chính từ nay tới IPO (doanh thu · biên · nhân sự · vốn · cột mốc).', 5)
      wireEach(root, 'button[data-del]', async (el) => {
        const id = el.getAttribute('data-del')
        if (!id || !window.confirm('Xoá năm kế hoạch này?')) return
        const r = await apiSend(`/api/masterplan/${id}`, 'DELETE')
        if (r.ok) { toast('Đã xoá'); void refresh() } else toast(r.error ?? 'Lỗi xoá', 'err')
      })
    }
    const refresh = async () => { const r = await apiSend('/api/masterplan', 'GET'); if (r.ok) render(r.data as Mp) }
    render(((raw as { data?: Mp })?.data) ?? {})

    let panel = root.querySelector<HTMLElement>('#mp-review')
    if (!panel) {
      panel = document.createElement('div')
      panel.id = 'mp-review'
      panel.style.cssText = 'margin:14px 0;padding:14px;border:1px solid var(--line,#2a2a3f);border-radius:12px;background:var(--panel,rgba(255,255,255,.02));display:none'
      const kpiRow = root.querySelector('.kpi-row')
      if (kpiRow?.parentNode) kpiRow.parentNode.insertBefore(panel, kpiRow.nextSibling)
      else root.appendChild(panel)
    }
    const box = panel

    ensureHeaderButton(root, 'za-add-year', '+ Năm kế hoạch', async () => {
      const v = await openFormModal({
        title: 'Lập kế hoạch một năm (masterplan)',
        fields: [
          { name: 'year', label: 'Năm', type: 'number', required: true, value: String(thisYear) },
          { name: 'phase', label: 'Bước hành trình (1-10)', type: 'number' },
          { name: 'revenue_target', label: 'Doanh thu mục tiêu', type: 'number' },
          { name: 'gross_margin_target_pct', label: 'Biên gộp mục tiêu %', type: 'number' },
          { name: 'ebitda_target', label: 'EBITDA mục tiêu', type: 'number' },
          { name: 'headcount_target', label: 'Nhân sự mục tiêu (người)', type: 'number' },
          { name: 'funding_target', label: 'Vốn cần gọi', type: 'number' },
          { name: 'funding_round_code', label: 'Vòng gọi vốn', placeholder: 'seed / series_a / pre_ipo' },
          { name: 'valuation_target', label: 'Định giá mục tiêu', type: 'number' },
          { name: 'key_milestone', label: 'Cột mốc then chốt của năm' },
        ],
        submitLabel: 'Lưu năm',
      })
      if (!v) return
      const res = await apiSend('/api/masterplan', 'POST', {
        year: num(v.year) ?? thisYear, phase: num(v.phase),
        revenue_target: num(v.revenue_target), gross_margin_target_pct: num(v.gross_margin_target_pct),
        ebitda_target: num(v.ebitda_target), headcount_target: num(v.headcount_target),
        funding_target: num(v.funding_target), funding_round_code: v.funding_round_code || undefined,
        valuation_target: num(v.valuation_target), key_milestone: v.key_milestone || undefined,
      })
      if (res.ok) { toast('Đã lưu năm kế hoạch'); void refresh() } else toast(res.error ?? 'Lỗi lưu', 'err')
    })

    ensureHeaderButton(root, 'za-mp-review', '🎯 Kế hoạch vs Thực tế', async () => {
      box.style.display = 'block'
      box.innerHTML = `<div style="color:var(--dim);padding:8px">Đang đối chiếu masterplan với P&L, nhân sự và vốn đã gọi…</div>`
      const r = await apiSend('/api/masterplan/review', 'POST', { year: thisYear })
      if (!r.ok) { box.innerHTML = `<div style="color:var(--err,#e0685f);padding:8px">${escapeHtml(r.error ?? 'Lỗi đối chiếu')}</div>`; return }
      const d = r.data as {
        year: number; phase?: number; revenue_pace_pct?: number
        plan: Record<string, number | string | null>; actual: Record<string, number | string | null>
        gaps: Array<{ metric: string; severity: string; message: string }>
      }
      const row = (label: string, plan: unknown, actual: unknown, isMoney = true) => {
        const p = typeof plan === 'number' ? (isMoney ? fmtMoney(plan) : fmtNum(plan)) : '—'
        const a = typeof actual === 'number' ? (isMoney ? fmtMoney(actual) : fmtNum(actual)) : '—'
        const pct = typeof plan === 'number' && plan > 0 && typeof actual === 'number' ? Math.round((actual / plan) * 100) : null
        const col = pct == null ? 'var(--dim)' : pct >= 90 ? 'var(--ok,#4fc79a)' : pct >= 70 ? 'var(--gold,#e4c16e)' : 'var(--err,#e0685f)'
        return `<tr><td><strong>${label}</strong></td><td class="num">${p}</td><td class="num">${a}</td><td class="num" style="color:${col}">${pct != null ? `${pct}%` : '—'}</td></tr>`
      }
      const sevCol = (s: string) => (s === 'critical' ? 'var(--err,#e0685f)' : s === 'warn' ? 'var(--gold,#e4c16e)' : 'var(--dim)')
      box.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px">
          <strong>🎯 Kế hoạch vs Thực tế — năm ${d.year}${d.phase ? ` · bước ${d.phase}/10` : ''}</strong>
          ${d.revenue_pace_pct != null ? `<span>Nhịp doanh thu: <strong style="color:${d.revenue_pace_pct >= 90 ? 'var(--ok,#4fc79a)' : d.revenue_pace_pct >= 70 ? 'var(--gold,#e4c16e)' : 'var(--err,#e0685f)'}">${d.revenue_pace_pct}%</strong> so tiến độ</span>` : ''}
        </div>
        <div style="overflow-x:auto"><table class="tbl" style="width:100%"><thead><tr><th>Chỉ tiêu</th><th>Kế hoạch</th><th>Thực tế</th><th>Đạt</th></tr></thead><tbody>
          ${row('Doanh thu', d.plan.revenue, d.actual.revenue)}
          ${row('Biên gộp %', d.plan.gross_margin_pct, d.actual.gross_margin_pct, false)}
          ${row('EBITDA', d.plan.ebitda, d.actual.ebitda)}
          ${row('Nhân sự', d.plan.headcount, d.actual.headcount, false)}
          ${row('Vốn gọi', d.plan.funding, d.actual.funding)}
        </tbody></table></div>
        ${d.plan.milestone ? `<div style="margin-top:8px;font-size:.8rem"><strong>Cột mốc năm:</strong> ${escapeHtml(String(d.plan.milestone))}</div>` : ''}
        ${d.gaps.length
          ? `<div style="margin-top:10px"><strong style="font-size:.85rem">⚠ Khoảng lệch cần xử lý:</strong>${d.gaps.map((g) => `<div style="margin-top:6px;padding:8px;border-left:3px solid ${sevCol(g.severity)};background:rgba(255,255,255,.02);font-size:.82rem">${escapeHtml(g.message)}</div>`).join('')}</div>`
          : `<div style="margin-top:10px;color:var(--ok,#4fc79a);font-size:.85rem">✓ Đang bám kế hoạch — không có lệch đáng kể.</div>`}`
      toast('Đã đối chiếu kế hoạch')
    })
  },

  'page-kpi': (raw) => {
    const root = document.getElementById('page-kpi')
    if (!root) return
    type Kpi = { id: string; metric_code?: string; name: string; value: number; unit?: string; period?: string; trend?: string; category?: string }
    const render = (list: Kpi[]) => {
      patchKpiCards(root, [
        { value: String(list.length), label: 'KPI tracked' },
        { value: String(new Set(list.map((k) => k.category ?? 'misc')).size), label: 'Categories' },
        { value: String(list.filter((k) => k.trend === 'up').length), label: 'Trending up' },
        { value: String(list.filter((k) => k.trend === 'down').length), label: 'Need attention' },
      ])
      const rows = list.slice(0, 60).map((k) => `<tr><td><strong>${escapeHtml(k.name)}</strong><button data-del="${k.id}" title="Xoá" style="float:right;background:none;border:0;color:var(--dim);cursor:pointer;font-size:.8rem">✕</button></td><td>${escapeHtml(k.category ?? '—')}</td><td class="num">${fmtNum(k.value)} ${escapeHtml(k.unit ?? '')}</td><td>${escapeHtml(k.period ?? '—')}</td><td><span class="st ${k.trend === 'up' ? 'ok' : k.trend === 'down' ? 'err' : 'dim'}">${escapeHtml(k.trend ?? '—')}</span></td></tr>`)
      patchTable(root, '.card', rows, 'Chưa có KPI. Bấm "+ KPI mới" để thêm.', 5)
      wireEach(root, 'button[data-del]', async (el) => {
        const id = el.getAttribute('data-del')
        if (!id || !window.confirm('Xoá KPI này?')) return
        const r = await apiSend(`/api/kpis/${id}`, 'DELETE')
        if (r.ok) { toast('Đã xoá'); void refresh() } else toast(r.error ?? 'Lỗi xoá', 'err')
      })
    }
    const refresh = async () => { const r = await apiSend('/api/kpis', 'GET'); if (r.ok) render((r.data as Kpi[]) ?? []) }
    render(((raw as { data?: Kpi[] })?.data) ?? [])
    wireButtonByText(root, 'KPI mới', async () => {
      const v = await openFormModal({
        title: 'Thêm KPI', submitLabel: 'Thêm', fields: [
          { name: 'name', label: 'Tên KPI', required: true, placeholder: 'MRR' },
          { name: 'metric_code', label: 'Mã (code)', required: true, placeholder: 'mrr' },
          { name: 'value', label: 'Giá trị', type: 'number', required: true },
          { name: 'unit', label: 'Đơn vị', placeholder: 'USD' },
          { name: 'period', label: 'Kỳ', placeholder: '2026-06' },
          { name: 'trend', label: 'Xu hướng', type: 'select', options: [{ value: '', label: '—' }, { value: 'up', label: 'up' }, { value: 'flat', label: 'flat' }, { value: 'down', label: 'down' }] },
        ],
      })
      if (!v) return
      const res = await apiSend('/api/kpis', 'POST', { name: v.name, metric_code: v.metric_code, value: num(v.value) ?? 0, unit: v.unit || undefined, period: v.period || undefined, trend: v.trend || undefined })
      if (res.ok) { toast('Đã thêm KPI'); void refresh() } else toast(res.error ?? 'Lỗi thêm', 'err')
    })
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
    type VaultData = { folders?: Array<{ id: string; name: string }>; docs?: Array<{ id: string; title: string; mime_type?: string; file_size_bytes?: number; created_at: string }> }
    const render = (d?: VaultData) => {
      const docs = d?.docs ?? []
      const folders = d?.folders ?? []
      patchKpiCards(root, [
        { value: String(docs.length), label: 'Total docs' },
        { value: String(folders.length), label: 'Folders' },
        { value: `${(docs.reduce((a, x) => a + (x.file_size_bytes ?? 0), 0) / 1_000_000).toFixed(1)}<em>MB</em>`, label: 'Storage' },
        { value: String(docs.filter((x) => /pdf|presentation|spreadsheet/.test(x.mime_type ?? '')).length), label: 'Pitch + Reports' },
      ])
      const folderRow = folders.length
        ? `<tr><td colspan="4" style="color:var(--dim);font-size:.75rem">📁 ${folders.map((f) => escapeHtml(f.name)).join(' · 📁 ')}</td></tr>`
        : ''
      const rows = docs.slice(0, 30).map((x) => `<tr><td><strong>${escapeHtml(x.title)}</strong></td><td>${escapeHtml(x.mime_type ?? '—')}</td><td class="num">${((x.file_size_bytes ?? 0) / 1024).toFixed(0)} KB</td><td>${fmtDate(x.created_at)}</td></tr>`)
      patchTable(root, '.card', folderRow ? [folderRow, ...rows] : rows, 'Data room trống. Tạo folder cấu trúc DD (Corporate/Financials/Legal/IP…) rồi upload tài liệu.', 4)
    }
    const refresh = async () => { const r = await apiSend('/api/vault', 'GET'); if (r.ok) render(r.data as VaultData) }
    render((raw as { data?: VaultData })?.data)
    ensureHeaderButton(root, 'za-add-folder', '+ Folder', async () => {
      const v = await openFormModal({
        title: 'Tạo folder data room',
        fields: [{ name: 'name', label: 'Tên folder', required: true, placeholder: 'Corporate / Financials / Legal / IP…' }],
        submitLabel: 'Tạo',
      })
      if (!v) return
      const res = await apiSend('/api/vault', 'POST', { name: v.name })
      if (res.ok) { toast('Đã tạo folder'); void refresh() } else toast(res.error ?? 'Lỗi tạo folder', 'err')
    })
  },

  'page-council': (raw) => {
    const root = document.getElementById('page-council')
    if (!root) return
    type Ev = { id: string; created_at: string; payload?: { input?: { description?: string }; result?: { overall_score?: number; recommendation?: string; summary?: string; votes?: Array<{ agent: string; vote: string; score: number; reasoning: string }> } } }
    const renderHistory = (list: Ev[]) => {
      const results = list.map((e) => e.payload?.result).filter(Boolean)
      const go = results.filter((r) => r?.recommendation === 'go').length
      const revise = results.filter((r) => r?.recommendation === 'revise').length
      const nogo = results.filter((r) => r?.recommendation === 'no_go').length
      patchKpiCards(root, [
        { value: String(list.length), label: 'Validations' },
        { value: String(go), label: 'GO' },
        { value: String(revise), label: 'Revise' },
        { value: String(nogo), label: 'No-go' },
      ])
    }
    renderHistory(((raw as { data?: Ev[] })?.data) ?? [])

    // Result panel host (created once).
    let panel = root.querySelector<HTMLElement>('#council-result')
    if (!panel) {
      panel = document.createElement('div')
      panel.id = 'council-result'
      panel.style.cssText = 'margin:14px 0;padding:14px;border:1px solid var(--line,#2a2a3f);border-radius:12px;background:var(--panel,rgba(255,255,255,.02));display:none'
      const kpiRow = root.querySelector('.kpi-row')
      if (kpiRow?.parentNode) kpiRow.parentNode.insertBefore(panel, kpiRow.nextSibling)
      else root.appendChild(panel)
    }
    const box = panel

    ensureHeaderButton(root, 'za-run-council', '⚖ Chạy Council 9', async () => {
      const v = await openFormModal({
        title: 'Council of 9 — thẩm định ý tưởng/quyết định',
        fields: [
          { name: 'description', label: 'Mô tả ý tưởng/quyết định (≥20 ký tự)', type: 'textarea', required: true },
          { name: 'industry', label: 'Ngành', required: true, placeholder: 'F&B / SaaS / fintech…' },
          { name: 'market_size', label: 'Quy mô thị trường', type: 'textarea' },
          { name: 'competition', label: 'Cạnh tranh', type: 'textarea' },
          { name: 'team_background', label: 'Đội ngũ', type: 'textarea' },
        ],
        submitLabel: 'Trình Council',
      })
      if (!v) return
      box.style.display = 'block'
      box.innerHTML = `<div style="color:var(--dim);padding:10px">⚖ 9 vị thần đang nghị sự… (~30-60s)</div>`
      const r = await apiSend('/api/council', 'POST', {
        description: v.description, industry: v.industry,
        market_size: v.market_size || undefined, competition: v.competition || undefined,
        team_background: v.team_background || undefined,
      })
      if (!r.ok) {
        box.innerHTML = `<div style="color:var(--err,#e0685f);padding:10px">${escapeHtml(r.error ?? 'Lỗi chạy Council')}${String(r.error ?? '').includes('AI') ? '<br/><span style="color:var(--dim);font-size:.8rem">AI chưa cấu hình — chờ đấu key WitsPro 5.5.</span>' : ''}</div>`
        return
      }
      const d = r.data as { overall_score?: number; recommendation?: string; summary?: string; votes?: Array<{ agent: string; vote: string; score: number; reasoning: string }> }
      const recCls = d.recommendation === 'go' ? 'var(--ok,#4fc79a)' : d.recommendation === 'no_go' ? 'var(--err,#e0685f)' : 'var(--gold,#e4c16e)'
      const voteRows = (d.votes ?? []).map((vt) => `<tr><td><strong>${escapeHtml(vt.agent)}</strong></td><td><span style="color:${vt.vote === 'green' ? 'var(--ok,#4fc79a)' : vt.vote === 'red' ? 'var(--err,#e0685f)' : 'var(--gold,#e4c16e)'};font-weight:700">${escapeHtml(vt.vote)}</span></td><td class="num">${vt.score}</td><td style="font-size:.78rem;color:var(--ink-2,#b3b2aa)">${escapeHtml(vt.reasoning)}</td></tr>`).join('')
      box.innerHTML = `
        <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:10px">
          <strong style="font-size:1.05rem">Phán quyết: <span style="color:${recCls};text-transform:uppercase">${escapeHtml(d.recommendation ?? '—')}</span></strong>
          <span>Điểm tổng: <strong>${d.overall_score ?? '—'}/100</strong></span>
        </div>
        <p style="color:var(--ink-2,#b3b2aa);font-size:.85rem;margin:0 0 10px">${escapeHtml(d.summary ?? '')}</p>
        <div style="overflow-x:auto"><table class="tbl" style="width:100%"><thead><tr><th>Agent</th><th>Vote</th><th>Điểm</th><th>Lý do</th></tr></thead><tbody>${voteRows}</tbody></table></div>`
      const rr = await apiSend('/api/council', 'GET')
      if (rr.ok) renderHistory((rr.data as Ev[]) ?? [])
      toast('Council đã phán quyết')
    })
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

    // ── SƠ ĐỒ TỔ CHỨC + KHUNG NĂNG LỰC TỪNG GHẾ ──
    type Cap = { name: string; category: string; level: string }
    type Pos = { id: string; title_vi: string; unit_code: string; level: string; status: string; holder_name?: string; capabilities?: Cap[]; decision_rights?: string[]; owns_metrics?: string[]; template_code?: string }
    type Tpl = { template_code: string; title_vi: string; unit_code: string; level: string; mission_vi: string; capabilities?: Cap[]; decision_rights?: string[]; owns_metrics?: string[]; min_phase?: number }
    type Unit = { unit_code: string; name_vi: string; mission_vi: string }
    type OrgData = { units?: Unit[]; templates?: Tpl[]; positions?: Pos[]; current_phase?: number; missing_positions?: Tpl[]; summary?: { total: number; filled: number; open: number; coverage_pct: number } }
    const LEVEL_VI: Record<string, string> = { c_level: 'C-level', director: 'Giám đốc', manager: 'Trưởng phòng', lead: 'Trưởng nhóm', ic: 'Chuyên viên' }

    let org = root.querySelector<HTMLElement>('#org-panel')
    if (!org) {
      org = document.createElement('div')
      org.id = 'org-panel'
      org.style.cssText = 'margin:14px 0;padding:14px;border:1px solid var(--line,#2a2a3f);border-radius:12px;background:var(--panel,rgba(255,255,255,.02))'
      root.appendChild(org)
    }
    const orgBox = org

    const showCapabilities = async (title: string, caps: Cap[], rights: string[], metrics: string[], mission?: string) => {
      const capHtml = caps.length
        ? caps.map((c) => `<div style="margin-top:5px;font-size:.8rem">• <strong>${escapeHtml(c.name)}</strong> <span style="font-size:.65rem;color:var(--dim)">[${escapeHtml(c.category)} · ${escapeHtml(c.level)}]</span></div>`).join('')
        : '<div style="color:var(--dim);font-style:italic">Chưa định nghĩa năng lực</div>'
      await openFormModal({
        title: `Khung năng lực — ${title}`,
        fields: [{
          name: 'info', label: 'Chi tiết vị trí', type: 'textarea',
          value: [
            mission ? `SỨ MỆNH:\n${mission}\n` : '',
            `NĂNG LỰC BẮT BUỘC:\n${caps.map((c, i) => `${i + 1}. ${c.name} (${c.category} · ${c.level})`).join('\n') || '—'}\n`,
            `QUYỀN QUYẾT ĐỊNH:\n${rights.map((r, i) => `${i + 1}. ${r}`).join('\n') || '—'}\n`,
            `KPI CHỊU TRÁCH NHIỆM:\n${metrics.join(' · ') || '—'}`,
          ].join('\n'),
        }],
        submitLabel: 'Đóng',
      })
      void capHtml
    }

    const renderOrg = (d: OrgData) => {
      const units = d.units ?? []
      const positions = d.positions ?? []
      const missing = d.missing_positions ?? []
      const s = d.summary
      const unitName = (c: string) => units.find((u) => u.unit_code === c)?.name_vi ?? c

      const posByUnit = new Map<string, Pos[]>()
      for (const p of positions) {
        const arr = posByUnit.get(p.unit_code) ?? []
        arr.push(p)
        posByUnit.set(p.unit_code, arr)
      }

      orgBox.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px">
          <strong>🏛 Sơ đồ tổ chức &amp; khung năng lực từng vị trí</strong>
          <span style="font-size:.75rem;color:var(--dim)">${s?.filled ?? 0}/${s?.total ?? 0} ghế có người (${s?.coverage_pct ?? 0}%) · bước ${d.current_phase ?? 1}/10</span>
        </div>
        ${positions.length === 0
          ? `<div style="color:var(--dim);font-style:italic;padding:6px 0 12px">Chưa lập sơ đồ tổ chức. Bấm "+ Vị trí" — chọn ghế chuẩn để kế thừa sẵn khung năng lực + quyền quyết định + KPI.</div>`
          : `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px">
              ${[...posByUnit.entries()].map(([uc, ps]) => `<div style="border:1px solid var(--line,#2a2a3f);border-radius:10px;padding:10px">
                <div style="font-size:.72rem;font-weight:700;color:var(--gold,#e4c16e);text-transform:uppercase;letter-spacing:.05em">${escapeHtml(unitName(uc))}</div>
                ${ps.map((p) => `<div style="margin-top:7px;padding-top:7px;border-top:1px solid var(--line,#2a2a3f)">
                  <div style="display:flex;justify-content:space-between;gap:6px;align-items:center">
                    <span><strong style="font-size:.85rem">${escapeHtml(p.title_vi)}</strong> <span style="font-size:.6rem;color:var(--dim)">${escapeHtml(LEVEL_VI[p.level] ?? p.level)}</span></span>
                    <span class="st ${p.status === 'filled' ? 'ok' : p.status === 'open' ? 'warn' : 'dim'}" style="font-size:.6rem">${p.status === 'filled' ? 'có người' : p.status === 'open' ? 'đang trống' : p.status}</span>
                  </div>
                  <div style="font-size:.7rem;color:var(--ink-2,#b3b2aa);margin-top:2px">${escapeHtml(p.holder_name ?? '— chưa bổ nhiệm')}</div>
                  <div style="margin-top:4px;display:flex;gap:8px">
                    <button data-cap="${p.id}" style="background:none;border:0;color:var(--gold,#e4c16e);cursor:pointer;font-size:.68rem;padding:0">📋 Năng lực (${(p.capabilities ?? []).length})</button>
                    <button data-delpos="${p.id}" style="background:none;border:0;color:var(--dim);cursor:pointer;font-size:.68rem;padding:0">✕ Xoá</button>
                  </div>
                </div>`).join('')}
              </div>`).join('')}
            </div>`}
        ${missing.length ? `<div style="margin-top:12px;padding:10px;border-left:3px solid var(--gold,#e4c16e);background:rgba(255,255,255,.02)">
          <strong style="font-size:.8rem">⚠ Ghế CẦN CÓ ở bước ${d.current_phase ?? 1} mà chưa lập (${missing.length}):</strong>
          <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">
            ${missing.map((t) => `<button data-add-tpl="${escapeHtml(t.template_code)}" style="background:rgba(228,193,110,.12);border:1px solid var(--gold,#e4c16e);color:var(--gold,#e4c16e);border-radius:6px;padding:3px 9px;cursor:pointer;font-size:.72rem">+ ${escapeHtml(t.title_vi)}</button>`).join('')}
          </div></div>` : ''}`

      wireEach(orgBox, 'button[data-cap]', async (el) => {
        const p = positions.find((x) => x.id === el.getAttribute('data-cap'))
        if (!p) return
        await showCapabilities(p.title_vi, p.capabilities ?? [], p.decision_rights ?? [], p.owns_metrics ?? [])
      })
      wireEach(orgBox, 'button[data-delpos]', async (el) => {
        const id = el.getAttribute('data-delpos')
        if (!id || !window.confirm('Xoá vị trí này khỏi sơ đồ tổ chức?')) return
        const r = await apiSend(`/api/org/${id}`, 'DELETE')
        if (r.ok) { toast('Đã xoá'); void refreshOrg() } else toast(r.error ?? 'Lỗi xoá', 'err')
      })
      wireEach(orgBox, 'button[data-add-tpl]', async (el) => {
        const code = el.getAttribute('data-add-tpl')
        const tpl = (d.templates ?? []).find((t) => t.template_code === code)
        if (!tpl) return
        const v = await openFormModal({
          title: `Lập ghế: ${tpl.title_vi}`,
          fields: [
            { name: 'holder_name', label: 'Ai ngồi ghế này (bỏ trống nếu đang tuyển)' },
            { name: 'status', label: 'Trạng thái', type: 'select', options: [['open', 'Đang trống — cần tuyển'], ['filled', 'Đã có người'], ['planned', 'Kế hoạch sau']].map(([v2, l]) => ({ value: v2, label: l })) },
          ],
          submitLabel: 'Lập ghế',
        })
        if (!v) return
        const res = await apiSend('/api/org', 'POST', {
          template_code: tpl.template_code, unit_code: tpl.unit_code, title_vi: tpl.title_vi,
          level: tpl.level, holder_name: v.holder_name || undefined,
          status: v.status || (v.holder_name ? 'filled' : 'open'),
        })
        if (res.ok) { toast(`Đã lập ghế ${tpl.title_vi} (kèm khung năng lực chuẩn)`); void refreshOrg() } else toast(res.error ?? 'Lỗi', 'err')
      })
    }
    const refreshOrg = async () => { const r = await apiSend('/api/org', 'GET'); if (r.ok) renderOrg(r.data as OrgData) }
    void refreshOrg()

    ensureHeaderButton(root, 'za-add-pos', '+ Vị trí', async () => {
      const r0 = await apiSend('/api/org', 'GET')
      const d0 = (r0.ok ? (r0.data as OrgData) : {}) ?? {}
      const tpls = d0.templates ?? []
      const v = await openFormModal({
        title: 'Thêm vị trí vào sơ đồ tổ chức',
        fields: [
          { name: 'template_code', label: 'Ghế chuẩn (kế thừa năng lực + quyền + KPI)', type: 'select', options: [{ value: '', label: '— Tự định nghĩa —' }, ...tpls.map((t) => ({ value: t.template_code, label: `${t.title_vi} (${t.unit_code})` }))] },
          { name: 'title_vi', label: 'Tên vị trí (nếu tự định nghĩa)' },
          { name: 'unit_code', label: 'Phòng ban (nếu tự định nghĩa)', type: 'select', options: (d0.units ?? []).map((u) => ({ value: u.unit_code, label: u.name_vi })) },
          { name: 'level', label: 'Cấp', type: 'select', options: Object.entries(LEVEL_VI).map(([v2, l]) => ({ value: v2, label: l })) },
          { name: 'holder_name', label: 'Ai ngồi ghế này' },
        ],
        submitLabel: 'Thêm vị trí',
      })
      if (!v) return
      const tpl = tpls.find((t) => t.template_code === v.template_code)
      const payload = {
        template_code: v.template_code || undefined,
        unit_code: tpl?.unit_code ?? v.unit_code,
        title_vi: tpl?.title_vi ?? v.title_vi,
        level: tpl?.level ?? v.level ?? 'manager',
        holder_name: v.holder_name || undefined,
        status: v.holder_name ? 'filled' : 'open',
      }
      if (!payload.unit_code || !payload.title_vi) { toast('Cần chọn ghế chuẩn hoặc nhập tên + phòng ban', 'err'); return }
      const res = await apiSend('/api/org', 'POST', payload)
      if (res.ok) { toast('Đã thêm vị trí'); void refreshOrg() } else toast(res.error ?? 'Lỗi thêm', 'err')
    })
  },

  'page-sops': (raw) => {
    const root = document.getElementById('page-sops')
    if (!root) return
    type Step = { no: number; action: string; owner?: string; sla_hours?: number }
    type Sop = { id: string; code?: string; title_vi: string; unit_code?: string; purpose_vi?: string; steps?: Step[]; frequency?: string; status: string; version?: number }
    type Payload = { sops?: Sop[]; summary?: { total: number; active: number; draft: number; units_covered: number } }
    const FREQ_VI: Record<string, string> = {
      daily: 'Hằng ngày', weekly: 'Hằng tuần', monthly: 'Hằng tháng',
      quarterly: 'Hằng quý', yearly: 'Hằng năm', on_demand: 'Khi cần',
    }
    const render = (p: Payload) => {
      const list = p.sops ?? []
      const s = p.summary
      patchKpiCards(root, [
        { value: String(s?.total ?? list.length), label: 'Quy trình (SOP)' },
        { value: String(s?.active ?? 0), label: 'Đang áp dụng' },
        { value: String(s?.draft ?? 0), label: 'Bản nháp' },
        { value: `${s?.units_covered ?? 0}<em>/12</em>`, label: 'Phòng ban có SOP' },
      ])
      const rows = list.slice(0, 50).map((x) => {
        const nSteps = (x.steps ?? []).length
        const cls = x.status === 'active' ? 'ok' : x.status === 'deprecated' ? 'dim' : 'warn'
        return `<tr><td><strong>${escapeHtml(x.title_vi)}</strong>${x.code ? `<br/><span class="mono" style="font-size:.6rem;color:var(--dim)">${escapeHtml(x.code)}</span>` : ''}<button data-del="${x.id}" title="Xoá" style="float:right;background:none;border:0;color:var(--dim);cursor:pointer;font-size:.8rem">✕</button></td><td>${escapeHtml(x.unit_code ?? '—')}</td><td class="num">${nSteps} bước</td><td>${escapeHtml(FREQ_VI[x.frequency ?? ''] ?? '—')}</td><td><span class="st ${cls}">${escapeHtml(x.status)}</span></td></tr>`
      })
      patchTable(root, '.card', rows, 'Chưa có SOP. Quy trình lặp >3 lần/tháng mà chưa chuẩn hoá = công ty phụ thuộc người, không scale được.', 5)
      wireEach(root, 'button[data-del]', async (el) => {
        const id = el.getAttribute('data-del')
        if (!id || !window.confirm('Xoá quy trình này?')) return
        const r = await apiSend(`/api/sops/${id}`, 'DELETE')
        if (r.ok) { toast('Đã xoá'); void refresh() } else toast(r.error ?? 'Lỗi xoá', 'err')
      })
    }
    const refresh = async () => { const r = await apiSend('/api/sops', 'GET'); if (r.ok) render(r.data as Payload) }
    render(((raw as { data?: Payload })?.data) ?? {})
    ensureHeaderButton(root, 'za-add-sop', '+ Quy trình', async () => {
      const v = await openFormModal({
        title: 'Tạo quy trình vận hành (SOP)',
        fields: [
          { name: 'title_vi', label: 'Tên quy trình', required: true, placeholder: 'Đóng sổ tháng · Onboard khách mới…' },
          { name: 'unit_code', label: 'Phòng ban', type: 'select', options: [['exec', 'Ban điều hành'], ['finance', 'Tài chính'], ['sales', 'Kinh doanh'], ['marketing', 'Marketing'], ['product', 'Sản phẩm'], ['tech', 'Công nghệ'], ['operations', 'Vận hành'], ['hr', 'Nhân sự'], ['legal', 'Pháp chế'], ['governance', 'Quản trị'], ['ir', 'Quan hệ NĐT'], ['security', 'An ninh']].map(([v2, l]) => ({ value: v2, label: l })) },
          { name: 'code', label: 'Mã SOP', placeholder: 'FIN-01' },
          { name: 'purpose_vi', label: 'Mục đích', type: 'textarea' },
          { name: 'steps', label: 'Các bước (mỗi dòng 1 bước)', type: 'textarea', placeholder: 'Thu thập chứng từ\nĐối chiếu ngân hàng\nLập báo cáo' },
          { name: 'frequency', label: 'Tần suất', type: 'select', options: Object.entries(FREQ_VI).map(([v2, l]) => ({ value: v2, label: l })) },
          { name: 'sla_hours', label: 'SLA (giờ)', type: 'number' },
          { name: 'status', label: 'Trạng thái', type: 'select', options: [['draft', 'Nháp'], ['active', 'Áp dụng'], ['deprecated', 'Ngừng']].map(([v2, l]) => ({ value: v2, label: l })) },
        ],
        submitLabel: 'Tạo SOP',
      })
      if (!v) return
      const steps = String(v.steps ?? '').split('\n').map((t) => t.trim()).filter(Boolean)
        .slice(0, 50).map((action, i) => ({ no: i + 1, action }))
      const res = await apiSend('/api/sops', 'POST', {
        title_vi: v.title_vi, unit_code: v.unit_code || undefined, code: v.code || undefined,
        purpose_vi: v.purpose_vi || undefined, steps, frequency: v.frequency || undefined,
        sla_hours: num(v.sla_hours), status: v.status || 'draft',
      })
      if (res.ok) { toast('Đã tạo SOP'); void refresh() } else toast(res.error ?? 'Lỗi tạo', 'err')
    })
  },

  'page-investors': (raw) => {
    const root = document.getElementById('page-investors')
    if (!root) return
    type Inv = { id: string; investor_name: string; firm_name?: string; stage?: string; target_check_usd?: number; committed_usd?: number; probability_pct?: number; next_action?: string }
    const render = (list: Inv[]) => {
      const totalTarget = list.reduce((a, i) => a + (i.target_check_usd ?? 0), 0)
      const totalCommit = list.reduce((a, i) => a + (i.committed_usd ?? 0), 0)
      patchKpiCards(root, [
        { value: String(list.length), label: 'Investors' },
        { value: fmtMoney(totalTarget), label: 'Target raise' },
        { value: fmtMoney(totalCommit), label: 'Committed' },
        { value: `${totalTarget ? Math.round((totalCommit / totalTarget) * 100) : 0}<em>%</em>`, label: 'Progress' },
      ])
      const rows = list.slice(0, 30).map((i) => `<tr><td><strong>${escapeHtml(i.investor_name)}</strong>${i.firm_name ? `<br/><span class="mono" style="font-size:.6rem;color:var(--dim)">${escapeHtml(i.firm_name)}</span>` : ''}<button data-del="${i.id}" title="Xoá" style="float:right;background:none;border:0;color:var(--dim);cursor:pointer;font-size:.8rem">✕</button></td><td>${escapeHtml(i.stage ?? '—')}</td><td class="num">${typeof i.target_check_usd === 'number' ? fmtMoney(i.target_check_usd) : '—'}</td><td class="num">${typeof i.probability_pct === 'number' ? `${i.probability_pct}%` : '—'}</td><td>${escapeHtml(i.next_action ?? '—')}</td></tr>`)
      patchTable(root, '.card', rows, 'Chưa có investor nào. Bấm "+ Investor" để bắt đầu pipeline.', 5)
      wireEach(root, 'button[data-del]', async (el) => {
        const id = el.getAttribute('data-del')
        if (!id || !window.confirm('Xoá investor này khỏi pipeline?')) return
        const r = await apiSend(`/api/pipeline/${id}`, 'DELETE')
        if (r.ok) { toast('Đã xoá'); void refresh() } else toast(r.error ?? 'Lỗi xoá', 'err')
      })
    }
    const refresh = async () => { const r = await apiSend('/api/investors', 'GET'); if (r.ok) render((r.data as Inv[]) ?? []) }
    render(((raw as { data?: Inv[] })?.data) ?? [])
    ensureHeaderButton(root, 'za-add-investor', '+ Investor', async () => {
      const v = await openFormModal({
        title: 'Thêm investor vào pipeline',
        fields: [
          { name: 'investor_name', label: 'Tên investor', required: true },
          { name: 'firm_name', label: 'Quỹ/Công ty' },
          { name: 'investor_type', label: 'Loại', type: 'select', options: ['angel','vc','pe','strategic','family_office','other'].map((x) => ({ value: x, label: x })) },
          { name: 'stage', label: 'Giai đoạn', type: 'select', options: ['research','contacted','meeting','dd','term_sheet','committed','passed'].map((x) => ({ value: x, label: x })) },
          { name: 'target_check_usd', label: 'Target check (USD)', type: 'number' },
          { name: 'probability_pct', label: 'Xác suất %', type: 'number' },
          { name: 'contact_email', label: 'Email liên hệ' },
          { name: 'next_action', label: 'Việc tiếp theo' },
        ],
        submitLabel: 'Thêm investor',
      })
      if (!v) return
      const res = await apiSend('/api/investors', 'POST', {
        investor_name: v.investor_name, firm_name: v.firm_name || undefined,
        investor_type: v.investor_type || undefined, stage: v.stage || undefined,
        target_check_usd: num(v.target_check_usd), probability_pct: num(v.probability_pct),
        contact_email: v.contact_email || undefined, next_action: v.next_action || undefined,
      })
      if (res.ok) { toast('Đã thêm investor'); void refresh() } else toast(res.error ?? 'Lỗi thêm', 'err')
    })
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
    type Ue = { id: string; period: string; new_customers: number; churned_customers: number; active_customers: number; starting_mrr: number; new_mrr: number; expansion_mrr: number; contraction_mrr: number; churned_mrr: number }
    const render = (list: Ue[]) => {
      const cur = list[0]
      const netMrr = cur ? cur.starting_mrr + cur.new_mrr + cur.expansion_mrr - cur.contraction_mrr - cur.churned_mrr : 0
      patchKpiCards(root, [
        { value: cur ? fmtNum(cur.active_customers) : '—', label: 'Khách đang hoạt động', sub: cur ? String(cur.period).slice(0, 7) : 'chưa có dữ liệu' },
        { value: cur ? fmtMoney(netMrr) : '—', label: 'MRR cuối kỳ' },
        { value: cur ? `+${cur.new_customers} / −${cur.churned_customers}` : '—', label: 'Khách mới / rời' },
        { value: cur ? fmtMoney(cur.expansion_mrr) : '—', label: 'MRR mở rộng' },
      ])
      const rows = list.slice(0, 24).map((u) => {
        const net = u.starting_mrr + u.new_mrr + u.expansion_mrr - u.contraction_mrr - u.churned_mrr
        return `<tr><td><strong>${String(u.period).slice(0, 7)}</strong></td><td class="num">${fmtNum(u.active_customers)}</td><td class="num" style="color:var(--ok,#4fc79a)">+${u.new_customers}</td><td class="num" style="color:var(--err,#e0685f)">−${u.churned_customers}</td><td class="num">${fmtMoney(net)}</td></tr>`
      })
      patchTable(root, '.card', rows, 'Chưa có dữ liệu khách hàng. Bấm "+ Tháng khách" — CAC/LTV/NRR sẽ tự tính từ đây + P&L.', 5)
    }
    const refresh = async () => { const r = await apiSend('/api/unit-economics', 'GET'); if (r.ok) render((r.data as Ue[]) ?? []) }
    render(((raw as { data?: Ue[] })?.data) ?? [])

    let panel = root.querySelector<HTMLElement>('#ue-panel')
    if (!panel) {
      panel = document.createElement('div')
      panel.id = 'ue-panel'
      panel.style.cssText = 'margin:14px 0;padding:14px;border:1px solid var(--line,#2a2a3f);border-radius:12px;background:var(--panel,rgba(255,255,255,.02));display:none'
      const kpiRow = root.querySelector('.kpi-row')
      if (kpiRow?.parentNode) kpiRow.parentNode.insertBefore(panel, kpiRow.nextSibling)
      else root.appendChild(panel)
    }
    const box = panel

    ensureHeaderButton(root, 'za-add-ue', '+ Tháng khách', async () => {
      const now = new Date()
      const defP = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const v = await openFormModal({
        title: 'Nhập dữ liệu khách hàng + MRR tháng',
        fields: [
          { name: 'period', label: 'Tháng (YYYY-MM)', required: true, value: defP },
          { name: 'active_customers', label: 'Khách đang hoạt động (cuối kỳ)', type: 'number', required: true },
          { name: 'new_customers', label: 'Khách mới trong kỳ', type: 'number' },
          { name: 'churned_customers', label: 'Khách rời bỏ trong kỳ', type: 'number' },
          { name: 'starting_mrr', label: 'MRR đầu kỳ', type: 'number' },
          { name: 'new_mrr', label: 'MRR từ khách mới', type: 'number' },
          { name: 'expansion_mrr', label: 'MRR mở rộng (upsell)', type: 'number' },
          { name: 'contraction_mrr', label: 'MRR giảm (downgrade)', type: 'number' },
          { name: 'churned_mrr', label: 'MRR mất (churn)', type: 'number' },
        ],
        submitLabel: 'Lưu tháng',
      })
      if (!v) return
      const res = await apiSend('/api/unit-economics', 'POST', {
        period: v.period,
        active_customers: num(v.active_customers) ?? 0, new_customers: num(v.new_customers) ?? 0,
        churned_customers: num(v.churned_customers) ?? 0, starting_mrr: num(v.starting_mrr) ?? 0,
        new_mrr: num(v.new_mrr) ?? 0, expansion_mrr: num(v.expansion_mrr) ?? 0,
        contraction_mrr: num(v.contraction_mrr) ?? 0, churned_mrr: num(v.churned_mrr) ?? 0,
      })
      if (res.ok) { toast('Đã lưu'); void refresh() } else toast(res.error ?? 'Lỗi lưu', 'err')
    })

    ensureHeaderButton(root, 'za-ue-derive', '📊 Tính & chấm chuẩn IPO', async () => {
      box.style.display = 'block'
      box.innerHTML = `<div style="color:var(--dim);padding:8px">Đang tính CAC · LTV · NRR · Rule of 40 · Burn Multiple… rồi so chuẩn ngành…</div>`
      const r = await apiSend('/api/unit-economics/derive', 'POST', {})
      if (!r.ok) { box.innerHTML = `<div style="color:var(--err,#e0685f);padding:8px">${escapeHtml(r.error ?? 'Lỗi tính')}</div>`; return }
      const d = r.data as {
        metrics: Record<string, number | string | null>
        benchmark: { stage: string; passed: number; measured: number; score_pct: number; items: Array<{ name: string; category: string; actual: number | null; status: string; target: string; note: string; fix_hint: string | null }> }
      }
      const m = d.metrics; const b = d.benchmark
      const fmtV = (x: number | string | null, suffix = '') => (x == null ? '—' : `${typeof x === 'number' ? (Math.abs(x) >= 10000 ? fmtMoney(x) : x) : x}${suffix}`)
      const cards = [
        ['CAC', fmtV(m.cac as number)], ['LTV', fmtV(m.ltv as number)],
        ['LTV:CAC', fmtV(m.ltv_cac_ratio as number, '×')], ['CAC Payback', fmtV(m.cac_payback_months as number, ' tháng')],
        ['NRR', fmtV(m.nrr_pct as number, '%')], ['GRR', fmtV(m.grr_pct as number, '%')],
        ['ARR', fmtV(m.arr as number)], ['Rule of 40', fmtV(m.rule_of_40 as number)],
        ['Burn Multiple', fmtV(m.burn_multiple as number, '×')], ['Magic Number', fmtV(m.magic_number as number, '×')],
        ['Quick Ratio', fmtV(m.quick_ratio as number, '×')], ['Logo churn', fmtV(m.logo_churn_pct as number, '%/th')],
      ]
      const statusIcon = (s: string) => (s === 'pass' ? '<span style="color:var(--ok,#4fc79a)">✓ ĐẠT</span>' : s === 'fail' ? '<span style="color:var(--err,#e0685f)">✕ CHƯA ĐẠT</span>' : '<span style="color:var(--dim)">— thiếu dữ liệu</span>')
      const scoreColor = b.score_pct >= 80 ? 'var(--ok,#4fc79a)' : b.score_pct >= 50 ? 'var(--gold,#e4c16e)' : 'var(--err,#e0685f)'
      box.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px">
          <strong>📊 Unit economics kỳ ${escapeHtml(String(m.period ?? ''))}</strong>
          <span>Chuẩn giai đoạn <strong>${escapeHtml(b.stage)}</strong>: <strong style="color:${scoreColor}">${b.passed}/${b.measured} đạt (${b.score_pct}%)</strong></span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin-bottom:12px">
          ${cards.map(([l, v2]) => `<div style="padding:8px;border:1px solid var(--line,#2a2a3f);border-radius:8px"><div style="font-size:.62rem;color:var(--dim);text-transform:uppercase">${l}</div><strong>${v2}</strong></div>`).join('')}
        </div>
        <div style="overflow-x:auto"><table class="tbl" style="width:100%"><thead><tr><th>Chỉ số</th><th>Thực tế</th><th>Chuẩn</th><th>Kết quả</th><th>Việc cần làm</th></tr></thead><tbody>
        ${b.items.map((it) => `<tr><td><strong>${escapeHtml(it.name)}</strong><br/><span style="font-size:.62rem;color:var(--dim)">${escapeHtml(it.note ?? '')}</span></td><td class="num">${it.actual ?? '—'}</td><td class="num">${escapeHtml(it.target ?? '')}</td><td>${statusIcon(it.status)}</td><td style="font-size:.76rem;color:var(--ink-2,#b3b2aa)">${escapeHtml(it.fix_hint ?? '')}</td></tr>`).join('')}
        </tbody></table></div>`
      toast(`Đã chấm: ${b.passed}/${b.measured} đạt chuẩn ${b.stage}`)
    })
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

  'page-legal': () => {
    const root = document.getElementById('page-legal')
    if (!root) return
    type Item = { id: string; item_type: string; title: string; authority?: string; reference_no?: string; expiry_date?: string; status: string }
    const TYPE_VI: Record<string, string> = {
      license: 'Giấy phép', contract: 'Hợp đồng', ip: 'Sở hữu trí tuệ', tax: 'Thuế',
      labor: 'Lao động', filing: 'Hồ sơ nộp', insurance: 'Bảo hiểm', policy: 'Quy chế', other: 'Khác',
    }
    const daysLeft = (d?: string) => (d ? Math.round((new Date(d).getTime() - Date.now()) / 86_400_000) : null)
    const render = (list: Item[]) => {
      const expiring = list.filter((i) => { const dl = daysLeft(i.expiry_date); return dl != null && dl >= 0 && dl <= 60 })
      const expired = list.filter((i) => { const dl = daysLeft(i.expiry_date); return dl != null && dl < 0 })
      patchKpiCards(root, [
        { value: String(list.length), label: 'Hồ sơ pháp lý' },
        { value: String(list.filter((i) => i.item_type === 'license' && i.status === 'active').length), label: 'Giấy phép hiệu lực' },
        { value: String(expiring.length), label: 'Sắp hết hạn 60 ngày', sub: expiring.length ? '⚠ cần gia hạn' : 'ổn' },
        { value: String(expired.length), label: 'Đã hết hạn', sub: expired.length ? '🚨 rủi ro DD' : 'sạch' },
      ])
      const rows = list.slice(0, 50).map((i) => {
        const dl = daysLeft(i.expiry_date)
        const cls = dl == null ? 'dim' : dl < 0 ? 'err' : dl <= 60 ? 'warn' : 'ok'
        const dlTxt = dl == null ? '—' : dl < 0 ? `hết hạn ${-dl} ngày` : `còn ${dl} ngày`
        return `<tr><td><strong>${escapeHtml(i.title)}</strong>${i.reference_no ? `<br/><span class="mono" style="font-size:.6rem;color:var(--dim)">${escapeHtml(i.reference_no)}</span>` : ''}<button data-del="${i.id}" title="Xoá" style="float:right;background:none;border:0;color:var(--dim);cursor:pointer;font-size:.8rem">✕</button></td><td>${escapeHtml(TYPE_VI[i.item_type] ?? i.item_type)}</td><td>${escapeHtml(i.authority ?? '—')}</td><td>${i.expiry_date ? fmtDate(i.expiry_date) : '—'}</td><td><span class="st ${cls}">${dlTxt}</span></td></tr>`
      })
      patchTable(root, '.card', rows, 'Sổ pháp lý trống. Thêm giấy phép/hợp đồng/IP — DD pháp lý soi đúng bảng này.', 5)
      wireEach(root, 'button[data-del]', async (el) => {
        const id = el.getAttribute('data-del')
        if (!id || !window.confirm('Xoá hồ sơ này?')) return
        const r = await apiSend(`/api/compliance/${id}`, 'DELETE')
        if (r.ok) { toast('Đã xoá'); void refresh() } else toast(r.error ?? 'Lỗi xoá', 'err')
      })
    }
    const refresh = async () => { const r = await apiSend('/api/compliance', 'GET'); if (r.ok) render((r.data as Item[]) ?? []) }
    void refresh()
    ensureHeaderButton(root, 'za-add-comp', '+ Hồ sơ pháp lý', async () => {
      const v = await openFormModal({
        title: 'Thêm hồ sơ tuân thủ',
        fields: [
          { name: 'title', label: 'Tên hồ sơ', required: true, placeholder: 'GPKD / Hợp đồng thuê / Nhãn hiệu…' },
          { name: 'item_type', label: 'Loại', type: 'select', required: true, options: Object.entries(TYPE_VI).map(([v2, l]) => ({ value: v2, label: l })) },
          { name: 'authority', label: 'Cơ quan cấp / đối tác' },
          { name: 'reference_no', label: 'Số hiệu' },
          { name: 'issued_date', label: 'Ngày cấp (YYYY-MM-DD)' },
          { name: 'expiry_date', label: 'Ngày hết hạn (YYYY-MM-DD)' },
          { name: 'notes', label: 'Ghi chú', type: 'textarea' },
        ],
        submitLabel: 'Thêm',
      })
      if (!v) return
      const res = await apiSend('/api/compliance', 'POST', {
        title: v.title, item_type: v.item_type, authority: v.authority || undefined,
        reference_no: v.reference_no || undefined, issued_date: v.issued_date || undefined,
        expiry_date: v.expiry_date || undefined, notes: v.notes || undefined,
      })
      if (res.ok) { toast('Đã thêm hồ sơ'); void refresh() } else toast(res.error ?? 'Lỗi thêm', 'err')
    })
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
    // Card 1: Nghị quyết HĐQT — dữ liệu thật từ board_resolutions.
    const TYPE_VI: Record<string, string> = {
      funding: 'Gọi vốn', esop: 'ESOP', appointment: 'Bổ nhiệm', budget: 'Ngân sách',
      m_and_a: 'M&A', policy: 'Quy chế', audit: 'Kiểm toán', ipo: 'IPO', other: 'Khác',
    }
    type Res = { id: string; resolution_no?: string; title: string; meeting_date: string; resolution_type: string; status: string; votes_for?: number; votes_against?: number }
    const renderRes = (list: Res[]) => {
      const tbody = cards[1]?.querySelector<HTMLTableSectionElement>('table.tbl tbody')
      if (!tbody) return
      const kpiSub = root.querySelectorAll<HTMLElement>('.kpi-row .kpi-card .kpi-v')
      if (kpiSub[2]) kpiSub[2].textContent = String(list.length)
      if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--dim);padding:18px;font-style:italic">Chưa có nghị quyết. Mọi quyết định lớn cần nghị quyết ký — thiếu là mất điểm governance khi DD/IPO.</td></tr>`
        return
      }
      tbody.innerHTML = list.slice(0, 30).map((r) => {
        const cls = r.status === 'approved' || r.status === 'executed' ? 'ok' : r.status === 'rejected' ? 'err' : 'warn'
        return `<tr><td><strong>${escapeHtml(r.title)}</strong>${r.resolution_no ? `<br/><span class="mono" style="font-size:.6rem;color:var(--dim)">${escapeHtml(r.resolution_no)}</span>` : ''}<button data-delres="${r.id}" title="Xoá" style="float:right;background:none;border:0;color:var(--dim);cursor:pointer;font-size:.8rem">✕</button></td><td>${escapeHtml(TYPE_VI[r.resolution_type] ?? r.resolution_type)}</td><td>${fmtDate(r.meeting_date)}</td><td><span class="st ${cls}">${escapeHtml(r.status)}</span>${(r.votes_for ?? 0) + (r.votes_against ?? 0) > 0 ? `<br/><span style="font-size:.6rem;color:var(--dim)">${r.votes_for ?? 0} thuận / ${r.votes_against ?? 0} chống</span>` : ''}</td></tr>`
      }).join('')
      wireEach(root, 'button[data-delres]', async (el) => {
        const id = el.getAttribute('data-delres')
        if (!id || !window.confirm('Xoá nghị quyết này?')) return
        const r = await apiSend(`/api/board/resolutions/${id}`, 'DELETE')
        if (r.ok) { toast('Đã xoá'); void refreshRes() } else toast(r.error ?? 'Lỗi xoá', 'err')
      })
    }
    const refreshRes = async () => { const r = await apiSend('/api/board/resolutions', 'GET'); if (r.ok) renderRes((r.data as Res[]) ?? []) }
    void refreshRes()
    ensureHeaderButton(root, 'za-add-res', '+ Nghị quyết', async () => {
      const today = new Date().toISOString().slice(0, 10)
      const v = await openFormModal({
        title: 'Tạo nghị quyết HĐQT',
        fields: [
          { name: 'title', label: 'Tiêu đề nghị quyết', required: true },
          { name: 'resolution_no', label: 'Số hiệu', placeholder: 'NQ-01/2026/HĐQT' },
          { name: 'resolution_type', label: 'Loại', type: 'select', options: Object.entries(TYPE_VI).map(([v2, l]) => ({ value: v2, label: l })) },
          { name: 'meeting_date', label: 'Ngày họp (YYYY-MM-DD)', value: today },
          { name: 'status', label: 'Trạng thái', type: 'select', options: [['draft', 'Nháp'], ['voted', 'Đã biểu quyết'], ['approved', 'Thông qua'], ['rejected', 'Bác bỏ'], ['executed', 'Đã thực thi']].map(([v2, l]) => ({ value: v2, label: l })) },
          { name: 'votes_for', label: 'Phiếu thuận', type: 'number' },
          { name: 'votes_against', label: 'Phiếu chống', type: 'number' },
          { name: 'body', label: 'Nội dung', type: 'textarea' },
        ],
        submitLabel: 'Tạo nghị quyết',
      })
      if (!v) return
      const res = await apiSend('/api/board/resolutions', 'POST', {
        title: v.title, resolution_no: v.resolution_no || undefined,
        resolution_type: v.resolution_type || 'other', meeting_date: v.meeting_date || undefined,
        status: v.status || 'draft', votes_for: num(v.votes_for), votes_against: num(v.votes_against),
        body: v.body || undefined,
      })
      if (res.ok) { toast('Đã tạo nghị quyết'); void refreshRes() } else toast(res.error ?? 'Lỗi tạo', 'err')
    })
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
      typeof j?.valuation_target === 'number' ? { value: fmtMoney(j.valuation_target), label: 'Định giá mục tiêu' } : { value: '—', label: 'Định giá mục tiêu' },
      j?.current_phase ? { value: `Phase ${j.current_phase}`, label: 'Giai đoạn' } : { value: '—', label: 'Giai đoạn' },
      { value: String(d?.cap_history?.length ?? 0), label: 'Cap snapshots' },
      { value: String(d?.comparables?.length ?? 0), label: 'Peer companies' },
    ])

    let panel = root.querySelector<HTMLElement>('#val-panel')
    if (!panel) {
      panel = document.createElement('div')
      panel.id = 'val-panel'
      panel.style.cssText = 'margin:14px 0;padding:14px;border:1px solid var(--line,#2a2a3f);border-radius:12px;background:var(--panel,rgba(255,255,255,.02));display:none'
      const kpiRow = root.querySelector('.kpi-row')
      if (kpiRow?.parentNode) kpiRow.parentNode.insertBefore(panel, kpiRow.nextSibling)
      else root.appendChild(panel)
    }
    const box = panel
    const show = (html: string) => { box.style.display = 'block'; box.innerHTML = html }
    const money = (x: unknown) => (typeof x === 'number' ? fmtMoney(x) : '—')

    const runVal = async (payload: Record<string, unknown>, title: string) => {
      show(`<div style="color:var(--dim);padding:8px">Đang định giá theo ${escapeHtml(title)}…</div>`)
      const r = await apiSend('/api/valuation/run', 'POST', payload)
      if (!r.ok) { show(`<div style="color:var(--err,#e0685f);padding:8px">${escapeHtml(r.error ?? 'Lỗi định giá')}</div>`); return }
      const v = r.data as Record<string, unknown>
      const ttm = v.ttm as { revenue?: number; ebitda?: number } | undefined
      let detail = ''
      if (v.method === 'comparables') {
        const mu = v.multiples_used as { ev_revenue?: number | null; ev_ebitda?: number | null; pe?: number | null }
        detail = `<div style="font-size:.8rem;color:var(--ink-2,#b3b2aa);margin-top:8px">Bội số trung vị từ ${String(v.peer_count)} peer — EV/Rev <strong>${mu?.ev_revenue ?? '—'}×</strong> · EV/EBITDA <strong>${mu?.ev_ebitda ?? '—'}×</strong> · P/E <strong>${mu?.pe ?? '—'}</strong><br/>Đã trừ chiết khấu thanh khoản công ty tư nhân ${String(v.illiquidity_discount_pct)}%.</div>`
      } else if (v.method === 'dcf') {
        const a = v.assumptions as Record<string, number>
        detail = `<div style="font-size:.8rem;color:var(--ink-2,#b3b2aa);margin-top:8px">WACC ${a.wacc_pct}% · tăng trưởng ${a.growth_rate_pct}%/năm · ${a.years} năm · g vĩnh viễn ${a.terminal_growth_pct}%<br/>PV giai đoạn dự báo ${money(v.pv_explicit)} + PV giá trị cuối ${money(v.pv_terminal)} (<strong>${String(v.terminal_pct_of_ev)}%</strong> giá trị nằm ở terminal — càng cao càng rủi ro giả định).</div>`
      } else {
        detail = `<div style="font-size:.8rem;color:var(--ink-2,#b3b2aa);margin-top:8px">Giá trị thoái vốn ${money(v.exit_value)} → chiết khấu về hôm nay.<br/>Nhà đầu tư cần <strong>${String(v.ownership_required_pct)}%</strong> (sau pha loãng dự kiến: <strong>${String(v.ownership_adjusted_for_dilution_pct)}%</strong>).</div>`
      }
      show(`<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
          <strong>💰 Kết quả định giá — ${escapeHtml(title)}</strong>
          ${ttm?.revenue ? `<span style="font-size:.75rem;color:var(--dim)">TTM doanh thu ${money(ttm.revenue)} · EBITDA ${money(ttm.ebitda)}</span>` : ''}
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-top:10px">
          <div style="padding:10px;border:1px solid var(--gold,#e4c16e);border-radius:8px"><div style="font-size:.65rem;color:var(--dim);text-transform:uppercase">Enterprise Value</div><strong style="font-size:1.1rem">${money(v.enterprise_value)}</strong></div>
          <div style="padding:10px;border:1px solid var(--line,#2a2a3f);border-radius:8px"><div style="font-size:.65rem;color:var(--dim);text-transform:uppercase">Equity Value</div><strong style="font-size:1.1rem">${money(v.equity_value)}</strong></div>
        </div>${detail}
        <div style="font-size:.7rem;color:var(--dim);margin-top:10px">Đã lưu vào lịch sử định giá (audit trail cho due-diligence).</div>`)
      toast('Định giá xong')
    }

    ensureHeaderButton(root, 'za-val-comp', '📈 Định giá theo Comparables', async () => {
      const v = await openFormModal({
        title: 'Định giá theo bội số thị trường (Comparables)',
        fields: [
          { name: 'net_debt', label: 'Nợ ròng (nợ − tiền), để 0 nếu không có', type: 'number', value: '0' },
          { name: 'illiquidity_discount_pct', label: 'Chiết khấu thanh khoản %', type: 'number', value: '25' },
        ],
        submitLabel: 'Định giá',
      })
      if (!v) return
      await runVal({ method: 'comparables', net_debt: num(v.net_debt) ?? 0, illiquidity_discount_pct: num(v.illiquidity_discount_pct) ?? 25 }, 'Comparables (bội số peer)')
    })

    ensureHeaderButton(root, 'za-val-dcf', '🧮 Định giá DCF', async () => {
      const v = await openFormModal({
        title: 'Chiết khấu dòng tiền (DCF)',
        fields: [
          { name: 'fcf_year1', label: 'FCF năm 1 (bỏ trống = tự ước từ P&L)', type: 'number' },
          { name: 'growth_rate_pct', label: 'Tăng trưởng FCF %/năm', type: 'number', value: '20', required: true },
          { name: 'years', label: 'Số năm dự báo', type: 'number', value: '5', required: true },
          { name: 'wacc_pct', label: 'WACC % (chi phí vốn bình quân)', type: 'number', value: '18', required: true },
          { name: 'terminal_growth_pct', label: 'Tăng trưởng vĩnh viễn %', type: 'number', value: '3', required: true },
          { name: 'net_debt', label: 'Nợ ròng', type: 'number', value: '0' },
        ],
        submitLabel: 'Chạy DCF',
      })
      if (!v) return
      await runVal({
        method: 'dcf', fcf_year1: num(v.fcf_year1), growth_rate_pct: num(v.growth_rate_pct) ?? 20,
        years: num(v.years) ?? 5, wacc_pct: num(v.wacc_pct) ?? 18,
        terminal_growth_pct: num(v.terminal_growth_pct) ?? 3, net_debt: num(v.net_debt) ?? 0,
      }, 'DCF (chiết khấu dòng tiền)')
    })

    ensureHeaderButton(root, 'za-val-vc', '🦄 VC Method', async () => {
      const v = await openFormModal({
        title: 'VC Method — định giá theo kỳ vọng thoái vốn',
        fields: [
          { name: 'exit_revenue', label: 'Doanh thu năm thoái vốn', type: 'number', required: true },
          { name: 'exit_multiple', label: 'Bội số khi thoái (EV/Rev)', type: 'number', value: '5', required: true },
          { name: 'years_to_exit', label: 'Số năm tới khi thoái', type: 'number', value: '5', required: true },
          { name: 'target_irr_pct', label: 'IRR mục tiêu của quỹ %', type: 'number', value: '40', required: true },
          { name: 'investment_usd', label: 'Số tiền đầu tư vòng này', type: 'number', required: true },
          { name: 'future_dilution_pct', label: 'Pha loãng vòng sau %', type: 'number', value: '25' },
        ],
        submitLabel: 'Tính',
      })
      if (!v) return
      await runVal({
        method: 'vc_method', exit_revenue: num(v.exit_revenue) ?? 0, exit_multiple: num(v.exit_multiple) ?? 5,
        years_to_exit: num(v.years_to_exit) ?? 5, target_irr_pct: num(v.target_irr_pct) ?? 40,
        investment_usd: num(v.investment_usd) ?? 0, future_dilution_pct: num(v.future_dilution_pct) ?? 25,
      }, 'VC Method')
    })
  },

  'page-token': (raw) => {
    const root = document.getElementById('page-token')
    if (!root) return
    type Alloc = { id: string; token_symbol: string; pool_name: string; allocation_pct: number; vested_amount?: number; total_supply?: number; vesting_cliff_months?: number; vesting_duration_months?: number; blockchain?: string }
    const render = (list: Alloc[]) => {
      const totalPct = list.reduce((a, t) => a + Number(t.allocation_pct), 0)
      patchKpiCards(root, [
        { value: String(list.length), label: 'Pools' },
        { value: `${totalPct.toFixed(1)}<em>%</em>`, label: 'Allocated', sub: totalPct > 100 ? '⚠ vượt 100%' : `còn ${(100 - totalPct).toFixed(1)}%` },
        { value: list[0] ? escapeHtml(list[0].token_symbol) : '—', label: 'Token' },
        { value: list[0]?.total_supply ? fmtNum(list[0].total_supply) : '—', label: 'Total supply' },
      ])
      const rows = list.slice(0, 30).map((t) => `<tr><td><strong>${escapeHtml(t.pool_name)}</strong><button data-del="${t.id}" title="Xoá" style="float:right;background:none;border:0;color:var(--dim);cursor:pointer;font-size:.8rem">✕</button></td><td>${escapeHtml(t.token_symbol)}</td><td class="num">${Number(t.allocation_pct).toFixed(1)}%</td><td class="num">${t.vesting_cliff_months ?? 0}m cliff · ${t.vesting_duration_months ?? 0}m</td><td>${escapeHtml(t.blockchain ?? '—')}</td></tr>`)
      patchTable(root, '.card', rows, 'Chưa có pool. Bấm "+ Pool" để thêm phân bổ tokenomics.', 5)
      wireEach(root, 'button[data-del]', async (el) => {
        const id = el.getAttribute('data-del')
        if (!id || !window.confirm('Xoá pool này?')) return
        const r = await apiSend(`/api/tokenomics/${id}`, 'DELETE')
        if (r.ok) { toast('Đã xoá'); void refresh() } else toast(r.error ?? 'Lỗi xoá', 'err')
      })
    }
    const refresh = async () => { const r = await apiSend('/api/tokenomics', 'GET'); if (r.ok) render((r.data as Alloc[]) ?? []) }
    render(((raw as { data?: Alloc[] })?.data) ?? [])
    ensureHeaderButton(root, 'za-add-pool', '+ Pool', async () => {
      const v = await openFormModal({
        title: 'Thêm pool tokenomics',
        fields: [
          { name: 'token_symbol', label: 'Token symbol', required: true, placeholder: 'ZENI' },
          { name: 'pool_name', label: 'Tên pool', required: true, placeholder: 'Team / Investors / Ecosystem…' },
          { name: 'allocation_pct', label: 'Phân bổ %', type: 'number', required: true, step: '0.1' },
          { name: 'total_supply', label: 'Total supply', type: 'number' },
          { name: 'vesting_cliff_months', label: 'Cliff (tháng)', type: 'number' },
          { name: 'vesting_duration_months', label: 'Vesting (tháng)', type: 'number' },
          { name: 'blockchain', label: 'Blockchain', placeholder: 'polygon' },
        ],
        submitLabel: 'Thêm pool',
      })
      if (!v) return
      const res = await apiSend('/api/tokenomics', 'POST', {
        token_symbol: v.token_symbol, pool_name: v.pool_name,
        allocation_pct: num(v.allocation_pct) ?? 0, total_supply: num(v.total_supply),
        vesting_cliff_months: num(v.vesting_cliff_months), vesting_duration_months: num(v.vesting_duration_months),
        blockchain: v.blockchain || undefined,
      })
      if (res.ok) { toast('Đã thêm pool'); void refresh() } else toast(res.error ?? 'Lỗi thêm', 'err')
    })
  },

  'page-comparables': (raw) => {
    const root = document.getElementById('page-comparables')
    if (!root) return
    type Comp = { id: string; company_name: string; ticker?: string; ev_revenue_multiple?: number; ev_ebitda_multiple?: number; pe_ratio?: number; growth_rate_pct?: number }
    const render = (list: Comp[]) => {
      const avgEvRev = list.length ? list.reduce((a, c) => a + (c.ev_revenue_multiple ?? 0), 0) / list.length : 0
      patchKpiCards(root, [
        { value: String(list.length), label: 'Comp companies' },
        { value: avgEvRev ? `${avgEvRev.toFixed(1)}×` : '—', label: 'Avg EV/Rev' },
        { value: '—', label: 'Median P/E' },
        { value: '—', label: 'Industry' },
      ])
      const rows = list.slice(0, 50).map((c) => `<tr><td><strong>${escapeHtml(c.company_name)}</strong>${c.ticker ? `<br/><span class="mono" style="font-size:.6rem;color:var(--dim)">${escapeHtml(c.ticker)}</span>` : ''}<button data-del="${c.id}" title="Xoá" style="float:right;background:none;border:0;color:var(--dim);cursor:pointer;font-size:.8rem">✕</button></td><td class="num">${c.ev_revenue_multiple?.toFixed(1) ?? '—'}×</td><td class="num">${c.ev_ebitda_multiple?.toFixed(1) ?? '—'}×</td><td class="num">${c.pe_ratio?.toFixed(1) ?? '—'}</td><td class="num">${c.growth_rate_pct?.toFixed(1) ?? '—'}%</td></tr>`)
      patchTable(root, '.card', rows, 'Chưa có comp. Bấm "+ Add peer" để thêm peer company.', 5)
      wireEach(root, 'button[data-del]', async (el) => {
        const id = el.getAttribute('data-del')
        if (!id || !window.confirm('Xoá peer này?')) return
        const r = await apiSend(`/api/comparables/${id}`, 'DELETE')
        if (r.ok) { toast('Đã xoá'); void refresh() } else toast(r.error ?? 'Lỗi xoá', 'err')
      })
    }
    const refresh = async () => { const r = await apiSend('/api/comparables', 'GET'); if (r.ok) render((r.data as Comp[]) ?? []) }
    render(((raw as { data?: Comp[] })?.data) ?? [])
    wireButtonByText(root, 'peer', async () => {
      const fields: Field[] = [
        { name: 'company_name', label: 'Tên công ty', required: true },
        { name: 'ticker', label: 'Mã (ticker)' },
        { name: 'exchange', label: 'Sàn' },
        { name: 'ev_revenue_multiple', label: 'EV/Revenue (×)', type: 'number' },
        { name: 'ev_ebitda_multiple', label: 'EV/EBITDA (×)', type: 'number' },
        { name: 'pe_ratio', label: 'P/E', type: 'number' },
        { name: 'growth_rate_pct', label: 'Growth %', type: 'number' },
      ]
      const v = await openFormModal({ title: 'Thêm peer company', fields, submitLabel: 'Thêm' })
      if (!v) return
      const res = await apiSend('/api/comparables', 'POST', {
        company_name: v.company_name, ticker: v.ticker || undefined, exchange: v.exchange || undefined,
        ev_revenue_multiple: num(v.ev_revenue_multiple), ev_ebitda_multiple: num(v.ev_ebitda_multiple),
        pe_ratio: num(v.pe_ratio), growth_rate_pct: num(v.growth_rate_pct),
      })
      if (res.ok) { toast('Đã thêm peer'); void refresh() } else toast(res.error ?? 'Lỗi thêm', 'err')
    })
  },

  'page-mktdata': (raw) => {
    const root = document.getElementById('page-mktdata')
    if (!root) return
    type Md = { id: string; metric_type: string; region?: string; segment?: string; value_numeric?: number; value_unit?: string; confidence?: string; source?: string }
    const render = (list: Md[]) => {
      const pick = (t: string) => list.find((m) => m.metric_type === t)
      const tam = pick('tam'); const sam = pick('sam'); const som = pick('som'); const growth = pick('growth_rate')
      patchKpiCards(root, [
        tam?.value_numeric ? { value: fmtMoney(tam.value_numeric), label: 'TAM' } : { value: '—', label: 'TAM' },
        sam?.value_numeric ? { value: fmtMoney(sam.value_numeric), label: 'SAM' } : { value: '—', label: 'SAM' },
        som?.value_numeric ? { value: fmtMoney(som.value_numeric), label: 'SOM' } : { value: '—', label: 'SOM' },
        growth?.value_numeric ? { value: `${growth.value_numeric}<em>%</em>`, label: 'Growth' } : { value: '—', label: 'Growth' },
      ])
      const rows = list.slice(0, 40).map((m) => `<tr><td><strong>${escapeHtml(m.metric_type.toUpperCase())}</strong><button data-del="${m.id}" title="Xoá" style="float:right;background:none;border:0;color:var(--dim);cursor:pointer;font-size:.8rem">✕</button></td><td>${escapeHtml(m.region ?? '—')}${m.segment ? ` · ${escapeHtml(m.segment)}` : ''}</td><td class="num">${m.value_numeric != null ? fmtNum(m.value_numeric) : '—'} ${escapeHtml(m.value_unit ?? '')}</td><td>${escapeHtml(m.source ?? '—')}</td><td><span class="st ${m.confidence === 'verified' || m.confidence === 'high' ? 'ok' : 'dim'}">${escapeHtml(m.confidence ?? '—')}</span></td></tr>`)
      patchTable(root, '.card', rows, 'Chưa có dữ liệu thị trường. Bấm "+ Metric" để thêm TAM/SAM/SOM.', 5)
      wireEach(root, 'button[data-del]', async (el) => {
        const id = el.getAttribute('data-del')
        if (!id || !window.confirm('Xoá metric này?')) return
        const r = await apiSend(`/api/market-data/${id}`, 'DELETE')
        if (r.ok) { toast('Đã xoá'); void refresh() } else toast(r.error ?? 'Lỗi xoá', 'err')
      })
    }
    const refresh = async () => { const r = await apiSend('/api/market-data', 'GET'); if (r.ok) render((r.data as Md[]) ?? []) }
    render(((raw as { data?: Md[] })?.data) ?? [])
    ensureHeaderButton(root, 'za-add-mktdata', '+ Metric', async () => {
      const v = await openFormModal({
        title: 'Thêm market metric',
        fields: [
          { name: 'metric_type', label: 'Loại', type: 'select', required: true, options: ['tam','sam','som','growth_rate','penetration','share','competitor_count','arpu','market_size'].map((x) => ({ value: x, label: x.toUpperCase() })) },
          { name: 'value_numeric', label: 'Giá trị', type: 'number', required: true },
          { name: 'value_unit', label: 'Đơn vị', placeholder: 'USD / % / count' },
          { name: 'region', label: 'Vùng', placeholder: 'VN / SEA / Global' },
          { name: 'segment', label: 'Phân khúc' },
          { name: 'source', label: 'Nguồn' },
          { name: 'confidence', label: 'Độ tin cậy', type: 'select', options: ['low','medium','high','verified'].map((x) => ({ value: x, label: x })) },
        ],
        submitLabel: 'Thêm',
      })
      if (!v) return
      const res = await apiSend('/api/market-data', 'POST', {
        metric_type: v.metric_type, value_numeric: num(v.value_numeric), value_unit: v.value_unit || undefined,
        region: v.region || undefined, segment: v.segment || undefined, source: v.source || undefined,
        confidence: v.confidence || undefined,
      })
      if (res.ok) { toast('Đã thêm metric'); void refresh() } else toast(res.error ?? 'Lỗi thêm', 'err')
    })
  },

  'page-mktintel': (raw) => {
    const root = document.getElementById('page-mktintel')
    if (!root) return
    type Intel = { id: string; category: string; severity?: string; title: string; related_competitor?: string; region?: string; created_at: string }
    const render = (list: Intel[]) => {
      patchKpiCards(root, [
        { value: String(list.length), label: 'Signals' },
        { value: String(list.filter((i) => i.severity === 'critical' || i.severity === 'alert').length), label: 'Alerts' },
        { value: String(new Set(list.map((i) => i.category)).size), label: 'Categories' },
        { value: list[0] ? fmtDate(list[0].created_at) : '—', label: 'Latest' },
      ])
      const sevCls = (s?: string) => (s === 'critical' ? 'err' : s === 'alert' ? 'warn' : 'dim')
      const rows = list.slice(0, 40).map((i) => `<tr><td><strong>${escapeHtml(i.title)}</strong><button data-del="${i.id}" title="Xoá" style="float:right;background:none;border:0;color:var(--dim);cursor:pointer;font-size:.8rem">✕</button></td><td>${escapeHtml(i.category)}</td><td><span class="st ${sevCls(i.severity)}">${escapeHtml(i.severity ?? 'info')}</span></td><td>${escapeHtml(i.related_competitor ?? i.region ?? '—')}</td><td>${fmtDate(i.created_at)}</td></tr>`)
      patchTable(root, '.card', rows, 'Chưa có tín hiệu thị trường. Bấm "+ Signal" để ghi nhận.', 5)
      wireEach(root, 'button[data-del]', async (el) => {
        const id = el.getAttribute('data-del')
        if (!id || !window.confirm('Xoá tín hiệu này?')) return
        const r = await apiSend(`/api/market-intel/${id}`, 'DELETE')
        if (r.ok) { toast('Đã xoá'); void refresh() } else toast(r.error ?? 'Lỗi xoá', 'err')
      })
    }
    const refresh = async () => { const r = await apiSend('/api/market-intel', 'GET'); if (r.ok) render((r.data as Intel[]) ?? []) }
    render(((raw as { data?: Intel[] })?.data) ?? [])
    ensureHeaderButton(root, 'za-add-intel', '+ Signal', async () => {
      const v = await openFormModal({
        title: 'Ghi nhận tín hiệu thị trường',
        fields: [
          { name: 'title', label: 'Tiêu đề', required: true },
          { name: 'category', label: 'Loại', type: 'select', required: true, options: ['competitor','regulation','market_shift','customer_signal','tech_trend','m_and_a','funding_round','exit'].map((x) => ({ value: x, label: x })) },
          { name: 'severity', label: 'Mức độ', type: 'select', options: ['info','watch','alert','critical'].map((x) => ({ value: x, label: x })) },
          { name: 'related_competitor', label: 'Đối thủ liên quan' },
          { name: 'region', label: 'Vùng' },
          { name: 'body', label: 'Chi tiết', type: 'textarea' },
          { name: 'source_url', label: 'Link nguồn' },
        ],
        submitLabel: 'Ghi nhận',
      })
      if (!v) return
      const res = await apiSend('/api/market-intel', 'POST', {
        title: v.title, category: v.category, severity: v.severity || undefined,
        related_competitor: v.related_competitor || undefined, region: v.region || undefined,
        body: v.body || undefined, source_url: v.source_url || undefined,
      })
      if (res.ok) { toast('Đã ghi nhận'); void refresh() } else toast(res.error ?? 'Lỗi', 'err')
    })
  },

  'page-nlq': (raw) => {
    const root = document.getElementById('page-nlq')
    if (!root) return
    // history KPI cards (no-op if the page has no .kpi-row)
    const list = ((raw as { data?: Array<{ id: string; query_text: string; status?: string; duration_ms?: number; created_at: string }> })?.data) ?? []
    const success = list.filter((q) => q.status === 'success').length
    const avgMs = list.length ? Math.round(list.reduce((a, q) => a + (q.duration_ms ?? 0), 0) / list.length) : 0
    patchKpiCards(root, [
      { value: String(list.length), label: 'Queries' },
      { value: `${list.length ? Math.round((success / list.length) * 100) : 0}<em>%</em>`, label: 'Success' },
      { value: `${avgMs}<em>ms</em>`, label: 'Avg latency' },
      { value: list[0] ? fmtDate(list[0].created_at) : '—', label: 'Latest' },
    ])

    // Wire the "ASK ANYTHING" input + suggestion buttons → real /api/nlq.
    const input = root.querySelector<HTMLInputElement>('input[type="text"]')
    const cardB = input?.closest('.card-b') ?? root.querySelector('.card-b') ?? root
    let resultBox = cardB.querySelector<HTMLElement>('#nlqResult')
    if (!resultBox) {
      resultBox = document.createElement('div')
      resultBox.id = 'nlqResult'
      resultBox.style.marginTop = '16px'
      cardB.appendChild(resultBox)
    }
    const box = resultBox
    const ask = async (qText: string) => {
      const q = qText.trim()
      if (!q) return
      box.innerHTML = `<div style="padding:14px;color:var(--dim)">Đang hỏi AI…</div>`
      const r = await apiSend('/api/nlq', 'POST', { query_text: q })
      if (!r.ok) { box.innerHTML = `<div style="padding:14px;color:var(--err)">${escapeHtml(r.error ?? 'Lỗi truy vấn')}</div>`; return }
      const d = r.data as { rows?: Array<Record<string, unknown>>; summary?: string; intent?: { intent_summary?: string }; meta?: { model?: string; duration_ms?: number } }
      const rows = d.rows ?? []
      const cols = rows.length ? Object.keys(rows[0]) : []
      const head = cols.map((c) => `<th>${escapeHtml(c)}</th>`).join('')
      const tbody = rows.slice(0, 50).map((row) => `<tr>${cols.map((c) => `<td>${escapeHtml(String(row[c] ?? ''))}</td>`).join('')}</tr>`).join('')
      box.innerHTML = `<div style="padding:14px;background:rgba(255,255,255,.05);border-radius:6px">
        <div class="mono" style="font-size:.62rem;color:var(--gold-b);letter-spacing:.1em;margin-bottom:6px">AI · ${escapeHtml(d.meta?.model ?? '')} · ${d.meta?.duration_ms ?? 0}ms</div>
        <div style="font-size:.86rem;margin-bottom:10px">${escapeHtml(d.intent?.intent_summary || d.summary || '')}</div>
        ${rows.length ? `<div style="overflow-x:auto"><table class="tbl"><thead><tr>${head}</tr></thead><tbody>${tbody}</tbody></table></div>` : '<div style="color:var(--dim)">Không có dòng dữ liệu.</div>'}</div>`
    }
    if (input && input.dataset.zaWired !== '1') {
      input.dataset.zaWired = '1'
      input.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter') { e.preventDefault(); void ask(input.value) } })
    }
    wireEach(cardB, '.btn.gh.sm', async (el) => { const t = el.textContent ?? ''; if (input) input.value = t; void ask(t) })
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
    type Fb = { id: string; category: string; status: string; severity: string; title: string; created_at?: string }
    const render = (list: Fb[]) => {
      patchKpiCards(root, [
        { value: String(list.length), label: 'Total feedback' },
        { value: String(list.filter((f) => f.status === 'open').length), label: 'Open' },
        { value: String(list.filter((f) => f.status === 'resolved').length), label: 'Resolved' },
        { value: String(list.filter((f) => f.severity === 'critical' || f.severity === 'high').length), label: 'High priority' },
      ])
      const sevCls = (s: string) => (s === 'critical' ? 'err' : s === 'high' ? 'warn' : 'dim')
      const rows = list.slice(0, 40).map((f) => `<tr><td><strong>${escapeHtml(f.title)}</strong><button data-del="${f.id}" title="Xoá" style="float:right;background:none;border:0;color:var(--dim);cursor:pointer;font-size:.8rem">✕</button></td><td>${escapeHtml(f.category)}</td><td><span class="st ${sevCls(f.severity)}">${escapeHtml(f.severity)}</span></td><td><span class="st ${f.status === 'resolved' ? 'ok' : 'info'}">${escapeHtml(f.status)}</span></td><td>${f.created_at ? fmtDate(f.created_at) : '—'}</td></tr>`)
      patchTable(root, '.card', rows, 'Chưa có feedback. Bấm "+ Feedback" để gửi góp ý đầu tiên.', 5)
      wireEach(root, 'button[data-del]', async (el) => {
        const id = el.getAttribute('data-del')
        if (!id || !window.confirm('Xoá feedback này?')) return
        const r = await apiSend(`/api/feedback/${id}`, 'DELETE')
        if (r.ok) { toast('Đã xoá'); void refresh() } else toast(r.error ?? 'Lỗi xoá', 'err')
      })
    }
    const refresh = async () => { const r = await apiSend('/api/feedback', 'GET'); if (r.ok) render((r.data as Fb[]) ?? []) }
    render(((raw as { data?: Fb[] })?.data) ?? [])
    ensureHeaderButton(root, 'za-add-fb', '+ Feedback', async () => {
      const v = await openFormModal({
        title: 'Gửi feedback',
        fields: [
          { name: 'title', label: 'Tiêu đề', required: true },
          { name: 'category', label: 'Loại', type: 'select', options: ['bug','feature_request','ux','data_quality','performance','other'].map((x) => ({ value: x, label: x })) },
          { name: 'severity', label: 'Mức độ', type: 'select', options: ['low','medium','high','critical'].map((x) => ({ value: x, label: x })) },
          { name: 'body', label: 'Chi tiết', type: 'textarea' },
        ],
        submitLabel: 'Gửi',
      })
      if (!v) return
      const res = await apiSend('/api/feedback', 'POST', {
        title: v.title, category: v.category || 'other', severity: v.severity || 'medium', body: v.body || undefined,
      })
      if (res.ok) { toast('Đã gửi feedback'); void refresh() } else toast(res.error ?? 'Lỗi gửi', 'err')
    })
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
