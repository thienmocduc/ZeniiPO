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
}

export function hasDatabase(): boolean {
  return !!process.env.DATABASE_URL;
}

function makePool(): Pool {
  const connectionString = process.env.DATABASE_URL;
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
