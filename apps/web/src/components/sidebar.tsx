import Link from 'next/link';
import { SidebarItem } from './sidebar-item';

type NavItem = {
  id: string;
  icon: string;
  label: string;
  href: string;
  badge?: string;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Tổng Quan',
    items: [
      { id: 'dash', icon: '◉', label: 'Dashboard', href: '/dashboard' },
      { id: 'kpi', icon: '▦', label: 'KPI Matrix', href: '/kpi-matrix' },
      { id: 'mile', icon: '◊', label: 'Milestones', href: '/milestones' },
      { id: 'tasks', icon: '▸', label: 'Task Cascade', href: '/task-cascade' },
      { id: 'wf', icon: '⧉', label: 'Workflow', href: '/workflow' },
    ],
  },
  {
    label: 'Tài Chính',
    items: [
      { id: 'fin', icon: '$', label: 'Financial Model', href: '/financials' },
      { id: 'sens', icon: '∴', label: 'Sensitivity', href: '/sensitivity' },
      { id: 'cap', icon: '◎', label: 'Cap Table', href: '/cap-table' },
      { id: 'clv', icon: 'Σ', label: 'CLV/CAC', href: '/clv-cac' },
      { id: 'vh', icon: '↑', label: 'Valuation', href: '/valuation' },
      { id: 'token', icon: '⬢', label: 'Tokenomics', href: '/tokenomics' },
    ],
  },
  {
    label: 'Gọi Vốn · IPO',
    items: [
      { id: 'ipo', icon: '★', label: 'IPO Execution', href: '/ipo-execution' },
      { id: 'pdeck', icon: '▣', label: 'Pitch Deck', href: '/pitch-deck' },
      { id: 'droom', icon: '▤', label: 'Data Room', href: '/data-room' },
      { id: 'gvpipe', icon: '⟶', label: 'Fundraise Pipeline', href: '/governance' },
      { id: 'gvdoc', icon: '▥', label: 'Governance Docs', href: '/governance-docs' },
    ],
  },
  {
    label: 'Pháp Lý',
    items: [
      { id: 'leg', icon: '§', label: 'Legal Docs', href: '/legal' },
      { id: 'tc', icon: '¶', label: 'Terms', href: '/terms' },
      { id: 'tcdoc', icon: '‡', label: 'Terms Docs', href: '/terms-docs' },
      { id: 'hsoct', icon: '◈', label: 'Compliance', href: '/compliance' },
    ],
  },
  {
    label: 'AI · Insight',
    items: [
      { id: 'comp', icon: '⊞', label: 'Comparables', href: '/comparables' },
      { id: 'mhkd', icon: '◬', label: 'Market Data', href: '/market-data' },
      { id: 'mkt', icon: '◭', label: 'Market Intel', href: '/market-intel' },
      { id: 'nlq', icon: '?', label: 'NL Query', href: '/nl-query' },
    ],
  },
  {
    label: 'Học Tập',
    items: [
      { id: 'academy', icon: '◑', label: 'Academy', href: '/academy', badge: 'MEMBER' },
    ],
  },
  {
    label: 'Hệ Thống',
    items: [
      { id: 'users', icon: '◐', label: 'Users', href: '/users' },
      { id: 'admin', icon: '★', label: 'Admin', href: '/admin' },
      { id: 'settings', icon: '⚙', label: 'Settings', href: '/settings' },
      { id: 'vault', icon: '🔒', label: 'Vault', href: '/vault' },
      { id: 'sales', icon: '↗', label: 'Sales', href: '/sales' },
      { id: 'billing', icon: '$', label: 'Billing', href: '/billing' },
      { id: 'feedback', icon: '♡', label: 'Feedback', href: '/feedback' },
    ],
  },
];

export function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 w-[240px] h-screen bg-panel border-r border-w-12 flex flex-col z-30">
      {/* Header */}
      <div className="h-[64px] flex items-center px-5 border-b border-w-12 shrink-0">
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <span
            aria-hidden="true"
            className="inline-flex items-center justify-center w-8 h-8 rounded font-display font-bold text-bg text-lg leading-none"
            style={{
              background:
                'linear-gradient(135deg, #E4C16E 0%, #C9A84C 55%, #8B7834 100%)',
            }}
          >
            Z
          </span>
          <span className="font-display text-lg text-ivory tracking-tight">
            Zeni <em className="italic text-gold-light font-display">iPO</em>
          </span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <div className="px-3 font-mono uppercase text-[.68rem] tracking-widest text-ink-dim mb-2">
              {group.label}
            </div>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <SidebarItem
                  key={item.id}
                  icon={item.icon}
                  label={item.label}
                  href={item.href}
                  badge={item.badge}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-w-12 text-[.6rem] font-mono text-ink-mute tracking-wider shrink-0">
        ZENIIPO · v1.0
      </div>
    </aside>
  );
}
