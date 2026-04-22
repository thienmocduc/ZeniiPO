import { cn } from '@/lib/utils';
import { MetricCard } from '@/components/modules/metric-card';
import {
  BtnPri,
  BtnSec,
  PageHeader,
  Panel,
} from '@/components/modules/page-header';

type Slide = {
  n: string;
  label: string;
  body: string;
  sub?: string;
  tone: 'title' | 'section' | 'warn' | 'metrics' | 'closing';
};

const SLIDES: Slide[] = [
  { n: '01', label: 'TITLE', body: 'ANIMA Care Global', sub: 'SEED ROUND Q3 2026 · $3M @ $30M', tone: 'title' },
  { n: '02', label: 'PROBLEM', body: 'Người Việt trung lưu thiếu giải pháp phục hồi sức khỏe integrative, chất lượng cao, affordable', tone: 'section' },
  { n: '03', label: 'SOLUTION', body: 'Trung tâm phục hồi + ANIMA 119 supplement + KOC ecosystem — 3-layer flywheel', tone: 'section' },
  { n: '04', label: 'MARKET (TAM)', body: 'VN wellness $3.2B · SEA $18B · 14% CAGR', sub: 'LIVE · from Council', tone: 'metrics' },
  { n: '05', label: 'BUSINESS MODEL', body: 'Product (ANIMA 119) + Service (centers) + SaaS (KOC subscription) · GM 48% Y5', tone: 'section' },
  { n: '06', label: 'TRACTION', body: 'ARR $342K · MoM 18.4% · 12 FTE · 200 KOC pipeline', sub: 'LIVE METRICS', tone: 'metrics' },
  { n: '07', label: 'GO-TO-MARKET ⚠', body: 'KOC-led distribution · cần rewrite · dwell 22s (weakest)', tone: 'warn' },
  { n: '08', label: 'COMPETITION', body: '2×2 matrix · VN hospital nhóm vs modern wellness chain', tone: 'section' },
  { n: '09', label: 'UNIT ECONOMICS', body: 'CAC $48 · LTV $180 · LTV/CAC 3.8× · Payback 4.2mo', tone: 'metrics' },
  { n: '10', label: 'FINANCIALS', body: '5Y forecast · ARR $130M Y5 · Rule40 55+', tone: 'section' },
  { n: '11', label: 'TEAM', body: 'Chairman + 6 C-Level + 5 operators · HealthTech + SaaS exits', tone: 'section' },
  { n: '12', label: 'MILESTONES', body: 'Next 18mo: 5 centers · 1K pro users · SEA soft launch', tone: 'section' },
  { n: '13', label: 'USE OF FUNDS', body: '$3M: 40% ops · 30% mkt · 20% tech · 10% reserve', tone: 'section' },
  { n: '14', label: 'THE ASK', body: 'Raising $3M · 15% equity · Lead welcome', tone: 'metrics' },
  { n: '15', label: 'CLOSING / VISION', body: '"ANIMA là Grab của ngành wellness — 5 năm, SGX, $1.3B"', tone: 'closing' },
];

const SLIDE_TONE: Record<Slide['tone'], string> = {
  title: 'bg-gradient-to-br from-gold/20 to-transparent border-gold',
  section: 'bg-w-4 border-w-8',
  warn: 'bg-warn/10 border-warn',
  metrics: 'bg-gradient-to-br from-chakra-7/10 to-transparent border-chakra-7/30',
  closing: 'bg-gradient-to-br from-chakra-7/20 to-chakra-6/10 border-chakra-7',
};

const SLIDE_LABEL_COLOR: Record<Slide['tone'], string> = {
  title: 'text-gold',
  section: 'text-chakra-6-light',
  warn: 'text-warn',
  metrics: 'text-chakra-7-violet',
  closing: 'text-chakra-7-violet',
};

