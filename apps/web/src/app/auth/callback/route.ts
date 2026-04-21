import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * OAuth / email-confirmation callback.
 *
 * Supabase sends users here after:
 *   - completing an email-confirmation link
 *   - returning from an OAuth provider redirect (when we enable them)
 *
 * We exchange the `code` query param for a session cookie, then bounce the
 * user to either `?redirect=…` or `/dashboard`.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const redirect = searchParams.get('redirect') || '/dashboard';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      const failUrl = new URL('/login', origin);
      failUrl.searchParams.set(
        'error',
        'Không thể xác thực liên kết. Vui lòng thử đăng nhập lại.',
      );
      return NextResponse.redirect(failUrl);
    }
  }

  // Ensure `redirect` is a local path — never trust caller-supplied absolute URLs.
  const safeRedirect = redirect.startsWith('/') ? redirect : '/dashboard';
  return NextResponse.redirect(new URL(safeRedirect, origin));
}
