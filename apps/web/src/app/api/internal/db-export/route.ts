import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';

/**
 * SAO LƯU DỮ LIỆU ĐANG SỐNG (chỉ đọc).
 *
 * Xuất toàn bộ bảng trong schema `public` ra JSON để tải về giữ bản sao.
 * Kết hợp với 31 file migration (đã có trong repo) là khôi phục lại được:
 *   migrations dựng cấu trúc  +  file JSON này đổ dữ liệu.
 *
 * AN TOÀN:
 *  - CHỈ ĐỌC. Không có đường nào ghi/xoá trong file này.
 *  - Auth y hệt `db-setup`: x-internal-key (so sánh chống dò thời gian) HOẶC
 *    Bearer PAT tự chứng minh là operator workspace (server tự hỏi ZeniCloud)
 *    HOẶC phiên superadmin Zeni ID.
 *  - Chạy qua pool owner, KHÔNG set ngữ cảnh người dùng — đây là công cụ vận
 *    hành, không phải API cho người dùng cuối. Vì vậy auth phải chặt.
 *  - Có trần số dòng mỗi bảng để không làm sập bộ nhớ; bảng nào bị cắt sẽ ghi
 *    rõ `truncated: true` thay vì lặng lẽ trả thiếu (fail-loud).
 */
export const runtime = 'nodejs';
export const maxDuration = 300;

const ZENICLOUD_API = (process.env.ZENICLOUD_API ?? 'https://zenicloud.io/api/v1').replace(/\/$/, '');
const ZENICLOUD_WS = process.env.ZENICLOUD_WS ?? 'zeniipo-com';
const MAX_ROWS_PER_TABLE = 20_000;

function keyOk(given: string): boolean {
  const expect = process.env.INTERNAL_API_KEY ?? '';
  if (!expect || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expect);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function authorize(req: NextRequest): Promise<string | null> {
  if (keyOk(req.headers.get('x-internal-key') ?? '')) return 'internal-key';
  const bearer = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (bearer) {
    try {
      const r = await fetch(`${ZENICLOUD_API}/projects?ws=${ZENICLOUD_WS}`, {
        headers: { Authorization: `Bearer ${bearer}` },
        cache: 'no-store',
      });
      if (r.ok) return 'workspace-pat';
    } catch {
      /* fail-closed */
    }
  }
  try {
    const { isCurrentSuperAdmin } = await import('@/lib/zeni/superadmin');
    if (await isCurrentSuperAdmin()) return 'superadmin';
  } catch {
    /* fail-closed */
  }
  return null;
}

export async function GET(req: NextRequest) {
  const via = await authorize(req);
  if (!via) return NextResponse.json({ error: 'Không có quyền' }, { status: 401 });
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Chưa có DATABASE_URL' }, { status: 503 });
  }

  const { query } = await import('@/lib/zeni/db');
  const url = new URL(req.url);
  // ?schema_only=1 → chỉ liệt kê bảng + số dòng (xem nhanh, không tải dữ liệu)
  const schemaOnly = url.searchParams.get('schema_only') === '1';

  const tables = await query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name`,
  );

  const data: Record<string, unknown[]> = {};
  const meta: Array<{ table: string; rows: number; truncated: boolean; error?: string }> = [];

  for (const { table_name } of tables) {
    // Tên bảng lấy từ information_schema (không phải input người dùng), vẫn
    // chặn thêm bằng biểu thức để không bao giờ nối chuỗi tuỳ tiện vào SQL.
    if (!/^[a-z_][a-z0-9_]*$/i.test(table_name)) continue;
    try {
      const c = await query<{ n: number }>(`SELECT count(*)::int AS n FROM public."${table_name}"`);
      const total = c[0]?.n ?? 0;
      if (!schemaOnly) {
        const rows = await query(`SELECT * FROM public."${table_name}" LIMIT ${MAX_ROWS_PER_TABLE}`);
        data[table_name] = rows;
      }
      meta.push({ table: table_name, rows: total, truncated: total > MAX_ROWS_PER_TABLE });
    } catch (e) {
      meta.push({
        table: table_name,
        rows: -1,
        truncated: false,
        error: e instanceof Error ? e.message.slice(0, 160) : 'unknown',
      });
    }
  }

  const body = {
    exported_at: new Date().toISOString(),
    authorized_via: via,
    database: 'zeniipo (Zeni Cloud)',
    note: 'Khôi phục: chạy 31 migration trong packages/database/zenicloud để dựng cấu trúc, rồi đổ dữ liệu từ khối "data".',
    table_count: meta.length,
    total_rows: meta.reduce((a, m) => a + Math.max(0, m.rows), 0),
    tables: meta,
    ...(schemaOnly ? {} : { data }),
  };

  return new NextResponse(JSON.stringify(body), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Disposition': `attachment; filename="zeniipo-backup-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
