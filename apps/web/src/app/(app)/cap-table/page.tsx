import { DonutChart } from '@/components/modules/donut-chart';
import { MetricCard } from '@/components/modules/metric-card';
import {
  BtnPri,
  BtnSec,
  PageHeader,
  Panel,
} from '@/components/modules/page-header';

const SLICES = [
  { label: 'Thiên Mộc Đức · Founder', value: 75, color: '#E4C16E', sub: '7.5M · Class A · 10× voting' },
  { label: 'Zeni Holdings Pte Ltd', value: 10, color: '#4f46e5', sub: '1M · Parent · Class A' },
  { label: 'ESOP Pool (SPV SG)', value: 10, color: '#a855f7', sub: '1M · Option · Class B' },
  { label: 'Advisor Pool', value: 3, color: '#06b6d4', sub: '300K · 3 advisors · Class B' },
  { label: 'Friends & Family', value: 2, color: '#4ade80', sub: '200K · pre-seed · 5 people' },
];

const TRAJECTORY = [
  { round: 'Pre-seed (F&F)', timing: '2025 Q4', raise: '$500K', preMoney: '—', postMoney: '$2.5M', founder: '85%', esop: '10%', investors: '2%' },
  { round: 'Seed', timing: '2026 Q3', raise: '$3M', preMoney: '$30M', postMoney: '$33M', founder: '63.8%', esop: '11.5%', investors: '15%', now: true },
  { round: 'Series A', timing: '2027 Q2', raise: '$12M', preMoney: '$80M', postMoney: '$92M', founder: '52%', esop: '13%', investors: '28%' },
  { round: 'Series B', timing: '2028 Q4', raise: '$45M', preMoney: '$300M', postMoney: '$345M', founder: '44%', esop: '13%', investors: '41%' },
  { round: 'Pre-IPO', timing: '2030 Q1', raise: '$70M', preMoney: '$900M', postMoney: '$970M', founder: '39%', esop: '14%', investors: '48%' },
  { round: 'SGX IPO', timing: '2030 Q4', raise: '$150M', preMoney: '$1.15B', postMoney: '$1.3B', founder: '34.2%', esop: '12%', investors: '53%', ipo: true },
];

const SCENARIO = [
  { name: 'Thiên Mộc Đức', class: 'Founder · Class A', shares: '7,500,000', pct: '63.8%', color: '#E4C16E', dim: true },
  { name: 'Zeni Holdings', class: 'Parent', shares: '1,000,000', pct: '8.5%', color: '#4f46e5', dim: true },
  { name: 'ESOP Pool (top-up 3%)', class: '1.35M total post-round', shares: '1,350,000', pct: '11.5%', color: '#a855f7', dim: true },
  { name: 'Advisor Pool', class: 'Diluted', shares: '300,000', pct: '2.6%', color: '#06b6d4', dim: true },
  { name: 'F&F', class: 'Diluted', shares: '200,000', pct: '1.7%', color: '#4ade80', dim: true },
  { name: 'Seed Investors (new)', class: 'Class A Preferred · 1× liq pref', shares: '1,400,000', pct: '11.9%', color: '#E4C16E', highlight: true },
];

