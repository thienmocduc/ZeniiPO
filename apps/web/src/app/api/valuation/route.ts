import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireUserAndTenant } from '@/lib/api/tenant'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  const [journey, snapshots, comps, dinhGia] = await Promise.all([
    supabase
      .from('ipo_journeys')
      .select('id, name, valuation_target, current_phase, target_year, exit_venue')
      .eq('tenant_id', auth.tenantId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('cap_table_snapshots')
      .select('id, snapshot_date, snapshot_type, total_shares, fully_diluted_shares, valuation_usd, share_price_usd, holders')
      .eq('tenant_id', auth.tenantId)
      .order('snapshot_date', { ascending: false })
      .limit(20),
    supabase
      .from('comparables')
      .select('company_name, ticker, ev_revenue_multiple, ev_ebitda_multiple, pe_ratio, growth_rate_pct')
      .eq('tenant_id', auth.tenantId)
      .order('updated_at', { ascending: false })
      .limit(20),
    // Các lần chạy định giá KÈM trạng thái phê duyệt.
    //
    // Trước đây `/api/valuation/run` ghi vào `valuation_runs` nhưng KHÔNG route
    // nào đọc bảng đó ra — chạy xong thì con số rơi vào CSDL rồi không ai nhìn
    // thấy lại. Và dấu vết phê duyệt (migration 039) cũng chưa có đường nào
    // phơi ra: cơ chế kiểm soát mà không ai thấy thì không kiểm soát được gì.
    supabase
      .from('dinh_gia_kem_phe_duyet')
      .select(
        'id, method, enterprise_value_usd, equity_value_usd, nguoi_chay, chay_luc, ' +
          'trang_thai_duyet, giai_thich, nguoi_duyet, duyet_luc',
      )
      .eq('tenant_id', auth.tenantId)
      .order('chay_luc', { ascending: false })
      .limit(20),
  ])
  return NextResponse.json({
    data: {
      journey: journey.data,
      cap_history: snapshots.data ?? [],
      comparables: comps.data ?? [],
      dinh_gia: dinhGia.data ?? [],
      // Đếm sẵn để giao diện không phải tự lọc — và để con số "bao nhiêu lần
      // định giá chưa ai duyệt" đập vào mắt thay vì nằm im trong danh sách.
      dinh_gia_tom_tat: {
        tong: (dinhGia.data ?? []).length,
        chua_duyet: (dinhGia.data ?? []).filter((x) => x.trang_thai_duyet === 'chua_duyet').length,
        het_hieu_luc: (dinhGia.data ?? []).filter((x) => x.trang_thai_duyet === 'het_hieu_luc').length,
      },
    },
  })
}
