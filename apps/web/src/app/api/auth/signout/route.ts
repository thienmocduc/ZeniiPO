import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Sign out the current user and bounce to /login.
 * Called from client via `fetch('/api/auth/signout', { method: 'POST' })`.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const loginUrl = new URL('/login', request.url);
  return NextResponse.redirect(loginUrl, { status: 303 });
}
