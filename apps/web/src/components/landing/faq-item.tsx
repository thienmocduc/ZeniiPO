'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

type FaqItemProps = {
  question: string;
  answer: string;
};

export function FaqItem({ question, answer }: FaqItemProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-w-8 rounded-card bg-panel/40 overflow-hidden transition-colors hover:border-w-16">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-6 px-6 py-5 text-left group"
      >
        <span className="font-display text-lg md:text-xl text-ink group-hover:text-gold-light transition-colors">
          {question}
        </span>
        <ChevronDown
          size={20}
          className={`flex-shrink-0 text-gold-light transition-transform duration-300 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>
      <div
        className={`grid transition-all duration-300 ease-out ${
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <p className="px-6 pb-6 text-ink-2 leading-relaxed">{answer}</p>
        </div>
      </div>
    </div>
  );
}
