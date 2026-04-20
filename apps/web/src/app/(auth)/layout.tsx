import type { ReactNode } from 'react';
import Link from 'next/link';

/**
 * Minimal auth layout — no app sidebar. Full-screen centered card over
 * the shared cosmos background rendered by the root layout.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="relative min-h-screen w-full flex flex-col items-center justify-center px-4 py-10">
      {/* Gold Z logo top-center */}
      <Link
        href="/"
        aria-label="Về trang chủ Zeniipo"
        className="absolute top-6 left-1/2 -translate-x-1/2 group"
      >
        <span
          className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-gold/60 bg-bg/60 backdrop-blur-sm font-display text-xl font-bold text-gold-light shadow-[0_0_24px_rgba(228,193,110,0.25)] transition group-hover:border-gold group-hover:shadow-[0_0_32px_rgba(228,193,110,0.45)]"
        >
          Z
        </span>
      </Link>

      <div className="w-full max-w-md z-10">{children}</div>

      <footer className="mt-10 text-center text-ink-dim text-2xs font-mono uppercase tracking-widest z-10">
        <span>Zeniipo · IPO Journey Platform</span>
      </footer>
    </main>
  );
}
