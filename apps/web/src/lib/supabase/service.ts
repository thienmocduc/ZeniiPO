/**
 * SERVICE CLIENT (bypass RLS) — ruột đã đổi sang Zeni Postgres (P2).
 * Kết nối pool chạy dưới user owner (KHÔNG SET ROLE) → không bị RLS chặn,
 * đúng ngữ nghĩa service_role cũ. CHỈ dùng ở server context đã tự xác thực
 * (cron + CRON_SECRET, ingest token-hash, internal x-internal-key, console
 * sau khi check is_chairman_super) — tuyệt đối không nhận input người dùng
 * chưa kiểm soát.
 */
import { getPool } from '@/lib/zeni/db'
import { makeClient, type Runner, type ZeniClient } from '@/lib/zeni/compat'

let cached: ZeniClient | null = null

export function createServiceClient(): ZeniClient {
  if (cached) return cached
  const runner: Runner = async (work) =>
    work(async (text, params) => {
      const res = await getPool().query(text, params as never[])
      return { rows: res.rows, rowCount: res.rowCount }
    })
  cached = makeClient(runner, async () => null)
  return cached
}
