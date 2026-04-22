import {
  CriteriaGroup,
  type Criterion,
} from '@/components/modules/criteria-group';
import { MetricCard } from '@/components/modules/metric-card';
import { ScoreCircle } from '@/components/modules/score-circle';
import {
  BtnPri,
  BtnSec,
  PageHeader,
  Panel,
} from '@/components/modules/page-header';

const FINANCIAL: Criterion[] = [
  { id: 'f1', label: 'ARR ≥ $100M (SGX Mainboard threshold)', status: 'pending', note: 'Currently $342K · trajectory Y5 $130M', weight: 10 },
  { id: 'f2', label: 'Rule of 40 ≥ 40 maintained 4+ quarters', status: 'progress', note: 'Current 58 · Y1 Q2', weight: 10 },
  { id: 'f3', label: 'Gross Margin ≥ 50% · trending up', status: 'progress', note: 'Currently 41% · target 48% Y5', weight: 8 },
  { id: 'f4', label: 'Big 4 PCAOB audit unqualified (3 năm)', status: 'pending', note: 'Phase 6 kickoff 2028', weight: 10 },
  { id: 'f5', label: 'IFRS/SFRS financial statements', status: 'pending', note: 'Conversion Phase 6', weight: 8 },
];

const GOVERNANCE: Criterion[] = [
  { id: 'g1', label: 'Board of Directors · 1/3 independent', status: 'progress', note: '2/5 independent · need 2 more', weight: 8 },
  { id: 'g2', label: 'Audit / Remuneration / Nomination committees', status: 'pending', note: 'Form in Phase 6', weight: 6 },
  { id: 'g3', label: 'SOX 404 internal control', status: 'pending', note: 'Phase 6 · 18mo runway', weight: 8 },
  { id: 'g4', label: 'CLO + CFO + Company Secretary · SGX certified', status: 'progress', note: 'CLO hired · CS pending', weight: 6 },
  { id: 'g5', label: 'Share registrar + transfer agent engaged', status: 'pending', weight: 4 },
];

const LEGAL: Criterion[] = [
  { id: 'l1', label: 'Prospectus S-1 draft v1', status: 'pending', weight: 10 },
  { id: 'l2', label: 'Underwriter mandate (DBS/UOB/OCBC)', status: 'pending', weight: 6 },
  { id: 'l3', label: 'IPO legal counsel retained (US + SG)', status: 'pending', weight: 6 },
  { id: 'l4', label: 'IP portfolio · 18 patents filed', status: 'progress', note: '4/18 filed · 14 drafting', weight: 6 },
  { id: 'l5', label: 'Data privacy compliance (PDPA · GDPR)', status: 'pass', note: 'Certified Q1 2026', weight: 4 },
];

const OPS: Criterion[] = [
  { id: 'o1', label: 'Public float ≥ 25% post-IPO', status: 'progress', note: 'Plan 28% float', weight: 6 },
  { id: 'o2', label: 'Min shareholders ≥ 500 post-IPO', status: 'pending', weight: 4 },
  { id: 'o3', label: 'Operating history ≥ 3 năm audited', status: 'progress', note: 'Y4 đạt đủ', weight: 6 },
  { id: 'o4', label: 'Investor Relations platform · 24/7', status: 'pending', weight: 4 },
  { id: 'o5', label: 'Quarterly earnings cadence · analyst calls', status: 'pending', weight: 4 },
];

const CHECKLIST = [
  { milestone: 'Underwriter mandate signed', t: 'T-180', owner: 'Chairman + CFO', status: 'pending' },
  { milestone: 'Audit firm Big 4 engaged · 3-year PCAOB audit', t: 'T-180', owner: 'CFO + CLO', status: 'pending' },
  { milestone: 'IPO legal counsel retained (US+SG)', t: 'T-170', owner: 'CLO', status: 'pending' },
  { milestone: 'Chairman + CEO media training', t: 'T-150', owner: 'Chairman', status: 'pending' },
  { milestone: 'Due Diligence kickoff · 120+ items', t: 'T-150', owner: 'CFO + CLO', status: 'pending' },
  { milestone: 'Prospectus S-1 draft v1', t: 'T-120', owner: 'CFO + Underwriter', status: 'pending' },
  { milestone: 'Regulatory confidential filing (SGX)', t: 'T-90', owner: 'CLO', status: 'pending' },
  { milestone: 'Prospectus S-1 public filing', t: 'T-60', owner: 'CLO + Underwriter', status: 'pending' },
  { milestone: 'Analyst day · research coverage kickoff', t: 'T-45', owner: 'Chairman + CFO', status: 'pending' },
  { milestone: 'Roadshow · 20 cities · 40+ institutional meetings', t: 'T-30 to T-10', owner: 'CEO + CFO', status: 'pending' },
  { milestone: 'Pricing meeting · final valuation', t: 'T-5', owner: 'Chairman + Underwriter', status: 'pending' },
  { milestone: 'SGX Bell Ring · Public trading Day-1', t: 'T-0', owner: 'Chairman', status: 'bell' },
  { milestone: 'Lock-up period 180 days · insider shares', t: 'T+0 to T+180', owner: 'CLO', status: 'placeholder' },
  { milestone: 'Q1 post-IPO earnings call', t: 'T+90', owner: 'Chairman + CFO', status: 'placeholder' },
];

