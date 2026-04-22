import { cn } from '@/lib/utils';

type Severity = 'high' | 'med' | 'low' | 'info';

type RecommendationCardProps = {
  severity: Severity;
  agent?: string;
  title: string;
  body: string;
  cta?: string;
};

const SEV_CONFIG: Record<
  Severity,
  { border: string; label: string; labelCls: string }
> = {
  high: {
    border: 'border-l-err',
    label: 'HIGH',
    labelCls: 'bg-err/20 text-err',
  },
  med: {
    border: 'border-l-warn',
    label: 'MED',
    labelCls: 'bg-warn/20 text-warn',
  },
  low: {
    border: 'border-l-ok',
    label: 'LOW',
    labelCls: 'bg-ok/20 text-ok',
  },
  info: {
    border: 'border-l-chakra-6',
    label: 'INFO',
    labelCls: 'bg-chakra-6/20 text-chakra-6-light',
  },
};

export function RecommendationCard({
  severity,
  agent,
  title,
  body,
  cta,
}: RecommendationCardProps) {
  const conf = SEV_CONFIG[severity];
  return (
    <div
      className={cn(
        'rounded-card border border-w-8 border-l-4 bg-w-4 p-3.5',
        conf.border,
      )}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className={cn(
            'font-mono text-[.58rem] px-1.5 py-0.5 rounded tracking-widest',
            conf.labelCls,
          )}
        >
          {conf.label}
        </span>
        {agent && (
          <span className="font-mono text-[.6rem] text-gold tracking-wider">
            {agent}
          </span>
        )}
      </div>
      <div className="text-[.88rem] text-ivory font-medium mb-1 leading-snug">
        {title}
      </div>
      <p className="text-[.74rem] text-ink-2 leading-relaxed">{body}</p>
      {cta && (
        <button className="mt-2.5 font-mono text-[.65rem] text-gold hover:text-gold-light tracking-wider uppercase">
          {cta} →
        </button>
      )}
    </div>
  );
}
