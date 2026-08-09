import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { applyHeaders, securityHeaders } from '@/lib/security/headers';
import { rateLimit } from '@/lib/security/rate-limit';
import { validateCsrf } from '@/lib/security/csrf';

// Route prefixes that require an authenticated session.
// Anything matching `/(app)/*` is covered by the list below (dashboard, kpi-matrix,
// financials, etc.) — if we add more app segments later, extend this list.
const PROTECTED_PREFIXES = [
  '/dashboard',
  '/kpi-matrix',
  '/financials',
  '/cap-table',
  '/admin',
  '/console',
  '/settings',
  '/academy',
  '/ipo-execution',
  '/pitch-deck',
  '/data-room',
];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

function headersObject(): Record<string, string> {
  return Object.fromEntries(Object.entries(securityHeaders));
}

export async function middleware(request: NextRequest) {
  // === SECURITY LAYER (runs BEFORE auth) ===

  // 1. Rate limit — per IP, per path bucket
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  const limit = await rateLimit(ip, request.nextUrl.pathname);
  if (!limit.success) {
    return new NextResponse('Rate limit exceeded', {
      status: 429,
      headers: {
        'Retry-After': '60',
        'X-RateLimit-Limit': String(limit.limit),
        'X-RateLimit-Remaining': String(limit.remaining),
        'X-RateLimit-Reset': String(limit.reset),
        ...headersObject(),
      },
    });
  }

  // Machine-to-machine endpoints: authenticated by a custom header token, not
  // by cookies. CSRF and bot-UA heuristics don't apply — a browser can't attach
  // `X-Zeni-Ingest-Token` cross-origin, and the callers here ARE scripts
  // (Google Apps Script, MISA export in Python, Lark automation, cron).
  // The endpoints do their own auth: ingest verifies a hashed token, cron
  // verifies CRON_SECRET.
  const path = request.nextUrl.pathname;
  const isMachineEndpoint =
    path.startsWith('/api/ingest') ||
    path.startsWith('/api/cron') ||
    // ZIPO-201: ZeniOS gọi contract bằng x-internal-key + x-user-id
    path.startsWith('/api/internal');

  // 2. CSRF on state-changing methods (POST/PUT/PATCH/DELETE)
  if (!isMachineEndpoint && !validateCsrf(request)) {
    return new NextResponse('CSRF detected', {
      status: 403,
      headers: headersObject(),
    });
  }

  // 3. Bot UA block (allow /api/health and /api/public)
  const ua = request.headers.get('user-agent') || '';
  const isBot = /python-requests|scrapy|bot|crawl|spider/i.test(ua);
  const isPublicApi =
    path.startsWith('/api/public') ||
    path.startsWith('/api/health') ||
    isMachineEndpoint;
  if (isBot && !isPublicApi) {
    return new NextResponse('Forbidden', {
      status: 403,
      headers: headersObject(),
    });
  }

  // === AUTH LAYER (Supabase session) ===
  const { response, user } = await updateSession(request);

  const { pathname, search } = request.nextUrl;

  if (!user && isProtected(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search = `?redirect=${encodeURIComponent(pathname + search)}`;
    const redirect = NextResponse.redirect(loginUrl);
    applyHeaders(redirect);
    return redirect;
  }

  // Apply security headers to the downstream response too
  applyHeaders(response);
  return response;
}

export const config = {
  matcher: [
    // Run on ALL routes (including /) EXCEPT Next.js internal assets + favicon
    // Root (/) needs middleware for security headers (X-Frame-Options, CSP, etc.)
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|ico|webp)).*)',
  ],
};
