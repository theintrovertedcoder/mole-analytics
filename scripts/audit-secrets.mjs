// scripts/audit-secrets.mjs — fails if a secret was compiled into the app.
//
// Everything in dist/ is public the moment it is deployed. The prototype this
// product grew out of copied GEMINI_API_KEY into the bundle through Vite's
// `define`; this is what would have caught it. It looks for the shapes secrets
// take, not for particular values, so it needs none to run.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2] ?? 'dist';
const files = [];
const walk = (d) => readdirSync(d).forEach(f => { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : files.push(p); });
walk(dir);

const PATTERNS = [
  ['a Google API key (the prototype’s Gemini key)', /AIza[0-9A-Za-z_-]{35}/],
  ['a Stripe secret key', /\b(sk|rk)_(live|test)_[0-9A-Za-z]{10,}/],
  ['an edge-function secret name next to a value', /(SERVICE_ROLE_KEY|PLEXYZ_API_KEY|PLEXYZ_WEBHOOK_SECRET|VISITOR_KEY_SECRET)["']?\s*[:=]\s*["'][^"']{8,}/],
  ['a private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
];

const problems = [];
for (const f of files.filter(f => /\.(js|html|css|json|map|txt)$/.test(f))) {
  const src = readFileSync(f, 'utf8');
  for (const [what, re] of PATTERNS) if (re.test(src)) problems.push(`${f}: ${what}`);
  // A Supabase key is a JWT. The anon one is meant to be public; the
  // service-role one bypasses every policy. Tell them apart by what they say.
  for (const m of src.matchAll(/eyJ[A-Za-z0-9_-]{10,}\.(eyJ[A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]{10,}/g)) {
    try {
      const claims = JSON.parse(Buffer.from(m[1], 'base64url').toString());
      if (claims.role && claims.role !== 'anon') problems.push(`${f}: a Supabase key with role "${claims.role}"`);
    } catch { /* not a JWT after all */ }
  }
}

if (files.length === 0) { console.error(`audit-secrets: ${dir} is empty — build first`); process.exit(1); }
if (problems.length) {
  console.error(`✗ secrets in the build:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`✓ no secrets in ${files.length} built files`);
