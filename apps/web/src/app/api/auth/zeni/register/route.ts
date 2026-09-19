import { NextRequest, NextResponse } from 'next/server';

/**
 * Đăng ký TÀI KHOẢN HỆ SINH THÁI ZENI (Zeni ID — Lớp 5) từ form zeniipo.com:
 * proxy POST /auth/register của nền tảng (đã probe: endpoint sống, 422 khi
 * thiếu field) rồi auto-login để set cookie phiên app. KHÔNG log mật khẩu.
 */
export const runtime = 'nodejs';

const ZENI_ID_BASE = (process.env.ZENI_ID_BASE_URL ?? 'https://zenicloud.io/api/v1').replace(/\/$/, '');
const SESSION_COOKIE = process.env.ZENI_ID_COOKIE ?? 'zeni_session';
const REFRESH_COOKIE = process.env.ZENI_REFRESH_COOKIE ?? 'zeni_refresh';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string; full_name?: string; company_name?: string | null };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Body không hợp lệ' }, { status: 400 });
  }
  const email = (body.email ?? '').trim().toLowerCase();
  const password = body.password ?? '';
  const name = (body.full_name ?? '').trim();
  if (!email || !password) {
    return NextResponse.json({ error: 'Thiếu email hoặc mật khẩu' }, { status: 400 });
  }

  let reg: Response;
  try {
    reg = await fetch(`${ZENI_ID_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        name: name || email,
        // gửi kèm ngữ cảnh để hệ sinh thái biết nguồn đăng ký
        source: 'zeniipo.com',
        company: body.company_name ?? undefined,
      }),
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json({ error: 'Không kết nối được Zeni ID' }, { status: 502 });
  }

  if (!reg.ok) {
    let detail = '';
    try {
      const j = (await reg.json()) as { error?: string; message?: string; detail?: unknown };
      detail = j.error ?? j.message ?? (typeof j.detail === 'string' ? j.detail : '');
    } catch {
      /* ignore */
    }
    const dup = reg.status === 409 || /exist|đã tồn tại|already/i.test(detail);
    return NextResponse.json(
      {
        error: dup
          ? 'Email này đã có tài khoản Zeni ID — đăng nhập trực tiếp tại /login.'
          : detail || `Zeni ID trả lỗi ${reg.status} — kiểm tra lại thông tin.`,
      },
      { status: dup ? 409 : 400 },
    );
  }

  // Auto-login ngay sau khi tạo — cùng pattern /api/auth/zeni/login.
  try {
    const login = await fetch(`${ZENI_ID_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      cache: 'no-store',
    });
    if (login.ok) {
      const data = (await login.json()) as { access_token?: string; token?: string; refresh_token?: string };
      const access = data.access_token ?? data.token;
      if (access) {
        const out = NextResponse.json({ ok: true, logged_in: true, email });
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
    }
  } catch {
    /* đăng ký đã thành công — login lỗi thì để user tự đăng nhập */
  }
  return NextResponse.json({ ok: true, logged_in: false, email });
}
