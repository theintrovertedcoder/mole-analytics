// The sign-in emails (scripts/build-emails.mjs). An email can't be checked the
// way a page can, so this holds what goes wrong in practice: a missing
// placeholder (Supabase sends the email with a hole in it), a colour that isn't
// Mole's, text nobody can read, a picture Gmail drops, and a file Gmail clips
// (it cuts anything over 102 kB).

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// @ts-expect-error — plain JS script, no types needed for this test
import { ASSET_BASE, build, EMAILS, render } from '../../scripts/build-emails.mjs';
import { contrast } from './contrast.ts';

const root = new URL('../../', import.meta.url);
const css = readFileSync(new URL('brand/colours/tokens.css', root), 'utf8');
const tokenHexes = new Set([...css.matchAll(/:\s*(#[0-9a-f]{6});/g)].map(m => m[1]!));

describe.each(EMAILS as { file: string; supabase: string; subject: string; button?: [string, string]; code?: string; sunny: [string, string] }[])('the $supabase email', e => {
  const html: string = render(e);

  it('carries what Supabase fills in, and only Supabase’s words', () => {
    if (e.button) expect(html).toContain('href="{{ .ConfirmationURL }}"');
    if (e.code) expect(html).toContain('{{ .Token }}');
    const used = [...html.matchAll(/\{\{\s*([^}]*?)\s*\}\}/g)].map(m => m[1]);
    for (const w of used) expect(['.ConfirmationURL', '.Token', '.Email', '.NewEmail']).toContain(w);
    // A code-only email has no link to click and the other way round.
    expect(Boolean(e.button) || Boolean(e.code)).toBe(true);
  });

  it('is safe for an inbox: no script, no stylesheet, no SVG, https pictures with alt text', () => {
    expect(html).not.toMatch(/<script|<link|<style|<svg|javascript:|\.svg/i);
    const imgs = [...html.matchAll(/<img\b[^>]*>/g)].map(m => m[0]);
    expect(imgs.length).toBeGreaterThanOrEqual(2);
    for (const img of imgs) {
      expect(img).toMatch(/src="https:\/\/sense\.mole\.is\/email\/[a-z-]+\.png"/);
      expect(img).toMatch(/alt="[^"]+"/);
      expect(img).toMatch(/width="\d+"/);
    }
  });

  it('uses Mole’s colours and no others', () => {
    const colours = [...html.matchAll(/#[0-9a-fA-F]{6}\b/g)].map(m => m[0].toLowerCase());
    expect(colours.length).toBeGreaterThan(5);
    for (const c of colours) expect(tokenHexes, c).toContain(c);
  });

  it('stays under Gmail’s clipping limit', () => {
    expect(Buffer.byteLength(html)).toBeLessThan(30_000);
  });
});

describe('the emails’ text can be read', () => {
  const t = (name: string) => css.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`))![1]!;
  const pairs: [string, string, string, number][] = [
    ['brand-ink', 'neutral-surface', 'the title and the details in bold', 4.5],
    ['neutral-fg-muted', 'neutral-surface', 'the words and the small print', 4.5],
    ['neutral-fg-muted', 'brand-base', 'the footer', 4.5],
    ['brand-purple-text', 'brand-base', 'the footer link', 4.5],
    ['neutral-on-fill', 'brand-purple', 'the button', 4.5],
    ['brand-ink', 'brand-purple-tint', 'the code', 4.5],
  ];
  it.each(pairs)('%s on %s clears %s:1 (%s)', (fg, bg, _where, min) => {
    expect(contrast(t(fg), t(bg))).toBeGreaterThanOrEqual(min);
  });
});

describe('the files', () => {
  it('are up to date with the generator', () => {
    for (const { file, content } of build() as { file: string; content: string }[]) {
      expect(readFileSync(file, 'utf8'), file).toBe(content);
    }
  });

  it('use pictures that exist and are small', () => {
    const names = new Set<string>();
    for (const e of EMAILS as { sunny: [string, string] }[]) names.add(e.sunny[0]);
    names.add('logo');
    const dir = new URL('public/email/', root);
    const have = readdirSync(dir);
    for (const n of names) {
      expect(have, n).toContain(`${n}.png`);
      expect(statSync(new URL(`${n}.png`, dir)).size).toBeLessThan(40_000);
    }
  });

  it('point at the address the app is served from', () => {
    expect(ASSET_BASE).toBe('https://sense.mole.is/email');
  });
});
