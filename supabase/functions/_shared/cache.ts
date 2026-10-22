// supabase/functions/_shared/cache.ts
// ─────────────────────────────────────────────────────────────────────────────
// A small cache of answers that are expensive to ask for and cheap to be a
// minute out of date: who a token belongs to, and which orgs and events they
// may see. It lives in one function instance's memory, so it is lost when the
// instance stops, and two instances do not share it. That is fine: a miss only
// means asking Mole V3 again.
//
// It also joins identical questions asked at the same moment (a page loading
// zones, sensors and numbers together asks Mole V3 once, not three times).
// A question that fails is forgotten at once, so a failure is never cached.
// ─────────────────────────────────────────────────────────────────────────────

export interface TtlCache<V> {
  /** The cached answer for `key`, or `load()`'s answer, kept for the cache's lifetime. */
  get(key: string, load: () => Promise<V>, keep?: (v: V) => boolean): Promise<V>;
  clear(): void;
  readonly size: number;
}

export function ttlCache<V>(ttlMs: number, maxEntries = 2_000, now: () => number = Date.now): TtlCache<V> {
  const entries = new Map<string, { at: number; value: Promise<V> }>();
  return {
    get size() { return entries.size; },
    clear() { entries.clear(); },
    async get(key, load, keep = () => true) {
      if (ttlMs <= 0) return load();
      const hit = entries.get(key);
      if (hit && now() - hit.at < ttlMs) return hit.value;
      if (entries.size >= maxEntries) entries.clear(); // bounded: an instance is not a database
      const value = load();
      entries.set(key, { at: now(), value });
      try {
        const v = await value;
        if (!keep(v)) entries.delete(key);
        return v;
      } catch (e) {
        entries.delete(key);
        throw e;
      }
    },
  };
}

/** A key for a secret (a token): its SHA-256, so the secret itself is never a map key. */
export async function hashKey(secret: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}
