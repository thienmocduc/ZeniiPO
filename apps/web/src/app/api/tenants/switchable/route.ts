import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

/**
 * DANH SÁCH CÔNG TY NGƯỜI DÙNG ĐƯỢC VÀO — cho ô chọn công ty ở thanh bên.
 *
 * Dùng hàm sẵn có `public.list_accessible_tenants()` (migration 006) thay vì tự
 * viết truy vấn: hàm đó đã gói đúng luật — chủ nền tảng thấy mọi công ty trong
 * hệ sinh thái, người dùng thường CHỈ thấy công ty của mình. Tự viết lại luật
 * này ở tầng ứng dụng là mở thêm một chỗ có thể sai lệch với CSDL.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });

  const { data, error } = await supabase.rpc('list_accessible_tenants');
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const ds = (Array.isArray(data) ? data : []) as Array<{
    id: string;
    name: string;
    slug: string;
    plan: string | null;
  }>;

  // Công ty đang xem = công ty trong hồ sơ người dùng.
  const { data: hoSo } = await supabase
    .from('user_profiles')
    .select('tenant_id')
    .eq('id', user.id)
    .maybeSingle();

  return NextResponse.json({
    data: ds,
    hien_tai: (hoSo as { tenant_id?: string } | null)?.tenant_id ?? null,
  });
}
