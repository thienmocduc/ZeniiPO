'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const schema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự'),
  remember: z.boolean().optional(),
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
    defaultValues: { email: '', password: '', remember: false },
  });

  async function onSubmit(values: FormValues) {
    setAuthError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });

    if (error) {
      if (error.message.toLowerCase().includes('invalid')) {
        setAuthError('Email hoặc mật khẩu không đúng.');
      } else if (error.message.toLowerCase().includes('network')) {
        setAuthError('Lỗi kết nối — vui lòng thử lại.');
      } else {
        setAuthError(error.message);
      }
      return;
    }

    router.push(redirect);
    router.refresh();
  }

  return (
    <div className="bg-panel/80 backdrop-blur-xl border border-w-12 rounded-card p-8 shadow-[0_20px_80px_rgba(0,0,0,0.5)]">
      <header className="mb-8 text-center">
        <h1 className="font-display text-3xl text-ivory leading-tight">
          Đăng nhập <span className="italic text-gold-light">vào Zeniipo</span>
        </h1>
        <p className="mt-2 font-serif italic text-ink-2 text-sm">
          Cascade tư tưởng Chairman — từ Day-0 đến ring-bell SGX.
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

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <div>
          <label
            htmlFor="email"
            className="block font-mono uppercase text-2xs tracking-widest text-ink-2 mb-2"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="founder@zeni.vn"
            {...register('email')}
            className="w-full bg-panel-2 border border-w-12 focus:border-gold focus:outline-none rounded px-4 py-3 text-ivory placeholder:text-ink-dim transition"
          />
          {errors.email && <p className="text-err text-sm mt-1">{errors.email.message}</p>}
        </div>

        <div>
          <label
            htmlFor="password"
            className="block font-mono uppercase text-2xs tracking-widest text-ink-2 mb-2"
          >
            Mật khẩu
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              {...register('password')}
              className="w-full bg-panel-2 border border-w-12 focus:border-gold focus:outline-none rounded px-4 py-3 pr-12 text-ivory placeholder:text-ink-dim transition"
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

        <div className="flex items-center justify-between text-sm">
          <label className="inline-flex items-center gap-2 text-ink-2 cursor-pointer">
            <input
              type="checkbox"
              {...register('remember')}
              className="h-4 w-4 rounded border-w-12 bg-panel-2 accent-gold"
            />
            <span>Ghi nhớ đăng nhập</span>
          </label>
          <Link
            href="/forgot-password"
            className="text-gold-light hover:text-gold transition"
          >
            Quên mật khẩu?
          </Link>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-gold text-bg px-8 py-3 rounded font-semibold hover:bg-gold-light transition disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
        >
          {isSubmitting && <Loader2 className="animate-spin" size={18} />}
          {isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </button>

        <div className="relative py-2">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-w-12" />
          </div>
          <div className="relative flex justify-center text-2xs font-mono uppercase tracking-widest">
            <span className="bg-panel px-3 text-ink-dim">hoặc</span>
          </div>
        </div>

        {/* TODO: OAuth setup coming Q3/2026 */}
        <button
          type="button"
          disabled
          aria-label="Đăng nhập với Google (sắp có)"
          className="w-full border border-w-12 bg-panel-2/50 text-ink-2 px-8 py-3 rounded font-medium inline-flex items-center justify-center gap-3 opacity-60 cursor-not-allowed"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
          </svg>
          <span>Google (sắp có)</span>
        </button>

        <p className="text-center text-ink-2 text-sm pt-2">
          Chưa có tài khoản?{' '}
          <Link
            href="/signup"
            className="text-gold-light hover:text-gold transition font-medium"
          >
            Đăng ký →
          </Link>
        </p>
      </form>
    </div>
  );
}
