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
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  LogIn,
  Mail,
  ShieldCheck,
  Smartphone,
  WifiOff,
} from 'lucide-react';
import { oauthDaBat } from '@/lib/zeni/oauth';
import { KHOA, docGhiNho, luuGhiNho } from '@/lib/zeni/ghi-nho';
import { PhoneForm } from './phone-form';

/** Logo Google đúng 4 màu — dùng chữ "G" tự vẽ là vi phạm quy chuẩn thương hiệu. */
function LogoGoogle() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5h-1.9V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.0 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.0 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5h-1.9V20H24v8h11.3c-.8 2.3-2.3 4.2-4.1 5.6l6.2 5.2C39.2 35.9 44 30.6 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

/** Dấu Zeni Digital — chữ Z trong khung, dùng đúng màu vàng của bộ nhận diện. */
function LogoZeniDigital() {
  return (
    <span className="flex h-[18px] w-[18px] items-center justify-center rounded-[4px] bg-gold/20 font-display text-[11px] font-bold text-gold-light">
      Z
    </span>
  );
}

/**
 * Các cách đăng nhập ngoài hiện trên màn hình.
 * `choLyDo` khác null ⇒ luôn ở trạng thái chờ, kể cả khi đã bật cờ OAuth —
 * dùng cho nhà cung cấp mà chính nền tảng còn báo chưa sẵn sàng.
 */
