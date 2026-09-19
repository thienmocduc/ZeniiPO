'use client';

/**
 * ĐẶT MẬT KHẨU MỚI — trang người dùng tới từ liên kết trong email.
 *
 * Trước đây trang này là ngõ cụt: chỉ hiện chữ "mật khẩu thuộc Zeni ID, sang
 * zenicloud.io mà đặt". Nay đặt được ngay tại đây, vì Zeni ID có sẵn hợp đồng
 * `/auth/password/forgot/verify` — thứ mà bản trước không tra nên không biết.
 */

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Check, Eye, EyeOff, KeyRound, Loader2, X } from 'lucide-react';

const LUAT: { kiem: (v: string) => boolean; chu: string }[] = [
  { kiem: (v) => v.length >= 12, chu: 'Tối thiểu 12 ký tự' },
  { kiem: (v) => /[A-Z]/.test(v), chu: 'Có chữ IN HOA' },
  { kiem: (v) => /[a-z]/.test(v), chu: 'Có chữ thường' },
  { kiem: (v) => /\d/.test(v), chu: 'Có chữ số' },
  { kiem: (v) => /[^A-Za-z0-9]/.test(v), chu: 'Có ký tự đặc biệt' },
];

const schema = z
  .object({
    mat_khau: z.string().superRefine((v, ctx) => {
      for (const l of LUAT) {
        if (!l.kiem(v)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: l.chu });
      }
    }),
    nhac_lai: z.string(),
  })
  .refine((d) => d.mat_khau === d.nhac_lai, {
    path: ['nhac_lai'],
    message: 'Hai lần nhập chưa khớp',
  });

type FormValues = z.infer<typeof schema>;

