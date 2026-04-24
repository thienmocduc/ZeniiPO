'use client';

/**
 * CascadeButton — floating action trigger for the Chairman Cascade Engine.
 * Renders a gold-gradient FAB at the bottom-right of the dashboard. Click
 * opens the cascade modal.
 */

import { useState } from 'react';
import { Lock } from 'lucide-react';
import { CascadeModal } from './cascade-modal';

type Variant = 'fab' | 'inline';

export function CascadeButton({ variant = 'fab' }: { variant?: Variant }) {
  const [open, setOpen] = useState(false);

  if (variant === 'inline') {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-DEFAULT border border-chakra-7-gold/40 bg-gradient-to-r from-chakra-6 via-chakra-7 to-gold-light px-3 py-1.5 text-2xs font-medium uppercase tracking-widest text-bg hover:opacity-90 transition-opacity"
          aria-label="Mở Chairman Cascade Engine"
        >
          <Lock className="h-3 w-3" aria-hidden />
          <span>Cascade event +</span>
        </button>
        <CascadeModal open={open} onClose={() => setOpen(false)} />
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-gradient-to-r from-gold-dark via-gold to-gold-light px-5 py-3.5 text-sm font-medium text-bg shadow-[0_12px_32px_rgba(228,193,110,0.45)] hover:shadow-[0_16px_40px_rgba(228,193,110,0.6)] animate-breathe transition-shadow"
        aria-label="Mở Chairman Cascade Engine"
      >
        <Lock className="h-4 w-4" aria-hidden />
        <span className="font-display tracking-wide">Cascade event</span>
      </button>
      <CascadeModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
