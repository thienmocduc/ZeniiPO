'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function AuthError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') console.error('[auth/error]', error)
  }, [error])

  return (
    <div className="bg-panel/80 backdrop-blur-xl border border-w-12 rounded-card p-8 text-center space-y-4">
      <div className="text-5xl">⚠</div>
      <h1 className="font-serif text-xl text-gold-light">Đăng nhập gặp lỗi</h1>
      <p className="text-sm text-ink-dim">Không tải được trang. Thử lại hoặc về trang chủ.</p>
      {error.digest && (
        <p className="font-mono text-xs text-ink-dim">Ref: <code className="text-gold-light">{error.digest}</code></p>
      )}
      <div className="flex gap-2 justify-center pt-2">
        <button
          onClick={reset}
          className="rounded bg-gold px-4 py-2 text-sm font-medium text-bg hover:bg-gold-light"
        >
          Thử lại
        </button>
        <Link href="/" className="rounded border border-w8 px-4 py-2 text-sm text-ink hover:bg-w4">
          Trang chủ
        </Link>
      </div>
    </div>
  )
}
