'use client'

import { useEffect, useState, useCallback } from 'react'

type Deliverable = { code: string; label?: string; entity?: string }
type Level = {
  level: number
  chakra: string
  name_vi: string
  name_en: string
  subtitle: string
  phase_range: string
  module_count: number
  color: string
  pass_mark: number
  pass_total: number
  agents: string[]
  required_deliverables: Deliverable[]
  state: 'locked' | 'learning' | 'assessed' | 'applying' | 'validated' | 'unlocked'
  assessment_score: number | null
  deliverables_done: Deliverable[]
  certified_at: string | null
  unlocked_at: string | null
}

const STATE_LABEL: Record<Level['state'], string> = {
  locked: 'Chưa mở',
  learning: 'Đang học',
  assessed: 'Đã thi đạt',
  applying: 'Đang nhập dữ liệu',
  validated: 'Đã xác thực',
  unlocked: 'Hoàn thành ✓',
}
const STATE_TONE: Record<Level['state'], string> = {
  locked: 'text-ink-dim border-w8',
  learning: 'text-sky-300 border-sky-700/50',
  assessed: 'text-amber-300 border-amber-700/50',
  applying: 'text-violet-300 border-violet-700/50',
  validated: 'text-emerald-300 border-emerald-700/50',
  unlocked: 'text-emerald-300 border-emerald-600',
}

