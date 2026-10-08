// supabase/functions/_shared/http.ts
// Responses, errors and CORS, the same way for every route.

import type { ApiErrorCode } from './contract.ts';

const STATUS: Record<ApiErrorCode, number> = {
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  invalid: 400,
  conflict: 409,
  upstream: 502,
  not_configured: 503,
};

export class ApiError extends Error {
  constructor(public code: ApiErrorCode, message: string) {
    super(message);
  }
}

export function corsHeaders(origin: string | null, allowed: string[]): Record<string, string> {
  // Reflect only an origin on the list. `*` would let any site that obtained a
  // Mole token call this API from a browser.
  const ok = origin && allowed.includes(origin);
  return {
    ...(ok ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}

export function errorResponse(e: unknown, headers: Record<string, string> = {}): Response {
  if (e instanceof ApiError) {
    return json({ error: { code: e.code, message: e.message } }, STATUS[e.code], headers);
  }
  // The detail goes to the function log, not to the browser.
  console.error('unhandled', e instanceof Error ? e.stack ?? e.message : e);
  return json({ error: { code: 'upstream', message: 'Something went wrong on our side. Try again in a minute.' } }, 500, headers);
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    if (body && typeof body === 'object' && !Array.isArray(body)) return body as Record<string, unknown>;
  } catch {
    // fall through
  }
  throw new ApiError('invalid', 'The request body must be a JSON object.');
}
