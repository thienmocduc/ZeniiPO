'use client';

/**
 * LoginForm — renders the exact <div class="login" id="login"> markup from
 * v1_8_FULL.html and wires the submit button (#loginBtn) to Supabase
 * email/password auth. Keeps role + company fields as UI-only (matches the
 * chairman's v1 seed — binding to RLS is a v2 task).
 */

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { GoogleSignInButton } from '@/components/auth/google-button';

type Props = {
  /** Pre-extracted `<div class="login">` HTML (full wrapper). */
  html: string;
};

export function LoginForm({ html }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/dashboard';
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const emailInput = root.querySelector<HTMLInputElement>('#loginEmail');
    const passwordInput = root.querySelector<HTMLInputElement>('#loginPassword');
    const loginBtn = root.querySelector<HTMLButtonElement>('#loginBtn');
    const pwdToggle = root.querySelector<HTMLSpanElement>('#pwdToggle');
    const rolePicks = root.querySelectorAll<HTMLDivElement>('.role-pick');

    // Wire role-pick toggle UI
    const roleHandlers: Array<() => void> = [];
    rolePicks.forEach((el) => {
      const h = () => {
        rolePicks.forEach((x) => x.classList.remove('sel'));
        el.classList.add('sel');
      };
      el.addEventListener('click', h);
      roleHandlers.push(() => el.removeEventListener('click', h));
    });

    // Wire password toggle
    const togglePwd = () => {
      if (!passwordInput) return;
      passwordInput.type = passwordInput.type === 'password' ? 'text' : 'password';
    };
    pwdToggle?.addEventListener('click', togglePwd);

    // Wire submit
    const onSubmit = async (e: Event) => {
      e.preventDefault();
      if (!emailInput || !passwordInput) return;
      const email = emailInput.value.trim();
      const password = passwordInput.value;
      setError(null);
      setPending(true);
      try {
        const supabase = createClient();
        const { error: authErr } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (authErr) throw authErr;
        router.replace(redirect);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Đăng nhập thất bại');
      } finally {
        setPending(false);
      }
    };
    loginBtn?.addEventListener('click', onSubmit);

    return () => {
      loginBtn?.removeEventListener('click', onSubmit);
      pwdToggle?.removeEventListener('click', togglePwd);
      roleHandlers.forEach((off) => off());
    };
  }, [router, redirect, html]);

  return (
    <>
      <div ref={rootRef} dangerouslySetInnerHTML={{ __html: html }} />
      <div style={{ maxWidth: 420, margin: '14px auto 0' }}>
        <GoogleSignInButton />
      </div>
      {error && (
        <div
          style={{
            position: 'fixed',
            top: 20,
            right: 20,
            padding: '10px 16px',
            background: 'rgba(248,113,113,.12)',
            border: '1px solid rgba(248,113,113,.4)',
            borderRadius: 8,
            color: '#fca5a5',
            fontSize: '.82rem',
            zIndex: 2000,
            maxWidth: 360,
          }}
        >
          {error}
        </div>
      )}
      {pending && (
        <div
          style={{
            position: 'fixed',
            top: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '8px 14px',
            background: 'rgba(6,182,212,.15)',
            border: '1px solid rgba(6,182,212,.4)',
            borderRadius: 8,
            color: '#67e8f9',
            fontSize: '.78rem',
            zIndex: 2000,
          }}
        >
          Đang xác thực...
        </div>
      )}
    </>
  );
}
