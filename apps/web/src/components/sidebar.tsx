'use client';

/**
 * Sidebar — renders the exact v1_8_FULL <aside class="nav"> markup via
 * dangerouslySetInnerHTML. After injection, we:
 *   1) intercept anchor clicks so Next.js router handles navigation
 *   2) toggle the `.act` class on the nav-it matching current pathname
 */

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';

type SidebarProps = {
  /** Pre-extracted sidebar inner HTML (rewritten so nav-it divs are <a>). */
  html: string;
};

export function Sidebar({ html }: SidebarProps) {
  const ref = useRef<HTMLElement | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  // Intercept clicks on nav-it anchors so navigation uses Next's client router.
  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    function onClick(e: MouseEvent) {
      const target = (e.target as HTMLElement | null)?.closest(
        'a.nav-it',
      ) as HTMLAnchorElement | null;
      if (!target) return;
      const href = target.getAttribute('href');
      if (!href || href.startsWith('http') || href.startsWith('#')) return;
      e.preventDefault();
      router.push(href);
    }

    root.addEventListener('click', onClick);
    return () => root.removeEventListener('click', onClick);
  }, [router]);

  // Sync `.act` class to current pathname.
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const items = root.querySelectorAll('a.nav-it');
    items.forEach((el) => {
      const href = el.getAttribute('href') || '';
      const isActive =
        href === pathname || (href !== '/' && pathname.startsWith(href + '/'));
      el.classList.toggle('act', isActive);
    });
  }, [pathname, html]);

  return (
    <aside
      ref={ref}
      className="nav"
      id="sidebar"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
