// scripts/build-email-assets.mjs
// ─────────────────────────────────────────────────────────────────────────────
// The pictures the emails use, as PNG.
// ─────────────────────────────────────────────────────────────────────────────
// Gmail and Outlook won't show an SVG in an email, so the logo and Sunny are
// rendered to PNG at twice the size they're shown, and served from this app at
// /email/ (https://sense.mole.is/email/…). They are the kit's drawings,
// unedited: the logo and the hand-drawn Sunny from public/brand/ (hashed in
// brand/sunny-kit.json), and the kit's rig moods, copied the same way, for the
// moods the hand-drawn Sunny doesn't have yet.
//
//   node scripts/build-email-assets.mjs
//
// Needs the browser the e2e tests use (no download).
// ─────────────────────────────────────────────────────────────────────────────

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public', 'email');
const brand = join(root, 'public', 'brand');

/** [output name, source svg, width px]: heights follow each drawing's own shape. */
export const ASSETS = [
  ['logo', 'mole-logo.svg', 240],
  ['sunny', 'sunny.svg', 256],
  ['sunny-thinking', 'sunny-thinking.svg', 256],
  ['sunny-delighted', 'sunny-delighted.svg', 256],
];

const executablePath = process.env.CHROME_PATH
  ?? ['/opt/pw-browsers/chromium', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(existsSync);

mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const [name, file, width] of ASSETS) {
    const svg = readFileSync(join(brand, file), 'utf8');
    const vb = svg.match(/viewBox="([^"]+)"/)[1].trim().split(/[\s,]+/).map(Number);
    const height = Math.round(width * vb[3] / vb[2]);
    const uri = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
    await page.setViewportSize({ width, height });
    await page.setContent(`<style>html,body{margin:0;background:transparent}img{display:block;width:${width}px;height:${height}px}</style><img src="${uri}">`);
    await page.waitForLoadState('load');
    writeFileSync(join(out, `${name}.png`), await page.screenshot({ omitBackground: true, type: 'png' }));
    console.log(`wrote public/email/${name}.png (${width}×${height})`);
  }
} finally {
  await browser.close();
}
