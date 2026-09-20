import type { Config } from 'tailwindcss'
import animatePlugin from 'tailwindcss-animate'

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx,js,jsx,mdx}'],
  theme: {
    extend: {
      // ─────────────────────────────────────────────────────────────────
      // BẢNG MÀU "KIM KHỐ" — tài chính tư nhân × công nghệ (20/09/2026)
      //
      // Chairman: nền tảng phục vụ khách doanh nghiệp 100% nên phải đẳng cấp,
      // màu đúng kiểu tài chính và công nghệ của tương lai.
      //
      // Bản cũ chạy bảng màu "luân xa": xanh lá #22c55e, lơ #06b6d4, chàm
      // #6366f1, tím #a855f7 — bốn màu rực nằm cạnh nhau. Đó là bảng màu của
      // ứng dụng tiêu dùng, không phải của nơi người ta mở bảng cổ phần và số
      // liệu tài chính. Nay theo đúng lối phòng khách ngân hàng tư nhân:
      //
      //   · MỘT điểm nhấn xa xỉ  → vàng champagne. Dùng dè, chỉ cho thứ quan
      //     trọng nhất trên màn hình. Vàng mà rải khắp nơi thì hết sang.
      //   · Chiều sâu           → lam sapphire, thay cho tím/chàm.
      //   · Chữ phụ             → bạch kim (xám ngả lam), cảm giác kim loại.
      //   · Dữ liệu, liên kết   → MỘT tông lam kỹ thuật, sạch và lạnh.
      //   · Trạng thái          → giảm độ rực: bảng số liệu tài chính mà xanh
      //     đỏ neon thì nhìn như trò chơi.
      // ─────────────────────────────────────────────────────────────────
      colors: {
        bg: '#06070B',
        'bg-2': '#0A0D14',
        panel: { DEFAULT: '#0E131D', 2: '#141A26' },
        ink: { DEFAULT: '#E8ECF2', 2: '#A8B3C2', dim: '#6A7382', mute: '#484F5C' },
        ivory: '#F4F1EA',

        // Điểm nhấn xa xỉ duy nhất.
        gold: { DEFAULT: '#C9A84C', light: '#DFC584', dark: '#8B7834' },

        // Chiều sâu — thay cho chàm/tím.
        sapphire: { DEFAULT: '#1B3A5C', deep: '#102439', light: '#2E5C8A' },

        // Kim loại — chữ phụ, đường viền nhấn.
        platinum: { DEFAULT: '#9AAAB8', dim: '#6E7C8A' },

        // Lam kỹ thuật — dữ liệu, liên kết, trạng thái đang chạy.
        tech: { DEFAULT: '#5B9BD5', dim: '#3E6E99' },

        // Tầng thông tin: bốn tông cùng họ, không còn cầu vồng.
        layer: { 1: '#C9A84C', 2: '#5B9BD5', 3: '#9AAAB8', 4: '#57C48F', 5: '#DDB05C' },

        /**
         * @deprecated Tên cũ theo "luân xa". KHÔNG dùng cho chỗ mới — hãy dùng
         * `sapphire` / `gold` / `tech`.
         * Vẫn giữ vì 8 tệp đang dùng lớp `chakra-6` / `chakra-7`; gỡ thẳng thì
         * Tailwind lặng lẽ bỏ qua lớp không khai và giao diện mất màu mà không
         * báo gì. Nay trỏ sang bảng màu mới nên những chỗ đó tự đổi theo.
         */
        chakra: {
          6: {
            DEFAULT: '#2E5C8A', // sapphire.light
            deep: '#102439',
            glow: '#5B9BD5',
            light: '#9AAAB8',
          },
          7: {
            DEFAULT: '#C9A84C', // gold
            violet: '#DFC584',
            crown: '#F4F1EA',
            gold: '#DFC584',
          },
        },

        // Trạng thái — đã giảm rực cho hợp bảng số liệu.
        ok: '#57C48F',
        warn: '#DDB05C',
        err: '#DC8080',

        w: {
          4: 'rgba(255,255,255,.04)',
          6: 'rgba(255,255,255,.06)',
          8: 'rgba(255,255,255,.08)',
          12: 'rgba(255,255,255,.12)',
          16: 'rgba(255,255,255,.16)',
        },
      },
      // MỘT PHÔNG DUY NHẤT: Noto Sans (lệnh chairman 20/09/2026).
      // Giữ nguyên bốn tên khoá vì hàng trăm chỗ đang dùng `font-display`,
      // `font-serif`, `font-mono` — đổi tên khoá là phải sửa hết, đổi GIÁ TRỊ
      // thì một chỗ là xong. Chúng nay chỉ còn khác nhau ở độ đậm/khoảng chữ.
      fontFamily: {
        display: ['"Noto Sans"', 'system-ui', 'sans-serif'],
        serif: ['"Noto Sans"', 'system-ui', 'sans-serif'],
        sans: ['"Noto Sans"', 'system-ui', 'sans-serif'],
        mono: ['"Noto Sans"', 'system-ui', 'sans-serif'],
      },
      fontSize: { '2xs': ['0.68rem', { lineHeight: '1.2' }] },
      letterSpacing: { widest: '0.25em', 'wider-plus': '0.3em' },
      borderRadius: { DEFAULT: '4px', card: '6px' },
      spacing: { navW: '240px', topH: '64px' },
      transitionTimingFunction: { ease: 'cubic-bezier(0.22, 1, 0.36, 1)' },
      keyframes: {
        drift: {
          from: { transform: 'translate(0,0)' },
          to: { transform: 'translate(-400px,-400px)' },
        },
        pulseSoft: { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.4' } },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(30px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        // Chakra cosmic motion — gentle / nhẹ nhàng
        aurora: {
          '0%,100%': {
            transform: 'translate3d(0,0,0) scale(1)',
            'background-position': '0% 50%',
          },
          '50%': {
            transform: 'translate3d(2%, -1%, 0) scale(1.04)',
            'background-position': '100% 50%',
          },
        },
        'glow-pulse': {
          '0%,100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
        orbit: {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
        breathe: {
          '0%,100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.03)' },
        },
      },
      animation: {
        drift: 'drift 200s linear infinite',
        'pulse-soft': 'pulseSoft 2s infinite',
        'fade-up': 'fade-up 0.8s ease-out',
        aurora: 'aurora 20s ease-in-out infinite',
        'glow-pulse': 'glow-pulse 4s ease-in-out infinite',
        orbit: 'orbit 60s linear infinite',
        breathe: 'breathe 6s ease-in-out infinite',
      },
    },
  },
  plugins: [animatePlugin],
}
export default config
