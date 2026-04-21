import { Suspense } from 'react';
import { LoginForm } from './login-form';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-panel/80 backdrop-blur-xl border border-w-12 rounded-card p-8">
          <div className="animate-pulse space-y-5">
            <div className="h-8 w-48 bg-w-8 rounded mx-auto" />
            <div className="h-4 w-64 bg-w-6 rounded mx-auto" />
            <div className="h-12 bg-w-8 rounded" />
            <div className="h-12 bg-w-8 rounded" />
            <div className="h-12 bg-gold/40 rounded" />
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
