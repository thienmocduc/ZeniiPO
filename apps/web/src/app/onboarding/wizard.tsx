'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Step = 1 | 2 | 3

const VENUES = [
  { code: 'sgx', name: 'SGX (Singapore)' },
  { code: 'nasdaq', name: 'NASDAQ (US)' },
  { code: 'nyse', name: 'NYSE (US)' },
  { code: 'hkex', name: 'HKEX (Hong Kong)' },
  { code: 'hose', name: 'HOSE (Vietnam)' },
] as const

const DEFAULT_KPIS = [
  { metric_code: 'mrr', name: 'MRR (Monthly Recurring Revenue)', value: 0, unit: 'USD', period: new Date().toISOString().slice(0, 7) },
  { metric_code: 'monthly_burn', name: 'Monthly Burn', value: 0, unit: 'USD', period: new Date().toISOString().slice(0, 7) },
  { metric_code: 'cash_balance', name: 'Cash Balance', value: 0, unit: 'USD', period: new Date().toISOString().slice(0, 7) },
  { metric_code: 'fte_count', name: 'FTE Count', value: 0, unit: 'people', period: new Date().toISOString().slice(0, 7) },
]

type Kpi = typeof DEFAULT_KPIS[number]

export function OnboardingWizard() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 1
  const [journey_name, setJourneyName] = useState('IPO Journey')
  const [target_year, setTargetYear] = useState(2031)
  const [exit_venue, setExitVenue] = useState<typeof VENUES[number]['code']>('sgx')
  const [valuation_target_usd, setValuationTarget] = useState(50_000_000)
  const [industry, setIndustry] = useState('')
  const [north_star_metric, setNorthStar] = useState('')

  // Step 2
  const [kpis, setKpis] = useState<Kpi[]>(DEFAULT_KPIS)

  // Step 3
  const [okr_title, setOkrTitle] = useState('Đạt Phase 2 trong 6 tháng')
  const [okr_description, setOkrDesc] = useState('')

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          journey_name, target_year, exit_venue, valuation_target_usd,
          industry, north_star_metric, kpis, okr_title, okr_description,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error?.message ?? json.error ?? `HTTP ${res.status}`)
        return
      }
      router.push('/dashboard')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-lg border border-w8 bg-bg-2 p-6">
      <Stepper step={step} />

      {step === 1 && (
        <section className="mt-6 space-y-4">
          <h2 className="text-lg font-medium">Bước 1 · IPO Journey</h2>
          <Field label="Tên hành trình">
            <input className={inp} value={journey_name} onChange={(e) => setJourneyName(e.target.value)} maxLength={120} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Năm IPO mục tiêu">
              <input type="number" min={2026} max={2050} className={inp} value={target_year} onChange={(e) => setTargetYear(Number(e.target.value))} />
            </Field>
            <Field label="Sàn niêm yết">
              <select className={inp} value={exit_venue} onChange={(e) => setExitVenue(e.target.value as typeof exit_venue)}>
                {VENUES.map((v) => <option key={v.code} value={v.code}>{v.name}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Valuation mục tiêu (USD)">
            <input type="number" min={1_000_000} className={inp} value={valuation_target_usd} onChange={(e) => setValuationTarget(Number(e.target.value))} />
            <p className="mt-1 text-xs text-ink-dim">Hiện tại: ${(valuation_target_usd / 1_000_000).toFixed(1)}M</p>
          </Field>
          <Field label="Ngành (1 từ)">
            <input className={inp} placeholder="biotech / fintech / wellness…" value={industry} onChange={(e) => setIndustry(e.target.value)} maxLength={80} />
          </Field>
          <Field label="North Star Metric">
            <input className={inp} placeholder="ARR · MAU · GMV · Therapy sessions/month…" value={north_star_metric} onChange={(e) => setNorthStar(e.target.value)} maxLength={120} />
          </Field>
          <div className="flex justify-end pt-2">
            <button className={btnPri} onClick={() => setStep(2)} disabled={!journey_name || !industry || !north_star_metric}>Tiếp →</button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="mt-6 space-y-4">
          <h2 className="text-lg font-medium">Bước 2 · 4 KPI bắc cầu</h2>
          <p className="text-xs text-ink-dim">Nhập số thật của tháng này. Có thể để 0 nếu chưa bắt đầu — KHÔNG nhập số giả.</p>
          {kpis.map((k, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-end border-b border-w8 pb-3">
              <Field className="col-span-5" label={i === 0 ? 'Tên KPI' : ''}>
                <input className={inp} value={k.name} onChange={(e) => {
                  const next = [...kpis]; next[i] = { ...next[i], name: e.target.value }; setKpis(next)
                }} maxLength={120} />
              </Field>
              <Field className="col-span-3" label={i === 0 ? 'Giá trị' : ''}>
                <input type="number" className={inp} value={k.value} onChange={(e) => {
                  const next = [...kpis]; next[i] = { ...next[i], value: Number(e.target.value) }; setKpis(next)
                }} />
              </Field>
              <Field className="col-span-2" label={i === 0 ? 'Đơn vị' : ''}>
                <input className={inp} value={k.unit ?? ''} onChange={(e) => {
                  const next = [...kpis]; next[i] = { ...next[i], unit: e.target.value }; setKpis(next)
                }} maxLength={20} />
              </Field>
              <Field className="col-span-2" label={i === 0 ? 'Kỳ' : ''}>
                <input className={inp} value={k.period ?? ''} onChange={(e) => {
                  const next = [...kpis]; next[i] = { ...next[i], period: e.target.value }; setKpis(next)
                }} placeholder="2026-04" />
              </Field>
            </div>
          ))}
          <div className="flex justify-between pt-2">
            <button className={btnSec} onClick={() => setStep(1)}>← Quay lại</button>
            <button className={btnPri} onClick={() => setStep(3)} disabled={kpis.some((k) => !k.name || !k.metric_code)}>Tiếp →</button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="mt-6 space-y-4">
          <h2 className="text-lg font-medium">Bước 3 · OKR Chairman đầu tiên</h2>
          <p className="text-xs text-ink-dim">OKR cao nhất cho Chairman trong 90 ngày tới. Cascade engine sẽ tự sinh 4 OKR phụ.</p>
          <Field label="Objective title">
            <input className={inp} value={okr_title} onChange={(e) => setOkrTitle(e.target.value)} maxLength={200} />
          </Field>
          <Field label="Mô tả (tuỳ chọn)">
            <textarea className={`${inp} min-h-[80px]`} value={okr_description} onChange={(e) => setOkrDesc(e.target.value)} maxLength={1000} />
          </Field>
          {error && (
            <div className="rounded border border-red-700 bg-red-900/30 p-3 text-sm text-red-200">
              {error}
            </div>
          )}
          <div className="flex justify-between pt-2">
            <button className={btnSec} onClick={() => setStep(2)} disabled={busy}>← Quay lại</button>
            <button className={btnPri} onClick={submit} disabled={busy || !okr_title}>
              {busy ? 'Đang tạo…' : '✓ Hoàn tất khởi tạo'}
            </button>
          </div>
        </section>
      )}
    </div>
  )
}

