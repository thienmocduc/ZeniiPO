import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function BillingSuccessPage({
  searchParams,
}: { searchParams: Promise<{ session_id?: string }> }) {
  const sp = await searchParams
  return (
    <main className="min-h-screen bg-bg text-ink flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-4 rounded-lg border border-w8 bg-bg-2 p-8">
        <div className="text-5xl">✓</div>
        <h1 className="font-serif text-2xl text-gold-light">Thanh toán thành công</h1>
        <p className="text-sm text-ink-dim">
          Subscription đã được kích hoạt. Webhook Stripe sẽ ghi vào DB trong vài giây.
        </p>
        {sp.session_id && (
          <p className="font-mono text-xs text-ink-dim">Session: {sp.session_id}</p>
        )}
        <Link href="/dashboard" className="inline-block mt-4 rounded bg-gold px-5 py-2 text-sm font-medium text-bg hover:bg-gold-light">
          Về Dashboard
        </Link>
      </div>
    </main>
  )
}
