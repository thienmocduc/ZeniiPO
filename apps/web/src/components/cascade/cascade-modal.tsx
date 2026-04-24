'use client';

/**
 * CascadeModal — Chairman triggers a top-down cascade event:
 *   valuation + venue + year + industry + strategy → 4 CHR objectives.
 * Posts to /api/cascade which calls the `cascade_chairman_event` Postgres RPC.
 * On success, redirects to /cascade-success/[journeyId] (then auto-jumps to /okrs).
 */

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type Venue = 'SGX' | 'NASDAQ' | 'NYSE' | 'HKEX' | 'HOSE';

type CascadeResponse = {
  data?: {
    event_id: string | null;
    journey_id: string | null;
    objectives_count?: number;
  };
  error?: string | { fieldErrors?: Record<string, string[]> } | unknown;
};

const VENUES: Venue[] = ['SGX', 'NASDAQ', 'NYSE', 'HKEX', 'HOSE'];

/** Format a number with thousand separators while typing. */
function formatThousands(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, '');
  if (!digits) return '';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function CascadeModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement | null>(null);

  const [valuation, setValuation] = useState<string>('3,130,000,000');
  const [venue, setVenue] = useState<Venue>('SGX');
  const [year, setYear] = useState<number>(2031);
  const [industry, setIndustry] = useState<string>('fermented biotech');
  const [northStar, setNorthStar] = useState<string>('');
  const [strategy, setStrategy] = useState<string>(
    'Cascade tư tưởng từ Chairman: dẫn dắt ngành công nghệ sinh học lên men, niêm yết IPO đa sàn, kiến tạo hệ sinh thái Web3 + AI cho 0 → IPO.',
  );

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lock body scroll while open + Esc to close.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !pending) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, pending, onClose]);

  if (!open) return null;

  const valuationNumber = Number(valuation.replace(/,/g, ''));
  const isStrategyTooLong = strategy.length > 5000;
  const isFormValid =
    valuationNumber > 0 &&
    VENUES.includes(venue) &&
    year >= 2026 &&
    year <= 2040 &&
    industry.trim().length > 0 &&
    industry.length <= 100 &&
    strategy.trim().length > 0 &&
    !isStrategyTooLong;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isFormValid || pending) return;
    setError(null);
    setPending(true);
    try {
      const res = await fetch('/api/cascade', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          valuation: valuationNumber,
          venue,
          year,
          industry: industry.trim(),
          north_star: northStar.trim() || undefined,
          strategy: strategy.trim(),
        }),
      });
      const json: CascadeResponse = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg =
          typeof json.error === 'string'
            ? json.error
            : 'Cascade thất bại. Vui lòng thử lại.';
        throw new Error(msg);
      }
      const journeyId = json.data?.journey_id;
      onClose();
      if (journeyId) {
        router.push(`/cascade-success/${journeyId}`);
      } else {
        router.push('/okrs');
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cascade thất bại.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cascade-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-md p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-[640px] rounded-card bg-panel/95 border border-chakra-6/40 shadow-[0_40px_80px_rgba(0,0,0,0.6)] relative overflow-hidden"
      >
        {/* Chakra gradient border (top edge) */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-[2px] cosmic-gradient-bg opacity-90"
        />

        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-5">
          <header className="space-y-1">
            <h2
              id="cascade-title"
              className="font-display text-2xl tracking-tight cosmic-gradient-text"
            >
              Chairman Cascade Engine
            </h2>
            <p className="text-ink-2 text-[0.82rem] leading-relaxed">
              Khởi tạo journey IPO + tự động cascade 4 mục tiêu CHR xuống toàn bộ tổ chức.
            </p>
          </header>

          {/* Valuation + Venue row */}
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-ink-2 text-2xs uppercase tracking-widest mb-1.5 block">
                Valuation target (USD)
              </span>
              <input
                type="text"
                inputMode="numeric"
                placeholder="3,130,000,000"
                value={valuation}
                onChange={(e) => setValuation(formatThousands(e.target.value))}
                disabled={pending}
                className="w-full bg-w-4 border border-w-12 focus:border-chakra-6 focus:outline-none rounded-DEFAULT px-3 py-2.5 text-ink font-mono text-sm transition-colors"
              />
            </label>

            <label className="block">
              <span className="text-ink-2 text-2xs uppercase tracking-widest mb-1.5 block">
                Exit venue
              </span>
              <select
                value={venue}
                onChange={(e) => setVenue(e.target.value as Venue)}
                disabled={pending}
                className="w-full bg-w-4 border border-w-12 focus:border-chakra-6 focus:outline-none rounded-DEFAULT px-3 py-2.5 text-ink text-sm transition-colors"
              >
                {VENUES.map((v) => (
                  <option key={v} value={v} className="bg-panel">
                    {v}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Year + Industry row */}
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-ink-2 text-2xs uppercase tracking-widest mb-1.5 block">
                Target year
              </span>
              <input
                type="number"
                min={2026}
                max={2040}
                value={year}
                onChange={(e) => setYear(Number(e.target.value) || 2031)}
                disabled={pending}
                className="w-full bg-w-4 border border-w-12 focus:border-chakra-6 focus:outline-none rounded-DEFAULT px-3 py-2.5 text-ink font-mono text-sm transition-colors"
              />
            </label>

            <label className="block">
              <span className="text-ink-2 text-2xs uppercase tracking-widest mb-1.5 block">
                Industry
              </span>
              <input
                type="text"
                maxLength={100}
                placeholder="fermented biotech"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                disabled={pending}
                className="w-full bg-w-4 border border-w-12 focus:border-chakra-6 focus:outline-none rounded-DEFAULT px-3 py-2.5 text-ink text-sm transition-colors"
              />
            </label>
          </div>

          {/* North Star (optional) */}
          <label className="block">
            <span className="text-ink-2 text-2xs uppercase tracking-widest mb-1.5 block">
              North Star metric{' '}
              <span className="text-ink-dim normal-case">(tuỳ chọn)</span>
            </span>
            <input
              type="text"
              maxLength={200}
              placeholder="VD: ARR $200M, 10M users, 50% gross margin..."
              value={northStar}
              onChange={(e) => setNorthStar(e.target.value)}
              disabled={pending}
              className="w-full bg-w-4 border border-w-12 focus:border-chakra-6 focus:outline-none rounded-DEFAULT px-3 py-2.5 text-ink text-sm transition-colors"
            />
          </label>

          {/* Strategy */}
          <label className="block">
            <span className="text-ink-2 text-2xs uppercase tracking-widest mb-1.5 block flex items-center justify-between">
              <span>Strategy</span>
              <span
                className={`normal-case tracking-normal text-[0.7rem] ${
                  isStrategyTooLong ? 'text-err' : 'text-ink-dim'
                }`}
              >
                {strategy.length} / 5000
              </span>
            </span>
            <textarea
              maxLength={5000}
              rows={5}
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
              disabled={pending}
              className="w-full bg-w-4 border border-w-12 focus:border-chakra-6 focus:outline-none rounded-DEFAULT px-3 py-2.5 text-ink text-sm transition-colors resize-y"
            />
          </label>

          {/* Error banner */}
          {error && (
            <div
              role="alert"
              className="rounded-DEFAULT border border-err/40 bg-err/10 px-3 py-2 text-[0.82rem] text-err"
            >
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="px-4 py-2 text-sm text-ink-2 hover:text-ink transition-colors disabled:opacity-50"
            >
              Huỷ
            </button>
            <button
              type="submit"
              disabled={!isFormValid || pending}
              className="px-5 py-2.5 rounded-DEFAULT text-sm font-medium text-bg cosmic-gradient-bg hover:animate-breathe disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_8px_24px_rgba(79,70,229,0.35)] flex items-center gap-2"
            >
              {pending ? (
                <>
                  <span
                    aria-hidden
                    className="inline-block h-3.5 w-3.5 rounded-full border-2 border-bg/40 border-t-bg animate-spin"
                  />
                  Đang cascade...
                </>
              ) : (
                <>🚀 Cascade event</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
