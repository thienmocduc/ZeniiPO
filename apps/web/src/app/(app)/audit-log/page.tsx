import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { AuditLogViewer } from './viewer'

export const dynamic = 'force-dynamic'

export default async function AuditLogPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/audit-log')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const canAccess = profile?.role && ['chr', 'ceo', 'auditor'].includes(profile.role)
  if (!canAccess) {
    return (
      <div className="p-6 max-w-2xl">
        <h1 className="font-serif text-2xl text-gold-light">Audit Log</h1>
        <div className="mt-6 rounded border border-amber-700/40 bg-amber-900/15 p-4 text-sm text-amber-200">
          🔒 Chỉ Chairman / CEO / Auditor mới có quyền xem audit log. Vai trò hiện tại: <b>{profile?.role ?? 'unknown'}</b>.
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl">
      <header className="mb-6">
        <div className="text-xs uppercase tracking-widest text-ink-dim">Bảo mật › Audit Log</div>
        <h1 className="font-serif text-2xl text-gold-light mt-1">Audit Log</h1>
        <p className="text-sm text-ink-dim mt-1">
          Mọi thay đổi nhạy cảm trong hệ thống được DB trigger ghi lại. Read-only · 7 năm retention.
        </p>
      </header>
      <AuditLogViewer />
    </div>
  )
}
