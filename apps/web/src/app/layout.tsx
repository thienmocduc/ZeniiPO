import type { Metadata, Viewport } from 'next';
import { Noto_Sans } from 'next/font/google';
import './globals.css';
import { getCss } from '@/lib/v1/extract';
import { CosmosBg } from '@/components/cosmos-bg';
import { MA_CHONG_CHOP } from '@/lib/zeni/che-do';

/**
 * MỘT PHÔNG DUY NHẤT CHO CẢ SẢN PHẨM — Noto Sans (lệnh chairman 20/09/2026).
 *
 * Trước đây nạp bốn họ chữ: Fraunces, Cormorant Garamond, Noto Sans,
 * JetBrains Mono. Ba cái đầu tiên ngoài việc làm giao diện lộn xộn còn bắt
 * người dùng tải thêm ba bộ phông — chậm trang mà chẳng để làm gì.
 *
 * Bốn biến CSS được giữ nguyên tên (`--font-display`, `--font-serif`,
 * `--font-mono`) vì hàng trăm chỗ trong mã đang dùng; nay tất cả cùng trỏ vào
 * Noto Sans. Chữ số thẳng hàng nhờ `tabular-nums` khai ở globals.css, không
 * cần phông monospace nữa.
 *
 * Noto Sans có bộ chữ Việt đầy đủ (`subsets` có 'vietnamese') — dấu mũ, dấu
 * móc, dấu thanh hiển thị đúng, không bị thay thế bằng phông dự phòng.
 */
const notoSans = Noto_Sans({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-sans',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700', '800', '900'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://zenicloud.io'),
  title: 'Zeniipo · IPO Journey Platform · Từ Day-0 đến ring-bell SGX 2031',
  description:
    'Nền tảng điều hành IPO dành cho founder Việt Nam và Đông Nam Á. Cascade tư tưởng từ Chairman xuống 12 tầng, 108 AI agent, 44 module, 420 bước — đi thẳng từ Day-0 đến ring-bell SGX 2031.',
  keywords: [
    'IPO',
    'Chairman',
    'OKR Cascade',
    'Cap Table',
    'Fundraise',
    'SGX',
    'Vietnam startup',
    'Zeni',
    'Zeniipo',
  ],
  authors: [{ name: 'Zeni Digital' }],
  openGraph: {
    title: 'Zeniipo · IPO Journey Platform',
    description:
      'Từ Day-0 tư tưởng đến ring-bell SGX 2031 — 10 phase, 44 module, 108 agent, 420 step.',
    url: 'https://zenicloud.io',
    siteName: 'Zeniipo',
    locale: 'vi_VN',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Zeniipo · IPO Journey Platform',
    description:
      'Từ Day-0 tư tưởng đến ring-bell SGX 2031. Chairman Cascade Engine + 108 AI Agent Legion.',
  },
  icons: {
    icon: [
      {
        url:
          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='15' fill='%23E4C16E'/%3E%3Ctext x='16' y='22' font-family='serif' font-weight='700' font-size='18' text-anchor='middle' fill='%2305070C'%3EZ%3C/text%3E%3C/svg%3E",
        type: 'image/svg+xml',
      },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Zeniipo',
  },
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#05070C' },
    { media: '(prefers-color-scheme: light)', color: '#05070C' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Load the v1_8_FULL <style> block and inject into <head> so every page
  // renders with the chairman's authoritative design system.
  const v1Css = getCss();

  return (
    <html
      lang="vi"
      className={notoSans.variable}
    >
      <head>
        {/*
          Đặt chế độ sáng/tối TRƯỚC khi trang vẽ. Không có đoạn này thì trang
          luôn vẽ bằng chế độ tối rồi mới nhảy sang sáng — người dùng thấy một
          cái chớp mỗi lần mở trang. Phải chạy đồng bộ và đứng trước mọi thứ.
        */}
        <script dangerouslySetInnerHTML={{ __html: MA_CHONG_CHOP }} />
        {/* v1_8_FULL.html CSS — byte-for-byte inherited */}
        <style dangerouslySetInnerHTML={{ __html: v1Css }} />
      </head>
      <body>
        <CosmosBg />
        {children}
      </body>
    </html>
  );
}
