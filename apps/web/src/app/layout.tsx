import type { Metadata, Viewport } from 'next';
import { Fraunces, Cormorant_Garamond, Noto_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { getCss } from '@/lib/v1/extract';
import { CosmosBg } from '@/components/cosmos-bg';

const fraunces = Fraunces({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-display',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800', '900'],
});

const cormorant = Cormorant_Garamond({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-serif',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
});

const notoSans = Noto_Sans({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-sans',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700', '800'],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-mono',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://zeniipo.com'),
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
    url: 'https://zeniipo.com',
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
};

export const viewport: Viewport = {
  themeColor: '#05070C',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
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
      className={`${fraunces.variable} ${cormorant.variable} ${notoSans.variable} ${jetbrainsMono.variable}`}
    >
      <head>
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
