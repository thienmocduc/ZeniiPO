import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE_QUAY_VE, ZENI_ID_BASE, duongDanNoiBoAnToan } from '@/lib/zeni/oauth';

/**
 * BƯỚC 2 — đổi token nhận từ #fragment lấy cookie phiên của app.
 *
 * NGUYÊN TẮC: token này do TRÌNH DUYỆT đưa lên, nên coi như chưa đáng tin.
 * Bắt buộc hỏi lại Zeni ID `GET /auth/me` xem token có thật và còn hạn không,
 * rồi mới đặt cookie. Không xác minh mà đặt thẳng thì bất kỳ ai cũng có thể gọi
 * route này với một chuỗi bịa và tự cấp cho mình một phiên.
 */
export const runtime = 'nodejs';

const SESSION_COOKIE = process.env.ZENI_ID_COOKIE ?? 'zeni_session';
const REFRESH_COOKIE = process.env.ZENI_REFRESH_COOKIE ?? 'zeni_refresh';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export async function POST(req: NextRequest) {
  let body: { access_token?: string; refresh_token?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Body không hợp lệ' }, { status: 400 });
  }

  const access = (body.access_token ?? '').trim();
  const refresh = (body.refresh_token ?? '').trim();
  if (!access) {
    return NextResponse.json({ error: 'Thiếu token' }, { status: 400 });
  }

  // Xác minh với nền tảng — fail-closed.
  let me: Response;
  try {
    me = await fetch(`${ZENI_ID_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${access}` },
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json({ error: 'Không kết nối được Zeni ID' }, { status: 502 });
  }
  if (!me.ok) {
    return NextResponse.json(
      { error: 'Token không hợp lệ hoặc đã hết hạn. Đăng nhập lại giúp em.' },
      { status: 401 },
    );
  }

  const u = (await me.json()) as { email?: string | null };

  // Quay về đúng chỗ người dùng đang muốn vào trước khi bị chặn đăng nhập.
  const quayVe = duongDanNoiBoAnToan(req.cookies.get(COOKIE_QUAY_VE)?.value);

  const out = NextResponse.json({ ok: true, email: u.email ?? null, redirect: quayVe });
  const opts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  };
  out.cookies.set(SESSION_COOKIE, access, opts);
  if (refresh) out.cookies.set(REFRESH_COOKIE, refresh, opts);
  // Cookie tạm đã dùng xong thì xoá, đừng để nó nằm lại trong trình duyệt.
  out.cookies.set(COOKIE_QUAY_VE, '', { ...opts, maxAge: 0 });
  return out;
}
