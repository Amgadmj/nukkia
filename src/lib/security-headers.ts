/**
 * No response carried any hardening headers before this (H-1 in the
 * security review): no CSP, no clickjacking protection, no HSTS.
 *
 * This was first tried as TanStack Start requestMiddleware in src/start.ts.
 * Verified against a real response with `fetch()` from the browser (both an
 * SSR page and a `new Response(...)` returned directly from an `/api/*`
 * route's `server.handlers`): the headers never showed up either way. That
 * middleware chain doesn't appear to wrap the literal Response these
 * handlers produce. Rather than ship something that silently does nothing,
 * these headers are applied in src/server.ts instead — the Cloudflare
 * Worker's own `fetch()` wrapper, which unconditionally sees every response
 * this app ever sends, confirmed the same way (see server.ts for the
 * verification note).
 */
export const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://*.supabase.co",
    "connect-src 'self' https://*.supabase.co https://generativelanguage.googleapis.com",
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; "),
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "geolocation=(), camera=(), microphone=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
};

export function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) headers.set(key, value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
