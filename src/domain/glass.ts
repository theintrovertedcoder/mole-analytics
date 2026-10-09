// The dark glass every word on a navy panel sits on (the funnel, and the
// sign-in page's picture of it). Its opacity is what tests/unit/brand.test.ts
// measures, over every colour that can be under it, so it lives in one place.

import type { CSSProperties } from 'react';

export const GLASS_ALPHA = 0.84;

export const glass: CSSProperties = {
  background: `color-mix(in srgb, var(--loop-navy) ${GLASS_ALPHA * 100}%, transparent)`,
  backdropFilter: 'blur(6px)',
  WebkitBackdropFilter: 'blur(6px)',
};
