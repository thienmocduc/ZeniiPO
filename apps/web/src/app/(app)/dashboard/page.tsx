import { MetricCard } from '@/components/modules/metric-card';
import { ScoreCircle } from '@/components/modules/score-circle';
import { ActionList } from '@/components/modules/action-list';
import { RecommendationCard } from '@/components/modules/recommendation-card';
import {
  BtnPri,
  BtnSec,
  PageHeader,
  Panel,
} from '@/components/modules/page-header';

const ACTIONS = [
  {
    id: '1',
    priority: 'T1' as const,
    title: 'Chốt term sheet Touchstone Partners — deadline T-3',
    owner: 'CFO · Lâm Khánh',
    due: '24/04',
    status: 'progress' as const,
  },
  {
    id: '2',
    priority: 'T1' as const,
    title: 'Gross margin slipping: đàm phán lại supplier ANIMA 119',
    owner: 'COO · Ngọc Hà',
    due: '26/04',
    status: 'open' as const,
  },
  {
    id: '3',
    priority: 'T2' as const,
    title: 'Rewrite slide 07 (GTM) — dwell time 22s yếu nhất deck',
    owner: 'CMO · Duy Anh',
    due: '30/04',
    status: 'open' as const,
  },
  {
    id: '4',
    priority: 'T2' as const,
    title: 'Upload 2 file còn thiếu folder 03 Legal',
    owner: 'CLO · Minh Trang',
    due: '28/04',
    status: 'open' as const,
  },
  {
    id: '5',
    priority: 'T3' as const,
    title: 'Lên lịch 1:1 với 200 Founder KOC Q2 wave',
    owner: 'Head KOC · Hương',
    due: '05/05',
    status: 'open' as const,
  },
];

const FLOW_STEPS = [
  { label: 'Chairman Event', active: true },
  { label: 'Goal Anchor', active: true },
  { label: 'OKR Cascade', active: true },
  { label: '7 Role Dashboard', active: true },
  { label: '108 Agent Legion', active: true },
  { label: 'Automation Engine', active: false },
  { label: 'Execution', active: false },
  { label: 'KPI Layer', active: false },
  { label: 'Feedback Loop', active: false, loop: true },
];

const ENTITIES = [
  {
    name: 'ANIMA Care Global',
    status: 'ACTIVE',
    tone: 'ok',
    desc: 'Valuation $47M · Seed Q3/2026 · 2 trung tâm · 200 Founder KOC',
    note: 'Ownership: Zeni 85% · ESOP 10% · Advisors 5%',
  },
  {
    name: 'WellKOC',
    status: 'BUILDING',
    tone: 'chakra7',
    desc: 'Pre-seed · 131 AI agents · 12 languages',
    note: 'Target Q4/2026 soft launch',
  },
  {
    name: 'Zeni Digital',
    status: 'SHADOW',
    tone: 'chakra6',
    desc: 'Parent brand · ZeniOS/ZeniERP/ZeniPay/Zeniipo',
    note: 'Dogfood test on Zeniipo · Series A 2027',
  },
  {
    name: 'Biotea84',
    status: 'EARLY',
    tone: 'gold',
    desc: 'Independent trà thảo mộc · product R&D',
    note: 'Soft launch 2027',
  },
  {
    name: 'Zeni Chain',
    status: 'INFRA',
    tone: 'cyan',
    desc: 'On-chain infra · ESOP + commission stacking',
    note: 'Phase 2 deploy Q2/2026',
  },
  {
    name: 'NexBuild',
    status: 'PARTNER',
    tone: 'warn',
    desc: 'Partner · không thuộc Zeni Holdings · dùng Zeni Digital',
    note: 'Cross-sell relationship',
  },
];

const TONE_MAP: Record<string, string> = {
  ok: 'border-l-ok from-ok/10',
  chakra7: 'border-l-chakra-7 from-chakra-7/10',
  chakra6: 'border-l-chakra-6 from-chakra-6/10',
  gold: 'border-l-gold from-gold/10',
  cyan: 'border-l-layer-3 from-layer-3/10',
  warn: 'border-l-warn from-warn/10',
};

