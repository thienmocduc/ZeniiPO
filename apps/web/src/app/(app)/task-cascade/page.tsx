import { cn } from '@/lib/utils';
import { MetricCard } from '@/components/modules/metric-card';
import {
  BtnPri,
  BtnSec,
  PageHeader,
  Panel,
} from '@/components/modules/page-header';

type Task = {
  id: string;
  priority: 'T1' | 'T2' | 'T3';
  title: string;
  owner: string;
  ownerInitial: string;
  ownerColor: string;
  due: string;
  status: 'open' | 'progress' | 'done' | 'blocked';
};

type Node = {
  id: string;
  role: string;
  person: string;
  okrs: number;
  krs: number;
  tasks: Task[];
  children?: Node[];
};

const TREE: Node = {
  id: 'chr',
  role: 'CHAIRMAN',
  person: 'Thiên Mộc Đức',
  okrs: 4,
  krs: 16,
  tasks: [
    {
      id: 't1',
      priority: 'T1',
      title: 'Chốt term sheet Touchstone + Golden Gate',
      owner: 'Đức',
      ownerInitial: 'T',
      ownerColor: '#E4C16E',
      due: '24/04',
      status: 'progress',
    },
    {
      id: 't2',
      priority: 'T1',
      title: 'Duyệt Q2 marketing budget revision',
      owner: 'Đức',
      ownerInitial: 'T',
      ownerColor: '#E4C16E',
      due: '25/04',
      status: 'open',
    },
  ],
  children: [
    {
      id: 'ceo',
      role: 'CEO',
      person: 'Lâm Khánh',
      okrs: 3,
      krs: 12,
      tasks: [
        {
          id: 't3',
          priority: 'T1',
          title: 'Đàm phán supplier ANIMA 119 (gross margin fix)',
          owner: 'Ngọc Hà · COO',
          ownerInitial: 'H',
          ownerColor: '#a855f7',
          due: '26/04',
          status: 'progress',
        },
        {
          id: 't4',
          priority: 'T2',
          title: 'Pitch rehearsal 4 persona · record dwell',
          owner: 'Duy Anh · CMO',
          ownerInitial: 'D',
          ownerColor: '#4f46e5',
          due: '28/04',
          status: 'open',
        },
      ],
      children: [
        {
          id: 'coo',
          role: 'COO',
          person: 'Ngọc Hà',
          okrs: 5,
          krs: 18,
          tasks: [
            {
              id: 't5',
              priority: 'T1',
              title: 'Ký hợp đồng supplier B (backup) · MOQ 5K unit',
              owner: 'Tùng · Ops Lead',
              ownerInitial: 'T',
              ownerColor: '#06b6d4',
              due: '26/04',
              status: 'progress',
            },
            {
              id: 't6',
              priority: 'T2',
              title: 'SOP fulfillment v2 · giảm cycle time 3.2d → 2.5d',
              owner: 'Linh · Fulfillment',
              ownerInitial: 'L',
              ownerColor: '#4ade80',
              due: '02/05',
              status: 'open',
            },
            {
              id: 't7',
              priority: 'T3',
              title: 'Tuyển 2 therapist trung tâm Q2',
              owner: 'Mai · HR',
              ownerInitial: 'M',
              ownerColor: '#fb923c',
              due: '10/05',
              status: 'open',
            },
          ],
        },
        {
          id: 'cmo',
          role: 'CMO',
          person: 'Duy Anh',
          okrs: 4,
          krs: 14,
          tasks: [
            {
              id: 't8',
              priority: 'T1',
              title: 'Rewrite GTM slide + câu chuyện KOC flywheel',
              owner: 'Duy Anh',
              ownerInitial: 'D',
              ownerColor: '#4f46e5',
              due: '30/04',
              status: 'open',
            },
            {
              id: 't9',
              priority: 'T2',
              title: 'Hãm 40% budget TikTok, tăng KOC sampling',
              owner: 'Hương · KOC Head',
              ownerInitial: 'H',
              ownerColor: '#a855f7',
              due: '28/04',
              status: 'blocked',
            },
          ],
        },
      ],
    },
    {
      id: 'cfo',
      role: 'CFO',
      person: 'Khánh Chi',
      okrs: 3,
      krs: 11,
      tasks: [
        {
          id: 't10',
          priority: 'T1',
          title: 'DD response batch 4/7 cho Touchstone',
          owner: 'Khánh Chi',
          ownerInitial: 'C',
          ownerColor: '#4ade80',
          due: '25/04',
          status: 'progress',
        },
        {
          id: 't11',
          priority: 'T2',
          title: 'Close month Apr · Day-3 target',
          owner: 'Plutus Agent · auto',
          ownerInitial: 'P',
          ownerColor: '#E4C16E',
          due: '03/05',
          status: 'open',
        },
      ],
    },
  ],
};

