import Link from 'next/link';
import { ArrowRight, Check, X } from 'lucide-react';
import { FaqItem } from '@/components/landing/faq-item';

// ————————————————————————————————————————————————————————
// Data
// ————————————————————————————————————————————————————————

const navLinks = [
  { href: '#problem', label: 'Vấn đề' },
  { href: '#features', label: 'Tính năng' },
  { href: '#cascade', label: 'Cascade' },
  { href: '#academy', label: 'Academy' },
  { href: '#pricing', label: 'Giá' },
  { href: '#faq', label: 'FAQ' },
];

const statsProof = [
  { n: '10', label: 'phase' },
  { n: '44', label: 'module' },
  { n: '108', label: 'agent' },
  { n: '420', label: 'step' },
  { n: '2', label: 'ngôn ngữ VN/EN' },
];

const problems = [
  'Cap Table nằm trong file Excel, mỗi round gọi vốn lại sai số',
  'OKR rời rạc — team nói một hướng, Chairman nói một hướng khác',
  'Data Room là Google Drive share link, nhà đầu tư đọc xong không biết ai còn giữ',
  'Pitch deck cũ 6 tháng, số liệu không khớp với báo cáo tài chính',
  'IPO Readiness không đo được — chỉ "cảm thấy sẵn sàng"',
  'Compliance deadline quên cho đến lúc Sở Giao dịch gửi công văn',
];

const solutions = [
  'Cap Table on-chain — mỗi cổ đông, mỗi vesting, mỗi option đều có hash',
  'OKR cascade 12 tầng — tư tưởng Chairman chảy xuống tận từng junior',
  'Data Room scoped theo NDA — ai xem gì, khi nào, export nào đều log',
  'Financial Model sync real-time với ERP, kế toán, payroll — 1 nguồn số',
  'IPO Readiness Scorecard 20 tiêu chí — điểm số thật, cảnh báo thật',
  'Compliance auto-alert — SGX, HOSE, HNX, UPCOM đều lên lịch sẵn',
];

type Feature = {
  num: string;
  color: string; // border color hex
  title: string;
  desc: string;
  bullets: string[];
};

