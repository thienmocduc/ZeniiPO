import { createServerClient as createSSRClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Server-side Supabase client for Route Handlers, Server Components, and Server Actions.
 * Reads + mutates session cookies via `next/headers`.
 *
 * Use `createServerClient()` in new code. `createClient()` kept as alias for existing callers.
 */
export function createServerClient() {
  const cookieStore = cookies();

  return createSSRClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Called from a Server Component — mutations allowed only in Server Actions / Route Handlers.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch {
            // Ignored — see above.
          }
        },
      },
    },
  );
}

// Alias for backward compatibility with existing imports.
export const createClient = createServerClient;
