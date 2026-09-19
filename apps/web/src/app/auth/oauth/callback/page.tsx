'use client';

/**
 * BƯỚC 3 — trang hứng token sau khi nền tảng xử lý xong đăng nhập ngoài.
 *
 * Nền tảng quay về đây với token nằm trong #fragment:
 *   /auth/oauth/callback#oauth=access_token=…&refresh_token=…&expires_in=…&is_new=…
 *
 * Fragment KHÔNG được trình duyệt gửi lên máy chủ, nên chỉ mã chạy tại trình
 * duyệt đọc được. Trang này đọc nó, gửi về máy chủ app để đổi lấy cookie
 * httpOnly, rồi XOÁ fragment khỏi thanh địa chỉ để token không nằm lại trong
 * lịch sử duyệt web.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';

export default function OAuthCallbackPage() {
  const router = useRouter();
  const [loi, setLoi] = useState<string | null>(null);

  useEffect(() => {
    let huy = false;

    (async () => {
      const raw = window.location.hash.replace(/^#/, '');
      // Nền tảng ghép chuỗi kiểu `oauth=access_token=…&refresh_token=…`,
      // nên phải bỏ tiền tố `oauth=` rồi mới đọc như tham số thường.
      const phan = raw.startsWith('oauth=') ? raw.slice('oauth='.length) : raw;
      const tham = new URLSearchParams(phan);
      const access = tham.get('access_token');
      const refresh = tham.get('refresh_token');

      if (!access) {
        setLoi('Không nhận được thông tin đăng nhập từ Zeni ID. Thử đăng nhập lại giúp em.');
        return;
      }

      // Xoá token khỏi thanh địa chỉ NGAY, trước cả khi gọi máy chủ.
      window.history.replaceState(null, '', window.location.pathname);

      try {
        const res = await fetch('/api/auth/zeni/oauth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token: access, refresh_token: refresh ?? undefined }),
        });
        if (huy) return;
        if (!res.ok) {
          const j = (await res.json().catch(() => null)) as { error?: string } | null;
          setLoi(j?.error ?? 'Không tạo được phiên đăng nhập.');
          return;
        }
        const j = (await res.json()) as { redirect?: string };
        router.replace(j.redirect ?? '/dashboard');
        router.refresh();
      } catch {
        if (!huy) setLoi('Không kết nối được máy chủ. Thử lại giúp em.');
      }
    })();

    return () => {
      huy = true;
    };
  }, [router]);

  return (
    <div className="bg-panel/80 backdrop-blur-xl border border-w-12 rounded-card p-8 text-center">
      {loi ? (
        <>
          <p role="alert" className="text-err text-sm">
            {loi}
          </p>
          <Link
            href="/login"
            className="mt-6 inline-block text-gold-light hover:text-gold underline underline-offset-4 text-sm"
          >
            Quay lại đăng nhập
          </Link>
        </>
      ) : (
        <p className="flex items-center justify-center gap-3 text-ink-2 text-sm">
          <Loader2 className="animate-spin" size={18} />
          Đang hoàn tất đăng nhập…
        </p>
      )}
    </div>
  );
}
