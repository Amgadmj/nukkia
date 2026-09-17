/**
 * Replaces window.__lovableEvents-based reporting, which only ever worked
 * inside the Lovable editor preview — in production and every local dev
 * session it did nothing (part of the Lovable exit, docs/ENGINEERING_PLAN.md).
 *
 * This is intentionally a plain, dependency-free logger, not a full APM
 * integration — no Sentry/Highlight account exists for this project yet,
 * and wiring one in without real credentials would just be a different
 * kind of silently-broken telemetry. Every call site already goes through
 * `reportError()`, so swapping `send()` below for a real provider's SDK
 * later is a one-file change.
 */
function send(payload: Record<string, unknown>) {
  console.error("[error-reporting]", payload);
}

export function reportError(error: unknown, context: Record<string, unknown> = {}) {
  const message =
    error instanceof Response
      ? `Response ${error.status}${error.url ? ` at ${error.url}` : ""}`
      : error instanceof Error
        ? error.message
        : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  send({
    message,
    stack,
    route: typeof window !== "undefined" ? window.location.pathname : undefined,
    ...context,
  });
}
