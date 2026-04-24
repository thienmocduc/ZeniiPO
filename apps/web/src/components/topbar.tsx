/**
 * Topbar — renders the exact v1_8_FULL <header class="tb"> markup via
 * dangerouslySetInnerHTML. Server component; accepts authenticated user prop
 * so we can optionally surface email/display-name later (v2 wire-up).
 */

import { getTopbarHtml } from '@/lib/v1/extract';

type TopbarUser = {
  email?: string | null;
  user_metadata?: { full_name?: string | null; name?: string | null } | null;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function Topbar({ user }: { user: TopbarUser }) {
  const html = getTopbarHtml();
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