const features: Feature[] = [
  {
    num: '01',
    color: '#E4C16E',
    title: 'Chairman Cascade Engine',
    desc: 'Tư tưởng Chairman không còn mắc kẹt trong đầu. Một input duy nhất — tầm nhìn, giá trị cốt lõi, đường biên đạo đức — cascade xuống 12 tầng OODA: từ Holding → BU → Product → Squad → từng cá nhân.',
    bullets: [
      '12 tầng OODA (Observe · Orient · Decide · Act) tự động đồng bộ',
      'Mọi quyết định dưới tầng đều mapping ngược về tư tưởng gốc',
      'Deviation detector — phát hiện team đi lệch hướng trong 24h',
      'Chairman Weekly Brief — AI tóm tắt 7 ngày cascade qua email',
    ],
  },
  {
    num: '02',
    color: '#a855f7',
    title: '108 Agent Legion',
    desc: 'Đội quân 108 AI agent chuyên biệt — mỗi agent một vai trò, được huấn luyện trên nghiệp vụ IPO thực tế. Không phải chatbot — là đồng nghiệp làm việc 24/7.',
    bullets: [
      'CFO-agent, General Counsel-agent, IR-agent, HR-agent… đủ C-level',
      'Tự động sinh Board Memo, Audit Trail, Due Diligence package',
      'Multi-agent hội thoại — 5 agent cùng review một deal',
      'Huấn luyện được — inject SOP công ty trong 48h',
    ],
  },
  {
    num: '03',
    color: '#06b6d4',
    title: 'Fundraise Pipeline',
    desc: 'Pipeline 8 stage từ Target List → Term Sheet → Close. Mỗi investor có scorecard, mỗi stage có checklist, mỗi email có template. Không còn quên follow-up.',
    bullets: [
      '8 stage: Target · Intro · First Meet · Diligence · LOI · TS · SPA · Close',
      'Investor scorecard — fit strategic × fit financial × speed × control',
      'Auto-reminder theo stage — không deal nào rơi quá 14 ngày',
      'Data Room permission scoped — mỗi investor một view riêng',
    ],
  },
  {
    num: '04',
    color: '#4ade80',
    title: 'IPO Readiness Scorecard',
    desc: '20 tiêu chí chấm điểm sẵn sàng IPO — từ SGX Mainboard, Catalist, HOSE, HNX. Thay vì "cảm thấy" sẵn sàng, bạn thấy con số 67/100 và biết phải làm 33 việc gì.',
    bullets: [
      '20 tiêu chí: financial, legal, governance, ESG, operational',
      'Benchmark với 40+ case study IPO thành công / thất bại',
      'Gap analysis tự động — xuất action plan 12 tháng',
      'Audit-ready snapshot — PCAOB, SOX, IFRS đều export được',
    ],
  },
  {
    num: '05',
    color: '#fb923c',
    title: 'Financial Model Monte Carlo',
    desc: 'Mô hình tài chính 5 năm chạy 1.000 kịch bản Monte Carlo. Bạn biết xác suất đạt revenue target, xác suất burn rate vượt ngưỡng, xác suất cần round kế.',
    bullets: [
      '1.000 simulation — không phải 3 kịch bản base/bull/bear',
      'Sensitivity analysis — CAC, LTV, churn, gross margin',
      'Runway radar — cảnh báo trước 6 tháng nếu cần gọi vốn',
      'Tích hợp kế toán VN (VAS) + chuẩn IFRS song song',
    ],
  },
  {
    num: '06',
    color: '#ec4899',
    title: 'Academy Handbook + Drills',
    desc: 'Học viện nội bộ song ngữ Việt–Anh. 200+ bài handbook, 80+ drill mô phỏng tình huống thật — từ đàm phán term sheet tới trả lời nhà báo sau tin đồn xấu.',
    bullets: [
      '200 bài handbook — IPO, M&A, governance, crisis PR',
      '80 drill — roleplay với AI đóng vai VC, phóng viên, regulator',
      'Song ngữ 100% — mọi bài đều có bản VN và EN đối chiếu',
      'Certificate nội bộ — track năng lực từng nhân sự',
    ],
  },
];

const cascadeTiers = [
  {
    tier: 'Tier 1 · Chairman',
    role: 'Observe',
    body: 'Chairman quan sát thị trường, đối thủ, vĩ mô. Input 1 tầm nhìn + 3 giá trị cốt lõi. Mọi thứ bên dưới cascade từ đây.',
  },
  {
    tier: 'Tier 2 · CEO / C-level',
    role: 'Orient',
    body: 'C-level định hướng chiến lược 12 tháng. Mapping từng OKR về đúng giá trị cốt lõi Chairman. Reject nếu lệch.',
  },
  {
    tier: 'Tier 3 · BU Head / VP',
    role: 'Decide',
    body: 'Quyết định cụ thể theo quý — ngân sách, ưu tiên, người chịu trách nhiệm. Mỗi quyết định có hash mapping ngược lên Tier 2.',
  },
  {
    tier: 'Tier 4 · Manager / Squad',
    role: 'Act',
    body: 'Team execute hằng ngày. Mọi action đều tag vào quyết định Tier 3 đã phê duyệt. Deviation > 10% auto-escalate.',
  },
];

type Plan = {
  name: string;
  tagline: string;
  price: string;
  vnd: string;
  highlighted?: boolean;
  bullets: string[];
  cta: string;
  href: string;
};

