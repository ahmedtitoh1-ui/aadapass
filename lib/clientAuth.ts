'use client';

const ACCESS_TOKEN_KEY = 'aada_access_token';
let memoryAccessToken: string | null = null;

export function getStoredAccessToken(): string | null {
  if (memoryAccessToken) return memoryAccessToken;
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.sessionStorage.getItem(ACCESS_TOKEN_KEY);
    if (stored) {
      memoryAccessToken = stored;
      return stored;
    }
  } catch {
    // Ignore storage access restrictions inside sandboxed iframes
  }
  return null;
}

export function setStoredAccessToken(token: string | null | undefined): void {
  if (!token) return;
  memoryAccessToken = token;
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
  } catch {
    // Ignore storage quota or iframe restrictions
  }
}

export function clearStoredAccessToken(): void {
  memoryAccessToken = null;
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  } catch {
    // Ignore storage restrictions
  }
}

export async function authFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = getStoredAccessToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(input, {
    ...init,
    credentials: init.credentials ?? 'include',
    headers,
  });
}