export default function IpoExecutionPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        category="Pháp lý"
        crumb="IPO Execution"
        title="IPO Execution"
        tagline="— T-180 đến bell ring SGX."
        lede="Phase 7 module · chỉ activate khi Phase 6 IPO Prep ≥80% complete. Target SGX listing Q4 2030. Scorecard 20 criteria phân 4 nhóm."
        actions={
          <>
            <BtnSec>Readiness report</BtnSec>
            <BtnPri>Kickoff checklist</BtnPri>
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Time to IPO" value="T-1,654" unit="days" sub="Q4 2030 · SGX" />
        <MetricCard label="Readiness" value="12" unit="/100" color="warn" sub="Phase 7 not active" />
        <MetricCard label="Expected raise" value="$150" unit="M" color="gold" sub="@ $1.3B post-money" />
        <MetricCard label="Underwriter shortlist" value="6" sub="DBS · UOB · OCBC · MS" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-4">
        <Panel title="IPO Readiness Score" tagline="· weighted 20-criteria">
          <div className="flex flex-col items-center gap-4 py-2">
            <ScoreCircle percentage={12} grade="F · NOT READY" size={160} />
            <div className="grid grid-cols-2 gap-2 w-full">
              {[
                { g: 'Financial', s: '6/46', tone: 'err' },
                { g: 'Governance', s: '3/32', tone: 'err' },
                { g: 'Legal', s: '2/32', tone: 'err' },
                { g: 'Operations', s: '1/24', tone: 'err' },
              ].map((x) => (
                <div
                  key={x.g}
                  className="px-3 py-2 bg-w-4 rounded border border-w-8 flex justify-between items-center"
                >
                  <span className="text-[.78rem] text-ivory">{x.g}</span>
                  <span className="font-mono text-[.8rem] text-err tabular-nums">
                    {x.s}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[.72rem] text-ink-dim leading-relaxed">
              Phase 7 chỉ kickoff khi score ≥ 75/100. Hiện tại là placeholder
              view — sẽ fill dần Y2 onwards.
            </p>
          </div>
        </Panel>

        <div className="grid grid-cols-1 gap-4">
          <CriteriaGroup name="Financial (weight 40%)" criteria={FINANCIAL} weight={40} />
          <CriteriaGroup name="Governance (weight 25%)" criteria={GOVERNANCE} weight={25} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CriteriaGroup name="Legal & IP (weight 20%)" criteria={LEGAL} weight={20} />
        <CriteriaGroup name="Operations (weight 15%)" criteria={OPS} weight={15} />
      </div>

      <Panel
        title="T-180 Checklist"
        tagline="· 42 critical items"
        tag="PHASE 7 PREVIEW"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-[.78rem]">
            <thead>
              <tr className="border-b border-w-8 text-left">
                {['Milestone', 'T-offset', 'Owner', 'Status'].map((h) => (
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
              {CHECKLIST.map((c, i) => (
                <tr
                  key={i}
                  className={`border-b border-w-6 ${
                    c.status === 'bell' ? 'bg-gold/10' : ''
                  }`}
                >
                  <td className="px-3 py-2 text-ivory">
                    {c.status === 'bell' ? (
                      <strong>{c.milestone}</strong>
                    ) : (
                      c.milestone
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-ink-2">{c.t}</td>
                  <td className="px-3 py-2 text-ink-2">{c.owner}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`font-mono text-[.6rem] px-2 py-0.5 rounded uppercase tracking-wider ${
                        c.status === 'bell'
                          ? 'bg-gold text-bg'
                          : c.status === 'placeholder'
                            ? 'bg-w-6 text-ink-dim'
                            : 'bg-w-8 text-ink-dim'
                      }`}
                    >
                      {c.status === 'bell'
                        ? 'Phase 8 begins'
                        : c.status === 'placeholder'
                          ? 'Placeholder'
                          : 'Not started'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="SGX Listing Requirements" tagline="· Mainboard">
          <div className="text-[.78rem] text-ink-2 leading-relaxed">
            {[
              { ok: true, label: 'Market cap ≥ S$300M — ANIMA target $1.3B ✓' },
              { ok: true, label: 'Profit test hoặc Market cap test — Market cap route ✓' },
              { ok: true, label: 'Operating history ≥ 3 năm audited — bằng Y4 đủ' },
              { ok: true, label: 'Public float ≥ 25% post-IPO — dilution plan support' },
              { ok: true, label: 'Min shareholders ≥ 500 post-IPO' },
              { ok: true, label: 'Independent directors ≥ 1/3 board' },
              { ok: true, label: 'IFRS/SFRS financial statements — Phase 6 conversion' },
            ].map((r, i) => (
              <div
                key={i}
                className="py-1.5 border-b border-dashed border-w-8 flex items-start gap-2"
              >
                <span className="text-ok font-mono shrink-0">✓</span>
                <span>{r.label}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Why SGX" tagline="· not HOSE / NASDAQ">
          <div className="text-[.78rem] text-ink-2 leading-relaxed space-y-3">
            <p>
              <b className="text-gold">Against HOSE (VN):</b> Volume tooling
              chưa đủ cho $1B+ company · analyst coverage yếu · institutional
              inflow limited · P/E discount vs SEA peers.
            </p>
            <p>
              <b className="text-gold">Against NASDAQ (US):</b> SOX 404
              compliance tốn $3-5M/year · PCAOB audit rủi ro với VN operations
              · analyst không cover SEA wellness.
            </p>
            <p>
              <b className="text-gold">SGX win:</b> SEA-friendly regulator ·
              USD-equivalent liquidity · 40%+ retail SEA investor base ·
              precedent Grab/Razer/Sea listing.
            </p>
          </div>
        </Panel>
      </div>
    </div>
  );
}
