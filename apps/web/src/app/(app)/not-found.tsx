import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="min-h-screen bg-bg text-ink flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-lg border border-w8 bg-bg-2 p-8 text-center space-y-4">
        <div className="font-serif text-7xl text-gold-light">404</div>
        <h1 className="font-serif text-xl text-ink">Không tìm thấy trang</h1>
        <p className="text-sm text-ink-dim">
          Có thể đường dẫn đã đổi hoặc trang chưa được kích hoạt cho tenant của bạn.
        </p>
        <div className="flex gap-2 justify-center pt-2">
          <Link
            href="/dashboard"
            className="rounded bg-gold px-4 py-2 text-sm font-medium text-bg hover:bg-gold-light"
          >
            Về Dashboard
          </Link>
          <Link
            href="/"
            className="rounded border border-w8 px-4 py-2 text-sm text-ink hover:bg-w4"
          >
            Trang chủ
          </Link>
        </div>
      </div>
    </main>
  )
}
