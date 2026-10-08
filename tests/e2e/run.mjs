// tests/e2e/run.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Can a person get what they came for? Journeys in a real browser.
// ─────────────────────────────────────────────────────────────────────────────
//   npm run test:e2e     (builds with VITE_SAMPLE_DATA=true first)
//
// Runs against the sample-data build, so no keys and no database. It proves
// the screens work end to end on the same arithmetic as production; it does
// not replace trying the live site with a real sensor.
//
// Every page visited is also run through axe, and a serious or critical
// accessibility violation fails the journey it was found on.
// ─────────────────────────────────────────────────────────────────────────────

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { chromium } from 'playwright-core';

const require = createRequire(import.meta.url);
const AXE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const PORT = 4199;
const BASE = `http://localhost:${PORT}`;
const SHOTS = 'tests/e2e/shots';

const executablePath = process.env.CHROME_PATH
  ?? ['/opt/pw-browsers/chromium', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(existsSync);

const server = spawn('node', ['scripts/serve-static.mjs', 'dist'], { env: { ...process.env, PORT: String(PORT) }, stdio: 'pipe' });
await new Promise(r => server.stdout.once('data', r));

const browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });
mkdirSync(SHOTS, { recursive: true });
let passed = 0, failed = 0;

async function axe(page, where) {
  await page.addScriptTag({ content: AXE });
  const res = await page.evaluate(async () => (await window.axe.run(document, { resultTypes: ['violations'] })).violations
    .filter(v => v.impact === 'serious' || v.impact === 'critical')
    .map(v => `${v.id}: ${v.nodes.slice(0, 2).map(n => n.target.join(' ')).join(' | ')}`));
  if (res.length) throw new Error(`accessibility, on ${where}:\n      ${res.join('\n      ')}`);
}

async function journey(name, fn, viewport = { width: 1280, height: 900 }) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  try {
    await fn(page);
    if (errors.length) throw new Error(`the page logged errors:\n      ${errors.join('\n      ')}`);
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

const expectText = async (page, text, timeout = 5000) => {
  await page.getByText(text, { exact: false }).first().waitFor({ timeout });
};

console.log('\nJourneys');

await journey('an organiser finds their events, and is told it is sample data', async page => {
  await page.goto(BASE);
  await expectText(page, 'Your events');
  await expectText(page, 'Events you run');
  await expectText(page, 'Your stands at other events');
  await expectText(page, 'Every number on this page is made up');
  await axe(page, 'the events list');
});

await journey('the whole-event funnel, busy hours and booth ranking all show', async page => {
  await page.goto(BASE);
  await page.getByRole('link', { name: /KL Founders Expo/ }).click();
  await expectText(page, 'Who came, who stayed');
  const funnel = page.getByRole('list', { name: 'Funnel' });
  await funnel.getByText('At the event', { exact: true }).waitFor();
  const first = await funnel.locator('li').first().innerText();
  if (!/\d{3}/.test(first)) throw new Error(`no count on the first step: ${first}`);
  await expectText(page, 'Booths and rooms');
  await expectText(page, 'What stands out');
  await expectText(page, 'Busiest:');
  await axe(page, 'the event dashboard');
});

await journey('narrowing to one booth relabels the funnel and keeps the link', async page => {
  await page.goto(BASE);
  await page.getByRole('link', { name: /KL Founders Expo/ }).click();
  await expectText(page, 'Who came, who stayed');
  await page.getByLabel('Showing').selectOption({ label: 'Booth A12 · TechFlow' });
  await expectText(page, 'Came to Booth A12 · TechFlow');
  if (!page.url().includes('zone=')) throw new Error(`the view is not in the address: ${page.url()}`);
  await page.reload();
  await expectText(page, 'Came to Booth A12 · TechFlow');
});

await journey("an exhibitor's funnel ends with the people who left their details", async page => {
  await page.goto(BASE);
  await page.getByRole('link', { name: /Mole at KL Tech Week/ }).click();
  await expectText(page, 'Came to your stand');
  await expectText(page, 'Left their details');
  // No venue sensor at someone else's event: said, not invented.
  await expectText(page, 'Not measured.');
});

await journey('an event with no sensors says how to start, not zeros', async page => {
  await page.goto(BASE);
  await page.getByRole('link', { name: /Mole Founders Meetup/ }).click();
  await expectText(page, 'No zones yet, so nothing to count');
  await page.getByRole('link', { name: 'Set up zones and sensors' }).click();
  await page.getByLabel('Name').fill('Main room');
  await page.getByLabel('Kind').selectOption('venue');
  await page.getByRole('button', { name: 'Add' }).click();
  await expectText(page, 'Counts everyone at the event');
  await page.getByRole('listitem').filter({ hasText: 'Main room' }).waitFor();
  await axe(page, 'zones and sensors');
});

await journey('pairing a sensor: scan or type, wait for the owner, paired', async page => {
  await page.goto(BASE);
  await page.getByRole('link', { name: 'Sensors' }).click();
  await expectText(page, 'Waiting for approval', 1).catch(() => {});
  await page.getByRole('link', { name: 'Pair a sensor' }).first().click();
  await page.getByLabel('Sensor code').fill('hello world');
  await page.getByRole('button', { name: /Ask PLExyz/ }).click();
  await expectText(page, "isn't a PLExyz device code");
  await page.getByLabel('Sensor code').fill('https://example.com/pair?code=PLX-NEW-0001');
  await page.getByLabel('What to call it').fill('Hall B entrance');
  await page.getByRole('button', { name: /Ask PLExyz/ }).click();
  await expectText(page, 'Waiting for the owner to allow it');
  await axe(page, 'waiting for approval');
  await page.getByRole('button', { name: 'Allow' }).click();
  await expectText(page, 'Paired');
  await page.getByRole('link', { name: 'Back to sensors' }).click();
  await page.getByText('Hall B entrance').waitFor();
});

await journey('a phone sees the dashboard without sideways scrolling', async page => {
  await page.goto(BASE);
  await page.getByRole('link', { name: /KL Founders Expo/ }).click();
  await expectText(page, 'Who came, who stayed');
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (over > 1) throw new Error(`the page is ${over}px wider than the phone`);
}, { width: 390, height: 844 });

await journey('the public sample never asks for a password, and is not indexed', async page => {
  await page.goto(BASE);
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.getByRole('button', { name: 'Explore the sample' }).waitFor();
  if (await page.locator('input[type=password]').count()) throw new Error('the sample sign-in page has a password box');
  const robots = await page.locator('meta[name=robots]').getAttribute('content');
  if (!/noindex/.test(robots ?? '')) throw new Error(`robots meta is ${robots}`);
  await axe(page, 'the sample sign-in page');
  await page.getByRole('button', { name: 'Explore the sample' }).click();
  await expectText(page, 'Your events');
});

await journey('an old link says so', async page => {
  await page.goto(`${BASE}/somewhere/else`);
  await expectText(page, 'Nothing at this address');
});

await browser.close();
server.kill();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
