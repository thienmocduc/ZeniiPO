import type { ReactNode } from 'react';

/**
 * Khung các màn hình xác thực — một thẻ ở giữa màn hình.
 *
 * LỖI ĐÃ SỬA (20/09/2026): bản cũ dùng `items-center` kèm `overflow-hidden`.
 * Khi thẻ cao hơn màn hình (màn hình đăng nhập có thêm nút, hoặc máy có cửa sổ
 * thấp), phần trên bị đẩy ra ngoài vùng nhìn thấy VÀ `overflow-hidden` chặn
 * luôn việc cuộn lên — người dùng mất hẳn tiêu đề, không cách nào với tới.
 *
 * Cách đúng: `my-auto` — còn chỗ thì căn giữa, hết chỗ thì cư xử như lề bình
 * thường và trang cuộn được. Không chặn cuộn dọc ở khung ngoài.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="relative flex min-h-screen w-full justify-center overflow-x-hidden px-4 py-8">
      <div className="z-10 my-auto w-full max-w-[420px]">{children}</div>
    </main>
  );
}
