/**
 * Post-cascade success page.
 * Shows the freshly-created journey + 4 CHR objectives, then auto-redirects to /okrs.
 */

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import { CascadeRedirect } from './cascade-redirect';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Journey = {
  id: string;
  name: string | null;
  valuation_target: number | null;
  exit_venue: string | null;
  target_year: number | null;
  industry: string | null;
};

type Objective = {
  id: string;
  title: string | null;
  description: string | null;
  tier: string | null;
  progress: number | null;
};

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function formatUsd(n: number | null): string {
  if (!n || !Number.isFinite(n)) return '—';
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  return `$${n.toLocaleString('en-US')}`;
}

export default async function CascadeSuccessPage({
  params,
}: {
  params: Promise<{ journeyId: string }>;
}) {
  const { journeyId } = await params;
  if (!isUuid(journeyId)) redirect('/okrs');

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: journey } = await supabase
    .from('ipo_journeys')
    .select('id,name,valuation_target,exit_venue,target_year,industry')
    .eq('id', journeyId)
    .maybeSingle();

  // Pull CHR-tier objectives for this tenant. We don't filter by journey_id
  // because the RPC may not stamp it on okr_objectives directly — instead we
  // grab the freshest 4 CHR rows.
  const { data: objectivesRaw } = await supabase
    .from('okr_objectives')
    .select('id,title,description,tier,progress')
    .eq('tier', 'CHR')
    .order('created_at', { ascending: false })
    .limit(4);

  const objectives = (objectivesRaw ?? []) as Objective[];
  const j = (journey ?? null) as Journey | null;

  return (
    <div className="relative min-h-[calc(100vh-var(--top-h,64px))] overflow-hidden">
      <CascadeRedirect to="/okrs" delayMs={5000} />

      {/* Aurora glow */}
      <div aria-hidden className="absolute inset-0 aurora-bg opacity-60 pointer-events-none" />

      <div className="relative z-10 mx-auto max-w-5xl px-6 py-14 sm:py-20">
        {/* Hero */}
        <div className="text-center crown-glow">
          <div className="inline-flex items-center gap-2 rounded-full border border-ok/30 bg-ok/10 px-3 py-1 text-2xs uppercase tracking-widest text-ok mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-ok animate-pulse-soft" />
            Cascade success
          </div>
          <h1 className="font-display text-4xl sm:text-5xl tracking-tight cosmic-gradient-text mb-3">
            Cascade thành công
          </h1>
          <p className="text-ink-2 text-lg">
            <span className="font-mono text-ivory">{objectives.length}</span> objectives đã được tạo và phân bổ xuống CHR-tier.
          </p>
        </div>

        {/* Journey summary card */}
        {j && (
          <div className="mt-10 rounded-card border border-w-12 bg-panel/60 p-6 backdrop-blur-sm">
            <div className="text-2xs uppercase tracking-widest text-ink-dim mb-3">
              IPO Journey
            </div>
            <h2 className="font-display text-2xl text-ivory mb-4">
              {j.name || 'Untitled journey'}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Stat label="Valuation" value={formatUsd(j.valuation_target)} />
              <Stat label="Venue" value={j.exit_venue || '—'} />
              <Stat label="Target year" value={String(j.target_year ?? '—')} />
              <Stat label="Industry" value={j.industry || '—'} />
            </div>
          </div>
        )}

        {/* Objectives */}
        <div className="mt-10">
          <div className="flex items-baseline justify-between mb-4">
            <h3 className="font-display text-xl text-ivory">
              CHR Objectives
            </h3>
            <span className="text-2xs uppercase tracking-widest text-ink-dim">
              {objectives.length} / 4
            </span>
          </div>

          {objectives.length === 0 ? (
            <div className="rounded-card border border-w-12 bg-panel/60 p-8 text-center text-ink-2">
              Chưa có objective nào hiển thị. Vui lòng kiểm tra OKR tree.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {objectives.map((o) => (
                <ObjectiveCard key={o.id} obj={o} />
              ))}
            </div>
          )}
        </div>

        {/* CTA */}
        <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/okrs"
            className="inline-flex items-center gap-2 rounded-DEFAULT cosmic-gradient-bg px-6 py-3 text-sm font-medium text-bg shadow-[0_8px_24px_rgba(79,70,229,0.35)] hover:animate-breathe transition-all"
          >
            Xem OKR tree đầy đủ
            <span aria-hidden>→</span>
          </Link>
          <Link
            href="/dashboard"
            className="text-sm text-ink-2 hover:text-ink transition-colors"
          >
            Về dashboard
          </Link>
        </div>

        <p className="mt-8 text-center text-2xs uppercase tracking-widest text-ink-dim">
          Tự động chuyển hướng đến OKR tree sau 5 giây...
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-2xs uppercase tracking-widest text-ink-dim mb-1">
        {label}
      </div>
      <div className="font-mono text-base text-ivory">{value}</div>
    </div>
  );
}

function ObjectiveCard({ obj }: { obj: Objective }) {
  const progress = Math.max(0, Math.min(100, obj.progress ?? 0));
  return (
    <article className="rounded-card border border-chakra-6/30 bg-panel/70 p-5 hover:border-chakra-6/60 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-2">
        <h4 className="font-display text-base text-ivory leading-snug">
          {obj.title || 'Untitled objective'}
        </h4>
        <span className="shrink-0 rounded-full border border-chakra-7/40 bg-chakra-7/10 px-2 py-0.5 text-[0.65rem] uppercase tracking-widest text-chakra-7-violet">
          {obj.tier || 'CHR'}
        </span>
      </div>
      {obj.description && (
        <p className="text-ink-2 text-[0.82rem] mb-4 line-clamp-3">
          {obj.description}
        </p>
      )}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 rounded-full bg-w-8 overflow-hidden">
          <div
            className="h-full cosmic-gradient-bg transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-2xs font-mono text-ink-dim shrink-0">
          {progress}%
        </span>
      </div>
    </article>
  );
}
