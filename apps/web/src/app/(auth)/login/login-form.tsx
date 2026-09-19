'use client';

/**
 * ĐĂNG NHẬP — viết bằng React, KHÔNG cắt gọt HTML mẫu nữa.
 *
 * VÌ SAO VIẾT LẠI (bài học 19/09/2026):
 * Bản cũ lấy nguyên khối `<div class="login">` trong `source.html` (bản dựng
 * demo) rồi dùng biểu thức tìm-thay để gọt bớt, và gắn sự kiện vào các id có
 * sẵn. Cách đó hỏng theo ba đường cùng lúc:
 *
 *  1. Một biểu thức gỡ nút SSO đã **cắt luôn nút Đăng nhập thật** (hai nút cùng
 *     tên lớp, nút thật đứng trước) ⇒ bản chạy thật ra màn hình đăng nhập KHÔNG
 *     CÓ NÚT NÀO. Mỗi lần dọn thêm là thêm một lần đánh cược.
 *  2. Sự kiện chỉ gắn vào cú nhấp nút ⇒ **gõ Enter không đăng nhập được**.
 *  3. Bản dựng còn ô "Công ty" và bộ chọn "Vai trò" không có tác dụng gì với
 *     đăng nhập thật (tổ chức và vai trò lấy từ hồ sơ trong dữ liệu) — để lại
 *     là hứa hão, tệ hơn là gợi ý người dùng tự nhận quyền Chairman.
 *
 * Viết bằng React thì ba thứ trên biến mất tận gốc: muốn bỏ gì thì không render,
 * form gửi được bằng Enter, và mọi thứ đều kiểm thử được.
 * Giao diện dùng đúng bộ lớp thiết kế của trang đăng ký để nhìn đồng bộ.
 */

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2, LogIn } from 'lucide-react';

const schema = z.object({
  email: z.string().min(1, 'Nhập email').email('Email không hợp lệ'),
  password: z.string().min(1, 'Nhập mật khẩu'),
});

type FormValues = z.infer<typeof schema>;

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/dashboard';

  const [authError, setAuthError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(values: FormValues) {
    setAuthError(null);
    try {
      const res = await fetch('/api/auth/zeni/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: values.email.trim(), password: values.password }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        setAuthError(j?.error ?? 'Đăng nhập thất bại');
        return;
      }
      // `replace` để nút Back không quay lại màn đăng nhập sau khi đã vào.
      router.replace(redirect);
      router.refresh();
    } catch {
      setAuthError('Không kết nối được máy chủ. Vui lòng thử lại.');
    }
  }

  const inputCls =
    'w-full bg-panel-2 border border-w-12 focus:border-gold focus:outline-none rounded px-4 py-3 text-ivory placeholder:text-ink-dim transition';
  const labelCls =
    'block font-mono uppercase text-2xs tracking-widest text-ink-2 mb-2';

  return (
    <div className="bg-panel/80 backdrop-blur-xl border border-w-12 rounded-card p-8 shadow-[0_20px_80px_rgba(0,0,0,0.5)]">
      <header className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gold/15 text-gold-light">
          <LogIn size={22} />
        </div>
        <h1 className="font-display text-3xl text-ivory leading-tight">
          Đăng nhập <span className="italic text-gold-light">Zeniipo</span>
        </h1>
        <p className="mt-2 font-serif italic text-ink-2 text-sm">
          Dùng tài khoản Zeni ID của bạn. Dữ liệu mỗi tổ chức tách biệt hoàn toàn.
        </p>
      </header>

      {authError && (
        <div
          role="alert"
          className="mb-5 rounded border border-err/40 bg-err/10 px-4 py-3 text-sm text-err"
        >
          {authError}
        </div>
      )}

      {/* `onSubmit` của form ⇒ gõ Enter cũng đăng nhập được (bản cũ không) */}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <div>
          <label htmlFor="email" className={labelCls}>
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            placeholder="ten@company.com"
            autoFocus
            {...register('email')}
            className={inputCls}
          />
          {errors.email && <p className="text-err text-sm mt-1">{errors.email.message}</p>}
        </div>

        <div>
          <label htmlFor="password" className={labelCls}>
            Mật khẩu
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              {...register('password')}
              className={`${inputCls} pr-12`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-dim hover:text-ivory transition"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.password && (
            <p className="text-err text-sm mt-1">{errors.password.message}</p>
          )}
        </div>

        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-xs text-gold-light hover:text-gold underline underline-offset-4"
          >
            Quên mật khẩu?
          </Link>
        </div>

        <button
          type="submit"
          id="loginBtn"
          disabled={isSubmitting}
          className="w-full bg-gold text-bg px-8 py-3 rounded font-semibold hover:bg-gold-light transition disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
        >
          {isSubmitting && <Loader2 className="animate-spin" size={18} />}
          {isSubmitting ? 'Đang đăng nhập...' : '🔐 Đăng nhập'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-2">
        Chưa có tài khoản?{' '}
        <Link href="/signup" className="text-gold-light hover:text-gold underline underline-offset-4">
          Đăng ký Zeni ID
        </Link>
      </p>

      <p className="mt-4 text-center text-2xs text-ink-dim leading-relaxed">
        Một tài khoản Zeni ID dùng chung cho mọi sản phẩm Zeni Holdings
        (zenicloud.io · ZeniIPO · Zeni Digital). Tổ chức và vai trò của bạn được
        lấy tự động từ hồ sơ — không cần chọn khi đăng nhập.
      </p>
    </div>
  );
}