function Stepper({ step }: { step: Step }) {
  const labels = ['IPO Journey', '4 KPI', 'OKR Chairman']
  return (
    <ol className="flex items-center justify-between">
      {labels.map((label, i) => {
        const n = (i + 1) as Step
        const active = n === step
        const done = n < step
        return (
          <li key={label} className="flex items-center gap-2 flex-1">
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                done ? 'bg-gold text-bg' : active ? 'bg-c5 text-ink' : 'bg-w8 text-ink-dim'
              }`}
            >
              {done ? '✓' : n}
            </span>
            <span className={`text-sm ${active ? 'text-ink' : 'text-ink-dim'}`}>{label}</span>
            {i < labels.length - 1 && <div className="ml-2 h-px flex-1 bg-w8" />}
          </li>
        )
      })}
    </ol>
  )
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className ?? ''}`}>
      {label && <span className="mb-1 block text-xs text-ink-dim">{label}</span>}
      {children}
    </label>
  )
}

const inp = 'w-full rounded border border-w8 bg-bg px-3 py-2 text-sm text-ink focus:border-gold focus:outline-none'
const btnPri = 'rounded bg-gold px-4 py-2 text-sm font-medium text-bg hover:bg-gold-light disabled:cursor-not-allowed disabled:opacity-50'
const btnSec = 'rounded border border-w8 px-4 py-2 text-sm text-ink hover:bg-w4'
