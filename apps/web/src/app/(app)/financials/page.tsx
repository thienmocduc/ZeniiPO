import { cn } from '@/lib/utils';
import { MetricCard } from '@/components/modules/metric-card';
import {
  BtnPri,
  BtnSec,
  PageHeader,
  Panel,
} from '@/components/modules/page-header';

const PNL = [
  { label: 'Revenue', apr: '712M', budget: '680M', variance: '+4.7%', ytd: '2.48B', fy: '24B', tone: 'ok', bold: true },
  { label: '  ANIMA 119 sales', apr: '520M', budget: '500M', variance: '+4%', ytd: '1.85B', fy: '18B', tone: 'ok', indent: true },
  { label: '  Trung tâm therapy', apr: '172M', budget: '160M', variance: '+7.5%', ytd: '580M', fy: '5.2B', tone: 'ok', indent: true },
  { label: '  KOC subscription', apr: '20M', budget: '20M', variance: '—', ytd: '55M', fy: '800M', tone: 'flat', indent: true },
  { label: 'COGS', apr: '(420M)', budget: '(380M)', variance: '-10.5%', ytd: '(1.42B)', fy: '(12.5B)', tone: 'err', bold: true },
  { label: 'Gross Profit', apr: '292M', budget: '300M', variance: '-2.7%', ytd: '1.06B', fy: '11.5B', tone: 'warn', bold: true, sub: true },
  { label: '(Gross Margin %)', apr: '41%', budget: '44%', variance: '-3pp', ytd: '43%', fy: '48%', tone: 'warn', dim: true },
  { label: 'OpEx', apr: '(1,620M)', budget: '(1,550M)', variance: '-4.5%', ytd: '(5.82B)', fy: '(48B)', tone: 'err', bold: true },
  { label: '  Salary & wages', apr: '(820M)', budget: '(800M)', variance: '-2.5%', ytd: '(3.05B)', fy: '(24B)', tone: 'warn', indent: true },
  { label: '  Marketing & KOC', apr: '(380M)', budget: '(320M)', variance: '-18.8%', ytd: '(1.28B)', fy: '(12B)', tone: 'err', indent: true },
  { label: '  Rent & utilities', apr: '(210M)', budget: '(215M)', variance: '+2.3%', ytd: '(820M)', fy: '(5.5B)', tone: 'ok', indent: true },
  { label: '  SaaS + tech', apr: '(105M)', budget: '(110M)', variance: '+4.5%', ytd: '(390M)', fy: '(2.4B)', tone: 'ok', indent: true },
  { label: '  Professional fees', apr: '(105M)', budget: '(105M)', variance: '—', ytd: '(280M)', fy: '(4.1B)', tone: 'flat', indent: true },
  { label: 'EBITDA', apr: '(1,328M)', budget: '(1,250M)', variance: '-6.2%', ytd: '(4.76B)', fy: '(36.5B)', tone: 'err', bold: true, sub: true, emphasis: true },
  { label: 'D&A', apr: '(35M)', budget: '(35M)', variance: '—', ytd: '(135M)', fy: '(1.2B)', tone: 'flat' },
  { label: 'Net Loss', apr: '(1,363M)', budget: '(1,285M)', variance: '-6.1%', ytd: '(4.90B)', fy: '(37.7B)', tone: 'err', bold: true, emphasis: true },
];

const CASHFLOW = [
  { label: 'Operating cash flow', value: '(1,180M)', tone: 'err', bold: true },
  { label: '  Net loss', value: '(1,363M)', tone: 'err', indent: true },
  { label: '  + D&A non-cash', value: '+35M', tone: 'ok', indent: true },
  { label: '  + Working cap changes', value: '+148M', tone: 'ok', indent: true },
  { label: 'Investing', value: '(68M)', tone: 'warn', bold: true },
  { label: '  CapEx trung tâm', value: '(68M)', tone: 'warn', indent: true },
  { label: 'Financing', value: '0', tone: 'flat', bold: true },
  { label: 'Net cash change', value: '(1,248M) ≈ $50K burn', tone: 'gold', bold: true, highlight: true },
  { label: 'Cash EOM', value: '$672K', tone: 'gold', bold: true, highlightGold: true },
];

const TONE_CLS: Record<string, string> = {
  ok: 'text-ok',
  warn: 'text-warn',
  err: 'text-err',
  gold: 'text-gold',
  flat: 'text-ink-2',
};

