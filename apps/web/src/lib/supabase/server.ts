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
    // Gọi CỬA HẸP `zeni_provision_user` (migration 031) thay vì chèn thẳng vào
    // `auth.users`.
    //
    // VÌ SAO ĐỔI (20/09/2026): từ khi ứng dụng nối bằng vai chạy KHÔNG sở hữu
    // bảng — điều kiện bắt buộc để RLS có hiệu lực — thì nó không còn quyền
    // đụng vào schema `auth`. Lệnh chèn cũ thất bại và lỗi bị nuốt ngay dưới
    // đây, nên người đăng ký mới KHÔNG có tổ chức và mọi trang trả 403
    // "No tenant for user". Đăng ký hỏng mà không ai biết.
    //
    // Chạy trong `withUser` để phiên mang vai `authenticated` — đúng vai được
    // cấp quyền EXECUTE. Cờ chủ nền tảng do chính hàm tra trong bảng
    // `platform_superadmins`, phía gọi KHÔNG truyền vào được (chống tự nâng
    // quyền), nên `superFlag` ở đây chỉ còn dùng để ghi nhật ký.
    await withUser(uid, async (client) => {
      await client.query('SELECT public.zeni_provision_user($1, $2, $3)', [
        uid,
        email,
        name ?? email ?? 'Zeni User',
      ]);
    });
    provisioned.add(uid);
  } catch (e) {
    // KHÔNG nuốt im lặng nữa: ghi rõ đây là lỗi ghi danh, vì chính chỗ này đã
    // làm hỏng đăng ký suốt một lần đổi vai mà không phát ra tín hiệu nào.
    console.error(
      `[zeni] GHI DANH THẤT BẠI uid=${uid} super=${superFlag} — người dùng sẽ không có tổ chức:`,
      e instanceof Error ? e.message : e,
    );
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