const plans: Plan[] = [
  {
    name: 'Trải nghiệm',
    tagline: 'Dùng thử trước khi mua',
    price: '$0',
    vnd: '0đ / tháng',
    bullets: [
      '14 ngày đầy đủ tính năng',
      'Không cần thẻ tín dụng',
      '1 công ty, 3 nhân sự',
      'Cascade Engine đọc-only',
      'Community Discord',
    ],
    cta: 'Bắt đầu miễn phí',
    href: '/signup?plan=free',
  },
  {
    name: 'Explorer',
    tagline: 'Solo founder & pre-seed',
    price: '$49',
    vnd: '~1.250.000đ / tháng',
    bullets: [
      '1 công ty, 10 nhân sự',
      'Cap Table on-chain',
      'Fundraise Pipeline 8 stage',
      'Academy 50 bài handbook',
      'Email support 48h',
    ],
    cta: 'Chọn Explorer',
    href: '/signup?plan=explorer',
  },
  {
    name: 'Pro',
    tagline: 'Seed đến Series A',
    price: '$499',
    vnd: '~12.500.000đ / tháng',
    highlighted: true,
    bullets: [
      '3 công ty, 50 nhân sự',
      'Chairman Cascade 12 tier đầy đủ',
      '20 AI agent trong Legion',
      'Data Room scoped permission',
      'Slack / Teams integration',
    ],
    cta: 'Chọn Pro',
    href: '/signup?plan=pro',
  },
  {
    name: 'Elite',
    tagline: 'Series B trở lên',
    price: '$1.999',
    vnd: '~50.000.000đ / tháng',
    bullets: [
      '10 công ty, 300 nhân sự',
      '108 AI Agent Legion đầy đủ',
      'IPO Readiness Scorecard',
      'Financial Model Monte Carlo',
      'Dedicated CSM · phản hồi 4h',
    ],
    cta: 'Chọn Elite',
    href: '/signup?plan=elite',
  },
  {
    name: 'Enterprise',
    tagline: 'Tập đoàn & Holding',
    price: '$4.999+',
    vnd: 'từ 125.000.000đ / tháng',
    bullets: [
      'Unlimited công ty & nhân sự',
      'On-prem hoặc private cloud VN',
      'Custom agent training (SOP nội bộ)',
      'SOC2 · ISO 27001 · VN PDPA',
      '24/7 war-room IPO support',
    ],
    cta: 'Liên hệ sales',
    href: '/contact?plan=enterprise',
  },
];

const testimonials = [
  {
    quote:
      '"Trước Zeniipo, mỗi board meeting tôi đều hồi hộp vì số liệu Cap Table khác bản tôi nhớ. Giờ mọi thứ on-chain, hash so khớp, C-level không còn cãi nhau về pha loãng."',
    name: 'Thiên Mộc Đức',
    role: 'Chairman · ANIMA Care',
  },
  {
    quote:
      '"Financial Model chạy Monte Carlo 1.000 lần cho tôi biết trước 6 tháng là phải gọi Series B — thay vì phát hiện ra trong tháng hết tiền. Một tính năng này đã đáng giá 1 năm subscription."',
    name: 'Nguyễn Huy Long',
    role: 'CFO · Biotea84',
  },
  {
    quote:
      '"108 agent không thay được team, nhưng 80% công việc giấy tờ cho Due Diligence đã được agent làm nháp xong. Team chỉ review và chốt. Chúng tôi close Series A sớm hơn 3 tháng."',
    name: 'Lê Minh Tuấn',
    role: 'CEO · VietStart.io',
  },
];

