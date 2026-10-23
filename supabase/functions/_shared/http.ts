// supabase/functions/_shared/http.ts
// Responses, errors, request ids and CORS, the same way for every route.

import type { ApiErrorCode } from './contract.ts';

const STATUS: Record<ApiErrorCode, number> = {
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  method_not_allowed: 405,
  invalid: 400,
  conflict: 409,
  upstream: 502,
  unavailable: 503,
  not_configured: 503,
  internal: 500,
};

export class ApiError extends Error {
  constructor(public code: ApiErrorCode, message: string, public headers: Record<string, string> = {}) {
    super(message);
  }
}

// One id per request, end to end: the Mole API gateway sends `x-request-id` and
// it is used as is, so one call has one id in the gateway's log, ours and the
// answer someone saw. A value that is not 8 to 128 of letters, digits and . _ : -
// is never trusted (it would be written to logs and headers); one is made here.
export const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{8,128}$/;
export function requestId(req: { headers: { get(name: string): string | null } }): string {
  const given = req.headers.get('x-request-id');
  return given && SAFE_REQUEST_ID.test(given) ? given : `sense_${crypto.randomUUID().replace(/-/g, '')}`;
}

export function corsHeaders(origin: string | null, allowed: string[]): Record<string, string> {
  // Reflect only an origin on the list. `*` would let any site that obtained a
  // Mole token call this API from a browser.
  const ok = origin && allowed.includes(origin);
  return {
    ...(ok ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Access-Control-Allow-Headers': 'authorization, content-type, x-request-id',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Expose-Headers': 'x-request-id',
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

export function errorResponse(e: unknown, headers: Record<string, string> = {}, rid?: string): Response {
  const ids: Record<string, string> = rid ? { 'x-request-id': rid } : {};
  if (e instanceof ApiError) {
    return json({ error: { code: e.code, message: e.message, ...(rid ? { requestId: rid } : {}) } }, STATUS[e.code], { ...headers, ...e.headers, ...ids });
  }
  // The detail goes to the function log, not to the browser.
  console.error(`[${rid ?? '-'}] unhandled`, e instanceof Error ? e.stack ?? e.message : e);
  return json(
    { error: { code: 'internal', message: 'Something went wrong on our side. Try again in a minute.', ...(rid ? { requestId: rid } : {}) } },
    500,
    { ...headers, ...ids },
  );
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
