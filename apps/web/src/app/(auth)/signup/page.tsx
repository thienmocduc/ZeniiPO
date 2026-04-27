'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Check, Loader2, X, Eye, EyeOff } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { GoogleSignInButton } from '@/components/auth/google-button';

const passwordRules = {
  length: (v: string) => v.length >= 12,
  upper: (v: string) => /[A-Z]/.test(v),
  lower: (v: string) => /[a-z]/.test(v),
  digit: (v: string) => /\d/.test(v),
  special: (v: string) => /[^A-Za-z0-9]/.test(v),
  noRepeat: (v: string) => !/(.)\1{2,}/.test(v),
  noCommon: (v: string) =>
    !['password', '12345678', 'qwerty', 'zeniipo', 'admin', 'chairman', 'iloveyou'].some((bad) =>
      v.toLowerCase().includes(bad),
    ),
};

const passwordSchema = z
  .string()
  .min(12, 'Mật khẩu tối thiểu 12 ký tự')
  .max(128, 'Mật khẩu tối đa 128 ký tự')
  .refine(passwordRules.upper, 'Cần ít nhất 1 chữ IN HOA')
  .refine(passwordRules.lower, 'Cần ít nhất 1 chữ thường')
  .refine(passwordRules.digit, 'Cần ít nhất 1 chữ số')
  .refine(passwordRules.special, 'Cần ít nhất 1 ký tự đặc biệt')
  .refine(passwordRules.noRepeat, 'Không lặp 1 ký tự ≥3 lần liên tiếp')
  .refine(passwordRules.noCommon, 'Tránh từ ngữ phổ biến (password, admin, chairman, ...)');

const schema = z.object({
  full_name: z.string().min(2, 'Vui lòng nhập họ tên đầy đủ'),
  email: z.string().email('Email không hợp lệ'),
  password: passwordSchema,
  company_name: z.string().optional(),
  role: z.string().default('chr'),
  terms: z.literal(true, {
    errorMap: () => ({ message: 'Bạn cần đồng ý với điều khoản' }),
  }),
});

type FormValues = z.infer<typeof schema>;

const ROLES: { value: string; label: string }[] = [
  { value: 'chr', label: 'Chairman — Chủ tịch' },
  { value: 'ceo', label: 'CEO — Tổng giám đốc' },
  { value: 'c_level', label: 'C-level — Quản trị cấp cao' },
  { value: 'investor', label: 'Investor — Nhà đầu tư' },
  { value: 'advisor', label: 'Advisor — Cố vấn' },
];

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

export default function SignupPage() {
  const [authError, setAuthError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: '',
      email: '',
      password: '',
      company_name: '',
      role: 'chr',
      terms: undefined as unknown as true,
    },
  });

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
    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: {
          full_name: values.full_name,
          company_name: values.company_name || null,
          role: values.role,
        },
      },
    });

    if (error) {
      setAuthError(error.message);
      return;
    }

    setSuccess(true);
  }

  if (success) {
    return (
      <div className="bg-panel/80 backdrop-blur-xl border border-w-12 rounded-card p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gold/15 text-gold-light">
          <Check size={28} />
        </div>
        <h1 className="font-display text-2xl text-ivory mb-2">
          Email xác nhận <span className="italic text-gold-light">đã được gửi</span>
        </h1>
        <p className="font-serif italic text-ink-2 mb-6">
          Vui lòng kiểm tra hộp thư và nhấp vào liên kết xác nhận để kích hoạt
          tài khoản Zeniipo của bạn.
        </p>
        <Link
          href="/login"
          className="inline-block bg-gold text-bg px-8 py-3 rounded font-semibold hover:bg-gold-light transition"
        >
          Về trang đăng nhập
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-panel/80 backdrop-blur-xl border border-w-12 rounded-card p-8 shadow-[0_20px_80px_rgba(0,0,0,0.5)]">
      <header className="mb-8 text-center">
        <h1 className="font-display text-3xl text-ivory leading-tight">
          Tạo tài khoản{' '}
          <span className="italic text-gold-light">Zeniipo</span>
        </h1>
        <p className="mt-2 font-serif italic text-ink-2 text-sm">
          Khởi đầu Day-0 — dẫn công ty tới ring-bell SGX.
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

      <GoogleSignInButton label="Đăng ký với Google" />
      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-w8" />
        <span className="font-mono text-2xs uppercase tracking-widest text-ink-dim">hoặc</span>
        <div className="h-px flex-1 bg-w8" />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <div>
          <label
            htmlFor="full_name"
            className="block font-mono uppercase text-2xs tracking-widest text-ink-2 mb-2"
          >
            Họ và tên
          </label>
          <input
            id="full_name"
            type="text"
            autoComplete="name"
            placeholder="Nguyễn Văn A"
            {...register('full_name')}
            className="w-full bg-panel-2 border border-w-12 focus:border-gold focus:outline-none rounded px-4 py-3 text-ivory placeholder:text-ink-dim transition"
          />
          {errors.full_name && (
            <p className="text-err text-sm mt-1">{errors.full_name.message}</p>
          )}
        </div>

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
          {errors.email && (
            <p className="text-err text-sm mt-1">{errors.email.message}</p>
          )}
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
            htmlFor="company_name"
            className="block font-mono uppercase text-2xs tracking-widest text-ink-2 mb-2"
          >
            Tên công ty <span className="lowercase text-ink-dim">(tuỳ chọn)</span>
          </label>
          <input
            id="company_name"
            type="text"
            autoComplete="organization"
            placeholder="Zeni Digital Holdings"
            {...register('company_name')}
            className="w-full bg-panel-2 border border-w-12 focus:border-gold focus:outline-none rounded px-4 py-3 text-ivory placeholder:text-ink-dim transition"
          />
          <p className="text-2xs text-ink-dim mt-1 font-mono">
            Nếu nhập — hệ thống sẽ tạo một tenant mới mang tên này.
          </p>
        </div>

        <div>
          <label
            htmlFor="role"
            className="block font-mono uppercase text-2xs tracking-widest text-ink-2 mb-2"
          >
            Vai trò
          </label>
          <select
            id="role"
            {...register('role')}
            className="w-full bg-panel-2 border border-w-12 focus:border-gold focus:outline-none rounded px-4 py-3 text-ivory transition"
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value} className="bg-panel">
                {r.label}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-start gap-3 text-sm text-ink-2 cursor-pointer">
          <input
            type="checkbox"
            {...register('terms')}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-w-12 bg-panel-2 accent-gold"
          />
          <span>
            Tôi đồng ý với{' '}
            <Link href="/terms" className="text-gold-light hover:text-gold underline">
              Điều khoản dịch vụ
            </Link>{' '}
            và{' '}
            <Link href="/privacy" className="text-gold-light hover:text-gold underline">
              Chính sách bảo mật
            </Link>
            .
          </span>
        </label>
        {errors.terms && (
          <p className="text-err text-sm -mt-3">{errors.terms.message as string}</p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-gold text-bg px-8 py-3 rounded font-semibold hover:bg-gold-light transition disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
        >
          {isSubmitting && <Loader2 className="animate-spin" size={18} />}
          {isSubmitting ? 'Đang tạo tài khoản...' : 'Tạo tài khoản'}
        </button>

        <p className="text-center text-ink-2 text-sm pt-2">
          Đã có tài khoản?{' '}
          <Link
            href="/login"
            className="text-gold-light hover:text-gold transition font-medium"
          >
            Đăng nhập →
          </Link>
        </p>
      </form>
    </div>
  );
}
