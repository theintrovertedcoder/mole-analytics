/** @type {import('tailwindcss').Config} */
// Every colour here is a Mole token from sunny-kit, the canonical set for every
// Mole product (the brand owner, 2026-10-08), read from brand/colours/tokens.css
// (loaded in src/index.css). brand/README.md says how to update it.
// tests/unit/brand.test.ts holds each name to a variable that exists.
//
// Mole Sense is purple, green and yellow, each with one job (sunny-kit
// docs/products.md): purple is the main button and the data, green (Loop) is
// where you are, yellow is Sunny, the glow and progress towards a goal.
const v = (name) => `var(--${name})`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Poppins', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        ink: v('brand-ink'),
        base: v('brand-base'),
        purple: {
          DEFAULT: v('brand-purple'),
          tint: v('brand-purple-tint'),
          text: v('brand-purple-text'),
          border: v('brand-purple-border'),
        },
        sunny: { DEFAULT: v('brand-yellow'), tint: v('brand-yellow-tint'), text: v('brand-yellow-text') },
        events: { DEFAULT: v('events'), tint: v('events-tint'), text: v('events-text') },
        loop: {
          DEFAULT: v('loop'),
          tint: v('loop-tint'),
          text: v('loop-text'),
          on: v('loop-on'),
          ground: v('loop-ground'),
          border: v('loop-border'),
          navy: v('loop-navy'),
          // The den's dark sidebar text: secondary words on a dark Loop surface.
          'on-dark': v('loop-sidebar-text'),
          'on-dark-muted': v('loop-sidebar-label'),
        },
        fg: { DEFAULT: v('neutral-fg'), muted: v('neutral-fg-muted'), subtle: v('neutral-fg-subtle'), disabled: v('neutral-fg-disabled') },
        line: { DEFAULT: v('neutral-border'), strong: v('neutral-border-strong') },
        surface: { DEFAULT: v('neutral-surface'), 2: v('neutral-surface-2'), 3: v('neutral-surface-3') },
        'on-fill': v('neutral-on-fill'),
        ok: { DEFAULT: v('status-success'), tint: v('status-success-tint'), text: v('status-success-text'), border: v('status-success-border') },
        warn: { DEFAULT: v('status-warning'), tint: v('status-warning-tint'), text: v('status-warning-text'), border: v('status-warning-border') },
        bad: { DEFAULT: v('status-error'), tint: v('status-error-tint'), text: v('status-error-text'), border: v('status-error-border') },
        info: { DEFAULT: v('status-info'), tint: v('status-info-tint'), text: v('status-info-text'), border: v('status-info-border') },
      },
      borderRadius: {
        chip: v('radius-chip'),
        panel: v('radius-panel'),
        card: v('radius-card'),
        feature: v('radius-feature'),
        sheet: v('radius-sheet'),
      },
      boxShadow: {
        subtle: v('shadow-subtle'),
        medium: v('shadow-medium'),
        large: v('shadow-large'),
        elevated: v('shadow-elevated'),
      },
      // The brand book's motion (Motion): three durations and named curves.
      // They are written in the book, not in the tokens file, so they are here.
      transitionDuration: { fast: '120ms', normal: '200ms', slow: '300ms' },
      transitionTimingFunction: {
        ease: 'cubic-bezier(0.4, 0, 0.2, 1)',
        enter: 'cubic-bezier(0.22, 1, 0.36, 1)',
        exit: 'cubic-bezier(0.4, 0, 1, 1)',
      },
      zIndex: { sticky: v('z-sticky'), overlay: v('z-overlay'), modal: v('z-modal'), toast: v('z-toast') },
    },
  },
  plugins: [],
};
