'use client';

/**
 * ĐĂNG NHẬP BẰNG SỐ ĐIỆN THOẠI + MÃ OTP.
 *
 * Hai bước: nhập số → nhận mã 6 số qua SMS → nhập mã. Mã và phiên đều do Zeni ID
 * cấp; ZeniIPO chỉ chuyển tiếp rồi đặt cookie (xem `api/auth/zeni/phone/*`).
 *
 * Nguyên tắc trung thực: nếu nền tảng báo chưa gửi được SMS thì màn hình nói
 * đúng như vậy và chỉ sang cách đăng nhập bằng email — tuyệt đối không hiện ô
 * nhập mã cho một tin nhắn không tồn tại.
 */

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Smartphone } from 'lucide-react';
import { cheSo } from '@/lib/zeni/phone';

const CHO_GUI_LAI_GIAY = 60;

export function PhoneForm({ redirect }: { redirect: string }) {
  const router = useRouter();

  const [buoc, setBuoc] = useState<'so' | 'ma'>('so');
  const [so, setSo] = useState('');
  const [soDaGui, setSoDaGui] = useState('');
  const [ma, setMa] = useState('');
  const [loi, setLoi] = useState<string | null>(null);
  const [dangChay, setDangChay] = useState(false);
  const [demNguoc, setDemNguoc] = useState(0);
  const oMa = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (demNguoc <= 0) return;
    const t = setTimeout(() => setDemNguoc((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [demNguoc]);

  useEffect(() => {
    if (buoc === 'ma') oMa.current?.focus();
  }, [buoc]);

  async function xinMa(e?: React.FormEvent) {
    e?.preventDefault();
    setLoi(null);
    setDangChay(true);
    try {
      const res = await fetch('/api/auth/zeni/phone/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: so }),
      });
      const j = (await res.json().catch(() => null)) as
        | { ok?: boolean; phone?: string; error?: string }
        | null;
      if (!res.ok) {
        setLoi(j?.error ?? 'Không xin được mã.');
        return;
      }
      setSoDaGui(j?.phone ?? so);
      setBuoc('ma');
      setDemNguoc(CHO_GUI_LAI_GIAY);
    } catch {
      setLoi('Không kết nối được máy chủ. Thử lại giúp em.');
    } finally {
      setDangChay(false);
    }
  }

  async function dangNhap(e: React.FormEvent) {
    e.preventDefault();
    setLoi(null);
    setDangChay(true);
    try {
      const res = await fetch('/api/auth/zeni/phone/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: soDaGui, code: ma }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        setLoi(j?.error ?? 'Đăng nhập thất bại.');
        return;
      }
      router.replace(redirect);
      router.refresh();
    } catch {
      setLoi('Không kết nối được máy chủ. Thử lại giúp em.');
    } finally {
      setDangChay(false);
    }
  }

  const oNhap =
    'w-full bg-panel-2 border border-w-12 focus:border-gold focus:outline-none rounded px-4 py-3 text-ivory placeholder:text-ink-dim transition';
  const nhan = 'block font-mono uppercase text-2xs tracking-widest text-ink-2 mb-2';
  const nutChinh =
    'inline-flex w-full items-center justify-center gap-2 rounded bg-gold px-8 py-3 font-semibold text-bg transition hover:bg-gold-light disabled:cursor-not-allowed disabled:opacity-60';

  return (
    <>
      {loi && (
        <div
          role="alert"
          data-testid="loi-dang-nhap-sdt"
          className="mb-5 rounded border border-err/40 bg-err/10 px-4 py-3 text-sm text-err"
        >
          {loi}
        </div>
      )}

      {buoc === 'so' ? (
        <form onSubmit={xinMa} noValidate className="space-y-5">
          <div>
            <label htmlFor="sdt" className={nhan}>
              Số điện thoại
            </label>
            <input
              id="sdt"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="0901234567"
              autoFocus
              value={so}
              onChange={(e) => setSo(e.target.value)}
              className={oNhap}
            />
            <p className="mt-2 text-2xs text-ink-dim">
              Số di động Việt Nam. Zeni ID sẽ nhắn cho bạn một mã gồm 6 số.
            </p>
          </div>

          <button type="submit" disabled={dangChay || so.trim().length < 9} className={nutChinh}>
            {dangChay && <Loader2 className="animate-spin" size={18} />}
            {dangChay ? 'Đang gửi mã…' : 'Gửi mã xác thực'}
          </button>
        </form>
      ) : (
        <form onSubmit={dangNhap} noValidate className="space-y-5">
          <div>
            <label htmlFor="ma-otp" className={nhan}>
              Mã xác thực
            </label>
            <input
              id="ma-otp"
              ref={oMa}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="••••••"
              value={ma}
              onChange={(e) => setMa(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className={`${oNhap} text-center font-mono text-2xl tracking-[0.5em]`}
            />
            <p className="mt-2 text-2xs text-ink-dim">
              Đã nhắn tới <span className="text-ink-2">{cheSo(soDaGui)}</span> · mã sống 5 phút
            </p>
          </div>

          <button type="submit" disabled={dangChay || ma.length !== 6} className={nutChinh}>
            {dangChay && <Loader2 className="animate-spin" size={18} />}
            {dangChay ? 'Đang kiểm tra…' : 'Đăng nhập'}
          </button>

          <div className="flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => {
                setBuoc('so');
                setMa('');
                setLoi(null);
              }}
              className="text-ink-2 underline underline-offset-4 transition hover:text-ivory"
            >
              ← Đổi số khác
            </button>
            <button
              type="button"
              disabled={demNguoc > 0 || dangChay}
              onClick={() => xinMa()}
              className="text-gold-light underline underline-offset-4 transition hover:text-gold disabled:cursor-not-allowed disabled:text-ink-dim disabled:no-underline"
            >
              {demNguoc > 0 ? `Gửi lại sau ${demNguoc}s` : 'Gửi lại mã'}
            </button>
          </div>
        </form>
      )}

      <p className="mt-6 flex items-center justify-center gap-2 text-center text-2xs text-ink-dim">
        <Smartphone size={12} />
        Số điện thoại phải đã gắn với tài khoản Zeni ID của bạn.
      </p>
    </>
  );
}
