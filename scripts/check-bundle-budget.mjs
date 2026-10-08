// scripts/check-bundle-budget.mjs — the first load stays small.
// Counts what index.html makes the browser fetch before anything appears
// (the entry script and the stylesheet), gzipped, and fails above the budget.
// The camera's QR reader and each backend load later and are not counted.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const dir = process.argv[2] ?? 'dist';
const BUDGET = { js: 100 * 1024, css: 10 * 1024 };
const html = readFileSync(join(dir, 'index.html'), 'utf8');
const refs = [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.(js|css))"/g)];
const total = { js: 0, css: 0 };
for (const [, path, kind] of refs) total[kind] += gzipSync(readFileSync(join(dir, path))).length;

let ok = true;
for (const kind of ['js', 'css']) {
  const line = `${kind}: ${(total[kind] / 1024).toFixed(1)} kB of ${(BUDGET[kind] / 1024).toFixed(0)} kB (gzip)`;
  if (total[kind] > BUDGET[kind]) { ok = false; console.error(`✗ ${line}`); } else console.log(`✓ ${line}`);
}
if (!refs.length) { console.error('✗ index.html loads no assets — wrong directory?'); ok = false; }
process.exit(ok ? 0 : 1);
