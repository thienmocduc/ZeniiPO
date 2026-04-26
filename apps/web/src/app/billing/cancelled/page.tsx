import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default function BillingCancelledPage() {
  return (
    <main className="min-h-screen bg-bg text-ink flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-4 rounded-lg border border-w8 bg-bg-2 p-8">
        <div className="text-5xl">×</div>
        <h1 className="font-serif text-2xl text-ink">Đã huỷ thanh toán</h1>
        <p className="text-sm text-ink-dim">
          Bạn đã huỷ phiên checkout. Có thể quay lại chọn plan khác bất cứ lúc nào.
        </p>
        <Link href="/billing" className="inline-block mt-4 rounded bg-gold px-5 py-2 text-sm font-medium text-bg hover:bg-gold-light">
          Quay lại trang Billing
        </Link>
      </div>
    </main>
  )
}
