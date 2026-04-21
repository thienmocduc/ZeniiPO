import type { ReactNode } from 'react';
import Link from 'next/link';

/**
 * Minimal auth layout — no app sidebar. Full-screen centered card over
 * the shared cosmos background rendered by the root layout.
 *
 * Chakra 6 (Ajna · indigo) + Chakra 7 (Sahasrara · violet→white→gold).
 * Adds a soft crown glow top-center and aurora sheen drifting behind the card.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="relative min-h-screen w-full flex flex-col items-center justify-start px-4 pt-20 pb-10 md:pt-24 md:pb-12 overflow-hidden">
      {/* Soft gold crown glow top-center (Sahasrara) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[60vh] -z-[1]"
        style={{
          background:
            'radial-gradient(40% 80% at 50% -10%, rgba(228,193,110,0.22) 0%, rgba(228,193,110,0.08) 35%, transparent 65%)',
        }}
      />

      {/* Aurora sheen — chakra 6 indigo + chakra 7 violet (counter-phase drift) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-[1] animate-aurora opacity-40"
        style={{
          willChange: 'transform',
          background:
            'radial-gradient(40% 40% at 15% 40%, rgba(99,102,241,0.26) 0%, transparent 70%),' +
            'radial-gradient(45% 45% at 85% 65%, rgba(168,85,247,0.24) 0%, transparent 70%)',
        }}
      />

      {/* Gold Z logo top-center */}
      <Link
        href="/"
        aria-label="Về trang chủ Zeniipo"
        className="absolute top-6 left-1/2 -translate-x-1/2 group z-20"
      >
        <div className="flex flex-col items-center gap-1.5">
          <span
            className="inline-flex items-center justify-center w-11 h-11 rounded-full border border-gold/60 bg-bg/60 backdrop-blur-sm font-serif italic text-xl font-semibold text-gold-light shadow-[0_0_24px_rgba(228,193,110,0.28)] transition group-hover:border-gold group-hover:shadow-[0_0_36px_rgba(228,193,110,0.5)]"
          >
            Z
          </span>
          <span className="font-mono text-[0.58rem] uppercase tracking-widest text-ink-dim group-hover:text-gold-light transition">
            Về trang chủ
          </span>
        </div>
      </Link>

      {/* Centered card */}
      <div className="w-full max-w-[540px] z-10">{children}</div>

      {/* Mantra footer */}
      <footer className="mt-8 md:mt-10 flex flex-col items-center gap-2 z-10 text-center">
        <p className="font-serif italic text-sm text-gold-light">
          Tĩnh lặng <span className="text-[#c084fc]">·</span> Hiện diện{' '}
          <span className="text-[#c084fc]">·</span> Phục hưng sự sống
        </p>
        <p className="font-mono text-2xs uppercase tracking-widest text-ink-dim">
          Zeniipo · IPO Journey Platform · 10 phase · 44 module · 108 agent
        </p>
      </footer>
    </main>
  );
}
