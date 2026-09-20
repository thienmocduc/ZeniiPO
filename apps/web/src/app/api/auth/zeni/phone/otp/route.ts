import { NextRequest, NextResponse } from 'next/server';
import { chuanHoaSoVN } from '@/lib/zeni/phone';

/**
 * ĐĂNG NHẬP BẰNG SỐ ĐIỆN THOẠI — bước 1: xin mã OTP.
 *
 * Chuyển tiếp sang Zeni ID `POST /auth/phone/send-otp`.
 * Giới hạn phía nền tảng: 3 lần / 15 phút cho mỗi số, 10 lần / ngày cho mỗi IP.
 *
 * TRUNG THỰC: nền tảng trả `ok=false` kèm lời giải thích khi dịch vụ SMS chưa
 * sẵn sàng (chưa cấu hình nhà mạng). App chuyển nguyên tín hiệu đó ra màn hình,
 * KHÔNG được hiện "đã gửi mã" rồi để người dùng ngồi chờ một tin nhắn không tồn
 * tại — đúng ràng buộc fail-closed của masterspec.
 */
export const runtime = 'nodejs';

const ZENI_ID_BASE = (process.env.ZENI_ID_BASE_URL ?? 'https://zenicloud.io/api/v1').replace(/\/$/, '');

export async function POST(req: NextRequest) {
  let body: { phone?: string };
  try {
    body = (await req.json()) as { phone?: string };
  } catch {
    return NextResponse.json({ error: 'Body không hợp lệ' }, { status: 400 });
  }

  const so = chuanHoaSoVN(body.phone ?? '');
  if (!so) {
    return NextResponse.json(
      { error: 'Số điện thoại không hợp lệ. Nhập số di động Việt Nam, ví dụ 0901234567.' },
      { status: 400 },
    );
  }

  let res: Response;
  try {
    res = await fetch(`${ZENI_ID_BASE}/auth/phone/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: so, purpose: 'login' }),
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json({ error: 'Không kết nối được Zeni ID.' }, { status: 502 });
  }

  if (res.status === 429) {
    return NextResponse.json(
      { error: 'Xin mã quá nhiều lần. Đợi khoảng 15 phút rồi thử lại.' },
      { status: 429 },
    );
  }
  if (!res.ok) {
    return NextResponse.json(
      { error: `Zeni ID từ chối yêu cầu (mã ${res.status}).` },
      { status: 502 },
    );
  }

  const j = (await res.json()) as { ok?: boolean; message?: string; expires_at?: string };

  // ok=false nghĩa là OTP đã tạo nhưng SMS KHÔNG gửi đi được. Nói thẳng.
  if (!j.ok) {
    return NextResponse.json(
      {
        error:
          'Chưa gửi được mã qua SMS — dịch vụ tin nhắn chưa sẵn sàng. ' +
          'Bạn dùng tạm cách đăng nhập bằng email và mật khẩu nhé.',
        sms_chua_san_sang: true,
      },
      { status: 503 },
    );
  }

  return NextResponse.json({
    ok: true,
    phone: so,
    het_han: j.expires_at ?? null,
    message: 'Đã gửi mã 6 số tới điện thoại của bạn.',
  });
}
