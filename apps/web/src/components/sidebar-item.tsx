'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

type SidebarItemProps = {
  icon: string;
  label: string;
  href: string;
  badge?: string;
};

export function SidebarItem({ icon, label, href, badge }: SidebarItemProps) {
  const pathname = usePathname();
  const isActive =
    pathname === href || (href !== '/' && pathname?.startsWith(href + '/'));

  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors',
        isActive
          ? 'bg-gold/10 border-l-2 border-gold text-ivory'
          : 'text-ink-2 hover:bg-w-6 border-l-2 border-transparent'
      )}
    >
      <span
        className={cn(
          'font-mono w-5 text-center',
          isActive ? 'text-gold-light' : 'text-ink-dim'
        )}
      >
        {icon}
      </span>
      <span className="flex-1 truncate">{label}</span>
      {badge && (
        <span className="text-[.58rem] font-mono bg-gold/10 text-gold-light px-1.5 py-0.5 rounded tracking-wider">
          {badge}
        </span>
      )}
    </Link>
  );
}
