import { NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import { mapRows, TARGET_TABLES, type TargetTable } from '@/lib/connectors/ingest'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120

/**
 * POST /api/ingest — CỔNG NẠP DỮ LIỆU TỪ HỆ THỐNG NGOÀI.
 *
 * Bất kỳ nền tảng nào gửi được HTTP JSON đều đấu nối được: Google Sheets
 * (Apps Script), Larksuite (automation), MISA (script xuất), zenidigital.io,
 * ZeniCloud Automation, ERP nội bộ…
 *
 *   POST /api/ingest
 *   Header: X-Zeni-Ingest-Token: <token cấp khi tạo connector>
 *   Body:   { "source_object": "PL_2026", "rows": [ {...}, {...} ] }
 *
 * BẢO MẬT:
 *  - Xác thực bằng token băm sha256 (DB không lưu token thô).
 *  - tenant_id lấy TỪ CONNECTOR, không lấy từ payload → không ghi chéo tenant.
 *  - Chỉ ghi vào bảng trong danh sách trắng, qua schema kiểm định từng dòng.
 *  - Mọi lần nạp ghi sync_runs (ai · bảng nào · bao nhiêu dòng · lỗi gì).
 */

const MAX_ROWS = 5000

const BodySchema = z.object({
  source_object: z.string().trim().min(1).max(200),
  rows: z.array(z.record(z.unknown())).min(1).max(MAX_ROWS),
  dry_run: z.boolean().optional(),
})

export async function POST(req: Request) {
  const token = req.headers.get('x-zeni-ingest-token') ?? ''
  if (!token || token.length < 20) {
    return NextResponse.json({ error: 'Thiếu hoặc sai X-Zeni-Ingest-Token' }, { status: 401 })
  }
  const tokenHash = createHash('sha256').update(token).digest('hex')

  const body = await req.json().catch(() => null)
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const sb = createServiceClient()

  const { data: connector } = await sb
    .from('data_connectors')
    .select('id, tenant_id, name, provider, status, total_rows_ingested')
    .eq('token_hash', tokenHash)
    .maybeSingle()
  if (!connector) {
    return NextResponse.json({ error: 'Token không hợp lệ' }, { status: 401 })
  }
  if (connector.status !== 'active') {
    return NextResponse.json({ error: `Connector đang ở trạng thái ${connector.status}` }, { status: 403 })
  }

  const { data: mapping } = await sb
    .from('connector_mappings')
    .select('id, source_object, target_table, field_map, is_enabled')
    .eq('connector_id', connector.id)
    .eq('source_object', parsed.data.source_object)
    .maybeSingle()
  if (!mapping || !mapping.is_enabled) {
    return NextResponse.json(
      { error: `Chưa cấu hình ánh xạ cho nguồn "${parsed.data.source_object}" — tạo mapping trước.` },
      { status: 404 },
    )
  }
  const target = mapping.target_table as TargetTable
  if (!TARGET_TABLES.includes(target)) {
    return NextResponse.json({ error: 'Bảng đích không được phép' }, { status: 400 })
  }

  const { valid, rejected } = mapRows(
    target,
    parsed.data.rows,
    (mapping.field_map ?? {}) as Record<string, string>,
  )

  if (parsed.data.dry_run) {
    return NextResponse.json({
      data: {
        dry_run: true, target_table: target,
        rows_received: parsed.data.rows.length,
        rows_valid: valid.length, rows_rejected: rejected.length,
        sample: valid.slice(0, 3), rejected: rejected.slice(0, 10),
      },
    })
  }

  const { data: run } = await sb
    .from('sync_runs')
    .insert({
      tenant_id: connector.tenant_id,
      connector_id: connector.id,
      target_table: target,
      rows_received: parsed.data.rows.length,
      rows_rejected: rejected.length,
      status: 'running',
      source_ip: (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || null,
    })
    .select('id')
    .single()

  let written = 0
  const errors: Array<Record<string, unknown>> = rejected.slice(0, 20).map((r) => ({
    index: r.index, reason: r.reason,
  }))

  if (valid.length > 0) {
    const payload = valid.map((r) => ({ ...r, tenant_id: connector.tenant_id }))
    const conflictKeys = (target === 'financial_statements' || target === 'unit_economics_inputs')
      ? 'tenant_id,period'
      : null

    // Ghi theo lô 500 dòng để không vượt giới hạn payload.
    for (let i = 0; i < payload.length; i += 500) {
      const chunk = payload.slice(i, i + 500)
      const q = conflictKeys
        ? sb.from(target).upsert(chunk, { onConflict: conflictKeys }).select('id')
        : sb.from(target).insert(chunk).select('id')
      const { data, error } = await q
      if (error) {
        errors.push({ chunk_start: i, db_error: error.message.slice(0, 300) })
      } else {
        written += data?.length ?? chunk.length
      }
    }
  }

  const status = written === 0 && valid.length > 0 ? 'failed' : rejected.length > 0 || errors.length > 0 ? 'partial' : 'success'

  if (run?.id) {
    await sb
      .from('sync_runs')
      .update({ rows_written: written, status, errors, finished_at: new Date().toISOString() })
      .eq('id', run.id)
  }
  await sb
    .from('data_connectors')
    .update({
      last_sync_at: new Date().toISOString(),
      last_sync_status: status,
      total_rows_ingested: Number(connector.total_rows_ingested ?? 0) + written,
    })
    .eq('id', connector.id)

  return NextResponse.json({
    data: {
      connector: connector.name,
      target_table: target,
      rows_received: parsed.data.rows.length,
      rows_written: written,
      rows_rejected: rejected.length,
      status,
      rejected: rejected.slice(0, 10),
    },
  })
}
