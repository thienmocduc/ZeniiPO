'use client';

import * as React from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { User as UserIcon, Settings, LogOut } from 'lucide-react';
import Link from 'next/link';

type UserMenuProps = {
  email: string;
  displayName?: string;
};

export function UserMenu({ email, displayName }: UserMenuProps) {
  const name = displayName || email.split('@')[0] || 'U';
  const initial = name.charAt(0).toUpperCase();

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label="Open user menu"
          className="inline-flex items-center justify-center w-9 h-9 rounded-full font-display font-semibold text-bg text-sm leading-none hover:ring-2 hover:ring-gold/40 transition-all"
          style={{
            background:
              'linear-gradient(135deg, #E4C16E 0%, #C9A84C 45%, #a855f7 100%)',
          }}
        >
          {initial}
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 w-[240px] rounded-card border border-w-12 bg-panel shadow-2xl p-2"
        >
          <div className="px-3 py-2.5 border-b border-w-12 mb-1">
            <div className="text-sm text-ivory font-display truncate">
              {name}
            </div>
            <div className="text-xs text-ink-dim truncate">{email}</div>
          </div>

          <DropdownMenu.Item asChild className="outline-none">
            <Link
              href="/settings"
              className="flex items-center gap-3 px-3 py-2 rounded text-sm text-ink-2 hover:bg-w-6 hover:text-ivory cursor-pointer"
            >
              <UserIcon size={14} className="text-ink-dim" />
              Profile
            </Link>
          </DropdownMenu.Item>

          <DropdownMenu.Item asChild className="outline-none">
            <Link
              href="/settings"
              className="flex items-center gap-3 px-3 py-2 rounded text-sm text-ink-2 hover:bg-w-6 hover:text-ivory cursor-pointer"
            >
              <Settings size={14} className="text-ink-dim" />
              Settings
            </Link>
          </DropdownMenu.Item>

          <div className="my-1 h-px bg-w-12" />

          <DropdownMenu.Item asChild className="outline-none">
            <form action="/api/auth/signout" method="post">
              <button
                type="submit"
                className="w-full flex items-center gap-3 px-3 py-2 rounded text-sm text-ink-2 hover:bg-w-6 hover:text-err cursor-pointer"
              >
                <LogOut size={14} className="text-ink-dim" />
                Logout
              </button>
            </form>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
