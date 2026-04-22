import { cn } from '@/lib/utils';

export type Phase = {
  id: string;
  number: string;
  title: string;
  description: string;
  timeline: string;
  budget: string;
  team: string;
  gate: string;
  completion?: number;
  status: 'done' | 'active' | 'queued' | 'future';
  accentColor?: string;
};

const STATUS_CONFIG: Record<
  Phase['status'],
  { label: string; cls: string; border: string }
> = {
  done: {
    label: 'DONE',
    cls: 'bg-ok/20 text-ok border-ok/40',
    border: 'border-l-ok',
  },
  active: {
    label: 'ACTIVE',
    cls: 'bg-gold/20 text-gold border-gold/40',
    border: 'border-l-gold',
  },
  queued: {
    label: 'QUEUED',
    cls: 'bg-chakra-6/20 text-chakra-6-light border-chakra-6/40',
    border: 'border-l-chakra-6',
  },
  future: {
    label: 'FUTURE',
    cls: 'bg-w-8 text-ink-dim border-w-12',
    border: 'border-l-w-12',
  },
};

export function PhaseTimeline({ phases }: { phases: Phase[] }) {
  return (
    <div className="flex flex-col gap-2.5">
      {phases.map((phase) => {
        const conf = STATUS_CONFIG[phase.status];
        return (
          <div
            key={phase.id}
            className={cn(
              'rounded-card border border-w-12 border-l-4 bg-w-4 px-4 py-3.5',
              conf.border,
              phase.status === 'active' &&
                'bg-gradient-to-r from-gold/10 via-transparent to-transparent',
            )}
          >
            <div className="flex items-baseline justify-between gap-3 flex-wrap mb-2">
              <div>
                <span className="font-mono text-[.62rem] tracking-widest text-gold">
                  {phase.number}
                </span>
                <div className="font-display text-xl text-ivory mt-1 font-medium">
                  {phase.title}{' '}
                  <em className="text-gold-light italic text-base">
                    — {phase.description}
                  </em>
                </div>
              </div>
              <span
                className={cn(
                  'font-mono text-[.62rem] px-2 py-1 rounded uppercase tracking-wider border',
                  conf.cls,
                )}
              >
                {conf.label}
                {phase.completion != null && ` · ${phase.completion}%`}
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { k: 'Timeline', v: phase.timeline },
                { k: 'Budget', v: phase.budget },
                { k: 'Team', v: phase.team },
                { k: 'Gate', v: phase.gate },
              ].map((it) => (
                <div
                  key={it.k}
                  className="px-2.5 py-2 bg-w-4 rounded text-[.72rem]"
                >
                  <div className="font-mono text-[.58rem] text-ink-dim tracking-widest mb-0.5 uppercase">
                    {it.k}
                  </div>
                  <div className="text-ivory">{it.v}</div>
                </div>
              ))}
            </div>
            {phase.completion != null && (
              <div className="mt-2.5 h-1.5 rounded-full bg-w-8 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-gold-dark to-gold-light"
                  style={{ width: `${phase.completion}%` }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
