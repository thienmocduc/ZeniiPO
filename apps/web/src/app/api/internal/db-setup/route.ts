import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { isCurrentSuperAdmin } from '@/lib/zeni/superadmin';

/**
 * DB-SETUP (chairman lệnh "dựng DB sạch trên ZeniCloud" 2026-08-10):
 * chạy bộ 29 migrations `packages/database/zenicloud/*.sql` (đã verify idempotent
 * 3 vòng) lên DB `zeni_ipo` NGAY KHI platform inject DATABASE_URL (ticket #8) —
 * không cần shell platform. Chỉ chạy file SQL đóng gói sẵn trong image,
 * KHÔNG nhận SQL từ ngoài.
 *
 * Auth (1 trong 3): x-internal-key (INTERNAL_API_KEY, timing-safe) ·
 * phiên superadmin Zeni ID · Bearer PAT chứng minh là operator workspace
 * (server tự gọi ZeniCloud GET /projects?ws= bằng token đó — 200 mới nhận).
 */
export const runtime = 'nodejs';
export const maxDuration = 300;

const ZENICLOUD_API = (process.env.ZENICLOUD_API ?? 'https://zenicloud.io/api/v1').replace(/\/$/, '');
const ZENICLOUD_WS = process.env.ZENICLOUD_WS ?? 'zeniipo-com';

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
    if (await isCurrentSuperAdmin()) return 'superadmin';
  } catch {
    /* fail-closed */
  }
  return null;
}

function findMigrationsDir(): string | null {
  const candidates = [
    path.join(process.cwd(), 'packages', 'database', 'zenicloud'),
    path.join(process.cwd(), '..', '..', 'packages', 'database', 'zenicloud'),
    path.join(process.cwd(), 'apps', 'web', '..', '..', 'packages', 'database', 'zenicloud'),
  ];
  for (const c of candidates) {
    try {
      if (fs.existsSync(c) && fs.statSync(c).isDirectory()) return c;
    } catch {
      /* next */
    }
  }
  return null;
}

/**
 * Thứ tự chạy migration là BẮT BUỘC, và sắp xếp theo bảng chữ cái là SAI.
 *
 * So chuỗi: "001_auth_rbac.sql" < "00_zeni_stub.sql" vì ký tự '1' đứng trước '_'
 * trong bảng mã. Hậu quả thật (đo được khi chạy lần đầu trên DB trống): file 001
 * chạy trước và chết ngay với `schema "auth" does not exist`, kéo theo 30 file
 * sau bị bỏ qua — 31/31 thất bại.
 *
 * Nay sắp theo SỐ ở đầu tên file: 00_zeni_stub (0) → 001 (1) → … → 030 (30).
 */
function listSqlFiles(dir: string): string[] {
  const order = (f: string): number => {
    const m = /^(\d+)/.exec(f)
    return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER
  }
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort((a, b) => order(a) - order(b) || a.localeCompare(b))
}

/**
 * Chẩn đoán quyền trên DB đích.
 *
 * Khi dựng thật trên Zeni Cloud, `000_zeni_stub.sql` đổ với
 * "permission denied to create role" — nhưng thông báo đó không cho biết ta
 * ĐANG là ai và THIẾU đúng quyền nào. Hàm này trả lời chính xác để còn đi xin
 * đúng thứ cần, thay vì đoán.
 */
async function dbDiagnostics() {
  const { query } = await import('@/lib/zeni/db')
  const out: Record<string, unknown> = {}
  const probe = async (key: string, sql: string) => {
    try {
      const r = await query<Record<string, unknown>>(sql)
      out[key] = r[0] ?? null
    } catch (e) {
      out[key] = `ERR: ${e instanceof Error ? e.message.slice(0, 120) : 'unknown'}`
    }
  }
  await probe('me', 'SELECT current_user, current_database() AS db, version() AS pg')
  await probe(
    'quyen_cua_toi',
    `SELECT rolsuper AS la_superuser, rolcreaterole AS tao_duoc_role,
            rolcreatedb AS tao_duoc_db, rolbypassrls AS bo_qua_rls
       FROM pg_roles WHERE rolname = current_user`,
  )
  await probe(
    'role_can_co',
    `SELECT
       bool_or(rolname='authenticated') AS co_authenticated,
       bool_or(rolname='anon')          AS co_anon,
       bool_or(rolname='service_role')  AS co_service_role
     FROM pg_roles`,
  )
  await probe(
    'schema_auth',
    `SELECT EXISTS(SELECT 1 FROM information_schema.schemata WHERE schema_name='auth') AS co_schema_auth`,
  )
  return out
}

