import { MetricCard } from '@/components/modules/metric-card';
import {
  BtnPri,
  BtnSec,
  PageHeader,
  Panel,
} from '@/components/modules/page-header';

const FOLDERS = [
  { code: '📂 01', name: 'Corporate', path: '/corporate', files: 8, status: 'Complete', tone: 'ok', perm: 'L1 · all investors' },
  { code: '📂 02', name: 'Financials', path: '/financials', files: 12, status: 'Complete', tone: 'ok', perm: 'L2 · NDA signed' },
  { code: '📂 03', name: 'Cap Table & Legal', path: '/legal', files: 6, status: '2 missing', tone: 'warn', perm: 'L2 · NDA signed' },
  { code: '📂 04', name: 'Product & Tech', path: '/product', files: 5, status: 'Complete', tone: 'ok', perm: 'L1 · all' },
  { code: '📂 05', name: 'Market & GTM', path: '/market', files: 4, status: 'Complete', tone: 'ok', perm: 'L1 · all' },
  { code: '📂 06', name: 'Team & HR', path: '/team', files: 3, status: '1 missing', tone: 'warn', perm: 'L3 · term sheet' },
  { code: '📂 07', name: 'Operations', path: '/ops', files: 2, status: '3 missing', tone: 'err', perm: 'L3 · term sheet' },
  { code: '📂 08', name: 'IP & Compliance', path: '/ip', files: 2, status: 'Complete', tone: 'ok', perm: 'L2 · NDA' },
];

const ACTIVITY = [
  { actor: 'Touchstone Partners · Tùng Nguyễn', time: '2h ago', action: 'Downloaded /financials/anima_5yr_model_v3.xlsx · session 14m', tone: 'ok' },
  { actor: '500 Global · Khailee Ng', time: '6h ago', action: 'Submitted 3 Q&A questions on /product/koc_flywheel.pdf', tone: 'chakra7' },
  { actor: 'Golden Gate · Vinnie Lauria', time: '1d ago', action: 'Viewed /market/tam_sam_som.pdf · /team/founder_bios.pdf', tone: 'cyan' },
  { actor: 'Hermes Agent · auto-generated', time: '2d ago', action: 'Created /financials/q1_2026_actuals_report.pdf · pending CFO approve', tone: 'gold' },
  { actor: 'ThinkZone · Bui Thanh Do', time: '3d ago', action: 'NDA signed · unlocked L2 access', tone: 'ok' },
];

const ACTIVITY_TONE: Record<string, string> = {
  ok: 'border-l-ok',
  chakra7: 'border-l-chakra-7',
  cyan: 'border-l-layer-3',
  gold: 'border-l-gold',
};

const STATUS_TONE: Record<string, string> = {
  ok: 'bg-ok/20 text-ok',
  warn: 'bg-warn/20 text-warn',
  err: 'bg-err/20 text-err',
};

