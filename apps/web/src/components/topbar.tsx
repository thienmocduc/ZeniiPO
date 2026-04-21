import { headers } from 'next/headers';
import { AppSwitcher } from './app-switcher';
import { UserMenu } from './user-menu';

// Minimal user shape (avoid importing Supabase types here to keep this
// component decoupled from the auth client).
type TopbarUser = {
  email?: string | null;
  user_metadata?: { full_name?: string | null; name?: string | null } | null;
};

// Map route prefix → human label for breadcrumb.
const SECTION_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  'kpi-matrix': 'KPI Matrix',
  milestones: 'Milestones',
  'task-cascade': 'Task Cascade',
  workflow: 'Workflow',
  financials: 'Financial Model',
  sensitivity: 'Sensitivity',
  'cap-table': 'Cap Table',
  'clv-cac': 'CLV / CAC',
  valuation: 'Valuation',
  tokenomics: 'Tokenomics',
  'ipo-execution': 'IPO Execution',
  'pitch-deck': 'Pitch Deck',
  'data-room': 'Data Room',
  governance: 'Fundraise Pipeline',
  'governance-docs': 'Governance Docs',
  legal: 'Legal Docs',
  terms: 'Terms',
  'terms-docs': 'Terms Docs',
  compliance: 'Compliance',
  comparables: 'Comparables',
  'market-data': 'Market Data',
  'market-intel': 'Market Intel',
  'nl-query': 'NL Query',
  academy: 'Academy',
  users: 'Users',
  admin: 'Admin',
  settings: 'Settings',
  vault: 'Vault',
  sales: 'Sales',
  billing: 'Billing',
  feedback: 'Feedback',
};

function resolveSection(pathname: string) {
  const segments = pathname.split('/').filter(Boolean);
  const first = segments[0] ?? '';
  return SECTION_LABELS[first] ?? 'Dashboard';
}

export function Topbar({ user }: { user: TopbarUser }) {
  // Read current pathname from Next.js request headers (set by middleware).
  const h = headers();
  const pathname =
    h.get('x-pathname') || h.get('x-invoke-path') || h.get('next-url') || '/dashboard';
  const section = resolveSection(pathname);

  const email = user.email ?? '—';
  const displayName =
    user.user_metadata?.full_name || user.user_metadata?.name || undefined;

  return (
    <header className="h-[64px] border-b border-w-12 bg-panel/80 backdrop-blur-sm sticky top-0 z-20 flex items-center px-6 gap-4">
      <div className="flex items-center gap-2 text-sm min-w-0">
        <span className="font-mono uppercase tracking-widest text-[.68rem] text-ink-dim">
          Zeni iPO
        </span>
        <span className="text-ink-dim">/</span>
        <span className="font-display text-ivory truncate">{section}</span>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-3">
        <AppSwitcher />
        <UserMenu email={email} displayName={displayName} />
      </div>
    </header>
  );
}
