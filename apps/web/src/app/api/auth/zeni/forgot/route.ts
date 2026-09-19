import { NextRequest, NextResponse } from 'next/server';

/**
 * QUÊN MẬT KHẨU — chuyển tiếp sang Zeni ID (Lớp 5).
 *
 * Trước đây trang /forgot-password chỉ hiện một dòng chữ tĩnh, bấm nút KHÔNG
 * gửi gì cả — người dùng ngồi chờ mail vĩnh viễn. Đó là lừa người dùng, phải bỏ.
 *
 * Mật khẩu thuộc về Zeni ID (tài khoản dùng chung hệ sinh thái), app không giữ
 * và không thể tự đặt lại. Route này thử gọi thật sang Zeni ID; nền tảng chưa
 * mở đường nào thì NÓI THẲNG là chưa gửi được, kèm chỗ tự xử — tuyệt đối không
 * báo "đã gửi email" khi chưa chắc (ràng buộc #7: fail-closed, cấm đoán).
 */
export const runtime = 'nodejs';

const ZENI_ID_BASE = (process.env.ZENI_ID_BASE_URL ?? 'https://zenicloud.io/api/v1').replace(/\/$/, '');

/** Các đường đặt lại mật khẩu thường gặp — thử lần lượt, cái nào nhận thì dùng. */
const RESET_PATHS = [
  '/auth/forgot-password',
  '/auth/password/forgot',
  '/auth/request-password-reset',
  '/auth/reset-password/request',
  '/auth/forgot',
];

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

  const tried: Array<{ path: string; status: number | string }> = [];

  for (const path of RESET_PATHS) {
    try {
      const res = await fetch(`${ZENI_ID_BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
        cache: 'no-store',
      });
      tried.push({ path, status: res.status });

      // 404/405 = đường này không tồn tại → thử đường kế tiếp.
      if (res.status === 404 || res.status === 405) continue;

      if (res.ok) {
        // Trả lời đồng nhất dù email có tồn tại hay không — không tiết lộ ai đã
        // đăng ký (chuẩn thực hành chống dò tài khoản).
        return NextResponse.json({
          ok: true,
          message:
            'Nếu email này có tài khoản Zeni ID, liên kết đặt lại đã được gửi. Kiểm tra cả hộp thư rác.',
        });
      }

      // Nền tảng trả lỗi thật (4xx/5xx khác) → báo đúng, không che.
      return NextResponse.json(
        {
          error: `Zeni ID từ chối yêu cầu (mã ${res.status}). Vui lòng đặt lại trực tiếp tại zenicloud.io.`,
          reset_url: 'https://zenicloud.io',
        },
        { status: 502 },
      );
    } catch {
      tried.push({ path, status: 'không kết nối được' });
    }
  }

  // Không đường nào nhận → nói thật, chỉ chỗ tự xử.
  return NextResponse.json(
    {
      error:
        'Zeni ID chưa mở chức năng đặt lại mật khẩu qua ứng dụng. Vui lòng đặt lại trực tiếp tại zenicloud.io rồi quay lại đăng nhập.',
      reset_url: 'https://zenicloud.io',
      da_thu: tried,
    },
    { status: 501 },
  );
}
