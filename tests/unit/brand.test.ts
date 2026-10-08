// The colours, measured rather than eyeballed. "White on Loop green looked
// fine and was 2.28:1." Every text-on-background pair the app uses is listed
// here with the ratio it must clear, computed from brand/mole-tokens.css.
// A new pair in the UI belongs in this list.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GLASS_ALPHA } from '../../src/ui/FlowFunnel.tsx';
// @ts-expect-error — plain JS config, no types needed for this test
import tailwind from '../../tailwind.config.js';

const css = readFileSync(new URL('../../brand/mole-tokens.css', import.meta.url), 'utf8');
const vars = new Map<string, string>([...css.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)].map(m => [m[1]!, m[2]!.trim()]));

function resolve(name: string): string {
  let v = vars.get(name);
  for (let i = 0; v && v.startsWith('var(') && i < 5; i++) v = vars.get(v.slice(6, -1));
  if (!v || !/^#[0-9a-f]{6}$/i.test(v)) throw new Error(`--${name} is not a hex colour: ${v}`);
  return v;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
}

const WHITE = '#ffffff';
const c = (n: string) => (n === 'white' ? WHITE : resolve(n));

// [text, background, minimum, where]
const PAIRS: [string, string, number, string][] = [
  ['brand-ink', 'brand-base', 4.5, 'body text on the page'],
  ['brand-ink', 'neutral-surface', 4.5, 'text on cards'],
  ['neutral-fg-muted', 'neutral-surface', 4.5, 'secondary text on cards'],
  ['neutral-fg-muted', 'brand-base', 4.5, 'secondary text on the page'],
  ['neutral-fg-muted', 'neutral-surface-3', 4.5, 'neutral pill'],
  ['neutral-fg-subtle', 'neutral-surface', 4.5, 'hints, axis labels, placeholders'],
  ['neutral-fg-subtle', 'brand-base', 4.5, 'hints on the page'],
  ['brand-purple-text', 'neutral-surface', 4.5, 'links and quiet buttons'],
  ['brand-purple-text', 'brand-purple-tint', 4.5, 'purple pill, active nav'],
  ['white', 'brand-purple', 4.5, 'primary button'],
  ['events-text', 'events-tint', 4.5, 'events pill and icon'],
  ['status-success-text', 'status-success-tint', 4.5, 'reporting pill'],
  ['status-warning-text', 'status-warning-tint', 4.5, 'waiting pill and note'],
  ['status-error-text', 'status-error-tint', 4.5, 'errors'],
  ['status-error-text', 'neutral-surface', 4.5, 'danger button, low battery'],
  ['status-info-text', 'status-info-tint', 4.5, 'quiet sensor pill'],
  ['brand-yellow-text', 'brand-yellow-tint', 4.5, 'the sample-data banner'],
  ['board-fg', 'board', 4.5, 'chart tooltip'],
  ['board-muted', 'board', 4.5, 'chart tooltip, second line'],
  // Marks, not text: 3:1 against what they sit on.
  ['brand-purple', 'neutral-surface', 3, 'funnel bars and the traffic line'],
];

describe('brand contrast', () => {
  it.each(PAIRS)('%s on %s clears %s:1 (%s)', (fg, bg, min) => {
    expect(contrast(c(fg), c(bg))).toBeGreaterThanOrEqual(min);
  });

  it('can tell a failing pair from a passing one', () => {
    // The control: white on Loop green, the pair that started the rule.
    expect(contrast(WHITE, '#22c55e')).toBeLessThan(2.5);
  });
});

// The funnel's words sit on dark glass over the ribbon (FlowFunnel.tsx,
// GLASS_ALPHA, read from there so the two cannot drift). At 0.72 this failed
// over the yellow end at 4.0:1; 0.82 is the least that passes. What they must clear depends on what the glass is over, so
// every colour the ribbon passes through is tried, including its yellow end,
// where the prototype's white numbers were about 1.3:1.
describe('the funnel glass', () => {
  const hex = (n: number[]) => '#' + n.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
  const rgb = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const over = (top: string, a: number, bottom: string) => hex(rgb(top).map((c, i) => c * a + rgb(bottom)[i]! * (1 - a)));
  const mix = (a: string, b: string, t: number) => hex(rgb(a).map((c, i) => c + (rgb(b)[i]! - c) * t));
  const GLASS = GLASS_ALPHA;
  const ribbonColours = [0, 0.25, 0.5, 0.75, 1].map(t => mix(c('brand-purple'), c('brand-yellow'), t)).concat(c('board'));

  it.each(ribbonColours)('words stay readable over %s', under => {
    const glass = over(c('board'), GLASS, under);
    expect(contrast(c('board-fg'), glass)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c('board-muted'), glass)).toBeGreaterThanOrEqual(4.5);
    // The pills: a 13% white wash, and the goal's 20% green one.
    expect(contrast(c('board-fg'), over('#ffffff', 0.13, glass))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c('board-ok'), over(c('board-ok'), 0.2, glass))).toBeGreaterThanOrEqual(4.5);
  });

  it('would have caught the prototype', () => {
    expect(contrast('#ffffff', c('brand-yellow'))).toBeLessThan(1.5);
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
});
