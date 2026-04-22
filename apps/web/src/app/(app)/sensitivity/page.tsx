import { MetricCard } from '@/components/modules/metric-card';
import {
  BtnPri,
  BtnSec,
  PageHeader,
  Panel,
} from '@/components/modules/page-header';

const VARS = [
  { label: 'ARR growth', value: '140', unit: '%', range: 'Range 80-200% uniform' },
  { label: 'Gross margin', value: '72', unit: '%', range: 'Range 60-85% μ=72' },
  { label: 'Net retention', value: '112', unit: '%', range: 'Range 90-140% μ=115' },
  { label: 'CAC payback', value: '14', unit: 'mo', range: 'Range 8-24 lognormal' },
  { label: 'Churn', value: '6', unit: '%', range: 'Range 2-15% beta' },
  { label: 'IPO P/S', value: '12', unit: '×', range: 'Range 6-20× triangular' },
  { label: 'Exit year', value: '2031', unit: 'yr', range: 'Range 2029-2033' },
];

const PERCENTILES = [
  { p: 'P10', v: '$1.2B', gold: false },
  { p: 'P25', v: '$2.1B', gold: false },
  { p: 'P50', v: '$3.6B', gold: true },
  { p: 'P75', v: '$5.4B', gold: false },
  { p: 'P90', v: '$7.8B', goldLight: true },
];

const HISTOGRAM = [30, 50, 85, 125, 150, 155, 140, 115, 90, 65, 45, 30, 15, 8];

export default function SensitivityPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        category="Tài chính"
        crumb="Sensitivity"
        title="Sensitivity"
        tagline="— 1,000 Monte Carlo runs"
        lede="Mỗi biến có range thay đổi · 1,000 iterations → distribution IPO valuation 2031. Chạy lại mỗi khi cập nhật model hoặc thay scenario."
        actions={
          <>
            <BtnSec>Export CSV</BtnSec>
            <BtnPri>🎲 Re-run sim</BtnPri>
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Median IPO val" value="$3.6" unit="B" color="gold" sub="P50 · 2031 target" />
        <MetricCard label="Upside (P90)" value="$7.8" unit="B" color="ok" sub="If NRR ≥125%" />
        <MetricCard label="Downside (P10)" value="$1.2" unit="B" color="warn" sub="Worst 10% case" />
        <MetricCard label="Runs" value="1,000" sub="Seeded · deterministic" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Input Range" tagline="· 7 variables" tag="EDITABLE">
          <div className="flex flex-col gap-3">
            {VARS.map((v) => (
              <div
                key={v.label}
                className="flex items-center gap-3 px-3 py-2 bg-w-4 rounded border border-w-8"
              >
                <label className="flex-1 text-[.82rem] text-ivory">
                  {v.label}
                </label>
                <div className="flex items-center gap-1 bg-panel-2 rounded border border-w-12 px-2 py-1">
                  <input
                    type="number"
                    defaultValue={v.value}
                    className="w-14 bg-transparent text-right font-mono text-[.82rem] text-gold outline-none"
                    readOnly
                  />
                  <span className="font-mono text-[.62rem] text-ink-dim">
                    {v.unit}
                  </span>
                </div>
                <span className="font-mono text-[.62rem] text-ink-dim w-40 text-right shrink-0">
                  {v.range}
                </span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          title="Distribution"
          tagline="IPO val 2031"
          tag="1,000 runs"
          tagTone="live"
        >
          <div className="grid grid-cols-5 gap-2 mb-5">
            {PERCENTILES.map((p) => (
              <div
                key={p.p}
                className={`px-2 py-2.5 rounded text-center ${
                  p.gold
                    ? 'bg-gold/15 border border-gold'
                    : 'bg-w-4 border border-w-8'
                }`}
              >
                <div
                  className={`font-mono text-[.55rem] tracking-widest uppercase mb-0.5 ${
                    p.gold ? 'text-gold' : 'text-ink-dim'
                  }`}
                >
                  {p.p}
                </div>
                <div
                  className={`font-display text-base ${
                    p.gold
                      ? 'text-gold font-semibold'
                      : p.goldLight
                        ? 'text-ok'
                        : 'text-ivory'
                  }`}
                >
                  {p.v}
                </div>
              </div>
            ))}
          </div>

          <svg viewBox="0 0 500 200" className="w-full h-48">
            <defs>
              <linearGradient id="hg1" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#E4C16E" stopOpacity=".8" />
                <stop offset="1" stopColor="#E4C16E" stopOpacity=".1" />
              </linearGradient>
            </defs>
            <g fill="url(#hg1)" stroke="#C9A84C" strokeWidth=".5">
              {HISTOGRAM.map((h, i) => (
                <rect
                  key={i}
                  x={20 + i * 32}
                  y={200 - h - 10}
                  width="28"
                  height={h + 10}
                />
              ))}
            </g>
            <line
              x1="180"
              y1="10"
              x2="180"
              y2="190"
              stroke="#E4C16E"
              strokeWidth="2"
              strokeDasharray="4 2"
            />
            <text
              x="186"
              y="22"
              fill="#E4C16E"
              fontSize="10"
              fontFamily="JetBrains Mono"
            >
              P50 $3.6B
            </text>
          </svg>

          <p className="mt-3 text-[.8rem] text-ink-2 leading-relaxed">
            Distribution{' '}
            <em className="text-gold not-italic">right-tail skewed</em>.
            High-leverage vars: ARR growth + NRR. NRR ≥125% → P75 $5.4B
            achievable.
          </p>
        </Panel>
      </div>

      <Panel title="Top Variable Sensitivity" tag="TORNADO" tagTone="default">
        <div className="flex flex-col gap-2.5">
          {[
            { name: 'ARR growth (80-200%)', impact: 78, direction: 'right' },
            { name: 'Net retention (90-140%)', impact: 64, direction: 'right' },
            { name: 'IPO P/S multiple (6-20×)', impact: 52, direction: 'right' },
            { name: 'Gross margin (60-85%)', impact: 38, direction: 'right' },
            { name: 'Churn (2-15%)', impact: 28, direction: 'left' },
            { name: 'CAC payback (8-24mo)', impact: 18, direction: 'left' },
            { name: 'Exit year (±2yr)', impact: 12, direction: 'both' },
          ].map((v) => (
            <div
              key={v.name}
              className="grid grid-cols-[200px_1fr_60px] items-center gap-3"
            >
              <span className="text-[.78rem] text-ivory truncate">
                {v.name}
              </span>
              <div className="h-6 bg-w-4 rounded relative overflow-hidden">
                <div
                  className={`absolute inset-y-0 ${
                    v.direction === 'right'
                      ? 'left-1/2 bg-gradient-to-r from-ok/30 to-ok'
                      : v.direction === 'left'
                        ? 'right-1/2 bg-gradient-to-l from-err/30 to-err'
                        : 'left-1/2 -translate-x-1/2 bg-gradient-to-r from-warn/30 to-warn'
                  }`}
                  style={{ width: `${v.impact / 2}%` }}
                />
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-w-16" />
              </div>
              <span className="font-mono text-[.72rem] text-gold text-right tabular-nums">
                ±{v.impact}%
              </span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
