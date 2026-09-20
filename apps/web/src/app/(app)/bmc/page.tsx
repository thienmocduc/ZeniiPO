import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { CanvasBoard } from './canvas'

export const dynamic = 'force-dynamic'

export default async function BmcPage() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/bmc')

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <header className="mb-6">
        <div className="text-xs uppercase tracking-widest text-ink-dim">Bước 1 › Mô hình kinh doanh</div>
        <h1 className="font-serif text-2xl text-gold-light mt-1">
          Business Model Canvas · 9 khối
        </h1>
        <p className="text-sm text-ink-dim mt-1 max-w-3xl">
          Đóng khung mô hình kinh doanh trước khi làm bất cứ thứ gì khác — mọi con số ở các
          bước sau đều bắt nguồn từ đây. Qua cổng bước 1 cần tối thiểu 5 khối có nội dung.
        </p>
      </header>
      <CanvasBoard />
    </div>
  )
}
