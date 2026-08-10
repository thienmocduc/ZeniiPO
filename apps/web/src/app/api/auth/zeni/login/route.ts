import { NextRequest, NextResponse } from 'next/server';

/**
 * Đăng nhập bằng TÀI KHOẢN HỆ SINH THÁI ZENI (Zeni ID — Lớp 5).
 * zeniipo.com khác apex domain với hub nên không share cookie được →
 * form tại app POST vào đây, server gọi Zeni ID /auth/login, nhận JWT pair
 * trong JSON body (nền tảng không set cookie) rồi tự set cookie riêng app.
 * KHÔNG log mật khẩu. Fail-closed.
 */
export const runtime = 'nodejs';

const ZENI_ID_BASE = (process.env.ZENI_ID_BASE_URL ?? 'https://zenicloud.io/api/v1').replace(/\/$/, '');
const SESSION_COOKIE = process.env.ZENI_ID_COOKIE ?? 'zeni_session';
const REFRESH_COOKIE = process.env.ZENI_REFRESH_COOKIE ?? 'zeni_refresh';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 ngày (refresh rotation lo phần hạn token)

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string };
  try {
    body = (await req.json()) as { email?: string; password?: string };
  } catch {
    return NextResponse.json({ error: 'Body không hợp lệ' }, { status: 400 });
  }
  const email = (body.email ?? '').trim().toLowerCase();
  const password = body.password ?? '';
  if (!email || !password) {
    return NextResponse.json({ error: 'Thiếu email hoặc mật khẩu' }, { status: 400 });
  }

  let res: Response;
  try {
    res = await fetch(`${ZENI_ID_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json({ error: 'Không kết nối được Zeni ID' }, { status: 502 });
  }

  if (!res.ok) {
    const unauthorized = res.status === 400 || res.status === 401 || res.status === 422;
    return NextResponse.json(
      {
        error: unauthorized
          ? 'Sai email hoặc mật khẩu. Dùng tài khoản hệ sinh thái Zeni (đăng ký tại zenicloud.io).'
          : `Zeni ID trả lỗi ${res.status} — thử lại sau.`,
      },
      { status: unauthorized ? 401 : 502 },
    );
  }

  const data = (await res.json()) as {
    access_token?: string;
    token?: string;
    refresh_token?: string;
  };
  const access = data.access_token ?? data.token;
  if (!access) {
    return NextResponse.json({ error: 'Zeni ID không trả token' }, { status: 502 });
  }

  const out = NextResponse.json({ ok: true, email });
  const opts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  };
  out.cookies.set(SESSION_COOKIE, access, opts);
  if (data.refresh_token) out.cookies.set(REFRESH_COOKIE, data.refresh_token, opts);
  return out;
}
