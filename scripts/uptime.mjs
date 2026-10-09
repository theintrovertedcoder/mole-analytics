// scripts/uptime.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Is Mole Sense up? Run every half hour by .github/workflows/uptime.yml (W-16).
// ─────────────────────────────────────────────────────────────────────────────
// A failed scheduled run is emailed by GitHub, so this needs no new account.
//
//   SITE_URL     the app (default https://sense.mole.is): must answer 200
//                with the app's page, not an error page or a parked domain.
//   HEALTH_URL   the backend's /api/health, once it is deployed: must answer
//                {"ok": true}. Unset until then, and skipped, saying so.
// ─────────────────────────────────────────────────────────────────────────────

const TIMEOUT_MS = 15_000;

async function get(fetchFn, url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    return await fetchFn(url, { signal: ctl.signal, headers: { 'User-Agent': 'mole-sense-uptime' } });
  } finally {
    clearTimeout(t);
  }
}

/** The site: a 200 whose page is the Mole Sense app. Returns a problem, or null. */
export async function checkSite(fetchFn, url) {
  let res;
  try { res = await get(fetchFn, url); } catch (e) { return `${url} didn't answer: ${e.message}`; }
  if (res.status !== 200) return `${url} answered ${res.status}`;
  const html = await res.text();
  if (!html.includes('<div id="root">')) return `${url} answered, but not with the Mole Sense app`;
  return null;
}

/** The backend: {"ok": true}, and if not, which part is down. */
export async function checkHealth(fetchFn, url) {
  let res, body;
  try { res = await get(fetchFn, url); body = await res.json(); } catch (e) { return `${url} didn't answer with JSON: ${e.message}`; }
  if (body?.ok === true) return null;
  const down = ['database', 'moleV3'].filter(k => body?.[k] === false);
  return `${url} says it isn't healthy${down.length ? `: ${down.join(' and ')} not reachable` : ''} (HTTP ${res.status})`;
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const site = process.env.SITE_URL || 'https://sense.mole.is';
  const health = process.env.HEALTH_URL;
  const problems = [await checkSite(fetch, site)];
  if (health) problems.push(await checkHealth(fetch, health));
  else console.log('HEALTH_URL is not set: the backend is not deployed yet, so only the site is checked.');
  const bad = problems.filter(Boolean);
  for (const p of bad) console.error(`✗ ${p}`);
  if (!bad.length) console.log(`✓ ${site} is up${health ? ', and the backend is healthy' : ''}`);
  process.exit(bad.length ? 1 : 0);
}
