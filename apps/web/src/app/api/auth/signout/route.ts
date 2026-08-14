import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, REFRESH_COOKIE } from '@/lib/zeni/session';

/**
 * Đăng xuất phiên Zeni ID: xoá cookie session + refresh rồi về /login.
 * Called from client via `fetch('/api/auth/signout', { method: 'POST' })`.
 */
export async function POST(request: NextRequest) {
  const loginUrl = new URL('/login', request.url);
  const res = NextResponse.redirect(loginUrl, { status: 303 });
  for (const name of [SESSION_COOKIE, REFRESH_COOKIE]) {
    res.cookies.set({ name, value: '', path: '/', maxAge: 0 });
  }
  return res;
}
