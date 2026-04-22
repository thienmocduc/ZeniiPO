import {
  PhaseTimeline,
  type Phase,
} from '@/components/modules/phase-timeline';
import { MetricCard } from '@/components/modules/metric-card';
import {
  BtnPri,
  BtnSec,
  PageHeader,
  Panel,
} from '@/components/modules/page-header';

const PHASES: Phase[] = [
  {
    id: 'p1',
    number: 'PHASE 1 · DAY 1-90 · ACTIVE',
    title: 'MVP Foundation',
    description: '8 modules core',
    timeline: '90 ngày · Day 42/90',
    budget: '$8,420 (~200tr VND)',
    team: '2 FT + 1 CTO + AI agents',
    gate: '8 module shipped · ANIMA dogfood live',
    completion: 47,
    status: 'active',
  },
  {
    id: 'p2',
    number: 'PHASE 2 · DAY 90-180',
    title: 'Validation + AI Council',
    description: 'Idea Validator + 100 Unicorn DB',
    timeline: '90 ngày',
    budget: '$12K-15K',
    team: '5 FT + 108 agents WIP',
    gate: 'ANIMA seed closed',
    status: 'queued',
  },
  {
    id: 'p3',
    number: 'PHASE 3 · DAY 180-270',
    title: 'Fundraise OS',
    description: 'full 8-stage pipeline automation',
    timeline: '90 ngày',
    budget: '$20K-28K',
    team: '8 FT',
    gate: '5 ANIMA raised seed via Zeniipo',
    status: 'queued',
  },
  {
    id: 'p4',
    number: 'PHASE 4 · DAY 270-365',
    title: 'Growth Engine',
    description: 'Marketing + Sales + Community layers',
    timeline: '95 ngày',
    budget: '$32K-45K',
    team: '12 FT + 72 agents',
    gate: '20+ paying customers',
    status: 'future',
  },
  {
    id: 'p5',
    number: 'PHASE 5 · Y2 H1',
    title: 'Ops Scaling',
    description: 'full 108 agent legion deployed',
    timeline: '6 tháng',
    budget: '$180K-240K',
    team: '25 FT + 108 agents',
    gate: 'ARR $4.2M · Rule40 ≥55',
    status: 'future',
  },
  {
    id: 'p6',
    number: 'PHASE 6 · Y2 Q3 - Y3',
    title: 'IPO Prep',
    description: 'SOX compliance, Big 4 audit, Series B',
    timeline: '~18 tháng',
    budget: '$1.8M-2.4M',
    team: '60 FT + IPO advisors',
    gate: 'ARR $18M · audit unqualified',
    status: 'future',
  },
  {
    id: 'p7',
    number: 'PHASE 7 · Y3-Y4',
    title: 'IPO Execution',
    description: 'prospectus · roadshow · bell ring',
    timeline: '6-9 tháng',
    budget: '$6M-9M fees',
    team: '100+ FT · underwriters · lawyers',
    gate: 'SGX listing live · $1.3B cap',
    status: 'future',
  },
  {
    id: 'p8',
    number: 'PHASE 8 · Y5+ POST-IPO',
    title: 'Post-IPO Operations',
    description: 'quarterly earnings · M&A · dividend',
    timeline: 'Y5+',
    budget: 'var',
    team: '150+ FT',
    gate: 'Quarterly earnings · analyst coverage',
    status: 'future',
  },
];

const CAPITAL = [
  { round: 'Pre-seed', raise: '$500K', yr: '2025', cum: '$500K' },
  { round: 'Seed', raise: '$3M', yr: '2026', cum: '$3.5M' },
  { round: 'Series A', raise: '$12M', yr: '2027', cum: '$15.5M' },
  { round: 'Series B', raise: '$45M', yr: '2028', cum: '$60.5M' },
  { round: 'Pre-IPO', raise: '$70M', yr: '2030', cum: '$130.5M' },
  { round: 'IPO raise', raise: '$150M', yr: '2030', cum: '$280.5M', gold: true },
];

export default function MilestonesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        category="Tổng quan"
        crumb="Milestones · Roadmap 5 năm"
        title="Roadmap 5 năm"
        tagline="— 8 Phase từ ý tưởng đến SGX bell ring."
        lede="Mỗi phase có mục tiêu, deliverables, success criteria, budget. Chuyển phase chỉ khi 80%+ criteria pass."
        actions={
          <>
            <BtnSec>Export Gantt</BtnSec>
            <BtnPri>View Timeline</BtnPri>
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          label="Current Phase"
          value="P1"
          unit="· MVP"
          color="gold"
          sub="Day 42/90 · 47% complete"
        />
        <MetricCard
          label="Budget YTD"
          value="$3.4K"
          unit="spent"
          color="ok"
          sub="of $8,420 P1 · 40%"
        />
        <MetricCard
          label="Phases done"
          value="0"
          unit="/ 8"
          sub="P1 in progress"
        />
        <MetricCard
          label="Days to IPO"
          value="1,654"
          color="warn"
          sub="2030 Q4 SGX target"
        />
      </div>

      <Panel
        title="Phase Timeline"
        tagline="· locked sequence"
        tag="LIVE"
        tagTone="live"
      >
        <PhaseTimeline phases={PHASES} />
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Cumulative Capital Raised" tag="PROJECTION">
          <table className="w-full text-[.82rem]">
            <tbody>
              {CAPITAL.map((c) => (
                <tr
                  key={c.round}
                  className={`border-b border-w-6 ${c.gold ? 'bg-gold/10' : ''}`}
                >
                  <td className="py-2 font-medium text-ivory">
                    {c.gold ? <b>{c.round}</b> : c.round}
                  </td>
                  <td className="py-2 font-mono tabular-nums text-ink-2">
                    {c.raise}
                  </td>
                  <td className="py-2 text-ink-dim">{c.yr}</td>
                  <td
                    className={`py-2 font-mono tabular-nums text-right ${
                      c.gold ? 'text-gold font-bold' : 'text-ivory'
                    }`}
                  >
                    {c.cum}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
        <Panel title="Phase Gate Criteria">
          <div className="text-[.8rem] text-ink-2 leading-relaxed space-y-3">
            <p>
              <strong className="text-ivory">
                Rule duy nhất để chuyển phase:
              </strong>{' '}
              80%+ success criteria của phase hiện tại đã đạt. Nếu không đạt,
              kéo dài phase tối đa 50% timeline gốc. Nếu vẫn không đạt,{' '}
              <span className="text-err font-bold">pivot hoặc shut down</span>.
              Zeniipo tự động warn Chairman T-15 ngày nếu risk phase không pass.
            </p>
            <p>
              <strong className="text-ivory">Exception rule:</strong> Phase 5 &
              6 có thể overlap 3 tháng (Series A + Ops Scaling chạy song song).
            </p>
          </div>
        </Panel>
      </div>
    </div>
  );
}
