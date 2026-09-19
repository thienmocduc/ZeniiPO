import { NextResponse, type NextRequest } from 'next/server';
import {
  COOKIE_QUAY_VE,
  DUONG_NHAN_CALLBACK,
  ZENI_ID_BASE,
  duongDanNoiBoAnToan,
  goCongKhai,
  laProviderHopLe,
} from '@/lib/zeni/oauth';

/**
 * BƯỚC 1 — mở cửa đăng nhập ngoài qua Zeni ID.
 * Chuyển hướng người dùng sang màn hình đăng nhập của nhà cung cấp.
 * Xem luồng đầy đủ ở `@/lib/zeni/oauth`.
 */
export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ provider: string }> },
) {
  const { provider } = await ctx.params;

  // Danh sách đóng: không ghép thẳng chuỗi từ URL vào địa chỉ gọi nền tảng.
  if (!laProviderHopLe(provider)) {
    const loi = new URL('/login', req.nextUrl.origin);
    loi.searchParams.set('error', 'Cách đăng nhập không được hỗ trợ.');
    return NextResponse.redirect(loi);
  }

  // Chỗ cần quay về được cất trong cookie ngắn hạn thay vì nhét vào `return_to`.
  // Lý do: `return_to` phải khớp danh sách trắng của nền tảng — giữ nó cố định
  // và sạch thì không phụ thuộc vào cách nền tảng cắt chuỗi truy vấn.
  const quayVe = duongDanNoiBoAnToan(req.nextUrl.searchParams.get('redirect'));

  const authorize = new URL(`${ZENI_ID_BASE}/auth/oauth/${provider}/authorize`);
  authorize.searchParams.set('return_to', `${goCongKhai()}${DUONG_NHAN_CALLBACK}`);

  const res = NextResponse.redirect(authorize.toString());
  res.cookies.set(COOKIE_QUAY_VE, quayVe, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', // 'lax' để cookie còn sống khi nền tảng chuyển hướng ngược về
    path: '/',
    maxAge: 600, // 10 phút — đúng bằng hạn của state phía nền tảng
  });
  return res;
}
