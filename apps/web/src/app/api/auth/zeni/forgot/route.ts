import { NextRequest, NextResponse } from 'next/server';

/**
 * QUÊN MẬT KHẨU — bước 1: xin Zeni ID gửi liên kết đặt lại qua email.
 *
 * LỊCH SỬ HAI LẦN SAI, ghi lại để không sai lần ba:
 *  1. Ban đầu trang /forgot-password chỉ hiện chữ tĩnh, bấm nút KHÔNG gửi gì —
 *     người dùng ngồi chờ mail vĩnh viễn.
 *  2. Sửa lần một: dò năm đường dẫn đoán mò (`/auth/password/forgot`,
 *     `/auth/forgot-password`, …). Không đường nào đúng nên app báo
 *     "Zeni ID chưa mở chức năng đặt lại mật khẩu" — **một lời nói sai sự thật**:
 *     nền tảng CÓ chức năng đó, chỉ là đường thật tên `/auth/password/forgot/init`.
 *     Đoán đường dẫn rồi đổ lỗi cho nền tảng là thói quen phải bỏ; bản kê API
 *     công khai ở https://zenicloud.io/openapi.json, tra một lần là xong.
 *
 * Hợp đồng thật (openapi.json):
 *   POST /auth/password/forgot/init   {email, brand?}  → luôn 200 (chống dò email)
 *   GET  /auth/password/forgot/status ?token=          → kiểm hạn của liên kết
 *   POST /auth/password/forgot/verify {token, new_password}
 * Giới hạn phía nền tảng: 3 lần / 15 phút / địa chỉ IP.
 */
export const runtime = 'nodejs';

const ZENI_ID_BASE = (process.env.ZENI_ID_BASE_URL ?? 'https://zenicloud.io/api/v1').replace(/\/$/, '');

export async function POST(req: NextRequest) {
  let body: { email?: string };
  try {
    body = (await req.json()) as { email?: string };
  } catch {
    return NextResponse.json({ error: 'Body không hợp lệ' }, { status: 400 });
  }
  const email = (body.email ?? '').trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'Email không hợp lệ' }, { status: 400 });
  }

  let res: Response;
  try {
    res = await fetch(`${ZENI_ID_BASE}/auth/password/forgot/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // `brand` quyết định logo + địa chỉ trang đặt lại in trong email. Nền tảng
      // mới khai 'zenicloud' và 'zenidigital'; gửi 'zeniipo' thì nó lùi về
      // 'zenicloud' (không lỗi). Khi ZeniCloud thêm nhãn zeniipo thì email sẽ
      // tự mang thương hiệu ZeniIPO và trỏ về /reset-password của app này.
      body: JSON.stringify({ email, brand: 'zeniipo' }),
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json(
      { error: 'Không kết nối được Zeni ID. Thử lại sau ít phút.' },
      { status: 502 },
    );
  }

  if (res.status === 429) {
    return NextResponse.json(
      { error: 'Bạn đã yêu cầu quá nhiều lần. Đợi khoảng 15 phút rồi thử lại.' },
      { status: 429 },
    );
  }

  if (!res.ok) {
    return NextResponse.json(
      {
        error: `Zeni ID từ chối yêu cầu (mã ${res.status}). Thử lại sau, hoặc đặt lại tại zenicloud.io.`,
        reset_url: 'https://zenicloud.io/forgot-password.html',
      },
      { status: 502 },
    );
  }

  // Nền tảng cố tình trả lời giống nhau dù email có tài khoản hay không, để
  // người ngoài không dò được ai đã đăng ký. App nói lại đúng như vậy.
  return NextResponse.json({
    ok: true,
    message:
      'Nếu email này có tài khoản Zeni ID, liên kết đặt lại đã được gửi tới hộp thư. Liên kết có hiệu lực 1 giờ — nhớ kiểm tra cả thư rác.',
  });
}
