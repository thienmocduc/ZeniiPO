import { cn } from '@/lib/utils';

export type ActionItem = {
  id: string;
  priority: 'T1' | 'T2' | 'T3';
  title: string;
  owner: string;
  due: string;
  status?: 'open' | 'progress' | 'blocked';
};

const PRIORITY_COLOR: Record<ActionItem['priority'], string> = {
  T1: 'border-err bg-err/10 text-err',
  T2: 'border-warn bg-warn/10 text-warn',
  T3: 'border-chakra-6 bg-chakra-6/10 text-chakra-6-light',
};

export function ActionList({ items }: { items: ActionItem[] }) {
  return (
    <div className="flex flex-col gap-2">
      {items.map((it) => (
        <div
          key={it.id}
          className="flex items-center gap-3 px-3 py-2.5 rounded bg-w-4 border border-w-8 hover:border-w-12 transition-colors"
        >
          <span
            className={cn(
              'font-mono text-[.62rem] px-1.5 py-0.5 rounded border',
              PRIORITY_COLOR[it.priority],
            )}
          >
            {it.priority}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[.82rem] text-ivory truncate">{it.title}</div>
            <div className="font-mono text-[.62rem] text-ink-dim mt-0.5">
              {it.owner} · due {it.due}
            </div>
          </div>
          {it.status && (
            <span className="font-mono text-[.58rem] text-ink-dim uppercase tracking-wider">
              {it.status}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
