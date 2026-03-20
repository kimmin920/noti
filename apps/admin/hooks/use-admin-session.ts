'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { getApiBase } from '@/lib/api-base';
import type { ViewerProfile } from '@/types/admin';

function isSessionError(message: string) {
  return message.includes('Session cookie missing') || message.includes('Invalid session');
}

export function useAdminSession() {
  const apiBase = getApiBase();
  const [me, setMe] = useState<ViewerProfile | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [ssoToken, setSsoToken] = useState('');
  const [localLoginId, setLocalLoginId] = useState('');
  const [localPassword, setLocalPassword] = useState('');
  const [publServiceToken, setPublServiceToken] = useState('');

  async function refreshSession() {
    setLoading(true);
    try {
      const authMe = await apiFetch<ViewerProfile>('/v1/auth/me');
      setMe(authMe);
      setError('');
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Unknown error';
      setMe(null);
      setError(isSessionError(message) ? '' : message);
    } finally {
      setLoading(false);
    }
  }

  async function exchangeSso() {
    if (!ssoToken) {
      setError('SSO JWT를 입력하세요.');
      return;
    }

    try {
      await apiFetch('/v1/auth/sso/exchange', {
        method: 'POST',
        headers: { Authorization: `Bearer ${ssoToken}` }
      });
      await refreshSession();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'SSO exchange failed');
    }
  }

  async function loginWithPassword() {
    if (!localLoginId || !localPassword) {
      setError('ID와 비밀번호를 입력하세요.');
      return;
    }

    try {
      await apiFetch('/v1/auth/password/login', {
        method: 'POST',
        body: JSON.stringify({ loginId: localLoginId, password: localPassword })
      });
      await refreshSession();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Login failed');
    }
  }

  function startGoogleLogin() {
    const url = new URL(`${apiBase}/v1/auth/google/start`);
    url.searchParams.set('returnTo', window.location.href);
    window.location.href = url.toString();
  }

  useEffect(() => {
    void refreshSession();
  }, []);

  return {
    me,
    error,
    loading,
    refreshSession,
    ssoToken,
    setSsoToken,
    localLoginId,
    setLocalLoginId,
    localPassword,
    setLocalPassword,
    publServiceToken,
    setPublServiceToken,
    exchangeSso,
    loginWithPassword,
    startGoogleLogin
  };
}
