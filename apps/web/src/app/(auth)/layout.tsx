import type { ReactNode } from 'react';

/**
 * Minimal auth layout — full-screen centered card. Pure form surface,
 * no logo, no mantra footer, no decorative glows. The cosmos background
 * already lives in the root layout so the page is far from blank.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="relative min-h-screen w-full flex items-center justify-center px-4 py-10 md:py-14 overflow-hidden">
      <div className="w-full max-w-[540px] z-10">{children}</div>
    </main>
  );
}