function Form() {
  const router = useRouter();
  const token = useSearchParams().get('token') ?? '';

  const [dangKiem, setDangKiem] = useState(true);
  const [tokenHong, setTokenHong] = useState<string | null>(null);
  const [loi, setLoi] = useState<string | null>(null);
  const [xong, setXong] = useState(false);
  const [hien, setHien] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { mat_khau: '', nhac_lai: '' } });

  const matKhau = watch('mat_khau');

  // Kiểm hạn liên kết NGAY khi mở trang — đừng để người dùng gõ xong mật khẩu
  // mới rồi mới báo "liên kết hết hạn".
  useEffect(() => {
    if (!token) {
      setTokenHong('Liên kết thiếu mã. Hãy mở đúng liên kết trong email đặt lại mật khẩu.');
      setDangKiem(false);
      return;
    }
    let huy = false;
    (async () => {
      try {
        const res = await fetch(`/api/auth/zeni/reset?token=${encodeURIComponent(token)}`);
        const j = (await res.json()) as { hop_le?: boolean; ly_do?: string };
        if (huy) return;
        if (!j.hop_le) setTokenHong(j.ly_do ?? 'Liên kết không dùng được.');
      } catch {
        if (!huy) setTokenHong('Không kiểm tra được liên kết. Thử lại sau.');
      } finally {
        if (!huy) setDangKiem(false);
      }
    })();
    return () => {
      huy = true;
    };
  }, [token]);

  async function onSubmit(v: FormValues) {
    setLoi(null);
    try {
      const res = await fetch('/api/auth/zeni/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: v.mat_khau }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        setLoi(j?.error ?? 'Không đặt được mật khẩu mới.');
        return;
      }
      setXong(true);
      setTimeout(() => router.replace('/login'), 2500);
    } catch {
      setLoi('Không kết nối được máy chủ. Thử lại giúp em.');
    }
  }

  const khung = 'bg-panel/80 backdrop-blur-xl border border-w-12 rounded-card p-8';
  const oNhap =
    'w-full bg-panel-2 border border-w-12 focus:border-gold focus:outline-none rounded px-4 py-3 text-ivory placeholder:text-ink-dim transition';
  const nhan = 'block font-mono uppercase text-2xs tracking-widest text-ink-2 mb-2';

  if (dangKiem) {
    return (
      <div className={`${khung} text-center`}>
        <p className="flex items-center justify-center gap-3 text-sm text-ink-2">
          <Loader2 className="animate-spin" size={18} />
          Đang kiểm tra liên kết…
        </p>
      </div>
    );
  }

  if (tokenHong) {
    return (
      <div className={`${khung} text-center`}>
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-err/15 text-err">
          <X size={26} />
        </div>
        <h1 className="font-display text-2xl text-ivory">Liên kết không dùng được</h1>
        <p role="alert" data-testid="loi-dat-lai" className="mt-3 text-sm text-err">
          {tokenHong}
        </p>
        <Link
          href="/forgot-password"
          className="mt-6 inline-flex w-full items-center justify-center rounded bg-gold px-8 py-3 font-semibold text-bg transition hover:bg-gold-light"
        >
          Xin liên kết mới
        </Link>
      </div>
    );
  }

  if (xong) {
    return (
      <div className={`${khung} text-center`}>
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-ok/15 text-ok">
          <Check size={26} />
        </div>
        <h1 className="font-display text-2xl text-ivory">Đã đổi mật khẩu</h1>
        <p className="mt-3 text-sm text-ink-2">
          Đang đưa bạn về trang đăng nhập — dùng mật khẩu mới để vào.
        </p>
        <Link href="/login" className="mt-5 inline-block text-sm text-gold-light underline underline-offset-4">
          Vào đăng nhập ngay →
        </Link>
      </div>
    );
  }

  return (
    <div className={khung}>
      <header className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gold/15 text-gold-light">
          <KeyRound size={22} />
        </div>
        <h1 className="font-display text-3xl leading-tight text-ivory">
          Đặt <span className="italic text-gold-light">mật khẩu mới</span>
        </h1>
        <p className="mt-2 font-serif text-sm italic text-ink-2">
          Mật khẩu này dùng cho Zeni ID — tức là cho mọi sản phẩm Zeni Holdings.
        </p>
      </header>

      {loi && (
        <div
          role="alert"
          data-testid="loi-dat-lai"
          className="mb-5 rounded border border-err/40 bg-err/10 px-4 py-3 text-sm text-err"
        >
          {loi}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <div>
          <label htmlFor="mat_khau" className={nhan}>
            Mật khẩu mới
          </label>
          <div className="relative">
            <input
              id="mat_khau"
              type={hien ? 'text' : 'password'}
              autoComplete="new-password"
              autoFocus
              {...register('mat_khau')}
              className={`${oNhap} pr-12`}
            />
            <button
              type="button"
              onClick={() => setHien((s) => !s)}
              aria-label={hien ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-dim transition hover:text-ivory"
            >
              {hien ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1">
            {LUAT.map((l) => {
              const dat = l.kiem(matKhau ?? '');
              return (
                <li
                  key={l.chu}
                  className={`flex items-center gap-2 text-xs ${dat ? 'text-ok' : 'text-ink-dim'}`}
                >
                  {dat ? <Check size={13} /> : <X size={13} />}
                  {l.chu}
                </li>
              );
            })}
          </ul>
        </div>

        <div>
          <label htmlFor="nhac_lai" className={nhan}>
            Nhập lại mật khẩu
          </label>
          <input
            id="nhac_lai"
            type={hien ? 'text' : 'password'}
            autoComplete="new-password"
            {...register('nhac_lai')}
            className={oNhap}
          />
          {errors.nhac_lai && <p className="mt-1 text-sm text-err">{errors.nhac_lai.message}</p>}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex w-full items-center justify-center gap-2 rounded bg-gold px-8 py-3 font-semibold text-bg transition hover:bg-gold-light disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting && <Loader2 className="animate-spin" size={18} />}
          {isSubmitting ? 'Đang đổi…' : 'Đổi mật khẩu'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-2">
        <Link href="/login" className="text-gold-light underline underline-offset-4 hover:text-gold">
          ← Về trang đăng nhập
        </Link>
      </p>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: '#94A3B8' }}>…</div>}>
      <Form />
    </Suspense>
  );
}
