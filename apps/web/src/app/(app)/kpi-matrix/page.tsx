import { cn } from '@/lib/utils';
import {
  BtnPri,
  BtnSec,
  PageHeader,
  Panel,
} from '@/components/modules/page-header';

const DIMENSIONS = [
  {
    name: 'Financial',
    cells: [
      { level: 'Company', value: 'ARR $342K · Burn 1.8× · GM 41%', tone: 'warn' },
      { level: 'Department', value: 'Budget vs actual: +12%', tone: 'ok' },
      { level: 'Team', value: 'CAC: $48', tone: 'ok' },
      { level: 'Individual', value: 'Rev/FTE: $19K', tone: 'warn' },
      { level: 'Task', value: 'Cost/task: $12', tone: 'ok' },
    ],
  },
  {
    name: 'Growth',
    cells: [
      { level: 'Company', value: 'MoM 18.4% · LTV $180', tone: 'ok' },
      { level: 'Department', value: 'Funnel: 2.8% → target 3%', tone: 'warn' },
      { level: 'Team', value: 'Campaign ROAS 3.2×', tone: 'ok' },
      { level: 'Individual', value: 'Leads/day: 14', tone: 'ok' },
      { level: 'Task', value: 'A/B lift: +8%', tone: 'ok' },
    ],
  },
  {
    name: 'Operations',
    cells: [
      { level: 'Company', value: 'Ops ratio 0.62', tone: 'ok' },
      { level: 'Department', value: 'SOP compliance 78%', tone: 'warn' },
      { level: 'Team', value: 'Cycle time 3.2d', tone: 'ok' },
      { level: 'Individual', value: 'Velocity: 14 pts', tone: 'ok' },
      { level: 'Task', value: 'Completion: 2.4d', tone: 'ok' },
    ],
  },
  {
    name: 'People',
    cells: [
      { level: 'Company', value: 'HC 12 · Attrition 0%', tone: 'ok' },
      { level: 'Department', value: 'Dept NPS: 52', tone: 'ok' },
      { level: 'Team', value: 'Engagement: 71', tone: 'ok' },
      { level: 'Individual', value: '1:1 cadence 92%', tone: 'ok' },
      { level: 'Task', value: 'Ownership: 88%', tone: 'ok' },
    ],
  },
  {
    name: 'Tech',
    cells: [
      { level: 'Company', value: 'Uptime 99.94% · Sec 91', tone: 'ok' },
      { level: 'Department', value: 'Sprint velocity 38', tone: 'ok' },
      { level: 'Team', value: 'PR review 4h', tone: 'ok' },
      { level: 'Individual', value: 'Commits/wk: 12', tone: 'ok' },
      { level: 'Task', value: 'Bug rate 0.3%', tone: 'ok' },
    ],
  },
  {
    name: 'Risk',
    cells: [
      { level: 'Company', value: 'Risk score 72/100', tone: 'warn' },
      { level: 'Department', value: 'Audit findings: 2 low', tone: 'warn' },
      { level: 'Team', value: 'Compliance breach 0', tone: 'ok' },
      { level: 'Individual', value: 'Policy violation 0', tone: 'ok' },
      { level: 'Task', value: 'Task risk 3 flags', tone: 'warn' },
    ],
  },
  {
    name: 'Brand',
    cells: [
      { level: 'Company', value: 'Brand NPS 48 · Aware 12%', tone: 'warn' },
      { level: 'Department', value: 'Content reach 82K/mo', tone: 'ok' },
      { level: 'Team', value: 'Sentiment +68', tone: 'ok' },
      { level: 'Individual', value: 'Thought leadership 4', tone: 'ok' },
      { level: 'Task', value: 'PR mention 11', tone: 'ok' },
    ],
  },
];

const BENCHMARKS = [
  { name: 'Growth rate MoM', our: 'ANIMA: 18.4%', cohort: 'Cohort p73: 22%', pct: 73, tone: 'warn' },
  { name: 'Capital efficiency', our: 'ANIMA: 0.65', cohort: 'Cohort p82: 0.58', pct: 82, tone: 'ok' },
  { name: 'LTV/CAC', our: 'ANIMA: 3.8', cohort: 'Cohort p68: 3.2', pct: 68, tone: 'ok' },
  { name: 'Gross margin', our: 'ANIMA: 41%', cohort: 'Cohort p24: 52%', pct: 24, tone: 'err' },
  { name: 'Rule of 40', our: 'ANIMA: 58', cohort: 'Cohort p78: 48', pct: 78, tone: 'ok' },
];

const TREND = [
  { m: "May '25", v: '$32K', h: 8 },
  { m: "Jun '25", v: '$48K', h: 12 },
  { m: "Jul '25", v: '$64K', h: 16 },
  { m: "Aug '25", v: '$84K', h: 21 },
  { m: "Sep '25", v: '$112K', h: 28 },
  { m: "Oct '25", v: '$144K', h: 36 },
  { m: "Nov '25", v: '$176K', h: 44 },
  { m: "Dec '25", v: '$208K', h: 52 },
  { m: "Jan '26", v: '$240K', h: 60 },
  { m: "Feb '26", v: '$280K', h: 70 },
  { m: "Mar '26", v: '$312K', h: 78 },
  { m: "Apr '26", v: '$342K', h: 86, current: true },
];