export function JourneyMap() {
  const [levels, setLevels] = useState<Level[]>([])
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<number | null>(null)

  const load = useCallback(async () => {
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/journey', { credentials: 'same-origin' })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? `HTTP ${res.status}`); return }
      setLevels(Array.isArray(json.data) ? json.data : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally { setBusy(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function act(level: number, action: string, extra: Record<string, unknown> = {}) {
    const res = await fetch('/api/journey', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level_num: level, action, ...extra }),
    })
    if (res.ok) load()
    else {
      const j = await res.json().catch(() => ({}))
      setError(j.error?.formErrors?.join(', ') ?? j.error ?? `HTTP ${res.status}`)
    }
  }

  if (busy && levels.length === 0) {
    return <div className="space-y-3">{[0,1,2,3,4,5,6].map((i) => <div key={i} className="h-20 rounded-xl bg-w4 animate-pulse" />)}</div>
  }
  if (error) return <div className="rounded border border-red-700 bg-red-900/30 p-4 text-sm text-red-200">{error}</div>

  const unlockedCount = levels.filter((l) => l.state === 'unlocked').length

  return (
    <div className="space-y-4">
      {/* Progress summary */}
      <div className="rounded-xl border border-w8 bg-bg-2 p-4 flex items-center justify-between">
        <div className="text-sm text-ink-dim">Tiến độ hành trình</div>
        <div className="flex items-center gap-3">
          <div className="h-2 w-48 rounded-full bg-w8 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-sky-500 to-violet-500"
                 style={{ width: `${(unlockedCount / 7) * 100}%` }} />
          </div>
          <span className="font-mono text-sm text-gold-light">{unlockedCount}/7</span>
        </div>
      </div>

      {/* 7 chakra levels */}
      {levels.map((lv, i) => {
        const isOpen = expanded === lv.level
        const isActive = lv.state !== 'locked'
        const doneSet = new Set((lv.deliverables_done ?? []).map((d) => d.code))
        return (
          <div key={lv.level}>
            <div
              className={`rounded-xl border bg-bg-2 p-5 transition ${isActive ? 'border-w12' : 'border-w8 opacity-60'} ${STATE_TONE[lv.state]}`}
            >
              <div className="flex items-center gap-4">
                {/* chakra ring */}
                <div className="flex h-12 w-12 flex-none items-center justify-center rounded-full font-serif font-semibold text-bg"
                     style={{ background: lv.color, boxShadow: isActive ? `0 0 18px 1px ${lv.color}` : 'none' }}>
                  {lv.state === 'unlocked' ? '✓' : lv.level}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[0.7rem] uppercase tracking-widest" style={{ color: lv.color }}>{lv.chakra}</div>
                  <div className="font-serif text-lg text-ink">{lv.name_vi} <span className="text-ink-dim text-sm">· {lv.subtitle}</span></div>
                  <div className="text-xs text-ink-dim mt-0.5">{lv.phase_range} · {lv.module_count} module · {lv.agents?.length ?? 0} agent</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`text-xs font-medium ${STATE_TONE[lv.state].split(' ')[0]}`}>{STATE_LABEL[lv.state]}</span>
                  <button onClick={() => setExpanded(isOpen ? null : lv.level)}
                          className="text-ink-dim hover:text-gold-light text-xs">{isOpen ? '▲ thu gọn' : '▼ chi tiết'}</button>
                </div>
              </div>

              {isOpen && (
                <div className="mt-4 pt-4 border-t border-w8 space-y-4">
                  {/* assessment */}
                  <div>
                    <div className="text-xs uppercase tracking-widest text-ink-dim mb-2">Cổng thi · cần ≥ {lv.pass_mark}/{lv.pass_total}</div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm">Điểm: <b className="text-gold-light">{lv.assessment_score ?? '—'}/{lv.pass_total}</b></span>
                      {lv.state !== 'unlocked' && (
                        <>
                          {lv.state === 'locked' && (
                            <button onClick={() => act(lv.level, 'start_learning')}
                                    className="rounded bg-c5 px-3 py-1 text-xs text-ink hover:opacity-90">Bắt đầu học</button>
                          )}
                          {(lv.state === 'learning' || lv.state === 'assessed' || lv.state === 'applying') && (
                            <button onClick={() => act(lv.level, 'submit_assessment', { score: lv.pass_mark })}
                                    className="rounded bg-amber-600 px-3 py-1 text-xs text-bg hover:opacity-90">Nộp bài thi (demo đạt)</button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* deliverables */}
                  <div>
                    <div className="text-xs uppercase tracking-widest text-ink-dim mb-2">Deliverable cần dựng (dữ liệu thật)</div>
                    <div className="space-y-1.5">
                      {(lv.required_deliverables ?? []).map((d) => {
                        const done = doneSet.has(d.code)
                        return (
                          <div key={d.code} className="flex items-center justify-between rounded border border-w8 bg-w4 px-3 py-2 text-sm">
                            <span className={done ? 'text-emerald-300' : 'text-ink'}>
                              {done ? '✓' : '○'} {d.label ?? d.code} <span className="text-ink-dim text-xs font-mono">· {d.entity}</span>
                            </span>
                            {!done && lv.state !== 'locked' && lv.state !== 'unlocked' && (
                              <button onClick={() => act(lv.level, 'add_deliverable', { deliverable: { code: d.code, label: d.label } })}
                                      className="rounded bg-violet-700/60 px-2.5 py-1 text-xs text-violet-100 hover:opacity-90">Đánh dấu xong</button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {lv.agents?.length > 0 && (
                    <div>
                      <div className="text-xs uppercase tracking-widest text-ink-dim mb-2">AI agent hỗ trợ</div>
                      <div className="flex flex-wrap gap-1.5">
                        {lv.agents.map((a) => <span key={a} className="rounded-full border border-w8 bg-w4 px-2.5 py-1 text-xs text-ink-dim font-mono">{a}</span>)}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            {i < levels.length - 1 && <div className="flex justify-center py-1 text-ink-dim/40">▾</div>}
          </div>
        )
      })}

      <div className="rounded-xl border border-dashed border-w8 bg-bg-2 p-4 text-center text-sm text-ink-dim">
        7 chặng năng lượng gói trọn <b className="text-gold-light">10 phase · 44 module · 420 step</b> — kể bằng ngôn ngữ dễ nhớ,
        chạy bằng dữ liệu thật của chính bạn.
      </div>
    </div>
  )
}