const REHEARSAL = [
  { persona: 'Khailee Ng · 500 Global style', style: 'Numbers-driven', q: '"Show me unit economics by cohort. CAC stability?"', score: '8.2/10', tone: 'ok' },
  { persona: 'Peter Thiel archetype', style: 'Contrarian · monopoly', q: '"What do you know that competitors don\'t? Moat proof?"', score: '6.8/10', tone: 'warn' },
  { persona: 'Vietnamese angel network', style: 'Relationship-first', q: '"Sếp có ai trong ban cố vấn? Bệ đỡ gia đình/network?"', score: '8.8/10', tone: 'ok' },
  { persona: 'Tiger Global style', style: 'Speed · scale-or-die', q: '"How fast can you 10×? What breaks at 50 centers?"', score: '7.1/10', tone: 'warn' },
];

export default function PitchDeckPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        category="Gọi vốn"
        crumb="Pitch Deck"
        title="Pitch Deck"
        tagline="— v3.2 auto-compile từ live metrics."
        lede="15 slide standard YC-format · metrics tự fill từ realtime KPI · AI VC persona rehearsal · snapshot timestamp mỗi slide."
        actions={
          <>
            <BtnSec>🎭 AI VC rehearsal</BtnSec>
            <BtnSec>Export PDF</BtnSec>
            <BtnPri>Recompile deck</BtnPri>
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Current version" value="v3.2" color="gold" sub="compiled 2h ago" />
        <MetricCard label="Sent to VCs" value="8" color="ok" sub="all tracked open" />
        <MetricCard label="Avg dwell time" value="4.8" unit="min" sub="target 3-6min" />
        <MetricCard label="Weakest slide" value="#7" color="warn" sub="GTM · dwell 22s" />
      </div>

      <Panel
        title="15-Slide YC Format"
        tagline="· auto-filled"
        tag="LIVE METRICS"
        tagTone="live"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {SLIDES.map((s) => (
            <div
              key={s.n}
              className={cn(
                'rounded-card border p-3 aspect-[16/10] flex flex-col justify-between cursor-pointer hover:scale-[1.02] transition-transform',
                SLIDE_TONE[s.tone],
              )}
            >
              <span
                className={cn(
                  'font-mono text-[.55rem] tracking-widest uppercase',
                  SLIDE_LABEL_COLOR[s.tone],
                )}
              >
                {s.n} · {s.label}
              </span>
              <div>
                <div
                  className={cn(
                    'font-display font-semibold leading-snug',
                    s.tone === 'title' ? 'text-[.95rem]' : 'text-[.85rem]',
                    s.tone === 'metrics' && 'text-gold',
                    s.tone === 'warn' && 'text-ivory',
                    s.tone === 'closing' && 'text-ivory italic',
                    s.tone === 'title' && 'text-ivory',
                    s.tone === 'section' && 'text-ivory',
                  )}
                >
                  {s.body}
                </div>
                {s.sub && (
                  <div className="font-mono text-[.58rem] text-gold mt-1.5 tracking-wider">
                    {s.sub}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel
        title="AI VC Persona Rehearsal"
        tagline="· 4 personas tested"
        tag="SIMULATED"
        tagTone="simulation"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-[.78rem]">
            <thead>
              <tr className="border-b border-w-8 text-left">
                {['VC Persona', 'Style', 'Top question', 'Score'].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2 font-mono text-[.6rem] uppercase tracking-widest text-gold"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {REHEARSAL.map((r) => (
                <tr key={r.persona} className="border-b border-w-6">
                  <td className="px-3 py-2 font-medium text-ivory">
                    <strong>{r.persona}</strong>
                  </td>
                  <td className="px-3 py-2 text-ink-2">{r.style}</td>
                  <td className="px-3 py-2 text-ink-2 italic">{r.q}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`font-mono text-[.7rem] px-2 py-0.5 rounded ${
                        r.tone === 'ok' ? 'bg-ok/20 text-ok' : 'bg-warn/20 text-warn'
                      }`}
                    >
                      {r.score}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