export default function FinancialsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        category="Tài chính"
        crumb="P&L · Cash Flow"
        title="P&L · Cash Flow"
        tagline="— IFRS compliant · monthly close Day-3."
        lede="Auto consolidation multi-entity · variance vs budget realtime · Plutus agents xử lý Day-1 rollforward."
        actions={
          <>
            <BtnSec>Period: Apr 2026 ▾</BtnSec>
            <BtnSec>Export IFRS</BtnSec>
            <BtnPri>Close Month</BtnPri>
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Revenue (Apr '26)" value="$28.5" unit="K" color="ok" trend={{ direction: 'up', value: '12% MoM' }} />
        <MetricCard label="Gross Margin" value="41" unit="%" color="warn" trend={{ direction: 'down', value: 'target 70%' }} />
        <MetricCard label="Net Burn" value="$48" unit="K/mo" color="err" sub="Target < $40K" />
        <MetricCard label="Cash on hand" value="$672" unit="K" color="gold" sub="14 months runway" />
      </div>

      <Panel
        title="P&L Statement"
        tagline="· Apr 2026 · VND unit"
        tag="UNAUDITED"
        tagTone="default"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-[.78rem]">
            <thead>
              <tr className="border-b border-w-8">
                <th className="text-left px-3 py-2 font-mono text-[.6rem] uppercase tracking-widest text-gold">
                  Line item
                </th>
                {['Apr Actual', 'Apr Budget', 'Variance', 'YTD', 'FY Target'].map((h) => (
                  <th
                    key={h}
                    className="text-right px-3 py-2 font-mono text-[.6rem] uppercase tracking-widest text-ink-dim"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PNL.map((r, i) => (
                <tr
                  key={i}
                  className={cn(
                    'border-b border-w-6',
                    r.sub && 'bg-w-4',
                    r.emphasis && 'bg-err/5',
                    r.dim && 'text-ink-dim',
                  )}
                >
                  <td
                    className={cn(
                      'px-3 py-2',
                      r.indent && 'pl-7',
                      r.bold ? 'font-medium text-ivory' : 'text-ink-2',
                    )}
                  >
                    {r.bold ? <strong>{r.label.trim()}</strong> : r.label}
                  </td>
                  <td className={cn('px-3 py-2 text-right font-mono tabular-nums', r.bold && 'font-semibold', TONE_CLS[r.tone])}>
                    {r.apr}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-ink-2">
                    {r.budget}
                  </td>
                  <td className={cn('px-3 py-2 text-right font-mono tabular-nums', TONE_CLS[r.tone])}>
                    {r.variance}
                  </td>
                  <td className={cn('px-3 py-2 text-right font-mono tabular-nums', r.bold && 'font-semibold', TONE_CLS[r.tone])}>
                    {r.ytd}
                  </td>
                  <td className={cn('px-3 py-2 text-right font-mono tabular-nums', r.bold && 'font-semibold', TONE_CLS[r.tone])}>
                    {r.fy}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 px-3 py-2.5 bg-w-4 border-l-2 border-chakra-7 rounded text-[.74rem] text-ink-2 leading-relaxed">
          <b className="text-gold">Plutus Agent · auto-analysis:</b> Revenue
          ahead of plan, but Marketing overspend $60M do KOC recruitment wave.
          Gross margin <b className="text-warn">-3pp</b> do supply chain ANIMA
          119. <b>Action:</b> COO đàm phán lại supplier tuần sau · CMO review
          CAC/channel.
        </div>
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Cash Flow" tagline="· monthly">
          <table className="w-full text-[.78rem]">
            <tbody>
              {CASHFLOW.map((r, i) => (
                <tr
                  key={i}
                  className={cn(
                    'border-b border-w-6',
                    r.highlight && 'bg-w-4',
                    r.highlightGold && 'bg-gold/10',
                  )}
                >
                  <td
                    className={cn(
                      'px-3 py-2',
                      r.indent && 'pl-6 text-ink-2',
                      r.bold && !r.indent && 'font-medium text-ivory',
                    )}
                  >
                    {r.bold && !r.indent ? <strong>{r.label.trim()}</strong> : r.label}
                  </td>
                  <td
                    className={cn(
                      'px-3 py-2 text-right font-mono tabular-nums',
                      r.bold && 'font-semibold',
                      TONE_CLS[r.tone],
                    )}
                  >
                    {r.value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="Entity consolidation" tagline="· Mother Tenant view">
          <table className="w-full text-[.78rem]">
            <thead>
              <tr className="border-b border-w-8">
                <th className="text-left px-3 py-2 font-mono text-[.6rem] uppercase tracking-widest text-gold">
                  Entity
                </th>
                <th className="text-right px-3 py-2 font-mono text-[.6rem] uppercase tracking-widest text-ink-dim">
                  Revenue
                </th>
                <th className="text-right px-3 py-2 font-mono text-[.6rem] uppercase tracking-widest text-ink-dim">
                  Burn
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                { e: 'ANIMA Care Global', rev: '$28.5K', burn: '($50K)', bold: true, goldRev: true },
                { e: 'WellKOC (pre-revenue)', rev: '—', burn: '($18K)' },
                { e: 'Biotea84 (R&D)', rev: '—', burn: '($4K)' },
                { e: 'Zeni Digital (shadow)', rev: '—', burn: '($12K)' },
                { e: 'Consolidated', rev: '$28.5K', burn: '($84K)', total: true, bold: true },
              ].map((r) => (
                <tr
                  key={r.e}
                  className={cn('border-b border-w-6', r.total && 'bg-w-4')}
                >
                  <td
                    className={cn('px-3 py-2', r.bold ? 'font-medium text-ivory' : 'text-ink-2')}
                  >
                    {r.bold ? <strong>{r.e}</strong> : r.e}
                  </td>
                  <td
                    className={cn(
                      'px-3 py-2 text-right font-mono tabular-nums',
                      r.goldRev ? 'text-gold' : 'text-ink-2',
                      r.total && 'text-gold font-semibold',
                    )}
                  >
                    {r.rev}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-err">
                    {r.burn}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 text-[.7rem] text-ink-dim leading-relaxed">
            Consolidation áp dụng khi Chủ tịch có toàn quyền (CHR-GLOBAL-001).
            Inter-company eliminations auto-handled.
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Unit Economics" tag="COHORT Y1">
          <div className="grid grid-cols-2 gap-3">
            {[
              { k: 'CAC (blended)', v: '$48', sub: 'Target $45 · KOC-led' },
              { k: 'LTV (24mo)', v: '$180', sub: 'Cohort avg · upsell 1.8×' },
              { k: 'LTV/CAC', v: '3.8×', sub: 'Healthy > 3', tone: 'gold' },
              { k: 'Payback', v: '4.2 mo', sub: 'Target < 6mo', tone: 'ok' },
              { k: 'Gross Margin', v: '41%', sub: 'Target Y5: 48%', tone: 'warn' },
              { k: 'Rule of 40', v: '58', sub: 'Growth + Margin' },
            ].map((u) => (
              <div key={u.k} className="px-3 py-2.5 bg-w-4 rounded border border-w-8">
                <div className="font-mono text-[.58rem] text-ink-dim uppercase mb-0.5">
                  {u.k}
                </div>
                <div
                  className={cn(
                    'font-display text-xl font-medium',
                    u.tone === 'gold' && 'text-gold',
                    u.tone === 'ok' && 'text-ok',
                    u.tone === 'warn' && 'text-warn',
                    !u.tone && 'text-ivory',
                  )}
                >
                  {u.v}
                </div>
                <div className="text-[.68rem] text-ink-dim mt-0.5">{u.sub}</div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="3-year Forecast" tagline="· ARR" tag="PROJECTION">
          <div className="flex items-end gap-2 h-56 px-1">
            {[
              { y: '2024', v: '$0', h: 0, label: 'Pre-revenue' },
              { y: '2025', v: '$120K', h: 5 },
              { y: "2026", v: '$2.8M', h: 20, current: true },
              { y: '2027', v: '$18M', h: 45 },
              { y: '2028', v: '$64M', h: 75 },
              { y: '2029', v: '$130M', h: 100, target: true },
            ].map((y) => (
              <div key={y.y} className="flex-1 flex flex-col items-center gap-1.5">
                <div className="w-full relative h-full flex items-end">
                  <div
                    className={cn(
                      'w-full rounded-t transition-all',
                      y.target
                        ? 'bg-gradient-to-t from-gold-dark to-gold-light'
                        : y.current
                          ? 'bg-gradient-to-t from-chakra-6-deep to-chakra-6-glow'
                          : 'bg-w-8',
                    )}
                    style={{ height: `${y.h}%` }}
                  />
                </div>
                <div className="font-mono text-[.6rem] text-ink-2">{y.y}</div>
                <div
                  className={cn(
                    'font-mono text-[.72rem] font-semibold',
                    y.target && 'text-gold',
                    y.current && 'text-chakra-6-light',
                    !y.current && !y.target && 'text-ink-dim',
                  )}
                >
                  {y.v}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 text-[.72rem] text-ink-dim leading-relaxed">
            Trajectory triple-triple-double. Y5 $130M ARR = SGX main board
            threshold. Rule of 40 duy trì ≥55 qua tất cả years.
          </div>
        </Panel>
      </div>
    </div>
  );
}
