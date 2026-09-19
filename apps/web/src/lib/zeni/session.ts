/**
 * Zeni ID (Lớp 5) — phiên đăng nhập bằng TÀI KHOẢN HỆ SINH THÁI ZENI,
 * thay thế Supabase Auth (ZIPO-002; backend Supabase cũ đã bị thu hồi 2026-08-10).
 *
 * Contract Zeni ID (xác nhận từ nền tảng): token JWT HS256 ký shared-secret nội bộ
 * → app KHÔNG tự verify (không JWKS). Nền tảng không set cookie; app lưu access
 * token vào cookie riêng (`zeni_session`) và VALIDATE mỗi request qua GET /auth/me.
 *
 * PERF: memo theo token TTL 60s (bắt buộc theo masterspec — không có nó mỗi trang
 * chậm ~2s vì /auth/me bị gọi lặp). Token revoke có trễ nhận biết tối đa 60s;
 * logout đổi cookie = key khác nên sạch ngay.
 */
import { cookies } from 'next/headers';

const ZENI_ID_BASE = (process.env.ZENI_ID_BASE_URL ?? 'https://zenicloud.io/api/v1').replace(/\/$/, '');
export const SESSION_COOKIE = process.env.ZENI_ID_COOKIE ?? 'zeni_session';
export const REFRESH_COOKIE = process.env.ZENI_REFRESH_COOKIE ?? 'zeni_refresh';

export type SessionUser = { id: string; email: string | null; name?: string | null };

const ME_TTL_MS = 60_000;
const meMemo = new Map<string, { user: SessionUser | null; exp: number }>();

/** User hiện tại — validate token qua Zeni ID GET /auth/me. Fail-closed.
 *  (React 18: không có react.cache — meMemo theo token đã dedup trong 60s.) */
export const getSessionUser = async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const hit = meMemo.get(token);
  if (hit && hit.exp > Date.now()) return hit.user;

  try {
    const res = await fetch(`${ZENI_ID_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) {
      meMemo.set(token, { user: null, exp: Date.now() + 5_000 }); // negative-cache ngắn
      return null;
    }
    const u = (await res.json()) as {
      id?: string; user_id?: string; sub?: string; email?: string | null; name?: string | null;
    };
    const id = u.id ?? u.user_id ?? u.sub;
    if (!id) return null;
    const user: SessionUser = { id: String(id), email: u.email ?? null, name: u.name ?? null };
    if (meMemo.size > 500) meMemo.clear();
    meMemo.set(token, { user, exp: Date.now() + ME_TTL_MS });
    return user;
  } catch {
    return null; // Zeni ID không reachable → coi như chưa đăng nhập (fail-closed)
  }
};

/** Tiện ích cho server action / API ghi dữ liệu. */
export async function requireUserId(): Promise<string | null> {
  return (await getSessionUser())?.id ?? null;
}
