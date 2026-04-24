'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Auto-redirects to `to` after `delayMs`. Cancellable on unmount. */
export function CascadeRedirect({
  to,
  delayMs = 5000,
}: {
  to: string;
  delayMs?: number;
}) {
  const router = useRouter();
  useEffect(() => {
    const t = setTimeout(() => {
      router.push(to);
    }, delayMs);
    return () => clearTimeout(t);
  }, [router, to, delayMs]);
  return null;
}