const STATUS_TONE: Record<Task['status'], string> = {
  open: 'bg-w-8 text-ink-dim',
  progress: 'bg-chakra-6/20 text-chakra-6-light',
  done: 'bg-ok/20 text-ok',
  blocked: 'bg-err/20 text-err',
};

const PRI_TONE: Record<Task['priority'], string> = {
  T1: 'border-err text-err bg-err/10',
  T2: 'border-warn text-warn bg-warn/10',
  T3: 'border-chakra-6 text-chakra-6-light bg-chakra-6/10',
};

function TaskCard({ task }: { task: Task }) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 rounded bg-panel-2 border border-w-8 hover:border-w-12 min-w-0">
      <span
        className={cn(
          'font-mono text-[.58rem] px-1.5 py-0.5 rounded border shrink-0',
          PRI_TONE[task.priority],
        )}
      >
        {task.priority}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[.78rem] text-ivory truncate">{task.title}</div>
        <div className="flex items-center gap-2 mt-0.5">
          <span
            className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[.58rem] font-bold text-bg shrink-0"
            style={{ background: task.ownerColor }}
          >
            {task.ownerInitial}
          </span>
          <span className="font-mono text-[.6rem] text-ink-dim truncate">
            {task.owner} · {task.due}
          </span>
        </div>
      </div>
      <span
        className={cn(
          'font-mono text-[.55rem] px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0',
          STATUS_TONE[task.status],
        )}
      >
        {task.status}
      </span>
    </div>
  );
}

function NodeBlock({ node, depth = 0 }: { node: Node; depth?: number }) {
  return (
    <div
      className={cn(
        'rounded-card border border-w-12 bg-panel',
        depth === 0 && 'border-gold/40 bg-gradient-to-br from-gold/10',
      )}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-w-8">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className={cn(
              'font-mono text-[.6rem] px-2 py-0.5 rounded uppercase tracking-widest shrink-0',
              depth === 0 && 'bg-gold text-bg',
              depth === 1 && 'bg-chakra-6/30 text-chakra-6-light',
              depth >= 2 && 'bg-w-8 text-ink-2',
            )}
          >
            {node.role}
          </span>
          <span className="font-display text-[.95rem] text-ivory truncate">
            {node.person}
          </span>
        </div>
        <div className="font-mono text-[.62rem] text-ink-dim tracking-wider shrink-0">
          {node.okrs} OKR · {node.krs} KR · {node.tasks.length} task
        </div>
      </div>
      <div className="p-3 space-y-2">
        {node.tasks.map((t) => (
          <TaskCard key={t.id} task={t} />
        ))}
      </div>
      {node.children && (
        <div
          className={cn(
            'ml-5 mt-1 pl-4 py-3 space-y-3 border-l-2',
            depth === 0 && 'border-gold/30',
            depth === 1 && 'border-chakra-6/30',
            depth >= 2 && 'border-w-12',
          )}
        >
          {node.children.map((c) => (
            <NodeBlock key={c.id} node={c} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function TaskCascadePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        category="Vận hành"
        crumb="Task Cascade"
        title="Task Cascade"
        tagline="— Năm → Tháng → Tuần → Ngày."
        lede="Zeniipo không gen 1,825 task cứng ngày-1. Nó lưu 5-year skeleton rồi gen rolling 30 ngày dựa trên tuần trước. OODA loop, không phải Gantt chart."
        actions={
          <>
            <BtnSec>Filter: Apr 2026 ▾</BtnSec>
            <BtnSec>View: Tree ▾</BtnSec>
            <BtnPri>+ Task mới</BtnPri>
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Active tasks" value="42" color="gold" sub="hôm nay · scoped Chairman+" />
        <MetricCard label="T1 critical" value="6" color="err" sub="blocks raise · due ≤3d" />
        <MetricCard label="On track" value="87" unit="%" color="ok" trend={{ direction: 'up', value: '+4pp WoW' }} />
        <MetricCard label="OKR trace" value="100" unit="%" sub="0 orphan task · full cascade" />
      </div>

      <Panel
        title="Cascade Tree"
        tagline="· Chairman → C-Level → Team"
        tag="LIVE"
        tagTone="live"
      >
        <NodeBlock node={TREE} />
      </Panel>
    </div>
  );
}
