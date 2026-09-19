import { NextResponse } from 'next/server'
import { createHash, randomBytes } from 'node:crypto'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { requireUserAndTenant } from '@/lib/api/tenant'
import { TARGET_TABLES } from '@/lib/connectors/ingest'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Quản lý kết nối dữ liệu ngoài (Google Sheets · Larksuite · MISA ·
 * zenidigital.io · ZeniCloud · webhook/API bất kỳ).
 *
 * POST tạo connector → SINH TOKEN NẠP, trả về ĐÚNG MỘT LẦN (DB chỉ giữ hash).
 * Người dùng dán token đó vào hệ thống nguồn để đẩy dữ liệu về /api/ingest.
 */

const PROVIDER_HINTS: Record<string, string> = {
  google_sheets: 'Dùng Apps Script: UrlFetchApp.fetch(url, {method:"post", headers:{"X-Zeni-Ingest-Token":TOKEN}, payload:JSON.stringify({source_object:"<tên sheet>", rows})})',
  google_workspace: 'Đẩy dữ liệu qua Apps Script hoặc Cloud Function của workspace.',
  larksuite: 'Dùng Lark Automation / Webhook node gọi POST kèm header token.',
  misa: 'Xuất bảng kê từ MISA (Excel/CSV) rồi đẩy JSON lên endpoint, hoặc dùng script trung gian.',
  zenidigital: 'Cấu hình webhook outbound trỏ về /api/ingest.',
  zeni_cloud: 'Dùng ZeniCloud Automation (Lớp 04) tạo luồng đẩy dữ liệu định kỳ.',
  csv_upload: 'Tải file CSV lên rồi hệ thống chuyển thành rows JSON.',
  webhook: 'Bất kỳ hệ thống nào gọi được HTTP POST JSON.',
  api: 'Tích hợp qua API tuỳ biến.',
}

export async function GET() {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const [connR, mapR, runR] = await Promise.all([
    supabase
      .from('data_connectors')
      .select('id, provider, name, direction, status, token_hint, config, last_sync_at, last_sync_status, total_rows_ingested, created_at')
      .order('created_at', { ascending: false }),
    supabase.from('connector_mappings').select('id, connector_id, source_object, target_table, field_map, is_enabled'),
    supabase
      .from('sync_runs')
      .select('id, connector_id, target_table, rows_received, rows_written, rows_rejected, status, started_at')
      .order('started_at', { ascending: false })
      .limit(20),
  ])
  if (connR.error) return NextResponse.json({ error: connR.error.message }, { status: 500 })

  const connectors = connR.data ?? []
  const mappings = mapR.error ? [] : mapR.data ?? []
  const runs = runR.error ? [] : runR.data ?? []

  return NextResponse.json({
    data: {
      connectors,
      mappings,
      runs,
      target_tables: TARGET_TABLES,
      ingest_endpoint: '/api/ingest',
      summary: {
        total: connectors.length,
        active: connectors.filter((c) => c.status === 'active').length,
        rows_total: connectors.reduce((a, c) => a + Number(c.total_rows_ingested ?? 0), 0),
        last_sync: connectors.find((c) => c.last_sync_at)?.last_sync_at ?? null,
      },
    },
  })
}

const PostSchema = z.object({
  provider: z.enum([
    'google_sheets', 'google_workspace', 'larksuite', 'misa',
    'zenidigital', 'zeni_cloud', 'csv_upload', 'webhook', 'api',
  ]),
  name: z.string().trim().min(1).max(120),
  direction: z.enum(['inbound', 'outbound', 'bidirectional']).default('inbound'),
  config: z.record(z.unknown()).optional(),
  // Tạo luôn mapping đầu tiên cho tiện
  source_object: z.string().trim().max(200).optional(),
  target_table: z.enum(TARGET_TABLES).optional(),
  field_map: z.record(z.string()).optional(),
})

export async function POST(req: Request) {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const body = await req.json().catch(() => ({}))
  const parsed = PostSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  // Token nạp: sinh ngẫu nhiên 32 byte, DB chỉ giữ sha256 + 6 ký tự cuối.
  const rawToken = `zi_ing_${randomBytes(32).toString('base64url')}`
  const tokenHash = createHash('sha256').update(rawToken).digest('hex')

  const { data: connector, error } = await supabase
    .from('data_connectors')
    .insert({
      tenant_id: auth.tenantId,
      provider: parsed.data.provider,
      name: parsed.data.name,
      direction: parsed.data.direction,
      status: 'active',
      token_hash: tokenHash,
      token_hint: rawToken.slice(-6),
      config: parsed.data.config ?? {},
    })
    .select('id, provider, name, status, token_hint')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let mapping = null
  if (parsed.data.source_object && parsed.data.target_table) {
    const m = await supabase
      .from('connector_mappings')
      .insert({
        tenant_id: auth.tenantId,
        connector_id: connector.id,
        source_object: parsed.data.source_object,
        target_table: parsed.data.target_table,
        field_map: parsed.data.field_map ?? {},
      })
      .select('id, source_object, target_table')
      .single()
    mapping = m.data ?? null
  }

  return NextResponse.json(
    {
      data: {
        connector,
        mapping,
        // Token hiện ĐÚNG MỘT LẦN — sau đây không đọc lại được.
        ingest_token: rawToken,
        ingest_endpoint: '/api/ingest',
        setup_hint: PROVIDER_HINTS[parsed.data.provider] ?? '',
        warning: 'Lưu token ngay — hệ thống chỉ giữ bản băm, không hiển thị lại.',
      },
    },
    { status: 201 },
  )
}
