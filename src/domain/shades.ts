// How the zone map shades a tile. The classes are written out whole, because
// Tailwind only builds the ones it can read; `mix` is the same shade as a
// number, so tests/unit/brand.test.ts can measure the text on every one.

export interface Shade {
  /** Percent of brand-purple over white; null for the plain "nobody stayed" tile. */
  mix: number | null;
  /** The text token on it: ink on the light shades, white only on solid purple. */
  text: 'brand-ink' | 'neutral-on-fill';
  classes: string;
}

/** Five shades, lightest to darkest. Index 0 is "nobody stayed". */
export const SHADES: readonly Shade[] = [
  { mix: null, text: 'brand-ink', classes: 'bg-surface-3 text-ink' },
  { mix: 14, text: 'brand-ink', classes: 'bg-[color-mix(in_srgb,var(--brand-purple)_14%,var(--neutral-surface))] text-ink' },
  { mix: 28, text: 'brand-ink', classes: 'bg-[color-mix(in_srgb,var(--brand-purple)_28%,var(--neutral-surface))] text-ink' },
  { mix: 42, text: 'brand-ink', classes: 'bg-[color-mix(in_srgb,var(--brand-purple)_42%,var(--neutral-surface))] text-ink' },
  { mix: 100, text: 'neutral-on-fill', classes: 'bg-purple text-on-fill' },
];

/** Which shade a zone gets, by how its stayed count compares with the busiest zone's. */
export function shadeFor(stayed: number, top: number): number {
  if (stayed <= 0 || top <= 0) return 0;
  const r = stayed / top;
  return r > 0.75 ? 4 : r > 0.5 ? 3 : r > 0.25 ? 2 : 1;
}