const TONE_BG: Record<string, string> = {
  ok: 'bg-ok/5 border-ok/20 text-ok',
  warn: 'bg-warn/5 border-warn/20 text-warn',
  err: 'bg-err/5 border-err/20 text-err',
};

export default function KpiMatrixPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        category="Vận hành"
        crumb="KPI Matrix"
        title="KPI Matrix"
        tagline="5 level × 7 dimension = 35 ô."
        lede="Mỗi ô có benchmark ngành, benchmark 100 unicorn, và trend 12 tháng. Period selector: Q1/Q2/YTD/12M."
        actions={
          <>
            <BtnSec>Period: Q2 2026 ▾</BtnSec>
            <BtnSec>Benchmark: 100 Unicorn ▾</BtnSec>
            <BtnPri>Export</BtnPri>
          </>
        }
      />

      <Panel title="Matrix realtime" tagline="· ANIMA Y1 Q2" tag="LIVE" tagTone="live">
        <div className="overflow-x-auto">
          <table className="w-full text-[.78rem]">
            <thead>
              <tr className="border-b border-w-8">
                <th className="text-left px-3 py-2 font-mono text-[.62rem] uppercase tracking-widest text-gold w-[120px]">
                  Dimension
                </th>
                {['Company', 'Department', 'Team', 'Individual', 'Task'].map(
                  (h) => (
                    <th
                      key={h}
                      className="text-left px-3 py-2 font-mono text-[.62rem] uppercase tracking-widest text-ink-dim"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {DIMENSIONS.map((d) => (
                <tr key={d.name} className="border-b border-w-6">
                  <td className="px-3 py-2.5 font-medium text-ivory">
                    {d.name}
                  </td>
                  {d.cells.map((c, i) => (
                    <td key={i} className="px-2 py-2">
                      <div
                        className={cn(
                          'px-2.5 py-1.5 rounded border text-[.72rem] font-mono',
                          TONE_BG[c.tone] ?? 'bg-w-4 border-w-8 text-ink-2',
                        )}
                      >
                        {c.value}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel
          title="Benchmark vs 100 Unicorn"
          tagline="· Y1 stage"
          tag="COHORT"
        >
          <div className="flex flex-col gap-3">
            {BENCHMARKS.map((b) => (
              <div key={b.name}>
                <div className="flex justify-between text-[.78rem] mb-1">
                  <span className="text-ivory">
                    <b>{b.name}</b>
                  </span>
                  <span className="text-gold font-mono text-[.68rem]">
                    {b.our} · {b.cohort}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-w-8 overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full',
                      b.tone === 'ok' && 'bg-ok',
                      b.tone === 'warn' && 'bg-warn',
                      b.tone === 'err' && 'bg-err',
                    )}
                    style={{ width: `${b.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 px-3 py-2.5 bg-w-4 border-l-2 border-chakra-7 rounded text-[.72rem] text-ink-2 leading-relaxed">
            <b className="text-gold">AI đọc data:</b> ANIMA{' '}
            <b className="text-ok">outperform</b> 3/5 dimension. Yếu nhất là{' '}
            <b className="text-err">Gross Margin (p24)</b> — tự động flag
            COO-001 rà soát supply chain cost.
          </div>
        </Panel>

        <Panel title="KPI Trend 12 tháng" tagline="· ARR" tag="LIVE" tagTone="live">
          <div className="flex items-end gap-1 h-48 px-1">
            {TREND.map((t) => (
              <div
                key={t.m}
                className="flex-1 relative group cursor-pointer min-w-0"
                style={{ height: `${t.h}%` }}
              >
                <div
                  className={cn(
                    'w-full h-full rounded-t',
                    t.current
                      ? 'bg-gradient-to-t from-gold-dark to-gold-light'
                      : 'bg-gradient-to-t from-chakra-6-deep to-chakra-6',
                  )}
                />
                <span className="hidden group-hover:block absolute -top-6 left-1/2 -translate-x-1/2 bg-panel-2 border border-w-12 px-2 py-0.5 rounded text-[.6rem] font-mono text-ivory whitespace-nowrap">
                  {t.m} · {t.v}
                </span>
              </div>
            ))}
          </div>
          <div className="flex justify-between font-mono text-[.58rem] text-ink-dim tracking-wider mt-1">
            {TREND.map((t) => (
              <span key={t.m} className={cn(t.current && 'text-gold')}>
                {t.m.split(' ')[0][0]}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2 mt-4">
            {[
              { k: 'CAGR', v: '+21.4%/mo' },
              { k: 'Best month', v: "Apr '26" },
              { k: 'Forecast May', v: '$398K' },
            ].map((s) => (
              <div key={s.k} className="px-3 py-2 bg-w-4 rounded">
                <div className="font-mono text-[.58rem] text-ink-dim uppercase mb-0.5">
                  {s.k}
                </div>
                <div className="text-gold font-mono text-[.9rem] font-semibold">
                  {s.v}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
