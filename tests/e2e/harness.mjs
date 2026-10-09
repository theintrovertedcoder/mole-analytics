// tests/e2e/harness.mjs
// ─────────────────────────────────────────────────────────────────────────────
// What every journey file shares: a served build, a browser, axe on every page
// visited, the 44px tap-target check, and a screenshot of whatever failed.
// run.mjs drives the sample build; live.mjs drives a live build against a
// stand-in for Mole V3.
// ─────────────────────────────────────────────────────────────────────────────

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { chromium } from 'playwright-core';

const require = createRequire(import.meta.url);
const AXE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const SHOTS = 'tests/e2e/shots';

const executablePath = process.env.CHROME_PATH
  ?? ['/opt/pw-browsers/chromium', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(existsSync);

let browser, server;
let passed = 0, failed = 0;

/** Serve a built app and open the browser. Returns the address to visit. */
export async function start({ dist = 'dist', port }) {
  server = spawn('node', ['scripts/serve-static.mjs', dist], { env: { ...process.env, PORT: String(port) }, stdio: 'pipe' });
  await new Promise(r => server.stdout.once('data', r));
  browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });
  mkdirSync(SHOTS, { recursive: true });
  return `http://localhost:${port}`;
}

export async function finish() {
  await browser.close();
  server.kill();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

export async function axe(page, where) {
  await page.addScriptTag({ content: AXE });
  const res = await page.evaluate(async () => (await window.axe.run(document, { resultTypes: ['violations'] })).violations
    .filter(v => v.impact === 'serious' || v.impact === 'critical')
    .map(v => `${v.id}: ${v.nodes.slice(0, 2).map(n => n.target.join(' ')).join(' | ')}`));
  if (res.length) throw new Error(`accessibility, on ${where}:\n      ${res.join('\n      ')}`);
  await tapTargets(page, where);
}

// The brand book: every tap target at least 44 × 44px (W-3). Inline links in a
// sentence are exempt, as WCAG 2.5.8 exempts them; everything else is measured.
export async function tapTargets(page, where) {
  const small = await page.evaluate(() => [...document.querySelectorAll('button, a[href], select, input:not([type=hidden]), [role=button]')]
    .filter(el => {
      const r = el.getBoundingClientRect();
      if (r.width <= 1 || r.height <= 1) return false;            // sr-only or hidden
      if (getComputedStyle(el).visibility === 'hidden') return false;
      if (getComputedStyle(el).display === 'inline') return false; // a link inside a sentence
      return Math.round(r.width) < 44 || Math.round(r.height) < 44;
    })
    .map(el => {
      const r = el.getBoundingClientRect();
      const name = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('type') || el.tagName).trim().slice(0, 40);
      return `${el.tagName.toLowerCase()} "${name}" is ${Math.round(r.width)}×${Math.round(r.height)}`;
    }));
  if (small.length) throw new Error(`tap targets under 44px, on ${where}:\n      ${small.join('\n      ')}`);
}

/** `expected`: console errors this journey causes on purpose (a refused code, say). */
export async function journey(name, fn, viewport = { width: 1280, height: 900 }, expected = []) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  try {
    await fn(page);
    const unexpected = errors.filter(e => !expected.some(re => re.test(e)));
    if (unexpected.length) throw new Error(`the page logged errors:\n      ${unexpected.join('\n      ')}`);
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}\n      ${String(e.message).split('\n').join('\n      ')}`);
    await page.screenshot({ path: `${SHOTS}/${name.replace(/[^a-z0-9]+/gi, '-')}.png`, fullPage: true }).catch(() => {});
  } finally {
    await ctx.close();
  }
}

export const expectText = async (page, text, timeout = 5000) => {
  await page.getByText(text, { exact: false }).first().waitFor({ timeout });
};
