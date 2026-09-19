/**
 * CHOKEPOINT tầng data (P2 — ZeniCloud Postgres). Tên file/hàm GIỮ NGUYÊN để
 * ~103 file import '@/lib/supabase/server' không phải sửa; ruột đã đổi:
 * supabase-js → Zeni compat client (pg + RLS GUC, xem lib/zeni/compat.ts).
 *
 * Ngữ cảnh mỗi request:
 *  - Có phiên Zeni ID  → withUser(uid): SET ROLE authenticated + app.uid (RLS thật)
 *    · email thuộc danh sách chủ nền tảng → thêm app.is_superadmin (ADMIN MODE:
 *    vào được mọi tenant Zeni Holdings — lệnh chairman 2026-08-10).
 *  - Chưa đăng nhập    → withAnon: role anon (chỉ catalog public-read).
 * Provisioning lần đầu: INSERT auth.users (trigger handle_new_user tự tạo
 * profile + tenant như flow Supabase cũ) + bật cờ is_chairman_super theo email.
 */
import { getSessionUser } from '@/lib/zeni/session';
import { isSuperAdminEmail } from '@/lib/zeni/superadmin';
import { withUser, withAnon, query } from '@/lib/zeni/db';
import { makeClient, type Runner, type ZeniClient } from '@/lib/zeni/compat';

// Memo per-instance: mỗi uid chỉ provision 1 lần cho tới khi cold start.
const provisioned = new Set<string>();

async function ensureProvisioned(
  uid: string,
  email: string | null,
  name: string | null | undefined,
  superFlag: boolean,
): Promise<void> {
  if (provisioned.has(uid)) return;
  try {
    await query(
      `INSERT INTO auth.users (id, email, raw_user_meta_data)
       VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (id) DO UPDATE SET email = COALESCE(EXCLUDED.email, auth.users.email)`,
      [uid, email, JSON.stringify({ full_name: name ?? email ?? 'Zeni User' })],
    );
    if (superFlag) {
      await query(
        `UPDATE public.user_profiles
         SET is_chairman_super = true
         WHERE id = $1 AND is_chairman_super IS DISTINCT FROM true`,
        [uid],
      );
    }
    provisioned.add(uid);
  } catch (e) {
    // Best-effort (vd DB chưa gắn — ticket #8): không chặn request, query sau
    // sẽ trả error rõ ràng qua compat client.
    console.error('[zeni] provision user:', e instanceof Error ? e.message : e);
  }
}

export async function createServerClient(): Promise<ZeniClient> {
  const su = await getSessionUser();

  if (!su) {
    const anonRunner: Runner = (work) =>
      withAnon((c) => work((text, params) => c.query(text, params as never[])));
    return makeClient(anonRunner, async () => null);
  }

  const superFlag = isSuperAdminEmail(su.email);
  await ensureProvisioned(su.id, su.email, su.name, superFlag);

  const runner: Runner = (work) =>
    withUser(su.id, (c) => work((text, params) => c.query(text, params as never[])), {
      superadmin: superFlag,
    });

  return makeClient(runner, async () => ({
    id: su.id,
    email: su.email,
    user_metadata: { full_name: su.name ?? null },
  }));
}

// Alias giữ tương thích các import cũ.
export const createClient = createServerClient;
