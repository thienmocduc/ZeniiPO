import { NextResponse } from 'next/server';

/** Đăng xuất Zeni ID — xoá cookie phiên của app. */
export const runtime = 'nodejs';

const SESSION_COOKIE = process.env.ZENI_ID_COOKIE ?? 'zeni_session';
const REFRESH_COOKIE = process.env.ZENI_REFRESH_COOKIE ?? 'zeni_refresh';

export async function POST() {
  const out = NextResponse.json({ ok: true });
  const kill = { path: '/', maxAge: 0 };
  out.cookies.set(SESSION_COOKIE, '', kill);
  out.cookies.set(REFRESH_COOKIE, '', kill);
  return out;
}
