import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

/**
 * BỐ CỤC MÀN HÌNH THEO VAI — trả về những mục người này nên thấy TRƯỚC.
 *
 * Trước đây 8 vai (chr·ceo·cfo·coo·cto·cmo·clo·emp) đều thấy y hệt nhau và phải
 * lội qua 51 mục menu. CFO đi tìm phần tài chính mất đúng số thao tác như một
 * nhân viên đi tìm việc được giao.
 *
 * ⚠ ĐÂY KHÔNG PHẢI PHÂN QUYỀN. Nó chỉ quyết định thấy gì TRƯỚC, không quyết
 * định được phép xem gì — quyền vẫn do RLS ở CSDL giữ. Nhầm hai thứ này là tự
 * tạo lỗ bảo mật kiểu "giấu nút đi coi như đã cấm".
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });

  const { data: hoSo } = await supabase
    .from('user_profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .maybeSingle();

  const vai = (hoSo as { role?: string } | null)?.role ?? 'emp';

  const { data, error } = await supabase
    .from('role_dashboard_blocks')
    .select('block_key, position, title_vi, why_vi, is_primary')
    .eq('role', vai)
    .order('position');

  if (error) {
    // Fail-closed: không đoán bố cục. Trả danh sách rỗng để giao diện giữ
    // nguyên menu đầy đủ, hơn là hiện một bố cục bịa.
    return NextResponse.json({ vai, data: [], loi: error.message }, { status: 200 });
  }

  return NextResponse.json({
    vai,
    ten: (hoSo as { full_name?: string } | null)?.full_name ?? null,
    data: data ?? [],
  });
}
