import { NextResponse, type NextRequest } from 'next/server';
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

/* ── Zeni ID session (ZIPO-002 — thay Supabase Auth) ─────────────────
   Cookie `zeni_session` (access JWT) + `zeni_refresh`. Access sống ~60',
   gần hết hạn → gọi /auth/refresh gia hạn ngầm (rotation) — port pattern
   zenios/src/proxy.ts. Middleware chỉ canh cookie + refresh; xác thực
   THẬT vẫn ở server (getSessionUser → GET /auth/me, fail-closed). */
const ZENI_ID_BASE = (process.env.ZENI_ID_BASE_URL ?? 'https://zenicloud.io/api/v1').replace(/\/$/, '');
const SESSION_COOKIE = process.env.ZENI_ID_COOKIE ?? 'zeni_session';
const REFRESH_COOKIE = process.env.ZENI_REFRESH_COOKIE ?? 'zeni_refresh';
const REFRESH_SKEW = Number(process.env.ZENI_REFRESH_SKEW ?? 600); // gia hạn khi còn <10'
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 30,
};

/** Đọc claim exp (Unix giây) — KHÔNG verify (Edge-safe, dùng atob). */
function jwtExp(token: string): number | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    let b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const payload = JSON.parse(atob(b64)) as { exp?: number };
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}

/** Access gần/đã hết hạn → refresh, mutate request.cookies, trả cookie cần set. */
async function maybeRefresh(
  request: NextRequest,
): Promise<{ name: string; value: string }[] | null> {
  const access = request.cookies.get(SESSION_COOKIE)?.value;
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!access || !refresh) return null;

  const exp = jwtExp(access);
  const now = Math.floor(Date.now() / 1000);
  if (exp !== null && exp - now > REFRESH_SKEW) return null;

  type RefreshResp = { access_token?: string; token?: string; refresh_token?: string };
  let data: RefreshResp | null = null;
  try {
    const r = await fetch(`${ZENI_ID_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh }),
      cache: 'no-store',
    });
    if (r.ok) data = (await r.json()) as RefreshResp;
  } catch {
    /* mạng chập chờn → giữ cookie cũ */
  }

  const newAccess = data?.access_token ?? data?.token;
  const newRefresh = data?.refresh_token ?? refresh;
  if (!newAccess) return null;

  request.cookies.set(SESSION_COOKIE, newAccess);
  request.cookies.set(REFRESH_COOKIE, newRefresh);
  return [
    { name: SESSION_COOKIE, value: newAccess },
    { name: REFRESH_COOKIE, value: newRefresh },
  ];
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

  // === AUTH LAYER (Zeni ID — ZIPO-002) ===
  const refreshed = await maybeRefresh(request);
  const hasSession = !!request.cookies.get(SESSION_COOKIE)?.value;

  const { pathname, search } = request.nextUrl;

  if (!hasSession && isProtected(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search = `?redirect=${encodeURIComponent(pathname + search)}`;
    const redirect = NextResponse.redirect(loginUrl);
    applyHeaders(redirect);
    return redirect;
  }

  // Propagate token mới (nếu vừa gia hạn) xuống render hiện tại + trình duyệt
  const response = NextResponse.next({ request });
  if (refreshed) {
    for (const c of refreshed) response.cookies.set(c.name, c.value, COOKIE_OPTS);
  }
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
