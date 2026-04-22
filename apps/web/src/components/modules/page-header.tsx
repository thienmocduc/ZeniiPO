import { cn } from '@/lib/utils';

type PageHeaderProps = {
  crumb: string;
  category: string;
  title: string;
  tagline?: string;
  lede?: string;
  actions?: React.ReactNode;
  className?: string;
};

export function PageHeader({
  crumb,
  category,
  title,
  tagline,
  lede,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        'flex items-start justify-between gap-6 flex-wrap mb-5 pb-4 border-b border-w-8',
        className,
      )}
    >
      <div className="min-w-0">
        <div className="font-mono text-[.62rem] uppercase tracking-widest text-ink-dim mb-1.5">
          <span className="text-gold">{category}</span> › {crumb}
        </div>
        <h1 className="font-display text-3xl md:text-[2.25rem] text-ivory font-medium leading-tight">
          {title}
          {tagline && (
            <em className="text-gold-light italic ml-2 text-xl md:text-2xl">
              {tagline}
            </em>
          )}
        </h1>
        {lede && (
          <p className="text-ink-2 text-[.88rem] mt-2 max-w-3xl leading-relaxed">
            {lede}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </header>
  );
}

type PanelProps = {
  title: string;
  tagline?: string;
  tag?: string;
  tagTone?: 'live' | 'simulation' | 'audit' | 'default';
  children: React.ReactNode;
  className?: string;
};

export function Panel({
  title,
  tagline,
  tag,
  tagTone = 'default',
  children,
  className,
}: PanelProps) {
  return (
    <section
      className={cn(
        'rounded-card border border-w-12 bg-panel p-4 md:p-5',
        className,
      )}
    >
      <header className="flex items-baseline justify-between gap-3 mb-3.5 pb-2.5 border-b border-w-8 flex-wrap">
        <h3 className="font-display text-lg text-ivory font-medium">
          {title}
          {tagline && (
            <em className="text-gold-light italic ml-1.5 text-[.88rem]">
              {tagline}
            </em>
          )}
        </h3>
        {tag && (
          <span
            className={cn(
              'font-mono text-[.58rem] px-2 py-0.5 rounded tracking-widest uppercase border',
              tagTone === 'live' && 'bg-ok/10 text-ok border-ok/30',
              tagTone === 'simulation' &&
                'bg-chakra-7/10 text-chakra-7-violet border-chakra-7/30',
              tagTone === 'audit' &&
                'bg-gold/10 text-gold border-gold/30',
              tagTone === 'default' && 'bg-w-6 text-ink-2 border-w-12',
            )}
          >
            {tag}
          </span>
        )}
      </header>
      {children}
    </section>
  );
}

export function BtnSec({ children }: { children: React.ReactNode }) {
  return (
    <button className="px-3 py-1.5 rounded border border-w-12 bg-w-4 text-ink text-[.78rem] hover:bg-w-6 transition-colors">
      {children}
    </button>
  );
}

export function BtnPri({ children }: { children: React.ReactNode }) {
  return (
    <button className="px-3.5 py-1.5 rounded bg-gradient-to-r from-gold-dark to-gold-light text-bg font-medium text-[.78rem] hover:brightness-110 transition-all">
      {children}
    </button>
  );
}
