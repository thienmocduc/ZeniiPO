import { Suspense } from 'react';
import { LoginForm } from './login-form';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  // `Suspense` vì LoginForm đọc `useSearchParams` (tham số ?redirect=).
  return (
    <Suspense fallback={<div style={{ padding: 40, color: '#94A3B8' }}>...</div>}>
      <LoginForm />
    </Suspense>
  );
}
