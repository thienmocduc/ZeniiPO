/**
 * Zeni Cloud L2 — Postgres data layer (DB `zeni_ipo`).
 * Port contract từ zenios/src/lib/zeni/db.ts: GUC `app.uid` ↔ auth.uid() trong
 * 00_zeni_stub.sql (đã verify khớp). Prod: DATABASE_URL do platform inject
 * (socket /cloudsql) khi service được gắn Cloud SQL — ticket #8.
 */
import { Pool, type PoolClient, type QueryResultRow } from 'pg';

declare global {
  // eslint-disable-next-line no-var
  var __zeniIpoPool: Pool | undefined;
  // Pool vai CHỦ, tách riêng — xem `getOwnerPool()`.
  var __zeniIpoOwnerPool: Pool | undefined;
}

export function hasDatabase(): boolean {
  return !!process.env.DATABASE_URL;
}

/**
 * HAI VAI, HAI VIỆC (Zeni Cloud cấp 20/09/2026 — cách B):
 *
 *   DATABASE_URL            → `zeniipo_com_runtime`, KHÔNG sở hữu bảng.
 *                             Ứng dụng chạy hằng ngày dùng vai này. Vì không
 *                             sở hữu bảng nên Postgres MỚI áp RLS — hàng rào
 *                             giữa các công ty nằm ở tầng CSDL, không phải ở
 *                             tầng mã ứng dụng.
 *   DATABASE_URL_MIGRATION  → `zeniipo_com_app`, chủ schema. CHỈ dùng để chạy
 *                             migration / db-setup (cần quyền tạo bảng).
 *
 * Trước 20/09 ứng dụng nối bằng chính vai CHỦ ⇒ Postgres bỏ qua toàn bộ RLS,
 * và cách ly giữa 9 công ty chỉ còn dựa vào mã ứng dụng. Một truy vấn quên
 * điều kiện tenant là lộ chéo. Đừng bao giờ trỏ DATABASE_URL về vai chủ nữa.
 */
export function chuoiKetNoiMigration(): string | undefined {
  return process.env.DATABASE_URL_MIGRATION ?? process.env.DATABASE_URL;
}

function makePool(connectionString?: string): Pool {
  connectionString = connectionString ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('Thiếu DATABASE_URL — chờ platform gắn Cloud SQL (ticket #8).');
  }
  const pool = new Pool({
    connectionString,
    max: Number(process.env.PGPOOL_MAX ?? 8),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl:
      connectionString.includes('/cloudsql/') || connectionString.includes('localhost')
        ? undefined
        : { rejectUnauthorized: false },
  });
  pool.on('error', (err) => console.error('[zeni/db] pool error:', err.message));
  return pool;
}

export function getPool(): Pool {
  if (!global.__zeniIpoPool) global.__zeniIpoPool = makePool();
  return global.__zeniIpoPool;
}

/**
 * Pool VAI CHỦ — dành riêng cho các đường máy-gọi-máy đã tự xác thực.
 *
 * ⚠ POOL NÀY BỎ QUA RLS HOÀN TOÀN. Chỉ dùng ở nơi đã tự kiểm danh tính bằng
 * cách khác (cron + CRON_SECRET, ingest + token băm, internal + x-internal-key,
 * console sau khi `is_chairman_super`). Đưa đầu vào người dùng chưa kiểm soát
 * vào đây là lộ dữ liệu chéo doanh nghiệp.
 *
 * ── VÌ SAO PHẢI TÁCH RIÊNG ──
 * `createServiceClient()` tự mô tả là "chạy dưới user owner → không bị RLS
 * chặn", nhưng nó gọi `getPool()` — và `DATABASE_URL` từ khi siết bảo mật đã
 * trỏ về `zeniipo_com_runtime`, một vai KHÔNG sở hữu bảng. Nên RLS vẫn áp, và
 * mọi đường máy-gọi-máy đều MÙ: đo trên production, vai runtime không có phiên
 * nhìn thấy 0 tenant, 0 user_profiles, 0 plan_targets trong khi vai chủ thấy
 * 1 / 1 / 466.
 *
 * Hệ quả im lặng: hợp đồng ba tầng gửi ZeniOS/ZeniERP luôn trả rỗng, và cả bốn
 * tác vụ định kỳ "chạy thành công" với 0 bản ghi xử lý. Không có lỗi nào được
 * ném ra — đó là kiểu hỏng khó phát hiện nhất.
 *
 * Thiếu `DATABASE_URL_MIGRATION` thì NÉM LỖI chứ không lặng lẽ rơi về vai
 * runtime: chạy tiếp mà không thấy gì còn tệ hơn là dừng lại và báo.
 */
export function getOwnerPool(): Pool {
  if (!global.__zeniIpoOwnerPool) {
    const cs = process.env.DATABASE_URL_MIGRATION;
    if (!cs) {
      throw new Error(
        'Thiếu DATABASE_URL_MIGRATION — đường máy-gọi-máy cần vai chủ để bỏ qua RLS. ' +
          'Chạy bằng vai runtime thì mọi truy vấn trả rỗng mà không báo lỗi.',
      );
    }
    global.__zeniIpoOwnerPool = makePool(cs);
  }
  return global.__zeniIpoOwnerPool;
}

/** Query không ngữ cảnh người dùng (catalog/health/setup). */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const res = await getPool().query<T>(text, params as never[]);
  return res.rows;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Transaction với ngữ cảnh RLS = user (SET LOCAL app.uid).
 * opts.superadmin=true → set app.is_superadmin (chế độ admin toàn tenant).
 */
export async function withUser<T>(
  uid: string,
  fn: (client: PoolClient) => Promise<T>,
  opts?: { superadmin?: boolean },
): Promise<T> {
  if (!UUID_RE.test(uid)) throw new Error('uid không hợp lệ.');
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    // BẮT BUỘC đổi role: user kết nối là OWNER (bypass RLS). Chạy dưới
    // `authenticated` (non-owner) thì RLS + policy `TO authenticated` mới áp.
    // Quyền bảng cấp ở migration 030_runtime_roles_grants.sql. Fail-closed:
    // SET ROLE lỗi → throw, không lặng lẽ chạy kiểu bypass.
    await client.query('SET LOCAL ROLE authenticated');
    await client.query("SELECT set_config('app.uid', $1, true)", [uid]);
    if (opts?.superadmin) {
      await client.query("SELECT set_config('app.is_superadmin', 'on', true)");
    }
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    throw e;
  } finally {
    client.release();
  }
}

/** Transaction ngữ cảnh KHÁCH VÃNG LAI (chưa đăng nhập): role anon, không app.uid.
 *  RLS chặn mọi bảng trừ catalog public-read (005) — đúng hành vi Supabase cũ. */
export async function withAnon<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE anon');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    throw e;
  } finally {
    client.release();
  }
}
