// src/domain/ribbon.ts
// ─────────────────────────────────────────────────────────────────────────────
// The shape of the funnel ribbon: the prototype's flowing stream, kept.
// ─────────────────────────────────────────────────────────────────────────────
// Each stage is a 100-unit slot. The ribbon is as thick as the stage's count
// allows (25 to 95 units of 100, so the smallest step is still visible and the
// biggest never touches the edge), and smooth cubic curves join the stages.
// The same path is drawn across (desktop) or down (phone).
//
// Only stages with a number take part. A stage with no sensor behind it has no
// thickness to draw, so the ribbon starts at the first measured stage and ends
// at the last one in an unbroken run; the stages outside it say "not
// measured" in their own column instead of being drawn as if they were tiny.
// ─────────────────────────────────────────────────────────────────────────────

export const SLOT = 100;
export const MIN_THICKNESS = 25;
export const MAX_THICKNESS = 95;

/** The first unbroken run of measured stages, as [first, last] indices, or null. */
export function measuredRun(values: (number | null)[]): [number, number] | null {
  const first = values.findIndex(v => v != null);
  if (first < 0) return null;
  let last = first;
  while (last + 1 < values.length && values[last + 1] != null) last++;
  return [first, last];
}

/** Thickness per stage in the run, scaled to the largest value in it. */
export function thicknesses(values: number[]): number[] {
  const max = Math.max(1, ...values);
  return values.map(v => MIN_THICKNESS + (Math.max(0, v) / max) * (MAX_THICKNESS - MIN_THICKNESS));
}

type Pt = { x: number; y: number };

/** A smooth outline through the stage centres, with flat ends at the run's edges. */
function outline(t: number[], start: number, orientation: 'h' | 'v', widen: number): string {
  const centreAt = (i: number) => (start + i) * SLOT + SLOT / 2;
  const from = start * SLOT, to = (start + t.length) * SLOT;
  const half = (w: number) => (w * widen) / 2;

  // Along the flow (x across, or y down) and across it (the edge's offset).
  const edge = (side: -1 | 1): Pt[] => [
    { x: from, y: 50 + side * half(t[0]!) },
    ...t.map((w, i) => ({ x: centreAt(i), y: 50 + side * half(w) })),
    { x: to, y: 50 + side * half(t[t.length - 1]!) },
  ];
  const map = (p: Pt) => (orientation === 'h' ? `${p.x} ${p.y}` : `${p.y} ${p.x}`);

  const curve = (pts: Pt[]) => {
    let d = '';
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]!, b = pts[i + 1]!;
      const mid = (a.x + b.x) / 2;
      d += ` C ${map({ x: mid, y: a.y })}, ${map({ x: mid, y: b.y })}, ${map(b)}`;
    }
    return d;
  };

  const top = edge(-1), bottom = edge(1).reverse();
  return `M ${map(top[0]!)}${curve(top)} L ${map(bottom[0]!)}${curve(bottom)} Z`;
}

export interface Ribbon {
  /** The run of stages the ribbon covers. */
  run: [number, number];
  path: string;
  /** Slightly wider, drawn blurred behind the main path. */
  glow: string;
}

export function ribbon(values: (number | null)[], orientation: 'h' | 'v'): Ribbon | null {
  const run = measuredRun(values);
  if (!run) return null;
  const t = thicknesses(values.slice(run[0], run[1] + 1) as number[]);
  return { run, path: outline(t, run[0], orientation, 1), glow: outline(t, run[0], orientation, 1.15) };
}
