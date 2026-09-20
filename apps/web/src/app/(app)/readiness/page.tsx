import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerClient } from '@/lib/supabase/server'
import { BangSanSang } from './bang-san-sang'

export const dynamic = 'force-dynamic'

export default async function ReadinessPage() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/readiness')

  // Tiêu chí gắn với HÀNH TRÌNH, không gắn với doanh nghiệp — một doanh nghiệp
  // có thể chạy lại hành trình mới mà vẫn giữ lịch sử hành trình cũ.
  const { data: journey } = await supabase
    .from('ipo_journeys')
    .select('id, name')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <header className="mb-6">
        <div className="text-xs uppercase tracking-widest text-ink-dim">Bước 8–9 › Sẵn sàng niêm yết</div>
        <h1 className="font-serif text-2xl text-gold-light mt-1">Hồ sơ bằng chứng cho từng tiêu chí</h1>
        <p className="text-sm text-ink-dim mt-1 max-w-3xl">
          Bên thẩm định đòi hồ sơ cho từng tiêu chí; tiêu chí không có hồ sơ với họ bằng
          không, bất kể hệ thống ghi bao nhiêu. Màn hình này hiện cả điểm tự khai lẫn điểm đã
          xác minh để bạn thấy trước khoảng cách — thay vì vỡ ra lúc due diligence.
        </p>
      </header>

      {journey ? (
        <BangSanSang journeyId={journey.id as string} />
      ) : (
        <div className="rounded-xl border border-dashed border-w8 bg-bg-2 p-10 text-center text-ink-dim text-sm">
          Chưa có hành trình IPO nào đang hoạt động.{' '}
          <Link href="/onboarding" className="text-gold-light underline">
            Hoàn tất bước nhập môn
          </Link>{' '}
          để hệ thống tạo bộ tiêu chí chuẩn.
        </div>
      )}
    </div>
  )
}
