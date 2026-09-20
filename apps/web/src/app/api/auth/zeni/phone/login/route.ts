import { NextRequest, NextResponse } from 'next/server';
import { chuanHoaSoVN } from '@/lib/zeni/phone';

/**
 * ĐĂNG NHẬP BẰNG SỐ ĐIỆN THOẠI — bước 2: đổi mã OTP lấy phiên.
 *
 * Zeni ID `POST /auth/phone/login` {phone, code} → cặp JWT. App đặt cookie riêng
 * y như đường đăng nhập bằng email (`/api/auth/zeni/login`) để phần còn lại của
 * hệ thống không phải biết người dùng đã vào bằng cách nào.
 *
 * KHÔNG ghi nhật ký mã OTP. Fail-closed.
 */
export const runtime = 'nodejs';

const ZENI_ID_BASE = (process.env.ZENI_ID_BASE_URL ?? 'https://zenicloud.io/api/v1').replace(/\/$/, '');
const SESSION_COOKIE = process.env.ZENI_ID_COOKIE ?? 'zeni_session';
const REFRESH_COOKIE = process.env.ZENI_REFRESH_COOKIE ?? 'zeni_refresh';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export async function POST(req: NextRequest) {
  let body: { phone?: string; code?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Body không hợp lệ' }, { status: 400 });
  }

  const so = chuanHoaSoVN(body.phone ?? '');
  const ma = (body.code ?? '').trim();
  if (!so) return NextResponse.json({ error: 'Số điện thoại không hợp lệ' }, { status: 400 });
  if (!/^\d{6}$/.test(ma)) {
    return NextResponse.json({ error: 'Mã xác thực gồm đúng 6 chữ số' }, { status: 400 });
  }

  let res: Response;
  try {
    res = await fetch(`${ZENI_ID_BASE}/auth/phone/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: so, code: ma }),
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json({ error: 'Không kết nối được Zeni ID.' }, { status: 502 });
  }

  if (!res.ok) {
    const saiMa = res.status === 400 || res.status === 401 || res.status === 422;
    return NextResponse.json(
      {
        error: saiMa
          ? 'Mã không đúng hoặc đã hết hạn. Xin mã mới rồi thử lại.'
          : `Zeni ID trả lỗi ${res.status} — thử lại sau.`,
      },
      { status: saiMa ? 401 : 502 },
    );
  }

  const data = (await res.json()) as {
    access_token?: string;
    token?: string;
    refresh_token?: string;
    mfa_required?: boolean;
  };

  // Nền tảng có thể trả về "cần xác thực 2 bước" thay vì token. ZeniIPO chưa
  // dựng màn hình 2 bước, nên nói thẳng thay vì im lặng không vào được.
  if (data.mfa_required) {
    return NextResponse.json(
      {
        error:
          'Tài khoản này bật xác thực 2 bước. Hiện ZeniIPO chưa hỗ trợ bước đó — ' +
          'đăng nhập bằng email và mật khẩu giúp em.',
      },
      { status: 409 },
    );
  }

  const access = data.access_token ?? data.token;
  if (!access) {
    return NextResponse.json({ error: 'Zeni ID không trả token' }, { status: 502 });
  }

  const out = NextResponse.json({ ok: true });
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
