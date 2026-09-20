import type { Config } from 'tailwindcss'
import animatePlugin from 'tailwindcss-animate'

/** Màu đọc từ biến CSS, chừa chỗ cho Tailwind chèn độ mờ (`bg-panel/80`). */
const mau = (ten: string) => `rgb(var(--m-${ten}) / <alpha-value>)`;

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx,js,jsx,mdx}'],
  theme: {
    extend: {
      /**
       * MÀU LẤY TỪ BIẾN CSS — hai bộ sáng/tối HOÀN TOÀN ĐỘC LẬP.
       *
       * Chairman 20/09/2026: "giao diện sáng thì chỉ màu xanh và nền trắng
       * ngọc trai, 2 giao diện sáng tối độc lập để khi chuyển không bị lỗi màu
       * và hiệu ứng."
       *
       * Trước đây màu là mã cứng (#0E131D, #C9A84C…) nằm thẳng trong tệp này,
       * nên không thể có hai bộ: đổi chế độ là phải đổi từng lớp ở hàng trăm
       * chỗ, và chắc chắn sót. Nay mỗi màu trỏ tới một biến CSS; `globals.css`
       * khai HAI bộ giá trị cho cùng bộ tên biến đó. Đổi chế độ = đổi đúng một
       * thuộc tính trên thẻ <html>, mọi thứ theo sau.
       *
       * Vì sao ghi theo KÊNH `R G B` chứ không ghi `#rrggbb`: mã nguồn đang
       * dùng 105 chỗ kiểu `bg-panel/80`, `border-gold/40`. Tailwind chỉ chèn
       * được độ mờ vào khi giá trị có chỗ trống `<alpha-value>` — mà muốn vậy
       * thì biến phải là ba số kênh, không phải chuỗi màu.
       */
      colors: {
        bg: mau('nen'),
        'bg-2': mau('nen-2'),
        panel: { DEFAULT: mau('tam'), 2: mau('tam-2') },
        ink: {
          DEFAULT: mau('chu'),
          2: mau('chu-2'),
          dim: mau('chu-mo'),
          mute: mau('chu-nhat'),
        },
        ivory: mau('nga'),

        /** Điểm nhấn: vàng champagne ở chế độ tối, XANH ở chế độ sáng. */
        gold: { DEFAULT: mau('nhan'), light: mau('nhan-sang'), dark: mau('nhan-dam') },

        sapphire: { DEFAULT: mau('lam'), deep: mau('lam-sau'), light: mau('lam-nhat') },
        platinum: { DEFAULT: mau('bach-kim'), dim: mau('bach-kim-mo') },
        tech: { DEFAULT: mau('lam-ky-thuat'), dim: mau('lam-ky-thuat-mo') },

        layer: {
          1: mau('nhan'),
          2: mau('lam-ky-thuat'),
          3: mau('bach-kim'),
          4: mau('tot'),
          5: mau('canh'),
        },

        ok: mau('tot'),
        warn: mau('canh'),
        err: mau('loi'),

        /**
         * Lớp phủ đường viền. Ở chế độ tối là trắng mờ, ở chế độ sáng phải là
         * ĐEN mờ — để nguyên trắng thì viền biến mất hẳn trên nền ngọc trai.
         * Đây đúng là loại "lỗi màu khi chuyển chế độ" chairman nhắc tới.
         */
        w: {
          4: 'rgb(var(--m-phu) / 0.04)',
          6: 'rgb(var(--m-phu) / 0.06)',
          8: 'rgb(var(--m-phu) / 0.08)',
          12: 'rgb(var(--m-phu) / 0.12)',
          16: 'rgb(var(--m-phu) / 0.16)',
        },

        /**
         * @deprecated Tên cũ theo "luân xa" — dùng `sapphire`/`gold`/`tech` cho
         * chỗ mới. Giữ lại vì 8 tệp còn dùng; gỡ thẳng thì Tailwind lặng lẽ bỏ
         * qua lớp không khai và giao diện mất màu mà không báo gì.
         */
        chakra: {
          6: {
            DEFAULT: mau('lam-nhat'),
            deep: mau('lam-sau'),
            glow: mau('lam-ky-thuat'),
            light: mau('bach-kim'),
          },
          7: {
            DEFAULT: mau('nhan'),
            violet: mau('nhan-sang'),
            crown: mau('nga'),
            gold: mau('nhan-sang'),
          },
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
