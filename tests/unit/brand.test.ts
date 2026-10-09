// The colours, measured rather than eyeballed. "White on Loop green looked
// fine and was 2.28:1." Every text-on-background pair the app uses is listed
// here with the ratio it must clear, computed from the sunny-kit tokens in
// brand/colours/tokens.css. A new pair in the UI belongs in this list.

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GLASS_ALPHA } from '../../src/ui/FlowFunnel.tsx';
// @ts-expect-error — plain JS config, no types needed for this test
import tailwind from '../../tailwind.config.js';
// @ts-expect-error — plain JS script, no types needed for this test
import { build as buildOnDark } from '../../scripts/sunny-on-dark.mjs';

const root = new URL('../../', import.meta.url);
const css = readFileSync(new URL('brand/colours/tokens.css', root), 'utf8');
const vars = new Map<string, string>([...css.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)].map(m => [m[1]!, m[2]!.trim()]));

function resolve(name: string): string {
  let v = vars.get(name);
  for (let i = 0; v && v.startsWith('var(') && i < 5; i++) v = vars.get(v.slice(6, -1));
  if (!v || !/^#[0-9a-f]{6}$/i.test(v)) throw new Error(`--${name} is not a hex colour: ${v}`);
  return v;
}

import { contrast } from './contrast.ts';

const c = resolve;

// [text, background, minimum, where]
const PAIRS: [string, string, number, string][] = [
  ['brand-ink', 'loop-ground', 4.5, 'body text on the page'],
  ['brand-ink', 'neutral-surface', 4.5, 'text on cards'],
  ['brand-ink', 'loop-tint', 4.5, 'the current page in the nav'],
  ['loop-text', 'neutral-surface', 4.5, '"Sense" beside the logo'],
  ['neutral-fg-muted', 'neutral-surface', 4.5, 'secondary text on cards'],
  ['neutral-fg-muted', 'loop-ground', 4.5, 'secondary text on the page'],
  ['neutral-fg-muted', 'neutral-surface-3', 4.5, 'neutral pill'],
  ['neutral-fg-subtle', 'neutral-surface', 4.5, 'hints, axis labels, placeholders'],
  ['neutral-fg-subtle', 'loop-ground', 4.5, 'hints on the page'],
  ['brand-purple-text', 'neutral-surface', 4.5, 'links and quiet buttons'],
  ['brand-purple-text', 'brand-purple-tint', 4.5, 'purple pill'],
  ['neutral-on-fill', 'brand-purple', 4.5, 'primary button'],
  ['events-text', 'events-tint', 4.5, 'events pill and icon'],
  ['status-success-text', 'status-success-tint', 4.5, 'reporting pill, goal reached'],
  ['status-warning-text', 'status-warning-tint', 4.5, 'waiting pill and note'],
  ['status-error-text', 'status-error-tint', 4.5, 'errors'],
  ['status-error-text', 'neutral-surface', 4.5, 'danger button, low battery'],
  ['status-info-text', 'status-info-tint', 4.5, 'quiet sensor pill'],
  ['brand-yellow-text', 'brand-yellow-tint', 4.5, 'the sample-data banner'],
  ['neutral-on-fill', 'brand-ink', 4.5, 'chart tooltip'],
  ['loop-sidebar-text', 'brand-ink', 4.5, 'chart tooltip, second line'],
  ['loop-on', 'loop', 4.5, "the funnel goal's pill"],
  // Marks, not text: 3:1 against what they sit on.
  ['brand-purple', 'neutral-surface', 3, 'the traffic line and zone bars'],
];

describe('brand contrast', () => {
  it.each(PAIRS)('%s on %s clears %s:1 (%s)', (fg, bg, min) => {
    expect(contrast(c(fg), c(bg))).toBeGreaterThanOrEqual(min);
  });

  it('can tell a failing pair from a passing one', () => {
    // The control: white on Loop green, the pair that started the rule.
    expect(contrast('#ffffff', c('loop'))).toBeLessThan(2.5);
  });
});

// The funnel's words sit on loop-navy glass over the stream (FlowFunnel.tsx,
// GLASS_ALPHA, read from there so the two cannot drift). What they must clear
// depends on what the glass is over, so everything that can be under it is
// tried: the bare panel, the purple stream, its glow, and Sunny's yellow glow.
describe('the funnel glass', () => {
  const hex = (n: number[]) => '#' + n.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
  const rgb = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const over = (top: string, a: number, bottom: string) => hex(rgb(top).map((v, i) => v * a + rgb(bottom)[i]! * (1 - a)));
  const navy = c('loop-navy');
  const purple = c('brand-purple');
  const yellow = c('brand-yellow');
  const under: [string, string][] = [
    ['the bare panel', navy],
    ['the stream', purple],
    ['the stream glow at the goal', over(purple, 0.45, navy)],
    ["Sunny's glow on the panel", over(yellow, 0.35, navy)],
    ["Sunny's glow on the stream", over(yellow, 0.35, purple)],
  ];

  it.each(under)('words stay readable over %s', (_, bottom) => {
    const glass = over(navy, GLASS_ALPHA, bottom);
    expect(contrast(c('neutral-on-fill'), glass)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c('loop-sidebar-text'), glass)).toBeGreaterThanOrEqual(4.5);
    // The step pills: a 13% white wash. (The goal's pill is solid; see PAIRS.)
    expect(contrast(c('neutral-on-fill'), over(c('neutral-on-fill'), 0.13, glass))).toBeGreaterThanOrEqual(4.5);
  });

  it('would have caught the prototype', () => {
    // White straight on the stream's old yellow end.
    expect(contrast('#ffffff', yellow)).toBeLessThan(1.5);
  });
});

describe('tailwind colours', () => {
  it('names only variables that exist in the tokens', () => {
    const missing: string[] = [];
    const walk = (o: unknown) => {
      if (typeof o === 'string') {
        for (const m of o.matchAll(/var\(--([a-z0-9-]+)\)/g)) if (!vars.has(m[1]!)) missing.push(m[1]!);
      } else if (o && typeof o === 'object') Object.values(o).forEach(walk);
    };
    walk(tailwind.theme.extend);
    expect(missing).toEqual([]);
  });

  it('holds no colour of its own', () => {
    const literal = JSON.stringify(tailwind.theme.extend.colors).match(/#[0-9a-f]{3,8}|rgba?\(/gi);
    expect(literal).toBeNull();
  });
});

// brand/ and the logos are sunny-kit's files, unedited (brand/README.md).
describe('the sunny-kit copies', () => {
  const manifest = JSON.parse(readFileSync(new URL('brand/sunny-kit.json', root), 'utf8')) as {
    files: Record<string, { kit: string; sha256: string }>;
  };
  const entries = Object.entries(manifest.files);

  it('covers the tokens, the fonts, the logos and Sunny', () => {
    const here = entries.map(([f]) => f);
    for (const f of ['brand/colours/tokens.css', 'public/brand/mole-logo.svg', 'public/brand/mole-badge.svg', 'public/favicon.svg', 'public/brand/sunny.svg'])
      expect(here).toContain(f);
  });

  it.each(entries)('%s is the kit file, byte for byte', (file, { sha256 }) => {
    expect(createHash('sha256').update(readFileSync(new URL(file, root))).digest('hex')).toBe(sha256);
  });

  it('has an up-to-date Sunny for the dark panel', () => {
    for (const { file, content } of buildOnDark() as { file: string; content: string }[])
      expect(readFileSync(file, 'utf8'), file).toBe(content);
  });
});