const STATUS_MAP: Record<string, string> = {
  ACTIVE: 'bg-ok/20 text-ok',
  BUILDING: 'bg-chakra-6/20 text-chakra-6-light',
  SHADOW: 'bg-chakra-7/20 text-chakra-7-violet',
  EARLY: 'bg-ink-dim/20 text-ink-dim',
  INFRA: 'bg-layer-3/20 text-layer-3',
  PARTNER: 'bg-warn/20 text-warn',
};

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        category="Tổng quan"
        crumb="Dashboard"
        title="Chào buổi sáng,"
        tagline="Chủ tịch Đức."
        lede="Runway 14 tháng · 4 VC đang DD · Readiness 842/1000. Hôm nay cần chốt Touchstone + fix gross margin. Hermes, Plutus và Themis đã pre-brief."
        actions={
          <>
            <BtnSec>🎯 Thao trường</BtnSec>
            <BtnSec>📊 Export</BtnSec>
            <BtnSec>🔄 Refresh</BtnSec>
            <BtnPri>+ Tạo OKR mới</BtnPri>
          </>
        }
      />

      {/* Flow ribbon */}
      <div className="flex items-center gap-1.5 flex-wrap rounded-card border border-w-8 bg-panel p-3">
        {FLOW_STEPS.map((step, i) => (
          <div key={step.label} className="flex items-center gap-1.5">
            <span
              className={`font-mono text-[.65rem] px-2 py-1 rounded uppercase tracking-wider ${
                step.active
                  ? 'bg-gold/20 text-gold border border-gold/30'
                  : 'bg-w-6 text-ink-dim border border-w-8'
              }`}
            >
              {step.label}
            </span>
            {i < FLOW_STEPS.length - 1 && (
              <span className="text-ink-dim text-xs">
                {step.loop ? '↺' : '→'}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          label="MRR (Apr '26)"
          value="$28.5"
          unit="K"
          color="gold"
          trend={{ direction: 'up', value: '12% MoM' }}
        />
        <MetricCard
          label="Runway"
          value="14"
          unit="tháng"
          color="ok"
          sub="$672K cash · burn $48K/mo"
        />
        <MetricCard
          label="Net Burn"
          value="$48"
          unit="K/mo"
          color="warn"
          sub="Target < $40K · CMO overspend"
        />
        <MetricCard
          label="Team"
          value="12"
          unit="FTE"
          color="default"
          sub="Attrition 0% · hiring 3 role"
        />
      </div>

      {/* 2-col: Readiness + Alerts + Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4">
        <Panel
          title="Next 5 Priority Actions"
          tagline="— hôm nay"
          tag="AUTO-RANKED"
          tagTone="live"
        >
          <ActionList items={ACTIONS} />
        </Panel>

        <div className="space-y-4">
          <Panel
            title="Fundraise Readiness"
            tagline="— Seed Q3/2026"
            tag="LIVE"
            tagTone="live"
          >
            <div className="flex flex-col items-center gap-3 py-2">
              <ScoreCircle percentage={84} grade="GREENLIGHT" />
              <div className="text-center text-[.78rem] text-ink-2 leading-relaxed max-w-[280px]">
                Score <b className="text-gold">842/1000</b>. 3 gap còn lại:
                gross margin, GTM slide, 2 legal docs.
              </div>
            </div>
          </Panel>

          <Panel
            title="Cảnh báo của AI"
            tag="3 items"
            tagTone="default"
          >
            <div className="flex flex-col gap-2.5">
              <RecommendationCard
                severity="high"
                agent="PLUTUS"
                title="Gross margin -3pp vs plan"
                body="ANIMA 119 supplier tăng giá nhập 8%. Đang có 2 supplier backup — COO cần chốt tuần này."
                cta="Mở supplier comparison"
              />
              <RecommendationCard
                severity="med"
                agent="HERMES"
                title="CMO overspend $60M (Marketing)"
                body="KOC recruitment wave đẩy CAC lên $58 vs plan $48. Tạm hãm 40% budget tháng 5 hoặc tăng LTV qua upsell."
                cta="Review channel split"
              />
              <RecommendationCard
                severity="low"
                agent="THEMIS"
                title="Touchstone DD 84/120 items"
                body="Chỉ còn 36 items — hoàn thành trong 5 ngày là có thể chốt term sheet."
                cta="Xem DD tracker"
              />
            </div>
          </Panel>
        </div>
      </div>

      {/* Entity map */}
      <Panel
        title="Zeni Holdings Entity Map"
        tagline="— Mother Tenant view"
        tag="CHR-GLOBAL-001"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {ENTITIES.map((e) => (
            <div
              key={e.name}
              className={`rounded-card border border-w-8 border-l-4 ${TONE_MAP[e.tone]} bg-gradient-to-br to-transparent p-3.5`}
            >
              <div className="flex items-baseline justify-between mb-1.5">
                <div className="font-display text-[.95rem] font-semibold text-ivory">
                  {e.name}
                </div>
                <span
                  className={`font-mono text-[.58rem] px-1.5 py-0.5 rounded tracking-widest ${STATUS_MAP[e.status]}`}
                >
                  {e.status}
                </span>
              </div>
              <p className="text-[.7rem] text-ink-dim leading-snug mb-1.5">
                {e.desc}
              </p>
              <p className="text-[.68rem] text-gold">{e.note}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