const faqs = [
  {
    q: 'Zeniipo khác gì Notion hay Carta?',
    a: 'Notion là trang trắng cho bạn tự xây. Carta là Cap Table + Fund Admin. Zeniipo là hệ điều hành IPO — mang tư tưởng Chairman xuống cascade 12 tầng, 108 agent làm việc 24/7, Financial Model Monte Carlo, IPO Readiness Scorecard, Academy song ngữ. Đây là sản phẩm hợp nhất, không phải bộ Lego bạn phải tự ráp.',
  },
  {
    q: 'Sản phẩm có hoàn toàn tiếng Việt không?',
    a: 'Có — 100% song ngữ Việt–Anh ngang cấp. UI, handbook, drill, email template, legal clause đều có bản VN chuẩn pháp lý (VAS, Luật Doanh nghiệp VN, Luật Chứng khoán VN) song song với bản EN (IFRS, Delaware corp law, SGX listing rule). Chairman Việt viết tiếng Việt, nhà đầu tư Singapore đọc tiếng Anh — cùng một data.',
  },
  {
    q: 'Bảo mật dữ liệu tài chính nhạy cảm?',
    a: 'Zeniipo chạy trên AWS Singapore + on-prem tùy chọn cho Enterprise. Mọi truy cập đều có audit log bất biến (append-only, hash chain). Chứng chỉ SOC2 Type II, đang trên lộ trình ISO 27001 (Q4 2026). Tuân thủ Nghị định 13/2023 của VN về bảo vệ dữ liệu cá nhân. Data Room có scoped NDA — mỗi investor chỉ thấy đúng folder được cấp quyền.',
  },
  {
    q: 'Export data ra được không? Lock-in không?',
    a: 'Hoàn toàn không lock-in. Cap Table export CSV + hash verify độc lập. Financial Model export Excel (.xlsx) đầy đủ formula. Data Room zip toàn bộ kèm audit trail. Nếu bạn quyết định rời Zeniipo, chúng tôi cam kết export đầy đủ trong 7 ngày làm việc — đây là điều khoản chuẩn trong MSA.',
  },
  {
    q: 'Có tích hợp với ERP, kế toán, ngân hàng không?',
    a: 'Pro trở lên tích hợp sẵn với MISA, FAST, Bravo, Odoo, SAP B1 (VN). Tier Elite/Enterprise có connector với VCB, TCB, BIDV cho cash position real-time. API REST + Webhook đầy đủ. Custom integration trong 4 tuần cho Enterprise có team tech riêng.',
  },
  {
    q: 'Chairman có phải là founder? Tôi là co-founder thì dùng được không?',
    a: 'Chairman trong Zeniipo là vai trò hệ thống — người set tầm nhìn + giá trị cốt lõi cho tổ chức. Founder solo thì Chairman = bạn. Co-founder team thì một người giữ vai Chairman (thường là CEO), những người còn lại ở tier C-level. Cascade Engine không quan tâm title pháp lý — chỉ quan tâm ai đang set hướng.',
  },
];

// ————————————————————————————————————————————————————————
// Page
// ————————————————————————————————————————————————————————

