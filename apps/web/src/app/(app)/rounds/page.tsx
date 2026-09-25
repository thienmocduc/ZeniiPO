import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { DanhSachVong } from './danh-sach-vong'

export const dynamic = 'force-dynamic'

export default async function RoundsPage() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/rounds')

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="mb-6">
        <div className="text-xs uppercase tracking-widest text-ink-dim">Bước 6 › Chiến lược vốn</div>
        <h1 className="font-serif text-2xl text-gold-light mt-1">Vòng gọi vốn</h1>
        <p className="text-sm text-ink-dim mt-1 max-w-3xl">
          Mở và theo dõi từng vòng gọi vốn. Hành trình chỉ qua bước 6 khi có ít nhất một vòng
          đang mở — vì chiến lược vốn phải khớp với hàm đốt tiền, không để tới lúc cạn mới đi gọi.
        </p>
      </header>
      <DanhSachVong />
    </div>
  )
}
