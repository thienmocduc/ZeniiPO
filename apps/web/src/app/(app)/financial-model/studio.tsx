'use client'

import { useEffect, useState } from 'react'

type MCResult = {
  trials: number
  horizon_months: number
  runway: { p10: number; p50: number; p90: number; mean: number }
  survival_probability: number
  ending_arr: { p10: number; p50: number; p90: number; mean: number }
  target_arr?: number
  probability_hit_target?: number
  median_path: { month: number; cash: number; revenue: number }[]
  warnings: string[]
}
type Sensitivity = { growth_deltas: number[]; margin_deltas: number[]; runway_p50: number[][] }

const fmtUsd = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${Math.round(n)}`
}

export function FinancialModelStudio() {
  const [a, setA] = useState({
    name: 'Base case',
    starting_cash: 1_000_000,
    monthly_revenue: 80_000,
    monthly_growth_mean: 0.08,
    monthly_growth_volatility: 0.04,
    gross_margin: 0.75,
    monthly_fixed_costs: 120_000,
    horizon_months: 36,
    target_arr: 5_000_000,
  })
  const [result, setResult] = useState<MCResult | null>(null)
  const [sensitivity, setSensitivity] = useState<Sensitivity | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/financial-model', { credentials: 'same-origin' })
      if (res.ok) {
        const j = await res.json()
        if (j.data?.result) { setResult(j.data.result); setSensitivity(j.data.sensitivity ?? null); if (j.data.assumptions) setA((s) => ({ ...s, ...j.data.assumptions })) }
      }
    })()
  }, [])

  async function run() {
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/financial-model', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(a),
      })
      const j = await res.json()
      if (!res.ok) { setError(j.error?.formErrors?.join(', ') ?? JSON.stringify(j.error) ?? `HTTP ${res.status}`); return }
      setResult(j.result); setSensitivity(j.sensitivity)
    } catch (e) { setError(e instanceof Error ? e.message : 'Network error') } finally { setBusy(false) }
  }

  const num = (k: keyof typeof a) => (e: React.ChangeEvent<HTMLInputElement>) => setA((s) => ({ ...s, [k]: Number(e.target.value) }))

  // runway radar color: green if p10 >= 12, amber 6-12, red < 6
  const runwayTone = (m: number) => (m >= 12 ? 'text-emerald-300' : m >= 6 ? 'text-amber-300' : 'text-red-300')
  const maxCash = result ? Math.max(...result.median_path.map((p) => p.cash), 1) : 1
  const minCash = result ? Math.min(...result.median_path.map((p) => p.cash), 0) : 0

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Assumptions */}
      <div className="lg:col-span-1 rounded-xl border border-w8 bg-bg-2 p-5 space-y-3 h-fit">
        <h2 className="font-medium text-ink">Giả định</h2>
        <Field label="Tiền mặt hiện có (USD)"><input type="number" className={inp} value={a.starting_cash} onChange={num('starting_cash')} /></Field>
        <Field label="MRR hiện tại (USD)"><input type="number" className={inp} value={a.monthly_revenue} onChange={num('monthly_revenue')} /></Field>
        <Field label={`Tăng trưởng TB/tháng: ${(a.monthly_growth_mean*100).toFixed(0)}%`}>
          <input type="range" min={-10} max={30} value={a.monthly_growth_mean*100} onChange={(e)=>setA(s=>({...s,monthly_growth_mean:Number(e.target.value)/100}))} className="w-full" /></Field>
        <Field label={`Biến động tăng trưởng: ±${(a.monthly_growth_volatility*100).toFixed(0)}%`}>
          <input type="range" min={0} max={20} value={a.monthly_growth_volatility*100} onChange={(e)=>setA(s=>({...s,monthly_growth_volatility:Number(e.target.value)/100}))} className="w-full" /></Field>
        <Field label={`Biên lợi nhuận gộp: ${(a.gross_margin*100).toFixed(0)}%`}>
          <input type="range" min={0} max={100} value={a.gross_margin*100} onChange={(e)=>setA(s=>({...s,gross_margin:Number(e.target.value)/100}))} className="w-full" /></Field>
        <Field label="Chi phí cố định/tháng (USD)"><input type="number" className={inp} value={a.monthly_fixed_costs} onChange={num('monthly_fixed_costs')} /></Field>
        <Field label="Horizon (tháng)"><input type="number" className={inp} value={a.horizon_months} onChange={num('horizon_months')} /></Field>
        <Field label="Target ARR (USD)"><input type="number" className={inp} value={a.target_arr} onChange={num('target_arr')} /></Field>
        <button onClick={run} disabled={busy} className="w-full rounded bg-gold px-4 py-2.5 text-sm font-medium text-bg hover:bg-gold-light disabled:opacity-50">
          {busy ? 'Đang chạy 1.000 kịch bản…' : '▶ Chạy Monte Carlo'}</button>
        {error && <div className="rounded border border-red-700 bg-red-900/30 p-2 text-xs text-red-200">{error}</div>}
      </div>

      {/* Results */}
      <div className="lg:col-span-2 space-y-4">
        {!result ? (
          <div className="rounded-xl border border-dashed border-w8 bg-bg-2 p-10 text-center text-ink-dim">
            Nhập giả định rồi bấm <b className="text-gold-light">Chạy Monte Carlo</b> để xem runway radar &amp; xác suất.
          </div>
        ) : (
          <>
            {/* Runway radar */}
            <div className="rounded-xl border border-w8 bg-bg-2 p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-medium text-ink">Runway radar</h2>
                <span className="text-xs text-ink-dim">{result.trials} kịch bản · {result.horizon_months} tháng</span>
              </div>
              <div className="grid grid-cols-4 gap-3 text-center">
                <Stat label="P10 (xấu)" v={`${result.runway.p10}t`} tone={runwayTone(result.runway.p10)} />
                <Stat label="P50 (trung vị)" v={`${result.runway.p50}t`} tone={runwayTone(result.runway.p50)} />
                <Stat label="P90 (tốt)" v={`${result.runway.p90}t`} tone={runwayTone(result.runway.p90)} />
                <Stat label="Sống sót horizon" v={`${Math.round(result.survival_probability*100)}%`} tone={result.survival_probability>=0.7?'text-emerald-300':result.survival_probability>=0.4?'text-amber-300':'text-red-300'} />
              </div>
              {result.runway.p10 < 6 && <p className="mt-3 text-xs text-red-300">⚠ Kịch bản xấu (P10) cạn tiền trong {result.runway.p10} tháng — cần gọi vốn hoặc cắt burn ngay.</p>}
            </div>

            {/* Ending ARR + target */}
            <div className="rounded-xl border border-w8 bg-bg-2 p-5">
              <h2 className="font-medium text-ink mb-3">ARR cuối kỳ (sau {result.horizon_months} tháng)</h2>
              <div className="grid grid-cols-4 gap-3 text-center">
                <Stat label="P10" v={fmtUsd(result.ending_arr.p10)} />
                <Stat label="P50" v={fmtUsd(result.ending_arr.p50)} tone="text-gold-light" />
                <Stat label="P90" v={fmtUsd(result.ending_arr.p90)} />
                {result.probability_hit_target != null && (
                  <Stat label={`P(≥ ${fmtUsd(result.target_arr ?? 0)})`} v={`${Math.round(result.probability_hit_target*100)}%`}
                    tone={result.probability_hit_target>=0.5?'text-emerald-300':'text-amber-300'} />
                )}
              </div>
            </div>

            {/* Median cash path sparkline */}
            <div className="rounded-xl border border-w8 bg-bg-2 p-5">
              <h2 className="font-medium text-ink mb-3">Đường tiền mặt trung vị</h2>
              <div className="flex items-end gap-0.5 h-28">
                {result.median_path.map((p) => {
                  const h = ((p.cash - minCash) / (maxCash - minCash)) * 100
                  return <div key={p.month} title={`Tháng ${p.month}: ${fmtUsd(p.cash)}`}
                    className={`flex-1 rounded-t ${p.cash < 0 ? 'bg-red-600' : 'bg-gradient-to-t from-c5 to-gold'}`}
                    style={{ height: `${Math.max(2, h)}%` }} />
                })}
              </div>
              <div className="flex justify-between text-2xs text-ink-dim mt-1"><span>Tháng 0</span><span>Tháng {result.horizon_months}</span></div>
            </div>

            {/* Sensitivity grid */}
            {sensitivity && (
              <div className="rounded-xl border border-w8 bg-bg-2 p-5">
                <h2 className="font-medium text-ink mb-1">Sensitivity · runway P50 (tháng)</h2>
                <p className="text-xs text-ink-dim mb-3">Hàng = Δ tăng trưởng · Cột = Δ biên lợi nhuận</p>
                <div className="overflow-x-auto">
                  <table className="text-xs">
                    <thead><tr><th className="p-1.5"></th>{sensitivity.margin_deltas.map((m,i)=><th key={i} className="p-1.5 text-ink-dim font-normal">{m>0?'+':''}{Math.round(m*100)}%</th>)}</tr></thead>
                    <tbody>
                      {sensitivity.runway_p50.map((row,ri)=>(
                        <tr key={ri}>
                          <td className="p-1.5 text-ink-dim">{sensitivity.growth_deltas[ri]>0?'+':''}{Math.round(sensitivity.growth_deltas[ri]*100)}%</td>
                          {row.map((v,ci)=>{
                            const ratio = v / result.horizon_months
                            const bg = ratio>=0.9?'rgba(52,211,153,0.25)':ratio>=0.5?'rgba(250,204,21,0.20)':'rgba(248,113,113,0.22)'
                            return <td key={ci} className="p-1.5 text-center text-ink font-mono" style={{background:bg}}>{v}</td>
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {result.warnings.length > 0 && (
              <div className="rounded border border-amber-700/40 bg-amber-900/15 p-3 text-xs text-amber-200">
                {result.warnings.map((w,i)=><div key={i}>⚠ {w}</div>)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-xs text-ink-dim">{label}</span>{children}</label>
}
function Stat({ label, v, tone }: { label: string; v: string; tone?: string }) {
  return <div><div className="text-2xs uppercase tracking-widest text-ink-dim">{label}</div><div className={`font-serif text-xl ${tone ?? 'text-ink'}`}>{v}</div></div>
}
const inp = 'w-full rounded border border-w8 bg-bg px-3 py-1.5 text-sm text-ink focus:border-gold focus:outline-none'