export default function Home() {
  return (
    <>
      {/* ——— Nav ——— */}
      <header className="fixed top-0 inset-x-0 z-50 backdrop-blur-md bg-bg/70 border-b border-w-6">
        <nav
          aria-label="Chính"
          className="max-w-[1400px] mx-auto flex items-center justify-between px-6 md:px-10 h-16"
        >
          <Link href="/" className="font-display text-2xl font-bold tracking-tight">
            Zeni <span className="font-serif italic text-gold-light">iPO</span>
          </Link>
          <ul className="hidden lg:flex items-center gap-8 text-sm text-ink-2">
            {navLinks.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  className="hover:text-gold-light transition-colors"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm text-ink-2 hover:text-ink transition-colors px-3 py-2 rounded hover:ring-1 hover:ring-chakra-6-glow/50 hover:shadow-[0_0_16px_rgba(99,102,241,0.25)]"
            >
              Đăng nhập
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 bg-gold-light text-bg font-medium text-sm px-4 py-2 rounded hover:bg-gold transition-all hover:shadow-[0_0_20px_rgba(99,102,241,0.35)]"
            >
              Dùng thử 14 ngày
              <ArrowRight size={16} />
            </Link>
          </div>
        </nav>
      </header>

      <main className="relative pt-16">
        {/* ——— Hero ——— */}
        <section
          aria-label="Giới thiệu"
          className="relative max-w-[1400px] mx-auto px-6 md:px-10 pt-20 md:pt-32 pb-16 md:pb-24"
        >
          <div className="inline-flex items-center gap-2 text-2xs font-mono uppercase tracking-widest text-gold-light border border-gold/30 rounded-full px-4 py-1.5 mb-8 bg-gold/5">
            <span className="w-2 h-2 rounded-full bg-gold-light animate-pulse-soft" />
            Ra mắt Beta · Apr 2026
          </div>

          <h1 className="hero-h1 font-display font-semibold text-ivory max-w-5xl text-balance">
            Từ Day-0{' '}
            <span className="font-serif italic text-gold-light font-normal">
              tư tưởng
            </span>{' '}
            đến ring-bell{' '}
            <span className="cosmic-gradient-text font-display">SGX 2031</span>.
          </h1>

          <p className="mt-8 max-w-2xl text-lg md:text-xl text-ink-2 leading-relaxed">
            Nền tảng điều hành IPO dành cho founder Việt Nam và Đông Nam Á. Zeniipo
            cascade tư tưởng Chairman xuống 12 tầng, triển khai 108 AI agent 24/7,
            đi thẳng từ Day-0 tới ring-bell — không cần ghép 20 công cụ rời rạc.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 bg-gold-light text-bg font-semibold text-base px-6 py-3.5 rounded hover:bg-gold transition-all hover:shadow-[0_10px_32px_rgba(99,102,241,0.35)]"
            >
              Dùng thử 14 ngày miễn phí
              <ArrowRight size={18} />
            </Link>
            <a
              href="#features"
              className="inline-flex items-center gap-2 border border-w-16 text-ink text-base px-6 py-3.5 rounded hover:border-chakra-6-glow hover:text-chakra-7-violet transition-colors"
            >
              Xem tính năng
            </a>
          </div>

          {/* Proof stats row */}
          <dl className="mt-16 grid grid-cols-2 md:grid-cols-5 gap-6 md:gap-4 border-t border-w-6 pt-10 max-w-4xl">
            {statsProof.map((s) => (
              <div key={s.label}>
                <dt className="font-mono text-2xs uppercase tracking-widest text-ink-dim">
                  {s.label}
                </dt>
                <dd className="mt-1 font-display text-3xl md:text-4xl font-semibold text-ivory">
                  {s.n}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ——— Problem / Solution ——— */}
        <section
          id="problem"
          aria-labelledby="problem-h"
          className="max-w-[1400px] mx-auto px-6 md:px-10 py-20 md:py-[120px] border-t border-w-6"
        >
          <div className="text-center mb-16">
            <p className="font-mono text-2xs uppercase tracking-widest text-gold-light">
              Vấn đề · Giải pháp
            </p>
            <h2
              id="problem-h"
              className="mt-4 font-display text-4xl md:text-5xl font-semibold text-ivory max-w-3xl mx-auto text-balance"
            >
              Founder Việt đang mắc kẹt giữa Excel, Notion và PowerPoint.
            </h2>
            <p className="mt-5 text-ink-2 max-w-2xl mx-auto">
              20 công cụ rời rạc, mỗi cái một nguồn dữ liệu, mỗi board meeting là một
              trận tranh cãi về con số. Zeniipo thay bằng một input duy nhất.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 md:gap-8">
            {/* Problem */}
            <div className="bg-gradient-to-br from-panel to-panel-2 border-l-[3px] border-err rounded-card p-8">
              <p className="font-mono text-2xs uppercase tracking-widest text-err mb-5">
                Hiện trạng
              </p>
              <h3 className="font-display text-2xl text-ivory mb-6">
                Excel / Notion / PowerPoint chaos
              </h3>
              <ul className="space-y-4">
                {problems.map((p, i) => (
                  <li key={i} className="flex gap-3 text-ink-2">
                    <X
                      size={20}
                      className="flex-shrink-0 mt-0.5 text-err"
                      strokeWidth={2.5}
                    />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Solution */}
            <div className="bg-gradient-to-br from-panel to-panel-2 border-l-[3px] border-ok rounded-card p-8">
              <p className="font-mono text-2xs uppercase tracking-widest text-ok mb-5">
                Với Zeniipo
              </p>
              <h3 className="font-display text-2xl text-ivory mb-6">
                Một input Chairman · cascade tất cả
              </h3>
              <ul className="space-y-4">
                {solutions.map((s, i) => (
                  <li key={i} className="flex gap-3 text-ink-2">
                    <Check
                      size={20}
                      className="flex-shrink-0 mt-0.5 text-ok"
                      strokeWidth={2.5}
                    />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ——— Features ——— */}
        <section
          id="features"
          aria-labelledby="features-h"
          className="max-w-[1400px] mx-auto px-6 md:px-10 py-20 md:py-[120px] border-t border-w-6"
        >
          <div className="text-center mb-16">
            <p className="font-mono text-2xs uppercase tracking-widest text-gold-light">
              Tính năng cốt lõi
            </p>
            <h2
              id="features-h"
              className="mt-4 font-display text-4xl md:text-5xl font-semibold text-ivory max-w-3xl mx-auto text-balance"
            >
              Sáu module, một hệ điều hành.
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <article
                key={f.num}
                className="group bg-gradient-to-br from-panel to-panel-2 rounded-card p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_60px_-20px_rgba(228,193,110,0.25)]"
                style={{ borderTop: `3px solid ${f.color}` }}
              >
                <div
                  className="font-serif italic text-6xl font-light mb-4 leading-none"
                  style={{ color: f.color }}
                >
                  {f.num}
                </div>
                <h3 className="font-display text-2xl font-semibold text-ivory mb-3">
                  {f.title}
                </h3>
                <p className="text-ink-2 leading-relaxed mb-6">{f.desc}</p>
                <ul className="space-y-2.5">
                  {f.bullets.map((b, i) => (
                    <li key={i} className="flex gap-2.5 text-sm text-ink-2">
                      <Check
                        size={16}
                        className="flex-shrink-0 mt-1 text-gold-light"
                        strokeWidth={2.5}
                      />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          {/* ——— Cascade Demo ——— */}
          <div
            id="cascade"
            aria-labelledby="cascade-h"
            className="mt-24 md:mt-32 scroll-mt-20"
          >
            <div className="text-center mb-12">
              <p className="font-mono text-2xs uppercase tracking-widest text-gold-light">
                Cascade Engine · Demo
              </p>
              <h3
                id="cascade-h"
                className="mt-4 font-display text-3xl md:text-4xl font-semibold text-ivory max-w-3xl mx-auto text-balance"
              >
                Từ tư tưởng Chairman xuống từng squad — qua 4 tầng OODA đầu tiên.
              </h3>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
              {cascadeTiers.map((t, i) => (
                <div
                  key={t.tier}
                  className="relative bg-gradient-to-br from-panel to-panel-2 border border-w-8 rounded-card p-6 hover:border-gold/40 transition-colors"
                >
                  <div className="font-mono text-2xs uppercase tracking-widest text-gold-light">
                    {t.tier}
                  </div>
                  <div className="mt-2 font-serif italic text-3xl text-ivory">
                    {t.role}
                  </div>
                  <p className="mt-3 text-sm text-ink-2 leading-relaxed">{t.body}</p>
                  {i < cascadeTiers.length - 1 && (
                    <div className="hidden lg:block absolute top-1/2 -right-3 w-4 h-px bg-gold/40" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ——— Academy anchor (placeholder before pricing) ——— */}
        <section
          id="academy"
          aria-labelledby="academy-h"
          className="max-w-[1400px] mx-auto px-6 md:px-10 py-20 md:py-[120px] border-t border-w-6"
        >
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <p className="font-mono text-2xs uppercase tracking-widest text-gold-light">
                Zeniipo Academy
              </p>
              <h2
                id="academy-h"
                className="mt-4 font-display text-4xl md:text-5xl font-semibold text-ivory text-balance"
              >
                Học viện nội bộ song ngữ.{' '}
                <span className="font-serif italic text-gold-light font-normal">
                  Không cần thuê tư vấn bên ngoài.
                </span>
              </h2>
              <p className="mt-6 text-ink-2 text-lg leading-relaxed">
                200 bài handbook IPO, 80 drill roleplay với AI đóng vai VC, phóng
                viên, regulator. Bạn train đội ngũ nội bộ đủ tiêu chuẩn Singapore,
                không phải bay qua dự workshop 5.000 USD/người.
              </p>
              <div className="mt-8 flex gap-4">
                <a
                  href="#pricing"
                  className="inline-flex items-center gap-2 border border-w-16 text-ink px-5 py-3 rounded hover:border-gold-light hover:text-gold-light transition-colors"
                >
                  Xem gói có Academy
                </a>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { n: '200', l: 'handbook bài' },
                { n: '80', l: 'drill roleplay' },
                { n: '100%', l: 'song ngữ VN-EN' },
                { n: '12', l: 'chuyên đề IPO' },
              ].map((s) => (
                <div
                  key={s.l}
                  className="bg-gradient-to-br from-panel to-panel-2 border border-w-6 rounded-card p-6"
                >
                  <div className="font-display text-4xl md:text-5xl font-semibold text-gold-light">
                    {s.n}
                  </div>
                  <div className="mt-1 font-mono text-2xs uppercase tracking-widest text-ink-dim">
                    {s.l}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ——— Pricing ——— */}
        <section
          id="pricing"
          aria-labelledby="pricing-h"
          className="max-w-[1400px] mx-auto px-6 md:px-10 py-20 md:py-[120px] border-t border-w-6"
        >
          <div className="text-center mb-16">
            <p className="font-mono text-2xs uppercase tracking-widest text-gold-light">
              Giá
            </p>
            <h2
              id="pricing-h"
              className="mt-4 font-display text-4xl md:text-5xl font-semibold text-ivory max-w-3xl mx-auto text-balance"
            >
              Năm cấp độ · từ solo founder đến holding tập đoàn.
            </h2>
            <p className="mt-5 text-ink-2 max-w-2xl mx-auto">
              Dùng thử 14 ngày đầy đủ tính năng · không cần thẻ tín dụng · hủy bất
              cứ lúc nào.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-5">
            {plans.map((p) => (
              <div
                key={p.name}
                className={`relative flex flex-col rounded-card p-7 transition-all duration-300 ${
                  p.highlighted
                    ? 'bg-gradient-to-br from-gold/10 to-panel-2 border-2 border-gold-light lg:-translate-y-2'
                    : 'bg-gradient-to-br from-panel to-panel-2 border border-w-8 hover:border-w-16'
                }`}
              >
                {p.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gold-light text-bg font-mono text-2xs uppercase tracking-widest font-bold px-3 py-1 rounded">
                    Phổ biến nhất
                  </div>
                )}
                <div className="font-display text-xl font-semibold text-ivory">
                  {p.name}
                </div>
                <div className="mt-1 text-sm text-ink-dim min-h-[2.5rem]">
                  {p.tagline}
                </div>
                <div className="mt-5">
                  <div className="font-display text-4xl font-semibold text-gold-light">
                    {p.price}
                  </div>
                  <div className="mt-1 font-mono text-2xs uppercase tracking-widest text-ink-dim">
                    {p.vnd}
                  </div>
                </div>
                <ul className="mt-6 space-y-2.5 flex-1">
                  {p.bullets.map((b, i) => (
                    <li key={i} className="flex gap-2 text-sm text-ink-2">
                      <Check
                        size={16}
                        className="flex-shrink-0 mt-0.5 text-gold-light"
                        strokeWidth={2.5}
                      />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={p.href}
                  className={`mt-7 inline-flex items-center justify-center gap-2 text-sm font-medium px-4 py-2.5 rounded transition-colors ${
                    p.highlighted
                      ? 'bg-gold-light text-bg hover:bg-gold'
                      : 'border border-w-16 text-ink hover:border-gold-light hover:text-gold-light'
                  }`}
                >
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* ——— Testimonials ——— */}
        <section
          aria-labelledby="testimonials-h"
          className="max-w-[1400px] mx-auto px-6 md:px-10 py-20 md:py-[120px] border-t border-w-6"
        >
          <div className="text-center mb-16">
            <p className="font-mono text-2xs uppercase tracking-widest text-gold-light">
              Khách hàng nói gì
            </p>
            <h2
              id="testimonials-h"
              className="mt-4 font-display text-4xl md:text-5xl font-semibold text-ivory max-w-3xl mx-auto text-balance"
            >
              Chairman Việt đang cascade cùng chúng tôi.
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <figure
                key={i}
                className="bg-gradient-to-br from-panel to-panel-2 border border-w-6 rounded-card p-7 flex flex-col"
              >
                <blockquote className="font-serif italic text-lg text-ivory leading-relaxed flex-1">
                  {t.quote}
                </blockquote>
                <figcaption className="mt-6 pt-5 border-t border-w-8">
                  <div className="font-display text-base text-ivory">{t.name}</div>
                  <div className="mt-0.5 font-mono text-2xs uppercase tracking-widest text-gold-light">
                    {t.role}
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        {/* ——— FAQ ——— */}
        <section
          id="faq"
          aria-labelledby="faq-h"
          className="max-w-[1000px] mx-auto px-6 md:px-10 py-20 md:py-[120px] border-t border-w-6"
        >
          <div className="text-center mb-16">
            <p className="font-mono text-2xs uppercase tracking-widest text-gold-light">
              Câu hỏi thường gặp
            </p>
            <h2
              id="faq-h"
              className="mt-4 font-display text-4xl md:text-5xl font-semibold text-ivory text-balance"
            >
              Bạn đang băn khoăn điều gì?
            </h2>
          </div>

          <div className="space-y-4">
            {faqs.map((f, i) => (
              <FaqItem key={i} question={f.q} answer={f.a} />
            ))}
          </div>
        </section>

        {/* ——— Final CTA ——— */}
        <section
          aria-labelledby="cta-h"
          className="max-w-[1400px] mx-auto px-6 md:px-10 py-20 md:py-[120px]"
        >
          <div className="relative bg-gradient-to-br from-panel to-panel-2 border border-gold/30 rounded-card p-10 md:p-16 text-center overflow-hidden">
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(228,193,110,0.15),transparent_60%)]"
            />
            <div className="relative">
              <h2
                id="cta-h"
                className="font-display text-3xl md:text-5xl font-semibold text-ivory max-w-3xl mx-auto text-balance"
              >
                Day-0 bắt đầu hôm nay.{' '}
                <span className="font-serif italic text-gold-light font-normal">
                  Ring-bell 2031 bắt đầu ngay bây giờ.
                </span>
              </h2>
              <p className="mt-6 text-ink-2 max-w-2xl mx-auto">
                Dùng thử 14 ngày miễn phí · không cần thẻ tín dụng · cancel anytime.
              </p>
              <div className="mt-10">
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 bg-gold-light text-bg font-semibold text-base px-7 py-4 rounded hover:bg-gold transition-colors"
                >
                  Dùng thử 14 ngày miễn phí
                  <ArrowRight size={18} />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ——— Footer ——— */}
      <footer className="border-t border-w-6 bg-bg-2/40">
        <div className="max-w-[1400px] mx-auto px-6 md:px-10 py-14">
          <div className="grid md:grid-cols-2 gap-10 mb-10">
            <div>
              <Link
                href="/"
                className="font-display text-2xl font-bold tracking-tight"
              >
                Zeni <span className="font-serif italic text-gold-light">iPO</span>
              </Link>
              <p className="mt-4 font-serif italic text-ink-2 max-w-md leading-relaxed">
                Tĩnh lặng · Hiện diện · Phục hưng sự sống
              </p>
            </div>
            <nav aria-label="Footer" className="md:justify-self-end">
              <ul className="grid grid-cols-2 gap-x-10 gap-y-3 text-sm text-ink-2">
                {[
                  { href: '/about', label: 'Về Zeniipo' },
                  { href: '/security', label: 'Bảo mật' },
                  { href: '/privacy', label: 'Chính sách riêng tư' },
                  { href: '/terms', label: 'Điều khoản' },
                  { href: '/contact', label: 'Liên hệ' },
                  { href: '/careers', label: 'Tuyển dụng' },
                  { href: '/changelog', label: 'Changelog' },
                  { href: '/docs', label: 'Tài liệu API' },
                ].map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="hover:text-gold-light transition-colors"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
          <div className="pt-8 border-t border-w-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 font-mono text-2xs uppercase tracking-widest text-ink-dim">
            <p>© 2026 Zeni Digital. Made in Vietnam · Listed on SGX by 2031.</p>
            <p>v1.0.0-beta · Apr 2026</p>
          </div>
        </div>
      </footer>
    </>
  );
}
