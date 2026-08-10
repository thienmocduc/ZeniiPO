/**
 * CHẾ ĐỘ TÀI KHOẢN ADMIN (lệnh chairman 2026-08-10): nhận diện chủ nền tảng theo
 * EMAIL Zeni ID → đăng nhập được và nhìn/điều hành MỌI tenant của hệ sinh thái
 * Zeni Holdings, không cần membership từng workspace.
 * Port pattern từ zenios/src/lib/zeni/superadmin.ts (Constitution Đ6).
 */
import { getSessionUser } from './session';

export const SUPER_ADMIN_EMAILS = new Set(
  (process.env.ZENI_SUPER_ADMIN_EMAILS ??
    'doanhnhancaotuan@gmail.com,caotuanphat581@gmail.com,cto@zeniipo.com,ceo@zeniipo.com,admin@zenidigital.com,wellnexusvn@gmail.com')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
);

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  return !!email && SUPER_ADMIN_EMAILS.has(email.toLowerCase());
}

export const isCurrentSuperAdmin = async (): Promise<boolean> => {
  const user = await getSessionUser();
  return isSuperAdminEmail(user?.email);
};
