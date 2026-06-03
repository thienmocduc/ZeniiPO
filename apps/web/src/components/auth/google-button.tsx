'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function GoogleSignInButton({ label = 'Tiếp tục với Google' }: { label?: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function signIn() {
    setBusy(true)
    setError(null)
    try {
      const supabase = createClient()
      // Read redirect from URL at click time (avoids useSearchParams suspense boundary).
      const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
      const redirect = params.get('redirect') || '/dashboard'
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${origin}/auth/callback?redirect=${encodeURIComponent(redirect)}`,
          queryParams: { access_type: 'offline', prompt: 'consent' },
        },
      })
      if (err) throw err
      // Supabase redirects the browser; we should not reach here.
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google sign-in failed'
      // Friendly message when provider not yet enabled in Supabase project.
      if (/provider .* (is )?not enabled/i.test(msg) || /unsupported/i.test(msg)) {
        setError('Google SSO chưa được bật. Đăng nhập bằng email + mật khẩu trước.')
      } else {
        setError(msg)
      }
      setBusy(false)
    }
  }

  return (
    <div style={{ marginTop: 14 }}>
      <button
        type="button"
        onClick={signIn}
        disabled={busy}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          width: '100%',
          padding: '10px 14px',
          borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.16)',
          background: 'rgba(255,255,255,0.04)',
          color: '#e5e7eb',
          fontSize: '.85rem',
          fontWeight: 500,
          cursor: busy ? 'wait' : 'pointer',
          transition: 'border-color .15s, background .15s',
          opacity: busy ? 0.6 : 1,
        }}
        onMouseEnter={(e) => { if (!busy) e.currentTarget.style.borderColor = 'rgba(228,193,110,0.5)' }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.16)' }}
      >
        <GoogleIcon />
        <span>{busy ? 'Đang chuyển hướng…' : label}</span>
      </button>
      {error && (
        <div style={{
          marginTop: 8,
          padding: '8px 12px',
          background: 'rgba(248,113,113,0.12)',
          border: '1px solid rgba(248,113,113,0.35)',
          borderRadius: 6,
          color: '#fca5a5',
          fontSize: '.78rem',
        }}>
          {error}
        </div>
      )}
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.17-1.84H9v3.49h4.84c-.21 1.13-.84 2.08-1.79 2.72v2.26h2.9c1.7-1.57 2.69-3.88 2.69-6.63z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.46-.81 5.95-2.18l-2.9-2.26c-.8.54-1.83.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.32C2.45 15.99 5.48 18 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.71a5.41 5.41 0 0 1 0-3.42V4.97H.96a9 9 0 0 0 0 8.07l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.34l2.58-2.58C13.46.89 11.43 0 9 0 5.48 0 2.45 2.01.96 4.97L3.97 7.3C4.68 5.18 6.66 3.58 9 3.58z" />
    </svg>
  )
}
