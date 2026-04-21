'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Eye, EyeOff, Lock, ArrowRight } from 'lucide-react';
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
    defaultValues: { email: '', password: '', remember: true },
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
    <div className="relative">
      {/* Soft aurora glow behind card — very subtle */}
      <div
        aria-hidden="true"
        className="absolute -inset-10 -z-10 opacity-60 blur-3xl pointer-events-none"
        style={{
          background:
            'radial-gradient(45% 55% at 30% 30%, rgba(99,102,241,0.30) 0%, transparent 60%),' +
            'radial-gradient(45% 55% at 70% 70%, rgba(168,85,247,0.28) 0%, transparent 60%)',
        }}
      />

      <div
        className="relative w-full max-w-[540px] rounded-card border border-chakra-6-glow/40 p-8 md:p-10 backdrop-blur-xl shadow-[0_40px_80px_rgba(0,0,0,0.5),0_0_60px_rgba(99,102,241,0.22)] animate-[glow-pulse_4s_ease-in-out_infinite]"
        style={{
          background:
            'linear-gradient(165deg, rgba(14,20,40,0.82) 0%, rgba(6,10,24,0.62) 100%)',
        }}
      >
        {/* Brand mark + tagline */}
        <div className="flex items-center gap-3.5 mb-8">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center font-serif italic text-2xl font-semibold text-ivory shadow-[0_0_24px_rgba(168,85,247,0.45)]"
            style={{
              background:
                'linear-gradient(135deg, #4f46e5 0%, #a855f7 50%, #e4c16e 100%)',
            }}
          >
            Z
          </div>
          <div>
            <div className="font-display text-[1.7rem] leading-none font-bold tracking-tight text-ivory">
              Zeni <em className="not-italic font-serif italic font-medium text-[#c084fc]">iPO</em>
            </div>
            <div className="mt-1.5 font-mono text-2xs uppercase tracking-widest text-gold-light">
              IPO Journey Platform · v1.8
            </div>
          </div>
        </div>

        {/* Title + sub */}
        <h1 className="font-display text-[1.85rem] leading-[1.15] font-medium text-ivory mb-2">
          Đăng nhập <em className="font-serif italic font-normal text-gold-light">Zeniipo workspace.</em>
        </h1>
        <p className="text-sm text-ink-2 leading-relaxed mb-7">
          Cascade tư tưởng Chairman — từ Day-0 đến ring-bell SGX 2031. Mỗi tenant, mỗi
          vai trò một góc nhìn riêng, bảo mật theo RLS policy cấp row.
        </p>

        {/* Error alert */}
        {authError && (
          <div
            role="alert"
            className="mb-5 rounded border border-err/40 bg-err/10 px-4 py-3 text-sm text-err"
          >
            {authError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          {/* Email */}
          <div>
            <label
              htmlFor="email"
              className="block font-mono text-2xs uppercase tracking-widest text-[#c084fc] font-medium mb-2.5"
            >
              Email <span className="text-err font-bold">*</span>
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="founder@zeni.vn"
              {...register('email')}
              className="w-full rounded-card border border-w-12 bg-w-4 px-3.5 py-3 text-[0.9rem] text-ink placeholder:text-ink-dim transition-all duration-200 focus:outline-none focus:border-[#6366f1] focus:bg-w-6 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.28)]"
            />
            {errors.email && (
              <p className="mt-1.5 text-xs text-err">{errors.email.message}</p>
            )}
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="password"
              className="block font-mono text-2xs uppercase tracking-widest text-[#c084fc] font-medium mb-2.5"
            >
              Mật khẩu <span className="text-err font-bold">*</span>
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                {...register('password')}
                className="w-full rounded-card border border-w-12 bg-w-4 px-3.5 py-3 pr-11 text-[0.9rem] text-ink placeholder:text-ink-dim transition-all duration-200 focus:outline-none focus:border-[#6366f1] focus:bg-w-6 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.28)]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-dim hover:text-gold-light transition"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1.5 text-xs text-err">{errors.password.message}</p>
            )}
          </div>

          {/* Remember + Forgot */}
          <div className="flex items-center justify-between pt-1">
            <label className="inline-flex items-center gap-2 cursor-pointer text-[0.82rem] text-ink-2">
              <input
                type="checkbox"
                {...register('remember')}
                className="h-4 w-4 rounded border-w-12 bg-w-4 accent-gold-light"
              />
              <span>Giữ đăng nhập 30 ngày</span>
            </label>
            <Link
              href="/forgot-password"
              className="text-[0.82rem] text-gold-light hover:text-gold transition"
            >
              Quên mật khẩu?
            </Link>
          </div>

          {/* Primary submit — chakra 6→7→gold flow with gentle breathe */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="group relative w-full rounded-card py-3 font-display text-[0.95rem] font-semibold text-ivory tracking-wide transition-all duration-200 hover:-translate-y-[1px] hover:shadow-[0_8px_28px_rgba(168,85,247,0.45)] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 inline-flex items-center justify-center gap-2 animate-breathe hover:animate-none"
            style={{
              background:
                'linear-gradient(135deg, #4f46e5 0%, #a855f7 50%, #e4c16e 100%)',
              backgroundSize: '150% 150%',
            }}
          >
            {isSubmitting ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              <Lock size={16} className="opacity-90" />
            )}
            {isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập Zeniipo'}
            {!isSubmitting && (
              <ArrowRight
                size={16}
                className="opacity-90 transition-transform group-hover:translate-x-1"
              />
            )}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 py-1">
            <div className="flex-1 h-px bg-w-8" />
            <span className="font-mono text-2xs uppercase tracking-widest text-ink-dim">
              hoặc
            </span>
            <div className="flex-1 h-px bg-w-8" />
          </div>

          {/* Google OAuth — disabled Q3/2026 */}
          <button
            type="button"
            disabled
            aria-label="Đăng nhập với Google (sắp có Q3/2026)"
            className="w-full rounded-card border border-w-12 bg-w-4 py-3 font-medium text-[0.88rem] text-ink-2 inline-flex items-center justify-center gap-3 opacity-60 cursor-not-allowed"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
            </svg>
            <span>Google / Microsoft SSO</span>
            <span className="ml-1 rounded bg-w-8 px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-widest text-gold-light">
              Q3/2026
            </span>
          </button>

          {/* Signup link */}
          <p className="pt-2 text-center text-sm text-ink-2">
            Chưa có tài khoản?{' '}
            <Link
              href="/signup"
              className="font-medium text-gold-light hover:text-gold transition"
            >
              Đăng ký founder account →
            </Link>
          </p>
        </form>

        {/* Footnote */}
        <div className="mt-6 pt-4 border-t border-dashed border-w-8 text-center font-mono text-[0.62rem] uppercase tracking-widest text-ink-dim leading-relaxed">
          RLS-guarded · Supabase Auth · Row-level tenant isolation
        </div>
      </div>
    </div>
  );
}
