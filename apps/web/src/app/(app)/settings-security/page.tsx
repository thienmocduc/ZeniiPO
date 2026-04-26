import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { SecurityPanel } from './panel'

export const dynamic = 'force-dynamic'

export default async function SecuritySettingsPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: factors } = await supabase.auth.mfa.listFactors()

  return (
    <div className="p-6 max-w-3xl">
      <header className="mb-6">
        <div className="text-xs uppercase tracking-widest text-ink-dim">Hệ thống › Cài đặt › Bảo mật</div>
        <h1 className="font-serif text-2xl text-gold-light mt-1">Quản lý bảo mật tài khoản</h1>
        <p className="text-sm text-ink-dim mt-1">Đổi mật khẩu · đổi email · bật xác thực 2 bước (TOTP).</p>
      </header>

      <SecurityPanel
        currentEmail={user.email ?? ''}
        enrolledFactors={(factors?.totp ?? []).map((f) => ({ id: f.id, friendly_name: f.friendly_name ?? null, status: f.status }))}
      />
    </div>
  )
}