export default function DataRoomPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        category="Gọi vốn"
        crumb="Data Room"
        title="Data Room"
        tagline="— DD-ready vault."
        lede="42 tài liệu structured · permission matrix cho từng investor · Q&A auto-capture · download audit log."
        actions={
          <>
            <BtnSec>🔒 Permissions</BtnSec>
            <BtnSec>DD Tracker</BtnSec>
            <BtnPri>+ Upload</BtnPri>
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Tài liệu" value="42" unit="/50" color="ok" sub="DD checklist complete 84%" />
        <MetricCard label="Active investors" value="4" sub="2 in DD · 2 browsing" />
        <MetricCard label="Q&A tuần này" value="23" color="gold" sub="18 answered · 5 pending" />
        <MetricCard label="Document gap" value="6" color="warn" sub="4 auto-gen · 2 manual" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-4">
        <Panel title="Folder structure" tagline="· hierarchical" tag="LTREE">
          <div className="overflow-x-auto">
            <table className="w-full text-[.78rem]">
              <thead>
                <tr className="border-b border-w-8 text-left">
                  {['Folder', 'Files', 'Status', 'Permission'].map((h) => (
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
                {FOLDERS.map((f) => (
                  <tr
                    key={f.name}
                    className="border-b border-w-6 hover:bg-w-4 cursor-pointer"
                  >
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-ivory">
                        <strong>
                          {f.code}. {f.name}
                        </strong>
                      </div>
                      <div className="font-mono text-[.6rem] text-ink-dim">
                        {f.path}
                      </div>
                    </td>
                    <td className="px-3 py-2 font-mono tabular-nums text-ink-2">
                      {f.files}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`font-mono text-[.6rem] px-2 py-0.5 rounded uppercase tracking-wider ${STATUS_TONE[f.tone]}`}
                      >
                        {f.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-[.62rem] text-ink-dim">
                      {f.perm}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">
            <div className="px-3 py-2 bg-w-4 rounded border border-w-8">
              <div className="font-mono text-[.6rem] text-ink-dim uppercase mb-1 tracking-widest">
                NDA status
              </div>
              <div className="text-[.78rem] text-ivory">
                4/14 signed · 2 pending · 1 declined
              </div>
            </div>
            <div className="px-3 py-2 bg-w-4 rounded border border-w-8">
              <div className="font-mono text-[.6rem] text-ink-dim uppercase mb-1 tracking-widest">
                Audit trail
              </div>
              <div className="text-[.78rem] text-ivory">
                Immutable · 7-year retention · WORM
              </div>
            </div>
          </div>
        </Panel>

        <Panel title="Recent Activity" tagline="· 7 ngày" tag="LIVE LOG" tagTone="live">
          <div className="flex flex-col gap-2">
            {ACTIVITY.map((a, i) => (
              <div
                key={i}
                className={`px-3 py-2.5 bg-w-4 rounded border-l-2 ${ACTIVITY_TONE[a.tone]}`}
              >
                <div className="flex justify-between items-baseline gap-2 mb-1">
                  <b className="text-[.8rem] text-ivory truncate">{a.actor}</b>
                  <span className="font-mono text-[.58rem] text-ink-dim shrink-0">
                    {a.time}
                  </span>
                </div>
                <div className="text-[.72rem] text-ink-2 leading-relaxed">
                  {a.action}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel
        title="Q&A Thread"
        tagline="· pending 5 · answered 18"
        tag="AUTO-CAPTURED"
      >
        <div className="flex flex-col gap-3">
          {[
            {
              asker: 'Khailee Ng · 500 Global',
              q: 'CAC by channel: bạn tách được TikTok vs KOL referral không? Có cohort stability 6-month?',
              status: 'answered',
              answered: 'CFO answered 4h ago',
            },
            {
              asker: 'Vinnie Lauria · Golden Gate',
              q: 'Supply chain risk với ANIMA 119 — có backup supplier? Lead time MOQ?',
              status: 'pending',
              answered: 'Assigned COO · due 26/04',
            },
            {
              asker: 'Bui Thanh Do · ThinkZone',
              q: 'Board composition kế hoạch: ai sẽ chiếm 2 seat khi Seed close?',
              status: 'answered',
              answered: 'Chairman answered 1d ago',
            },
          ].map((x, i) => (
            <div
              key={i}
              className="px-3.5 py-3 bg-w-4 border border-w-8 rounded"
            >
              <div className="flex justify-between items-baseline gap-3 mb-1">
                <b className="text-[.8rem] text-ivory">{x.asker}</b>
                <span
                  className={`font-mono text-[.58rem] px-2 py-0.5 rounded uppercase ${
                    x.status === 'answered'
                      ? 'bg-ok/20 text-ok'
                      : 'bg-warn/20 text-warn'
                  }`}
                >
                  {x.status}
                </span>
              </div>
              <div className="text-[.78rem] text-ink-2 italic leading-relaxed mb-1.5">
                &ldquo;{x.q}&rdquo;
              </div>
              <div className="font-mono text-[.62rem] text-gold">
                {x.answered}
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
