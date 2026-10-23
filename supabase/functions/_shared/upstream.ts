// supabase/functions/_shared/upstream.ts
// ─────────────────────────────────────────────────────────────────────────────
// Every call this backend makes to another service goes through here: Mole V3,
// PLExyz and this project's own database API alike.
// ─────────────────────────────────────────────────────────────────────────────
// One rule for all of them: a deadline. A service that hangs would otherwise
// hold the function until Supabase kills it, and the person would wait the
// whole time for a vague error. A call that does not answer in time, or cannot
// be made at all, becomes a plain 503 `unavailable` naming the service, so the
// app can say what is wrong and the gateway can tell it from a bug (500).
//
// A new service needs nothing new: pass its name to `callUpstream`.
// ─────────────────────────────────────────────────────────────────────────────

import { ApiError } from './http.ts';

/** How long any one call may take. Supabase allows a function far longer. */
export const DEADLINE_MS = 8_000;

export interface UpstreamOptions {
  timeoutMs?: number;
  fetch?: typeof fetch;
}

export async function callUpstream(name: string, url: string, init: RequestInit = {}, opts: UpstreamOptions = {}): Promise<Response> {
  const f = opts.fetch ?? fetch;
  try {
    return await f(url, { ...init, signal: AbortSignal.timeout(opts.timeoutMs ?? DEADLINE_MS) });
  } catch (e) {
    const timedOut = e instanceof DOMException && (e.name === 'TimeoutError' || e.name === 'AbortError');
    // The URL is logged without its query, which can carry filters but never secrets.
    console.error(`${name} ${timedOut ? 'timed out' : 'unreachable'}: ${url.split('?')[0]}`);
    throw new ApiError(
      'unavailable',
      timedOut ? `${name} took too long to answer. Try again in a minute.` : `Couldn't reach ${name}. Try again in a minute.`,
      { 'Retry-After': '30' },
    );
  }
}
