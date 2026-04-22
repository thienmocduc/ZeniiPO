import { cn } from '@/lib/utils';

type Trend = {
  direction: 'up' | 'down' | 'flat';
  value: string;
};

type MetricCardProps = {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  trend?: Trend;
  color?: 'gold' | 'ok' | 'warn' | 'err' | 'default';
};

const COLOR_MAP: Record<NonNullable<MetricCardProps['color']>, string> = {
  gold: 'border-gold/40 bg-gradient-to-br from-gold/10 to-transparent',
  ok: 'border-ok/40 bg-gradient-to-br from-ok/10 to-transparent',
  warn: 'border-warn/40 bg-gradient-to-br from-warn/10 to-transparent',
  err: 'border-err/40 bg-gradient-to-br from-err/10 to-transparent',
  default: 'border-w-12 bg-w-4',
};

export function MetricCard({
  label,
  value,
  unit,
  sub,
  trend,
  color = 'default',
}: MetricCardProps) {
  return (
    <div
      className={cn(
        'rounded-card border p-4 flex flex-col gap-1.5 min-w-0',
        COLOR_MAP[color],
      )}
    >
      <div className="font-mono text-[.62rem] uppercase tracking-widest text-ink-dim">
        {label}
      </div>
      <div className="font-display text-[1.75rem] leading-none text-ivory font-medium">
        {value}
        {unit && <em className="not-italic text-ink-2 text-lg ml-1">{unit}</em>}
      </div>
      {trend ? (
        <div
          className={cn(
            'font-mono text-[.7rem]',
            trend.direction === 'up' && 'text-ok',
            trend.direction === 'down' && 'text-err',
            trend.direction === 'flat' && 'text-ink-dim',
          )}
        >
          {trend.direction === 'up' ? '▲' : trend.direction === 'down' ? '▼' : '—'}{' '}
          {trend.value}
        </div>
      ) : sub ? (
        <div className="text-[.72rem] text-ink-dim leading-snug">{sub}</div>
      ) : null}
    </div>
  );
}
