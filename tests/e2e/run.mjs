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

import { axe, expectText, finish, journey, start } from './harness.mjs';

const BASE = await start({ port: 4199 });

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
  await page.getByRole('list', { name: 'Funnel' }).waitFor();
  const funnel = page.getByRole('list', { name: 'Funnel' });
  await funnel.getByText('At the event', { exact: true }).waitFor();
  const first = await funnel.locator('li').first().innerText();
  if (!/\d{3}/.test(first)) throw new Error(`no count on the first step: ${first}`);
  await expectText(page, 'Booths and rooms');
  await expectText(page, 'What stands out');
  await expectText(page, 'Busiest:');
  // The sample's 10 booth staff (2 at each of 5 booths) are left out, and it says so.
  await expectText(page, '10 phones that spent 3 hours or more at one booth were left out as booth staff.');
  await axe(page, 'the event dashboard');
});

await journey('narrowing to one booth relabels the funnel and keeps the link', async page => {
  await page.goto(BASE);
  await page.getByRole('link', { name: /KL Founders Expo/ }).click();
  await page.getByRole('list', { name: 'Funnel' }).waitFor();
  await page.getByLabel('Showing').selectOption({ label: 'Booth A12 · TechFlow' });
  await expectText(page, 'Came to Booth A12 · TechFlow');
  if (!page.url().includes('zone=')) throw new Error(`the view is not in the address: ${page.url()}`);
  await page.reload();
  await expectText(page, 'Came to Booth A12 · TechFlow');
});

await journey('the zone map shades each zone, opens its detail, and narrows the funnel to it', async page => {
  await page.goto(BASE);
  await page.getByRole('link', { name: /KL Founders Expo/ }).click();
  await page.getByRole('heading', { name: 'Zones at a glance' }).waitFor();
  await expectText(page, 'It is not a floor plan');
  const tile = page.getByRole('button', { name: /^Booth A12 · TechFlow\s*\d+\s*stayed$/ });
  if ((await tile.getAttribute('aria-pressed')) !== 'false') throw new Error('a tile starts pressed');
  await tile.click();
  if ((await tile.getAttribute('aria-pressed')) !== 'true') throw new Error('the tile did not show it was picked');
  const detail = page.getByRole('region', { name: 'Booth A12 · TechFlow, detail' });
  await detail.waitFor();
  await detail.getByText('Typical visit').waitFor();
  await axe(page, 'a zone’s detail');
  await page.getByRole('button', { name: 'Close the detail' }).click();
  await detail.waitFor({ state: 'detached' });
  await tile.click();
  await page.getByRole('button', { name: 'Show its funnel' }).click();
  await expectText(page, 'Came to Booth A12 · TechFlow');
  if (!page.url().includes('zone=')) throw new Error(`the view is not in the address: ${page.url()}`);
  // The ranked list is for the whole event; narrowed to one zone it steps aside.
  if (await page.getByRole('heading', { name: 'Booths and rooms' }).count()) throw new Error('the ranking stayed after narrowing to one zone');
});

await journey('on a phone the menu is a drawer: it opens, keeps focus, closes, and navigates', async page => {
  await page.goto(BASE);
  await page.getByRole('heading', { name: 'Your events' }).waitFor();   // the page has rendered, so "not there" means it
  if (await page.getByRole('navigation', { name: 'Main' }).isVisible()) throw new Error('the sidebar is showing on a phone');
  await page.getByRole('button', { name: 'Open the menu' }).click();
  const menu = page.getByRole('dialog', { name: 'Menu' });
  await menu.waitFor();
  await axe(page, 'the open menu');
  await page.keyboard.press('Escape');
  await menu.waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Open the menu' }).click();
  await menu.getByRole('link', { name: 'Sensors' }).click();
  await menu.waitFor({ state: 'hidden' });
  await expectText(page, 'Spare sensor');
}, { width: 390, height: 844 });

await journey('the funnel opens a stage to explain it, and closes with Escape', async page => {
  await page.goto(BASE);
  await page.getByRole('link', { name: /KL Founders Expo/ }).click();
  await page.getByRole('button', { name: /Stayed 3 min or more/ }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByText('What this means').waitFor();
  await sheet.getByText('Counted by PLExyz sensors').waitFor();
  await axe(page, 'the stage sheet');
  await page.keyboard.press('Escape');
  await sheet.waitFor({ state: 'detached' });
});

await journey('percentages, one hour, and the connection goal', async page => {
  await page.goto(BASE);
  await page.getByRole('link', { name: /KL Founders Expo/ }).click();
  const funnel = page.getByRole('list', { name: 'Funnel' });
  await funnel.waitFor();
  await page.getByRole('radio', { name: 'Percentages' }).click();
  await funnel.locator('li').nth(1).getByText(/^\d+(\.\d)?%$/).waitFor();
  if (!page.url().includes('pct=1')) throw new Error(`percentages are not in the address: ${page.url()}`);

  // The goal: 46 connections made against a goal of 40 is reached.
  await page.getByRole('radio', { name: 'People' }).click();
  await page.getByRole('spinbutton').fill('40');
  await expectText(page, 'Goal reached');

  // One hour: Mole's event-wide number steps aside rather than sitting beside an hour of visits.
  await page.getByRole('radio', { name: 'Hour' }).click();
  await page.getByLabel('Which hour').selectOption({ index: 3 });
  await funnel.getByText('Mole counts this for the whole event').waitFor();
  await expectText(page, 'quarter-hour');
});

await journey("an exhibitor's funnel ends with the people who left their details", async page => {
  await page.goto(BASE);
  await page.getByRole('link', { name: /Mole at KL Tech Week/ }).click();
  await expectText(page, 'Came to your stand');
  await expectText(page, 'Left their details');
  // No venue sensor at someone else's event: said, not invented.
  await expectText(page, 'Not measured');
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

  // Deleting asks in a Mole dialog, not the browser's confirm() (W-7).
  const boxes = [];
  page.on('dialog', d => { boxes.push(`${d.type()}: ${d.message()}`); d.dismiss().catch(() => {}); });
  const del = page.getByRole('button', { name: 'Delete Main room' });
  const asked = page.getByRole('dialog', { name: 'Delete “Main room”?' });
  await del.click();
  await asked.waitFor({ timeout: 3000 }).catch(() => {
    throw new Error(boxes.length ? `the browser's own box opened instead of a Mole dialog: ${boxes[0]}` : 'no dialog opened');
  });
  const focused = await page.evaluate(() => document.activeElement?.textContent);
  if (focused !== 'Cancel') throw new Error(`the dialog opened with "${focused}" focused, not Cancel`);
  await axe(page, 'the delete dialog');
  await asked.getByRole('button', { name: 'Cancel' }).click();
  await asked.waitFor({ state: 'detached' });
  await del.click();
  await page.keyboard.press('Escape');
  await asked.waitFor({ state: 'detached' });
  await page.getByRole('listitem').filter({ hasText: 'Main room' }).waitFor();
  await del.click();
  await asked.getByRole('button', { name: 'Delete zone' }).click();
  await page.getByRole('listitem').filter({ hasText: 'Main room' }).waitFor({ state: 'detached' });
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
  await page.getByRole('list', { name: 'Funnel' }).waitFor();
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

await finish();
