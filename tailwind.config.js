/** @type {import('tailwindcss').Config} */
// Every colour here is a Mole token, read from brand/mole-tokens.css (loaded in
// src/index.css). Using the variables rather than copying hex values means a
// change to the design system reaches this product by copying the three brand
// files, with nothing to edit here. tests/unit/brand.test.ts holds each name to
// a variable that exists.
const v = (name) => `var(--${name})`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Poppins', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        ink: v('brand-ink'),
        base: v('brand-base'),
        purple: {
          DEFAULT: v('brand-purple'),
          hover: v('brand-purple-hover'),
          tint: v('brand-purple-tint'),
          text: v('brand-purple-text'),
          border: v('brand-purple-border'),
          deep: v('purple-deep'),
        },
        sunny: { DEFAULT: v('brand-yellow'), tint: v('brand-yellow-tint'), text: v('brand-yellow-text') },
        events: { DEFAULT: v('events'), tint: v('events-tint'), text: v('events-text') },
        lavender: v('lavender'),
        fg: { DEFAULT: v('neutral-fg'), muted: v('neutral-fg-muted'), subtle: v('neutral-fg-subtle'), disabled: v('neutral-fg-disabled') },
        line: { DEFAULT: v('neutral-border'), strong: v('neutral-border-strong') },
        surface: { DEFAULT: v('neutral-surface'), 2: v('neutral-surface-2'), 3: v('neutral-surface-3') },
        ok: { DEFAULT: v('status-success'), tint: v('status-success-tint'), text: v('status-success-text'), border: v('status-success-border') },
        warn: { DEFAULT: v('status-warning'), tint: v('status-warning-tint'), text: v('status-warning-text'), border: v('status-warning-border') },
        bad: { DEFAULT: v('status-error'), tint: v('status-error-tint'), text: v('status-error-text'), border: v('status-error-border') },
        info: { DEFAULT: v('status-info'), tint: v('status-info-tint'), text: v('status-info-text'), border: v('status-info-border') },
        board: { DEFAULT: v('board'), 2: v('board-2'), fg: v('board-fg'), muted: v('board-muted') },
      },
      borderRadius: {
        chip: v('radius-chip'),
        panel: v('radius-panel'),
        card: v('radius-card'),
        feature: v('radius-feature'),
      },
      boxShadow: {
        subtle: v('shadow-subtle'),
        medium: v('shadow-medium'),
        panel: v('shadow-panel'),
        loud: v('shadow-loud'),
      },
      transitionTimingFunction: { enter: v('ease-enter'), exit: v('ease-exit') },
    },
  },
  plugins: [],
};
