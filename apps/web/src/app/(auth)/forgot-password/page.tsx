'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Check, Loader2, Mail } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const schema = z.object({
  email: z.string().email('Email không hợp lệ'),
});

type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [authError, setAuthError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  });

  async function onSubmit(values: FormValues) {
    setAuthError(null);
    const supabase = createClient();
    const origin =
      typeof window !== 'undefined'
        ? window.location.origin
        : process.env.NEXT_PUBLIC_SITE_URL || '';

    const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: `${origin}/reset-password`,
    });

    if (error) {
      setAuthError(error.message);
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <div className="bg-panel/80 backdrop-blur-xl border border-w-12 rounded-card p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gold/15 text-gold-light">
          <Check size={28} />
        </div>
        <h1 className="font-display text-2xl text-ivory mb-2">
          Email reset <span className="italic text-gold-light">đã được gửi</span>
        </h1>
        <p className="font-serif italic text-ink-2 mb-6">
          Vui lòng kiểm tra hộp thư và nhấp vào liên kết để đặt lại mật khẩu.
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
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gold/15 text-gold-light">
          <Mail size={22} />
        </div>
        <h1 className="font-display text-3xl text-ivory leading-tight">
          Quên mật khẩu?
        </h1>
        <p className="mt-2 font-serif italic text-ink-2 text-sm">
          Nhập email của bạn — chúng tôi sẽ gửi liên kết đặt lại.
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
          {errors.email && (
            <p className="text-err text-sm mt-1">{errors.email.message}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-gold text-bg px-8 py-3 rounded font-semibold hover:bg-gold-light transition disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
        >
          {isSubmitting && <Loader2 className="animate-spin" size={18} />}
          {isSubmitting ? 'Đang gửi...' : 'Gửi liên kết đặt lại'}
        </button>

        <p className="text-center text-ink-2 text-sm pt-2">
          Nhớ ra rồi?{' '}
          <Link
            href="/login"
            className="text-gold-light hover:text-gold transition font-medium"
          >
            ← Về đăng nhập
          </Link>
        </p>
      </form>
    </div>
  );
}
