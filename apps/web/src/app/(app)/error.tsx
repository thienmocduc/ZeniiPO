'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') console.error('[app/error]', error)
  }, [error])

  return (
    <main className="min-h-screen bg-bg text-ink flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-lg border border-w8 bg-bg-2 p-8 text-center space-y-4">
        <div className="text-5xl">⚠</div>
        <h1 className="font-serif text-2xl text-gold-light">Có lỗi xảy ra</h1>
        <p className="text-sm text-ink-dim">
          Trang không tải được. Lỗi đã được ghi vào audit log để team xử lý.
        </p>
        {error.digest && (
          <p className="font-mono text-xs text-ink-dim">Reference: <code className="text-gold-light">{error.digest}</code></p>
        )}
        <div className="flex gap-2 justify-center pt-2">
          <button
            onClick={reset}
            className="rounded bg-gold px-4 py-2 text-sm font-medium text-bg hover:bg-gold-light"
          >
            Thử lại
          </button>
          <Link
            href="/dashboard"
            className="rounded border border-w8 px-4 py-2 text-sm text-ink hover:bg-w4"
          >
            Về Dashboard
          </Link>
        </div>
      </div>
    </main>
  )
}