async function sanityCounts() {
  const { query } = await import('@/lib/zeni/db');
  const out: Record<string, number | string> = {};
  for (const t of ['agent_catalog', 'modules_catalog', 'tenants']) {
    try {
      const r = await query<{ n: number }>(`SELECT count(*)::int AS n FROM public.${t}`);
      out[t] = r[0]?.n ?? 0;
    } catch (e) {
      out[t] = `ERR: ${e instanceof Error ? e.message.slice(0, 80) : 'unknown'}`;
    }
  }
  return out;
}

export async function GET(req: NextRequest) {
  const via = await authorize(req);
  if (!via) return NextResponse.json({ error: 'Không có quyền' }, { status: 401 });

  const dir = findMigrationsDir();
  const files = dir ? listSqlFiles(dir) : [];
  const hasDb = !!process.env.DATABASE_URL;
  let db: unknown = null;
  if (hasDb) {
    try {
      const { query } = await import('@/lib/zeni/db');
      const r = await query<{ n: number }>(
        "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'",
      );
      db = {
        connected: true,
        public_tables: r[0]?.n ?? 0,
        sanity: await sanityCounts(),
        chan_doan: await dbDiagnostics(),
      };
    } catch (e) {
      db = { connected: false, error: e instanceof Error ? e.message.slice(0, 160) : 'unknown' };
    }
  }
  return NextResponse.json({
    authorized_via: via,
    database_url_present: hasDb,
    migrations_dir: dir,
    migrations_files: files.length,
    db,
    hint: hasDb
      ? 'POST {"confirm":"zeni_ipo"} để chạy migrations (idempotent).'
      : 'Chờ platform gắn Cloud SQL + DATABASE_URL (ticket #8) rồi POST.',
  });
}

export async function POST(req: NextRequest) {
  const via = await authorize(req);
  if (!via) return NextResponse.json({ error: 'Không có quyền' }, { status: 401 });

  let body: { confirm?: string };
  try {
    body = (await req.json()) as { confirm?: string };
  } catch {
    body = {};
  }
  if (body.confirm !== 'zeni_ipo') {
    return NextResponse.json(
      { error: 'Thiếu confirm — POST {"confirm":"zeni_ipo"} để xác nhận chạy migrations.' },
      { status: 400 },
    );
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: 'Chưa có DATABASE_URL — chờ platform gắn Cloud SQL (ticket #8).' },
      { status: 503 },
    );
  }
  const dir = findMigrationsDir();
  if (!dir) {
    return NextResponse.json({ error: 'Không tìm thấy thư mục migrations trong image.' }, { status: 500 });
  }

  // Migration cần quyền TẠO BẢNG ⇒ phải chạy bằng VAI CHỦ, không phải vai chạy
  // hằng ngày. Từ 20/09/2026 ứng dụng nối bằng `zeniipo_com_runtime` (không sở
  // hữu bảng, để RLS có hiệu lực), nên ở đây phải mở kết nối riêng bằng
  // DATABASE_URL_MIGRATION. Thiếu biến đó thì lùi về DATABASE_URL — khi ấy
  // migration sẽ báo lỗi quyền, và báo lỗi rõ vẫn tốt hơn là âm thầm chạy
  // ứng dụng bằng vai chủ (mất sạch RLS).
  const { chuoiKetNoiMigration } = await import('@/lib/zeni/db');
  const { Pool } = await import('pg');
  const chuoi = chuoiKetNoiMigration()!;
  const pool = new Pool({
    connectionString: chuoi,
    max: 2,
    ssl: chuoi.includes('/cloudsql/') || chuoi.includes('localhost')
      ? undefined
      : { rejectUnauthorized: false },
  });
  const report: Array<{ file: string; ok: boolean; ms: number; error?: string }> = [];
  let aborted = false;

  for (const file of listSqlFiles(dir)) {
    if (aborted) {
      report.push({ file, ok: false, ms: 0, error: 'SKIPPED (dừng vì lỗi trước đó)' });
      continue;
    }
    const t0 = Date.now();
    try {
      const sql = fs.readFileSync(path.join(dir, file), 'utf8');
      await pool.query(sql); // mỗi file 1 lệnh multi-statement, file đã idempotent
      report.push({ file, ok: true, ms: Date.now() - t0 });
    } catch (e) {
      report.push({
        file,
        ok: false,
        ms: Date.now() - t0,
        error: e instanceof Error ? e.message.slice(0, 300) : 'unknown',
      });
      aborted = true; // thứ tự là bắt buộc — dừng, không chạy lệch nền
    }
  }

  // Đây là pool riêng mở bằng vai chủ — đóng lại ngay, đừng để nó sống tiếp
  // trong tiến trình cùng với pool của vai chạy.
  await pool.end().catch(() => {});

  const okCount = report.filter((r) => r.ok).length;
  return NextResponse.json({
    authorized_via: via,
    ran: report.length,
    ok: okCount,
    failed: report.length - okCount,
    report,
    sanity: aborted ? null : await sanityCounts(),
  });
}
