import { cn } from '@/lib/utils';

export type Criterion = {
  id: string;
  label: string;
  status: 'pass' | 'progress' | 'fail' | 'pending';
  note?: string;
  weight?: number;
};

type CriteriaGroupProps = {
  name: string;
  criteria: Criterion[];
  weight?: number;
  score?: number;
};

const STATUS_CONFIG: Record<Criterion['status'], { icon: string; cls: string }> = {
  pass: { icon: '✓', cls: 'text-ok border-ok/40 bg-ok/10' },
  progress: { icon: '◐', cls: 'text-gold border-gold/40 bg-gold/10' },
  fail: { icon: '✕', cls: 'text-err border-err/40 bg-err/10' },
  pending: { icon: '·', cls: 'text-ink-dim border-w-12 bg-w-4' },
};

export function CriteriaGroup({
  name,
  criteria,
  weight,
  score,
}: CriteriaGroupProps) {
  return (
    <div className="rounded-card border border-w-12 bg-w-4 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-w-8 bg-w-6 flex items-center justify-between gap-2">
        <div className="font-mono text-[.7rem] uppercase tracking-widest text-gold">
          {name}
        </div>
        <div className="flex items-center gap-3 font-mono text-[.65rem]">
          {weight != null && (
            <span className="text-ink-dim">weight {weight}%</span>
          )}
          {score != null && (
            <span className="text-gold tabular-nums">
              {score}/{criteria.length * 10}
            </span>
          )}
        </div>
      </div>
      <div className="divide-y divide-w-8">
        {criteria.map((c) => {
          const conf = STATUS_CONFIG[c.status];
          return (
            <div
              key={c.id}
              className="flex items-start gap-3 px-4 py-2.5 hover:bg-w-4"
            >
              <span
                className={cn(
                  'shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full border text-[.72rem] font-mono',
                  conf.cls,
                )}
              >
                {conf.icon}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[.82rem] text-ivory">{c.label}</div>
                {c.note && (
                  <div className="text-[.7rem] text-ink-dim mt-0.5">
                    {c.note}
                  </div>
                )}
              </div>
              {c.weight != null && (
                <span className="font-mono text-[.62rem] text-ink-dim tabular-nums">
                  {c.weight}pt
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
