'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { KHAI_TAM_LESSONS, KHAI_TAM_QUIZ, KHAI_TAM_PASS_MARK, KHAI_TAM_TOTAL } from '@/lib/curriculum/khai-tam'

type Phase = 'learn' | 'quiz' | 'captable' | 'done'
type Holder = { name: string; shares: number; type: 'founder' | 'esop' | 'investor' | 'advisor' }

export function KhaiTamFlow() {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('learn')
  const [lessonIdx, setLessonIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [graded, setGraded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // cap table builder
  const [holders, setHolders] = useState<Holder[]>([
    { name: '', shares: 700000, type: 'founder' },
    { name: 'ESOP Pool', shares: 120000, type: 'esop' },
  ])

  const score = useMemo(
    () => KHAI_TAM_QUIZ.reduce((s, q) => s + (answers[q.id] === q.correct ? 1 : 0), 0),
    [answers],
  )
  const passed = score >= KHAI_TAM_PASS_MARK
  const totalShares = holders.reduce((s, h) => s + (Number(h.shares) || 0), 0)
  const founderPct = totalShares > 0 ? Math.round((holders.filter(h=>h.type==='founder').reduce((s,h)=>s+(Number(h.shares)||0),0) / totalShares) * 1000) / 10 : 0
  const esopPct = totalShares > 0 ? Math.round((holders.filter(h=>h.type==='esop').reduce((s,h)=>s+(Number(h.shares)||0),0) / totalShares) * 1000) / 10 : 0

  async function submitAssessment() {
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/journey', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level_num: 1, action: 'submit_assessment', score }),
      })
      if (!res.ok) { const j = await res.json().catch(()=>({})); setError(j.error ?? `HTTP ${res.status}`); return }
      setPhase('captable')
    } catch (e) { setError(e instanceof Error ? e.message : 'Network error') } finally { setBusy(false) }
  }

  async function finishCapTable() {
    setBusy(true); setError(null)
    try {
      // 1. Create real cap table snapshot
      const ctRes = await fetch('/api/cap-table', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ holders: holders.filter(h=>h.name && h.shares>0), snapshot_type: 'adhoc', origin: 'khai_tam_v0' }),
      })
      if (!ctRes.ok) { const j = await ctRes.json().catch(()=>({})); setError(`Cap table: ${j.error?.formErrors?.join(', ') ?? JSON.stringify(j.error) ?? ctRes.status}`); return }

      // 2. Mark deliverable cap_table_v0
      await fetch('/api/journey', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level_num: 1, action: 'add_deliverable', deliverable: { code: 'cap_table_v0', label: 'Cap table v0' } }) })

      // 3. Mark deliverable readiness_baseline (baseline readiness computed server-side later)
      const last = await fetch('/api/journey', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level_num: 1, action: 'add_deliverable', deliverable: { code: 'readiness_baseline', label: 'Điểm readiness sơ bộ' } }) })
      const lastJson = await last.json().catch(()=>({}))
      if (last.ok && lastJson.data?.can_unlock) { setPhase('done'); return }
      // even if not auto-unlocked, advance to done screen
      setPhase('done')
    } catch (e) { setError(e instanceof Error ? e.message : 'Network error') } finally { setBusy(false) }
  }

  // ─── LEARN ─────────────────────────────────────────────
  if (phase === 'learn') {
    const lesson = KHAI_TAM_LESSONS[lessonIdx]
    return (
      <div className="rounded-xl border border-w8 bg-bg-2 p-6">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs text-ink-dim">Bài {lessonIdx + 1}/{KHAI_TAM_LESSONS.length}</span>
          <div className="h-1.5 w-40 rounded-full bg-w8 overflow-hidden">
            <div className="h-full bg-gold" style={{ width: `${((lessonIdx + 1) / KHAI_TAM_LESSONS.length) * 100}%` }} />
          </div>
        </div>
        <h2 className="font-serif text-xl text-ink">{lesson.title}</h2>
        <p className="mt-2 text-sm italic text-gold-light">{lesson.analogy}</p>
        <div className="mt-4 space-y-3">
          {lesson.body.map((p, i) => <p key={i} className="text-sm text-ink-2 leading-relaxed">{p}</p>)}
        </div>
        <div className="mt-4 rounded border border-gold/30 bg-gold/5 p-3 text-sm text-gold-light">
          💡 {lesson.takeaway}
        </div>
        <div className="mt-6 flex justify-between">
          <button disabled={lessonIdx===0} onClick={()=>setLessonIdx(i=>i-1)}
                  className="rounded border border-w8 px-4 py-2 text-sm text-ink-dim disabled:opacity-40 hover:bg-w4">← Trước</button>
          {lessonIdx < KHAI_TAM_LESSONS.length - 1 ? (
            <button onClick={()=>setLessonIdx(i=>i+1)} className="rounded bg-gold px-4 py-2 text-sm font-medium text-bg hover:bg-gold-light">Tiếp →</button>
          ) : (
            <button onClick={()=>setPhase('quiz')} className="rounded bg-gold px-4 py-2 text-sm font-medium text-bg hover:bg-gold-light">Làm bài thi →</button>
          )}
        </div>
      </div>
    )
  }

  // ─── QUIZ ──────────────────────────────────────────────
  if (phase === 'quiz') {
    return (
      <div className="rounded-xl border border-w8 bg-bg-2 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-xl text-ink">Bài thi · cần ≥ {KHAI_TAM_PASS_MARK}/{KHAI_TAM_TOTAL}</h2>
          {graded && <span className={`text-sm font-medium ${passed ? 'text-emerald-300' : 'text-red-300'}`}>{score}/{KHAI_TAM_TOTAL} {passed ? '· Đạt ✓' : '· Chưa đạt'}</span>}
        </div>
        {KHAI_TAM_QUIZ.map((q, qi) => (
          <div key={q.id} className="border-b border-w8 pb-4">
            <div className="text-sm text-ink mb-2"><b>{qi+1}.</b> {q.q}</div>
            <div className="space-y-1.5">
              {q.options.map((opt, oi) => {
                const sel = answers[q.id] === oi
                const showCorrect = graded && oi === q.correct
                const showWrong = graded && sel && oi !== q.correct
                return (
                  <button key={oi} disabled={graded}
                    onClick={()=>setAnswers(a=>({...a,[q.id]:oi}))}
                    className={`block w-full text-left rounded border px-3 py-2 text-sm transition ${
                      showCorrect ? 'border-emerald-600 bg-emerald-900/20 text-emerald-200'
                      : showWrong ? 'border-red-600 bg-red-900/20 text-red-200'
                      : sel ? 'border-gold bg-gold/10 text-ink' : 'border-w8 text-ink-dim hover:bg-w4'}`}>
                    {opt}
                  </button>
                )
              })}
            </div>
            {graded && <p className="mt-2 text-xs text-ink-dim">→ {q.explain}</p>}
          </div>
        ))}
        {error && <div className="rounded border border-red-700 bg-red-900/30 p-3 text-sm text-red-200">{error}</div>}
        <div className="flex justify-between">
          <button onClick={()=>setPhase('learn')} className="rounded border border-w8 px-4 py-2 text-sm text-ink-dim hover:bg-w4">← Ôn lại bài</button>
          {!graded ? (
            <button disabled={Object.keys(answers).length < KHAI_TAM_TOTAL}
              onClick={()=>setGraded(true)}
              className="rounded bg-gold px-4 py-2 text-sm font-medium text-bg hover:bg-gold-light disabled:opacity-40">Chấm điểm</button>
          ) : passed ? (
            <button disabled={busy} onClick={submitAssessment} className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-bg hover:opacity-90">
              {busy ? 'Đang lưu…' : 'Tiếp: dựng cap table →'}</button>
          ) : (
            <button onClick={()=>{setGraded(false);setAnswers({})}} className="rounded bg-amber-600 px-4 py-2 text-sm font-medium text-bg hover:opacity-90">Làm lại</button>
          )}
        </div>
      </div>
    )
  }

  // ─── CAP TABLE ─────────────────────────────────────────
  if (phase === 'captable') {
    return (
      <div className="rounded-xl border border-w8 bg-bg-2 p-6 space-y-4">
        <h2 className="font-serif text-xl text-ink">Dựng cap table thật của bạn</h2>
        <p className="text-sm text-ink-dim">Nhập cổ đông + số cổ phần. Đây là dữ liệu thật — sẽ thành cap table v0 vận hành.</p>
        <div className="space-y-2">
          {holders.map((h, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <input className="col-span-5 rounded border border-w8 bg-bg px-3 py-2 text-sm text-ink focus:border-gold focus:outline-none"
                placeholder="Tên cổ đông" value={h.name}
                onChange={e=>setHolders(hs=>hs.map((x,xi)=>xi===i?{...x,name:e.target.value}:x))} />
              <input type="number" className="col-span-3 rounded border border-w8 bg-bg px-3 py-2 text-sm text-ink focus:border-gold focus:outline-none"
                value={h.shares}
                onChange={e=>setHolders(hs=>hs.map((x,xi)=>xi===i?{...x,shares:Number(e.target.value)}:x))} />
              <select className="col-span-3 rounded border border-w8 bg-bg px-2 py-2 text-sm text-ink focus:border-gold focus:outline-none"
                value={h.type}
                onChange={e=>setHolders(hs=>hs.map((x,xi)=>xi===i?{...x,type:e.target.value as Holder['type']}:x))}>
                <option value="founder">Founder</option><option value="esop">ESOP</option>
                <option value="investor">Investor</option><option value="advisor">Advisor</option>
              </select>
              <button className="col-span-1 text-ink-dim hover:text-red-300"
                onClick={()=>setHolders(hs=>hs.filter((_,xi)=>xi!==i))}>✕</button>
            </div>
          ))}
        </div>
        <button onClick={()=>setHolders(hs=>[...hs,{name:'',shares:0,type:'investor'}])}
          className="text-sm text-gold-light hover:underline">+ Thêm cổ đông</button>

        <div className="grid grid-cols-3 gap-3 pt-3 border-t border-w8 text-center">
          <div><div className="text-2xs uppercase tracking-widest text-ink-dim">Tổng cổ phần</div><div className="font-serif text-lg text-ink">{totalShares.toLocaleString()}</div></div>
          <div><div className="text-2xs uppercase tracking-widest text-ink-dim">Founder %</div><div className={`font-serif text-lg ${founderPct>=65?'text-emerald-300':founderPct>=50?'text-amber-300':'text-red-300'}`}>{founderPct}%</div></div>
          <div><div className="text-2xs uppercase tracking-widest text-ink-dim">ESOP %</div><div className={`font-serif text-lg ${esopPct>=10&&esopPct<=15?'text-emerald-300':'text-ink'}`}>{esopPct}%</div></div>
        </div>
        {founderPct < 65 && <p className="text-xs text-amber-300">⚠ Founder dưới 65% — bạn sẽ khó giữ toàn quyền quyết định lớn (nhắc lại bài 5).</p>}
        {error && <div className="rounded border border-red-700 bg-red-900/30 p-3 text-sm text-red-200">{error}</div>}
        <div className="flex justify-end">
          <button disabled={busy || totalShares<=0 || holders.filter(h=>h.name&&h.shares>0).length===0}
            onClick={finishCapTable}
            className="rounded bg-emerald-600 px-5 py-2.5 text-sm font-medium text-bg hover:opacity-90 disabled:opacity-40">
            {busy ? 'Đang lưu…' : '✓ Hoàn tất Khai Tâm'}</button>
        </div>
      </div>
    )
  }

  // ─── DONE ──────────────────────────────────────────────
  return (
    <div className="rounded-xl border border-emerald-700/50 bg-emerald-900/10 p-8 text-center space-y-4">
      <div className="text-5xl">🎓</div>
      <h2 className="font-serif text-2xl text-gold-light">Hoàn thành Cấp 1 · Khai Tâm</h2>
      <p className="text-sm text-ink-dim max-w-md mx-auto">
        Bạn đã hiểu cơ chế vốn, thi đạt {score}/{KHAI_TAM_TOTAL}, và dựng cap table thật ({totalShares.toLocaleString()} cổ phần,
        founder {founderPct}%). Cấp 2 · Lập Nền đã mở khoá.
      </p>
      <div className="flex gap-3 justify-center pt-2">
        <button onClick={()=>router.push('/journey')} className="rounded bg-gold px-5 py-2.5 text-sm font-medium text-bg hover:bg-gold-light">Xem hành trình 7 tầng →</button>
        <button onClick={()=>router.push('/dashboard')} className="rounded border border-w8 px-5 py-2.5 text-sm text-ink hover:bg-w4">Vào Dashboard</button>
      </div>
    </div>
  )
}
