import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser-side Supabase client.
 * Use in Client Components (files marked 'use client') and browser-only code.
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY from env.
 * RLS is enforced server-side — anon key is safe to ship to the browser.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
