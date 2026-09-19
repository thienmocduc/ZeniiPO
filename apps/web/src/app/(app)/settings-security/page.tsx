import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { SecurityPanel } from './panel'

export const dynamic = 'force-dynamic'

export default async function SecuritySettingsPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="p-6 max-w-3xl">
      <header className="mb-6">
        <div className="text-xs uppercase tracking-widest text-ink-dim">Hệ thống › Cài đặt › Bảo mật</div>
        <h1 className="font-serif text-2xl text-gold-light mt-1">Quản lý bảo mật tài khoản</h1>
        <p className="text-sm text-ink-dim mt-1">
          Tài khoản Zeni ID dùng chung hệ sinh thái — mật khẩu · email · MFA quản
          lý tại zenicloud.io; app sẽ tự phục vụ khi Zeni ID mở API.
        </p>
      </header>

      <SecurityPanel currentEmail={user.email ?? ''} enrolledFactors={[]} />
    </div>
  )
}
