import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type VerifyResult = {
  valid: boolean
  cert_code?: string
  kind?: string
  title_vi?: string
  title_en?: string
  holder_name?: string | null
  company_name?: string | null
  issued_at?: string
}

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const sp = await searchParams
  const code = (sp.code ?? '').trim()
  let result: VerifyResult | null = null
  if (code) {
    const supabase = await createServerClient()
    const { data } = await supabase.rpc('verify_certificate', { p_code: code })
    result = (data as VerifyResult) ?? { valid: false }
  }

  return (
    <main className="min-h-screen bg-bg text-ink flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="font-serif text-2xl text-gold-light">Zeniipo · Xác thực chứng nhận</div>
          <p className="text-sm text-ink-dim mt-1">Kiểm tra tính xác thực của một chứng nhận IPO-Ready.</p>
        </div>

        <form className="flex gap-2 mb-6" action="/verify" method="get">
          <input name="code" defaultValue={code} placeholder="ZENI-XXXX-XXXX"
            className="flex-1 rounded border border-w8 bg-bg-2 px-3 py-2 text-sm text-ink focus:border-gold focus:outline-none font-mono uppercase" />
          <button className="rounded bg-gold px-4 py-2 text-sm font-medium text-bg hover:bg-gold-light">Verify</button>
        </form>

        {result && (
          result.valid ? (
            <div className="rounded-xl border border-emerald-600 bg-emerald-900/15 p-6 text-center">
              <div className="text-3xl">✓</div>
              <div className="text-xs uppercase tracking-widest text-emerald-300 mt-2">Chứng nhận hợp lệ</div>
              <h2 className="font-serif text-xl text-gold-light mt-2">{result.title_vi}</h2>
              <p className="text-sm text-ink mt-1">{result.holder_name ?? ''}{result.company_name ? ` · ${result.company_name}` : ''}</p>
              <div className="font-mono text-xs text-ink-dim mt-3">{result.cert_code} · cấp {result.issued_at ? new Date(result.issued_at).toLocaleDateString('vi-VN') : ''}</div>
            </div>
          ) : (
            <div className="rounded-xl border border-red-700 bg-red-900/20 p-6 text-center text-red-200">
              <div className="text-3xl">✕</div>
              <p className="mt-2 text-sm">Không tìm thấy chứng nhận với mã <b className="font-mono">{code}</b>.</p>
            </div>
          )
        )}
      </div>
    </main>
  )
}
