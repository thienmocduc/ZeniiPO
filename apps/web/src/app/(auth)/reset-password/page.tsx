'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Check, Eye, EyeOff, Loader2, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const passwordRules = {
  length: (v: string) => v.length >= 8,
  upper: (v: string) => /[A-Z]/.test(v),
  digit: (v: string) => /\d/.test(v),
  special: (v: string) => /[^A-Za-z0-9]/.test(v),
};

const schema = z
  .object({
    password: z
      .string()
      .min(8, 'Mật khẩu tối thiểu 8 ký tự')
      .refine(passwordRules.upper, 'Cần ít nhất 1 chữ IN HOA')
      .refine(passwordRules.digit, 'Cần ít nhất 1 chữ số')
      .refine(passwordRules.special, 'Cần ít nhất 1 ký tự đặc biệt'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirm'],
  });

type FormValues = z.infer<typeof schema>;

function Rule({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li
      className={`flex items-center gap-2 text-xs ${
        ok ? 'text-ok' : 'text-ink-dim'
      }`}
    >
      {ok ? <Check size={12} /> : <X size={12} />}
      <span>{children}</span>
    </li>
  );
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const [authError, setAuthError] = useState<string | null>(null);
  const [canReset, setCanReset] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirm: '' },
  });

  // Listen for PASSWORD_RECOVERY event that fires when Supabase detects
  // a recovery token in the URL fragment after user clicks the reset link.
  useEffect(() => {
    const supabase = createClient();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setCanReset(true);
      }
    });

    // Also allow reset if the user already has a session (refresh during flow).
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setCanReset(true);
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  const password = watch('password') || '';
  const ruleState = useMemo(
    () => ({
      length: passwordRules.length(password),
      upper: passwordRules.upper(password),
      digit: passwordRules.digit(password),
      special: passwordRules.special(password),
    }),
    [password],
  );

  async function onSubmit(values: FormValues) {
    setAuthError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      password: values.password,
    });

    if (error) {
      setAuthError(error.message);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  }

  return (
    <div className="bg-panel/80 backdrop-blur-xl border border-w-12 rounded-card p-8 shadow-[0_20px_80px_rgba(0,0,0,0.5)]">
      <header className="mb-8 text-center">
        <h1 className="font-display text-3xl text-ivory leading-tight">
          Đặt lại{' '}
          <span className="italic text-gold-light">mật khẩu</span>
        </h1>
        <p className="mt-2 font-serif italic text-ink-2 text-sm">
          Chọn một mật khẩu mạnh cho lần đăng nhập kế tiếp.
        </p>
      </header>

      {!canReset && !authError && (
        <div className="mb-5 rounded border border-w-12 bg-panel-2/60 px-4 py-3 text-sm text-ink-2">
          Đang xác thực liên kết đặt lại... Nếu liên kết đã hết hạn, vui lòng{' '}
          <Link href="/forgot-password" className="text-gold-light hover:text-gold underline">
            yêu cầu mới
          </Link>
          .
        </div>
      )}

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
            htmlFor="password"
            className="block font-mono uppercase text-2xs tracking-widest text-ink-2 mb-2"
          >
            Mật khẩu mới
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
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
          <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
            <Rule ok={ruleState.length}>Tối thiểu 8 ký tự</Rule>
            <Rule ok={ruleState.upper}>1 chữ IN HOA</Rule>
            <Rule ok={ruleState.digit}>1 chữ số</Rule>
            <Rule ok={ruleState.special}>1 ký tự đặc biệt</Rule>
          </ul>
          {errors.password && (
            <p className="text-err text-sm mt-1">{errors.password.message}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="confirm"
            className="block font-mono uppercase text-2xs tracking-widest text-ink-2 mb-2"
          >
            Xác nhận mật khẩu
          </label>
          <input
            id="confirm"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="••••••••"
            {...register('confirm')}
            className="w-full bg-panel-2 border border-w-12 focus:border-gold focus:outline-none rounded px-4 py-3 text-ivory placeholder:text-ink-dim transition"
          />
          {errors.confirm && (
            <p className="text-err text-sm mt-1">{errors.confirm.message}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting || !canReset}
          className="w-full bg-gold text-bg px-8 py-3 rounded font-semibold hover:bg-gold-light transition disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
        >
          {isSubmitting && <Loader2 className="animate-spin" size={18} />}
          {isSubmitting ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
        </button>
      </form>
    </div>
  );
}
