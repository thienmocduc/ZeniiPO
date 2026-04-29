'use client'

/**
 * Root-level error boundary. Catches errors from the root layout itself
 * (e.g. provider boots, font loading) — page-level errors are caught by
 * (app)/error.tsx and (auth)/error.tsx.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  return (
    <html lang="vi">
      <body style={{ background: '#05070C', color: '#e5e7eb', fontFamily: 'system-ui, sans-serif', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 480, textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 32, background: 'rgba(255,255,255,0.02)' }}>
          <div style={{ fontSize: 56 }}>⚠</div>
          <h1 style={{ fontSize: 22, color: '#e4c16e', margin: '12px 0' }}>Hệ thống gặp lỗi nghiêm trọng</h1>
          <p style={{ fontSize: 14, color: '#9ca3af' }}>
            Vui lòng tải lại trang. Nếu vẫn lỗi, liên hệ team kỹ thuật với mã tham chiếu bên dưới.
          </p>
          {error.digest && (
            <p style={{ fontFamily: 'monospace', fontSize: 12, color: '#9ca3af', marginTop: 12 }}>
              Reference: <code style={{ color: '#e4c16e' }}>{error.digest}</code>
            </p>
          )}
          <a href="/" style={{ display: 'inline-block', marginTop: 20, padding: '10px 20px', background: '#e4c16e', color: '#05070C', borderRadius: 6, textDecoration: 'none', fontWeight: 500 }}>
            Tải lại trang chủ
          </a>
        </div>
      </body>
    </html>
  )
}