const NHA_CUNG_CAP: {
  ma: string;
  ten: string;
  Logo: () => React.JSX.Element;
  choLyDo: string | null;
}[] = [
  { ma: 'google', ten: 'Google', Logo: LogoGoogle, choLyDo: null },
  {
    ma: 'zenidigital',
    ten: 'Zeni Digital',
    Logo: LogoZeniDigital,
    // Hỏi nền tảng ngày 20/09/2026: provider zenidigital trả `ready: false`.
    choLyDo: 'Zeni Cloud chưa bật kết nối Zeni Digital (nền tảng báo chưa sẵn sàng)',
  },
];

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
  /** Hai cách vào cùng một tài khoản Zeni ID — email+mật khẩu, hoặc SĐT+mã OTP. */
  const [cach, setCach] = useState<'email' | 'dien-thoai'>('email');
  /** Bật CapsLock là nguyên nhân số một của "mật khẩu đúng mà báo sai". */
  const [capsLock, setCapsLock] = useState(false);
  const [mangOffline, setMangOffline] = useState(false);
  /** Email lần trước — mời quay lại bằng một cú bấm thay vì gõ lại. */
  const [emailCuoi, setEmailCuoi] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  // Nhớ cách đăng nhập quen và email lần trước. Chạy sau khi dựng xong giao diện
  // để máy chủ và trình duyệt vẽ ra giống nhau (tránh lệch khi bù nước).
  useEffect(() => {
    if (docGhiNho(KHOA.cachCuoi) === 'dien-thoai') setCach('dien-thoai');
    const e = docGhiNho(KHOA.emailCuoi);
    if (e) setEmailCuoi(e);
  }, []);

  useEffect(() => {
    luuGhiNho(KHOA.cachCuoi, cach);
  }, [cach]);

  // Mất mạng thì nói ngay, đừng để người dùng bấm rồi chờ hết giờ mới biết.
  useEffect(() => {
    const capNhat = () => setMangOffline(!navigator.onLine);
    capNhat();
    window.addEventListener('online', capNhat);
    window.addEventListener('offline', capNhat);
    return () => {
      window.removeEventListener('online', capNhat);
      window.removeEventListener('offline', capNhat);
    };
  }, []);

  function dungEmailCuoi() {
    if (!emailCuoi) return;
    setValue('email', emailCuoi, { shouldValidate: true });
    setEmailCuoi(null);
    setFocus('password');
  }

  async function onSubmit(values: FormValues) {
    setAuthError(null);
    // Nhớ email để lần sau chỉ cần bấm một cái. KHÔNG bao giờ nhớ mật khẩu.
    luuGhiNho(KHOA.emailCuoi, values.email.trim());
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
    'w-full bg-panel-2 border border-w-12 focus:border-gold focus:outline-none rounded px-4 py-2.5 text-ivory placeholder:text-ink-dim transition';
  const labelCls =
    'block font-mono uppercase text-2xs tracking-widest text-ink-2 mb-1.5';

  return (
    <div className="rounded-card border border-w-12 bg-panel/80 p-6 shadow-[0_20px_80px_rgba(0,0,0,0.5)] backdrop-blur-xl">
      {/* Đầu thẻ gọn: một dòng tên, một dòng nói rõ đây là Zeni ID. Bản trước
          có huy hiệu to + đoạn giới thiệu hai dòng, đẩy thẻ cao quá màn hình. */}
      <header className="mb-5 text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-gold/15 text-gold-light">
          <LogIn size={18} />
        </div>
        <h1 className="font-display text-2xl leading-tight text-ivory">
          Đăng nhập <span className="italic text-gold-light">Zeniipo</span>
        </h1>
        <p className="mt-1.5 flex items-center justify-center gap-1.5 text-xs text-ink-2">
          <ShieldCheck size={12} className="text-gold-light" />
          Bằng <span className="text-gold-light">Zeni ID</span> — một tài khoản cho cả hệ sinh thái
        </p>
      </header>

      {/* ĐĂNG NHẬP BẰNG NHÀ CUNG CẤP NGOÀI — đi qua Zeni ID, app KHÔNG tự đấu
          Google.
          Lệnh chairman 20/09: nút nào chưa có OAuth thì CỨ HIỆN, đánh dấu đang
          chờ. Nên nút hiện nhưng KHOÁ hẳn (`disabled` + `aria-disabled`) kèm chữ
          "đang chờ kết nối" — người dùng thấy được lộ trình mà không ai bấm phải
          một đường dẫn ném họ sang tên miền khác.
          Bật thật = đặt NEXT_PUBLIC_ZENI_OAUTH=1 khi ZeniCloud cấp khoá. */}

      {/* Mất mạng thì nói ngay, đừng để người dùng bấm rồi chờ hết giờ mới biết. */}
      {mangOffline && (
        <div
          role="status"
          data-testid="mat-mang"
          className="mb-4 flex items-center gap-2 rounded border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-warn"
        >
          <WifiOff size={16} />
          Máy bạn đang mất kết nối mạng — nối lại rồi hãy đăng nhập.
        </div>
      )}

      {/* Quay lại bằng một cú bấm. Chỉ nhớ EMAIL, không bao giờ nhớ mật khẩu. */}
      {cach === 'email' && emailCuoi && (
        <button
          type="button"
          onClick={dungEmailCuoi}
          data-testid="email-lan-truoc"
          className="mb-4 flex w-full items-center justify-between gap-3 rounded border border-gold/25 bg-gold/5 px-4 py-2.5 text-left transition hover:border-gold/50 hover:bg-gold/10"
        >
          <span className="min-w-0">
            <span className="block font-mono text-2xs uppercase tracking-widest text-ink-dim">
              Lần trước bạn dùng
            </span>
            <span className="block truncate text-sm text-ivory">{emailCuoi}</span>
          </span>
          <ArrowRight size={16} className="shrink-0 text-gold-light" />
        </button>
      )}

      {/* Hai cách vào cùng một tài khoản Zeni ID. Đăng nhập bằng số điện thoại
          là đường có sẵn của nền tảng (SMS OTP) — với doanh nhân Việt thì đây là
          cách quen tay hơn cả. */}
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg border border-w-12 bg-panel-2 p-1">
        {(
          [
            { ma: 'email', chu: 'Email', Icon: Mail },
            { ma: 'dien-thoai', chu: 'Số điện thoại', Icon: Smartphone },
          ] as const
        ).map(({ ma, chu, Icon }) => (
          <button
            key={ma}
            type="button"
            onClick={() => setCach(ma)}
            aria-pressed={cach === ma}
            className={`flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition ${
              cach === ma ? 'bg-gold text-bg' : 'text-ink-2 hover:text-ivory'
            }`}
          >
            <Icon size={15} />
            {chu}
          </button>
        ))}
      </div>

      {cach === 'dien-thoai' && <PhoneForm redirect={redirect} />}

      {cach === 'email' && (
        <>
      {authError && (
        <div
          role="alert"
          // Nhãn riêng để test bám vào. KHÔNG được để test dò `[role="alert"]`
          // chung chung: Next.js tự chèn `#__next-route-announcer__` mang đúng
          // vai trò đó vào MỌI trang, luôn hiện (ẩn 1px) và rỗng chữ — test dò
          // như vậy sẽ XANH kể cả khi form không hề gửi đi. Đã dính 20/09/2026.
          data-testid="loi-dang-nhap"
          className="mb-4 rounded border border-err/40 bg-err/10 px-3 py-2 text-sm text-err"
        >
          {authError}
        </div>
      )}

      {/* `onSubmit` của form ⇒ gõ Enter cũng đăng nhập được (bản cũ không) */}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
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
              // Bật CapsLock là nguyên nhân số một của "mật khẩu đúng mà báo
              // sai" — người dùng không nhìn thấy chữ mình gõ nên không biết.
              onKeyUp={(e) => setCapsLock(e.getModifierState?.('CapsLock') ?? false)}
              onBlur={() => setCapsLock(false)}
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
          {capsLock && (
            <p
              role="status"
              data-testid="canh-bao-capslock"
              className="mt-2 flex items-center gap-2 text-xs text-warn"
            >
              <ShieldCheck size={13} />
              Đang bật CapsLock — chữ hoa thường sẽ khác với mật khẩu bạn nhớ.
            </p>
          )}
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
          className="inline-flex w-full items-center justify-center gap-2 rounded bg-gold px-8 py-2.5 font-semibold text-bg transition hover:bg-gold-light disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting && <Loader2 className="animate-spin" size={18} />}
          {isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập bằng Zeni ID'}
        </button>
      </form>
        </>
      )}

      {/* CÁCH KHÁC — xếp DƯỚI form chính và để gọn, học cách zenicloud.io bày:
          đây chỉ là đường liên kết tài khoản, không phải nhân vật chính.
          Bản trước để hai nút to đùng nằm TRÊN cùng, đẩy form xuống và làm thẻ
          cao quá màn hình. */}
      <div className="mt-6 border-t border-w-12 pt-5">
        <p className="mb-3 text-center font-mono text-2xs uppercase tracking-widest text-ink-dim">
          hoặc
        </p>
        <div className="grid grid-cols-2 gap-2">
          {NHA_CUNG_CAP.map(({ ma, ten, Logo, choLyDo }) => {
            const sanSang = oauthDaBat() && !choLyDo;
            return sanSang ? (
              <a
                key={ma}
                href={`/api/auth/zeni/oauth/${ma}?redirect=${encodeURIComponent(redirect)}`}
                data-testid={`oauth-${ma}`}
                className="flex items-center justify-center gap-2 rounded border border-w-12 bg-panel-2 px-3 py-2 text-sm text-ivory transition hover:border-gold/50"
              >
                <Logo />
                {ten}
              </a>
            ) : (
              <button
                key={ma}
                type="button"
                disabled
                aria-disabled="true"
                data-testid={`oauth-${ma}-cho`}
                title={choLyDo ?? 'Đang chờ Zeni Cloud cấp khoá kết nối'}
                className="flex cursor-not-allowed items-center justify-center gap-2 rounded border border-dashed border-w-12 px-3 py-2 text-sm text-ink-dim"
              >
                <span className="opacity-40">
                  <Logo />
                </span>
                {ten}
                <span className="font-mono text-2xs uppercase tracking-wide">· đang chờ</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Đăng ký: một dòng gọn nhưng vẫn là nút bấm được rõ ràng. */}
      <p className="mt-5 text-center text-sm text-ink-2">
        Chưa có tài khoản?{' '}
        <Link
          href="/signup"
          className="font-semibold text-gold-light underline underline-offset-4 transition hover:text-gold"
        >
          Đăng ký miễn phí
        </Link>
      </p>
    </div>
  );
}
