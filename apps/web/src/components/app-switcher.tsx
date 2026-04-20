'use client';

import * as React from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronDown, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

type AppStatus = 'current' | 'live_external' | 'coming';

type ZeniApp = {
  id: string;
  name: string;
  tagline: string;
  status: AppStatus;
  href?: string;
  comingDate?: string;
};

const APPS: ZeniApp[] = [
  {
    id: 'zeniipo',
    name: 'Zeniipo',
    tagline: 'IPO Journey Platform',
    status: 'current',
  },
  {
    id: 'zenios',
    name: 'ZeniOS',
    tagline: 'Operating System',
    status: 'live_external',
    href: 'https://zenidigital.com/zenios',
  },
  {
    id: 'zenierp',
    name: 'ZeniERP',
    tagline: 'Enterprise Resource Planning',
    status: 'live_external',
    href: 'https://zenidigital.com/zenierp',
  },
  {
    id: 'zenipay',
    name: 'ZeniPay',
    tagline: 'Payment Rail',
    status: 'coming',
    comingDate: 'Q1 2027',
  },
  {
    id: 'zenistudio',
    name: 'ZeniStudio',
    tagline: 'Content · Creative',
    status: 'coming',
    comingDate: 'Q2 2027',
  },
  {
    id: 'zenisocial',
    name: 'ZeniSocial',
    tagline: 'Community · Network',
    status: 'coming',
    comingDate: 'Q4 2027',
  },
];

export function AppSwitcher() {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 h-9 px-3 rounded border border-w-12 bg-panel-2 hover:bg-w-8 text-sm text-ink transition-colors"
        >
          <span className="font-display font-semibold text-gold-light">
            Zeniipo
          </span>
          <ChevronDown size={14} className="text-ink-dim" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 w-[320px] rounded-card border border-w-12 bg-panel shadow-2xl p-2"
        >
          <div className="px-3 py-2 text-[.6rem] font-mono uppercase tracking-widest text-ink-dim">
            Zeni Product Suite
          </div>
          <div className="space-y-0.5">
            {APPS.map((app) => {
              const isDisabled = app.status === 'coming';
              const content = (
                <div
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded transition-colors',
                    app.status === 'current' && 'bg-gold/5',
                    !isDisabled && 'hover:bg-w-6',
                    isDisabled && 'opacity-60 cursor-not-allowed'
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-display text-sm text-ivory">
                        {app.name}
                      </span>
                      {app.status === 'current' && (
                        <span className="text-[.55rem] font-mono tracking-widest text-gold-light">
                          ● CURRENT
                        </span>
                      )}
                      {app.status === 'live_external' && (
                        <ExternalLink size={11} className="text-ink-dim" />
                      )}
                    </div>
                    <div className="text-xs text-ink-dim font-serif italic mt-0.5">
                      {app.tagline}
                    </div>
                  </div>
                  {app.status === 'coming' && (
                    <span className="text-[.55rem] font-mono tracking-widest text-ink-mute">
                      {app.comingDate}
                    </span>
                  )}
                </div>
              );

              if (app.status === 'live_external' && app.href) {
                return (
                  <DropdownMenu.Item
                    key={app.id}
                    asChild
                    className="outline-none focus:outline-none"
                  >
                    <a
                      href={app.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                    >
                      {content}
                    </a>
                  </DropdownMenu.Item>
                );
              }

              return (
                <DropdownMenu.Item
                  key={app.id}
                  disabled={isDisabled}
                  className="outline-none focus:outline-none"
                  onSelect={(e) => {
                    if (isDisabled) e.preventDefault();
                  }}
                >
                  {content}
                </DropdownMenu.Item>
              );
            })}
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
