import { Suspense } from 'react';
import { LoginForm } from './login-form';
import { getLoginHtml } from '@/lib/v1/extract';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  const html = getLoginHtml();
  return (
    <Suspense fallback={<div style={{ padding: 40, color: '#94A3B8' }}>...</div>}>
      <LoginForm html={html} />
    </Suspense>
  );
}
