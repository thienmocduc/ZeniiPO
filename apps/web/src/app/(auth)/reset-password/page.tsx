'use client';

/**
 * Flow reset mật khẩu cũ (Supabase recovery token) đã thay bằng Zeni ID —
 * tài khoản dùng chung hệ sinh thái, mật khẩu quản lý ở tầng nền tảng.
 * Trang giữ lại để link cũ trong email không chết, chỉ đường đúng chỗ.
 */
import Link from 'next/link';
import { KeyRound } from 'lucide-react';

export default function ResetPasswordPage() {
  return (
    <div className="bg-panel/80 backdrop-blur-xl border border-w-12 rounded-card p-8 shadow-[0_20px_80px_rgba(0,0,0,0.5)] text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gold/15 text-gold-light">
        <KeyRound size={26} />
      </div>
      <h1 className="font-display text-3xl text-ivory leading-tight">
        Mật khẩu thuộc <span className="italic text-gold-light">Zeni ID</span>
      </h1>
      <p className="mt-3 font-serif italic text-ink-2 text-sm">
        Tài khoản của bạn dùng chung toàn hệ sinh thái Zeni. Đặt lại mật khẩu
        tại zenicloud.io (Quên mật khẩu), sau đó quay lại đăng nhập ZeniIPO
        bằng mật khẩu mới.
      </p>
      <div className="mt-6 flex flex-col gap-3">
        <a
          href="https://zenicloud.io"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block bg-gold text-bg px-8 py-3 rounded font-semibold hover:bg-gold-light transition"
        >
          Mở Zeni ID (zenicloud.io)
        </a>
        <Link
          href="/login"
          className="text-sm text-gold-light hover:text-gold underline underline-offset-4"
        >
          ← Về trang đăng nhập
        </Link>
      </div>
    </div>
  );
}
