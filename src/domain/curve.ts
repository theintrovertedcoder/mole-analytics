// src/domain/curve.ts
// The prototype's traffic line was a smooth curve. A naive smooth curve
// overshoots: between 0 and 300 people it can dip below zero or bulge above
// the peak, drawing people who were never there. This is monotone cubic
// interpolation (Fritsch–Carlson): smooth, and never beyond its neighbours.

export interface Pt {
  x: number;
  y: number;
}

export function monotonePath(p: Pt[]): string {
  const n = p.length;
  if (n === 0) return '';
  if (n === 1) return `M${p[0]!.x},${p[0]!.y}`;
  const dx = (i: number) => p[i + 1]!.x - p[i]!.x;
  const slope = (i: number) => (p[i + 1]!.y - p[i]!.y) / dx(i);

  // Tangents: the mean of the neighbouring slopes, zero at a peak or a valley.
  const m: number[] = new Array(n);
  m[0] = slope(0);
  m[n - 1] = slope(n - 2);
  for (let i = 1; i < n - 1; i++) {
    const a = slope(i - 1), b = slope(i);
    m[i] = a * b <= 0 ? 0 : (a + b) / 2;
  }
  // Limit them so the curve cannot overshoot (Fritsch–Carlson).
  for (let i = 0; i < n - 1; i++) {
    const s = slope(i);
    if (s === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i]! / s, b = m[i + 1]! / s;
    const h = a * a + b * b;
    if (h > 9) {
      const t = 3 / Math.sqrt(h);
      m[i] = t * a * s;
      m[i + 1] = t * b * s;
    }
  }

  const f = (v: number) => Number(v.toFixed(2));
  let d = `M${f(p[0]!.x)},${f(p[0]!.y)}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx(i) / 3;
    d += `C${f(p[i]!.x + h)},${f(p[i]!.y + m[i]! * h)} ${f(p[i + 1]!.x - h)},${f(p[i + 1]!.y - m[i + 1]! * h)} ${f(p[i + 1]!.x)},${f(p[i + 1]!.y)}`;
  }
  return d;
}