export default function CapTablePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        category="Gọi vốn"
        crumb="Cap Table"
        title="Cap Table"
        tagline="— ANIMA Care Global."
        lede="Bảng cơ cấu vốn realtime. Auto-recompute khi có round mới, ESOP grant, hay transfer."
        actions={
          <>
            <BtnSec>Scenario: Current ▾</BtnSec>
            <BtnSec>Export CSV</BtnSec>
            <BtnPri>+ New Round</BtnPri>
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Tổng cổ phần" value="10" unit="M" color="gold" sub="100% fully-diluted" />
        <MetricCard label="Founder holding" value="85" unit="%" color="ok" sub="8.5M · Class A" />
        <MetricCard label="ESOP Pool" value="10" unit="%" sub="1M alloc · 420K vested" />
        <MetricCard label="Dilution post-Seed" value="15" unit="%" color="warn" sub="Projected · pending close" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Shareholders" tagline="· Current" tag="LIVE" tagTone="live">
          <DonutChart
            slices={SLICES}
            centerValue="10M"
            centerLabel="shares issued"
          />
        </Panel>

        <Panel
          title="Scenario: Sau Seed $3M"
          tagline="@ pre-money $30M"
          tag="SIMULATION"
          tagTone="simulation"
        >
          <div className="flex flex-col gap-2">
            {SCENARIO.map((s) => (
              <div
                key={s.name}
                className={`flex items-center gap-3 px-2.5 py-1.5 rounded ${
                  s.highlight ? 'bg-gold/15 border border-gold/40' : 'bg-w-4'
                } ${s.dim ? 'opacity-70' : ''}`}
              >
                <span
                  className="w-3 h-3 rounded shrink-0"
                  style={{ background: s.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[.82rem] text-ivory">{s.name}</div>
                  <div className="font-mono text-[.6rem] text-ink-dim">
                    {s.class}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono text-[.72rem] tabular-nums text-ink-2">
                    {s.shares}
                  </div>
                  <div className="font-mono text-[.72rem] text-gold tabular-nums">
                    {s.pct}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 px-3 py-2.5 bg-w-4 border-l-2 border-chakra-7 rounded text-[.72rem] text-ink-2 leading-relaxed">
            <b className="text-gold">Themis Agent:</b> Dilution post-Seed 15%
            (thường range 15-25% cho seed). Founder giữ 63.8% — an toàn cho
            Series A/B sau.
          </div>
        </Panel>
      </div>

      <Panel
        title="Dilution Trajectory 5 rounds"
        tagline="· IPO exit model"
        tag="IFRS-READY"
        tagTone="audit"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-[.78rem]">
            <thead>
              <tr className="border-b border-w-8 text-left">
                {['Round', 'Timing', 'Raise', 'Pre-money', 'Post-money', 'Founder %', 'ESOP %', 'Investors cum %'].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-3 py-2 font-mono text-[.6rem] uppercase tracking-widest text-gold"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {TRAJECTORY.map((r) => (
                <tr
                  key={r.round}
                  className={`border-b border-w-6 ${
                    r.now ? 'bg-gold/10' : r.ipo ? 'bg-chakra-7/10' : ''
                  }`}
                >
                  <td className="px-3 py-2 font-medium text-ivory">
                    <strong>{r.round}</strong>
                    {r.now && (
                      <span className="ml-2 font-mono text-[.55rem] px-1.5 py-0.5 rounded bg-gold text-bg">
                        NOW
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-ink-2">{r.timing}</td>
                  <td className="px-3 py-2 font-mono tabular-nums text-ink-2">
                    {r.raise}
                  </td>
                  <td className="px-3 py-2 font-mono tabular-nums text-ink-2">
                    {r.preMoney}
                  </td>
                  <td className="px-3 py-2 font-mono tabular-nums text-ink-2">
                    {r.postMoney}
                  </td>
                  <td className="px-3 py-2 font-mono tabular-nums text-ivory">
                    {r.founder}
                  </td>
                  <td className="px-3 py-2 font-mono tabular-nums text-ink-2">
                    {r.esop}
                  </td>
                  <td className="px-3 py-2 font-mono tabular-nums text-ivory">
                    {r.investors}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 px-3 py-2.5 bg-w-4 border-l-2 border-gold rounded text-[.72rem] text-ink-2 leading-relaxed">
          <b className="text-gold">Founder final @ IPO: 34.2% = $445M</b> (giả
          định giá IPO giữ valuation). Control vẫn hold qua Class A voting
          (10×). Class B cho public chỉ 1× voting.
        </div>
      </Panel>
    </div>
  );
}
