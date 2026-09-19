import { NextRequest, NextResponse } from 'next/server';

/**
 * QUÊN MẬT KHẨU — bước 2: kiểm liên kết và đặt mật khẩu mới.
 *
 *   GET  ?token=…                 → liên kết còn hiệu lực không (để hiện "hết hạn")
 *   POST {token, new_password}    → đặt mật khẩu mới
 *
 * Gọi thẳng hợp đồng thật của Zeni ID (`/auth/password/forgot/status|verify`).
 * App KHÔNG giữ mật khẩu, chỉ chuyển tiếp — và không bao giờ ghi nhật ký mật khẩu.
 */
export const runtime = 'nodejs';

const ZENI_ID_BASE = (process.env.ZENI_ID_BASE_URL ?? 'https://zenicloud.io/api/v1').replace(/\/$/, '');

/** Nền tảng yêu cầu tối thiểu 10 ký tự; app đặt luật chặt hơn cho khớp trang đăng ký. */
const LUAT = [
  { dat: (v: string) => v.length >= 12, chu: 'tối thiểu 12 ký tự' },
  { dat: (v: string) => /[A-Z]/.test(v), chu: 'ít nhất 1 chữ IN HOA' },
  { dat: (v: string) => /[a-z]/.test(v), chu: 'ít nhất 1 chữ thường' },
  { dat: (v: string) => /\d/.test(v), chu: 'ít nhất 1 chữ số' },
  { dat: (v: string) => /[^A-Za-z0-9]/.test(v), chu: 'ít nhất 1 ký tự đặc biệt' },
];

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') ?? '';
  if (!token) return NextResponse.json({ hop_le: false, ly_do: 'Thiếu mã liên kết' }, { status: 400 });

  try {
    const res = await fetch(
      `${ZENI_ID_BASE}/auth/password/forgot/status?token=${encodeURIComponent(token)}`,
      { cache: 'no-store' },
    );
    if (!res.ok) {
      return NextResponse.json(
        { hop_le: false, ly_do: 'Liên kết đã hết hạn hoặc đã dùng rồi. Xin liên kết mới.' },
        { status: 200 },
      );
    }
    const j = (await res.json()) as { valid?: boolean; ok?: boolean };
    const hopLe = j.valid ?? j.ok ?? true;
    return NextResponse.json({
      hop_le: hopLe,
      ly_do: hopLe ? null : 'Liên kết đã hết hạn hoặc đã dùng rồi. Xin liên kết mới.',
    });
  } catch {
    return NextResponse.json({ hop_le: false, ly_do: 'Không kết nối được Zeni ID.' }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  let body: { token?: string; new_password?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Body không hợp lệ' }, { status: 400 });
  }

  const token = (body.token ?? '').trim();
  const matKhau = body.new_password ?? '';
  if (!token) return NextResponse.json({ error: 'Thiếu mã liên kết' }, { status: 400 });

  const thieu = LUAT.filter((l) => !l.dat(matKhau)).map((l) => l.chu);
  if (thieu.length) {
    return NextResponse.json({ error: `Mật khẩu cần ${thieu.join(' · ')}` }, { status: 400 });
  }

  let res: Response;
  try {
    res = await fetch(`${ZENI_ID_BASE}/auth/password/forgot/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, new_password: matKhau }),
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json({ error: 'Không kết nối được Zeni ID.' }, { status: 502 });
  }

  if (!res.ok) {
    const het = res.status === 400 || res.status === 404 || res.status === 410;
    return NextResponse.json(
      {
        error: het
          ? 'Liên kết đã hết hạn hoặc đã dùng rồi. Xin liên kết đặt lại mới.'
          : `Zeni ID từ chối (mã ${res.status}). Thử lại sau.`,
      },
      { status: het ? 400 : 502 },
    );
  }

  // KHÔNG tự đăng nhập hộ: đổi mật khẩu xong thì bắt đăng nhập lại bằng mật khẩu
  // mới — vừa chắc là người dùng nhớ đúng, vừa không cấp phiên từ một liên kết
  // email (email lọt tay người khác thì họ vẫn phải biết mật khẩu vừa đặt).
  return NextResponse.json({ ok: true });
}
