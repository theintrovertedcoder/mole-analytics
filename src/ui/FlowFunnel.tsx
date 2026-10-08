// src/ui/FlowFunnel.tsx
// ─────────────────────────────────────────────────────────────────────────────
// The funnel, as the prototype drew it: a stream that narrows stage by stage,
// on a dark panel. Across on a wide screen, down on a phone. Tap a stage for
// what it means and how it is counted.
//
// On brand (sunny-kit, the brand owner's decisions of 2026-10-08):
//   • The panel is loop-navy, Loop's deep colour: Mole Sense is purple, green
//     and yellow, and green is the Loop family.
//   • The stream is brand-purple alone. Three gradients only, so the
//     prototype's purple-to-yellow blend went; yellow arrives as the glow
//     behind Sunny at the goal, which is one of the three.
//   • The goal's conversion pill is solid Loop green with Loop's own ink text
//     (loop-on): green is "goal reached". Green text on a green wash was 3.9:1.
//   • Sunny sits on the dark panel with the kit's white die-cut border
//     (scripts/sunny-on-dark.mjs): the hand-drawn Sunny, and the delighted
//     mood once the goal is reached.
//
// Kept from the prototype: the ribbon and its glow, Start / Step / Goal, the
// stage icons, the big numbers, the conversion pills, the mascot at the end
// (now Sunny, Mole's own), and the percentage view.
//
// Changed, on purpose:
//   • Text sits on dark glass, not straight on the stream. White on the
//     prototype's yellow end was about 1.3:1; on the glass it clears 4.5:1
//     wherever the stream or the glow is under it (tests/unit/brand.test.ts).
//   • A stage with no sensor says "Not measured" in its column, and the ribbon
//     is only drawn through stages that have a number.
//   • One list in the DOM for both layouts, so a screen reader reads it once.
// ─────────────────────────────────────────────────────────────────────────────

import { Clock, Handshake, MapPin, Users } from 'lucide-react';
import type { CSSProperties } from 'react';
import { formatCount, formatPercent } from '../domain/format.ts';
import type { Stage, StageKey } from '../domain/funnel.ts';
import { ribbon, SLOT } from '../domain/ribbon.ts';
import { useTween } from '../lib/useTween.ts';

const ICON: Record<StageKey, typeof Users> = {
  venue: Users,
  visited: MapPin,
  stayed: Clock,
  details: Handshake,
  connections: Handshake,
};

/** The glass every word on the panel sits on. Its opacity is what the contrast test assumes. */
export const GLASS_ALPHA = 0.84;
const glass: CSSProperties = {
  background: `color-mix(in srgb, var(--loop-navy) ${GLASS_ALPHA * 100}%, transparent)`,
  backdropFilter: 'blur(6px)',
  WebkitBackdropFilter: 'blur(6px)',
};

const eyebrow = (i: number, n: number) => (i === 0 ? 'Start' : i === n - 1 ? 'Goal' : `Step ${i + 1}`);

function Ribbon({ values, orientation, goalMet }: { values: (number | null)[]; orientation: 'h' | 'v'; goalMet: boolean }) {
  const r = ribbon(values, orientation);
  const n = values.length;
  const box = orientation === 'h' ? `0 0 ${n * SLOT} 100` : `0 0 100 ${n * SLOT}`;
  const id = `ribbon-${orientation}`;
  return (
    <svg
      viewBox={box}
      preserveAspectRatio="none"
      aria-hidden
      className={`pointer-events-none absolute inset-0 h-full w-full ${orientation === 'h' ? 'hidden lg:block' : 'lg:hidden'}`}
    >
      <defs>
        <filter id={`${id}-blur`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation={orientation === 'h' ? 4 : 5} />
        </filter>
        {/* Where the run starts or ends at a stage with no sensor, the stream
            fades in or out over a short distance instead of stopping at a wall. */}
        {r && (() => {
          const a = r.run[0] * SLOT, b = (r.run[1] + 1) * SLOT;
          const fadeIn = r.run[0] > 0 ? 45 : 0, fadeOut = r.run[1] < n - 1 ? 45 : 0;
          const along = orientation === 'h' ? { x1: a, x2: b, y1: 0, y2: 0 } : { x1: 0, x2: 0, y1: a, y2: b };
          const len = b - a;
          return (
            <>
              <linearGradient id={`${id}-fade`} gradientUnits="userSpaceOnUse" {...along}>
                <stop offset={0} stopColor="#fff" stopOpacity={fadeIn ? 0 : 1} />
                <stop offset={fadeIn / len} stopColor="#fff" stopOpacity={1} />
                <stop offset={1 - fadeOut / len} stopColor="#fff" stopOpacity={1} />
                <stop offset={1} stopColor="#fff" stopOpacity={fadeOut ? 0 : 1} />
              </linearGradient>
              <mask id={`${id}-mask`} maskUnits="userSpaceOnUse" x={-50} y={-50}
                width={orientation === 'h' ? n * SLOT + 100 : 200} height={orientation === 'h' ? 200 : n * SLOT + 100}>
                <rect x={-50} y={-50} width={orientation === 'h' ? n * SLOT + 100 : 200}
                  height={orientation === 'h' ? 200 : n * SLOT + 100} fill={`url(#${id}-fade)`} />
              </mask>
            </>
          );
        })()}
      </defs>
      {orientation === 'h' && Array.from({ length: n - 1 }, (_, i) => (
        <line key={i} x1={(i + 1) * SLOT} x2={(i + 1) * SLOT} y1={0} y2={100}
          stroke="var(--neutral-on-fill)" strokeOpacity={0.13} strokeWidth={0.5} vectorEffect="non-scaling-stroke" />
      ))}
      {r && (
        <g mask={`url(#${id}-mask)`}>
          <path d={r.glow} fill="var(--brand-purple)" opacity={goalMet ? 0.45 : 0.3} filter={`url(#${id}-blur)`} />
          <path d={r.path} fill="var(--brand-purple)" />
        </g>
      )}
    </svg>
  );
}

export function FlowFunnel({ stages, showPercent, goalMet = false, onOpen }: {
  stages: Stage[];
  showPercent: boolean;
  goalMet?: boolean;
  onOpen: (stage: Stage) => void;
}) {
  const values = useTween(stages.map(s => s.value));
  const n = stages.length;
  const lastMeasured = stages[n - 1]?.value != null;

  return (
    <div className="relative overflow-hidden rounded-feature bg-loop-navy text-on-fill shadow-large">
      <Ribbon values={values} orientation="h" goalMet={goalMet} />
      <Ribbon values={values} orientation="v" goalMet={goalMet} />

      <ol aria-label="Funnel" className="relative flex flex-col lg:min-h-[400px] lg:flex-row">
        {stages.map((s, i) => {
          const Icon = ICON[s.key];
          const rate = s.value != null && s.of != null ? formatPercent(s.value, s.of) : null;
          const big = s.value == null ? '—' : showPercent && rate ? rate : formatCount(s.value);
          const small = s.value == null ? null : showPercent && rate ? formatCount(s.value) : rate ? `${rate} of step ${i}` : null;
          return (
            <li key={s.key} className="flex min-h-[124px] flex-1 lg:min-h-0">
              <button
                type="button"
                onClick={() => onOpen(s)}
                className={`group flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors
                  hover:bg-[color-mix(in_srgb,var(--neutral-on-fill)_5%,transparent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-sunny
                  sm:px-7 lg:flex-col lg:items-center lg:justify-between lg:px-3 lg:py-8 lg:text-center
                  ${i === n - 1 && lastMeasured ? 'pb-20 lg:pb-24' /* room for Sunny, so it never covers the number */ : ''}`}
              >
                {/* Icon and what the stage is */}
                <div className="flex items-center gap-3 lg:flex-col">
                  <span style={glass} className="rounded-panel border border-[color:color-mix(in_srgb,var(--neutral-on-fill)_13%,transparent)] p-2.5 shadow-medium transition-transform duration-slow group-hover:scale-110 lg:p-3">
                    <Icon className="h-5 w-5 text-on-fill lg:h-6 lg:w-6" aria-hidden />
                  </span>
                  <span style={glass} className="rounded-panel px-3 py-2 lg:px-4">
                    <span className="block text-[11px] font-extrabold uppercase tracking-[0.13em] text-loop-on-dark">{eyebrow(i, n)}</span>
                    <span className="block max-w-[11rem] text-sm font-extrabold leading-tight text-on-fill lg:text-[17px]">{s.label}</span>
                  </span>
                </div>

                {/* The visible words are the button's name (voice control says what it sees). */}
                <span className="sr-only">Show what this means. </span>
                {/* The number */}
                <div style={glass} className="rounded-panel px-3 py-2 text-right lg:mb-2 lg:px-5 lg:py-3 lg:text-center">
                  {s.value == null ? (
                    <span className="block max-w-[12rem] text-xs leading-snug text-loop-on-dark">
                      <span className="block text-sm font-extrabold text-on-fill">Not measured</span>
                      {s.missing}
                    </span>
                  ) : (
                    <>
                      <span className="block text-[28px] font-extrabold tabular-nums leading-none tracking-tight text-on-fill lg:text-[40px]">
                        {big}
                      </span>
                      {small && (
                        <span className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-xs font-semibold
                          ${i === n - 1 ? 'bg-loop text-loop-on' : 'bg-[color-mix(in_srgb,var(--neutral-on-fill)_13%,transparent)] text-on-fill'}`}>
                          {small}
                        </span>
                      )}
                      {s.source === 'mole' && (
                        <span className="mt-1.5 block text-[11px] font-semibold text-loop-on-dark">from Mole</span>
                      )}
                    </>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ol>

      {/* Sunny, at the end of the stream, as the prototype's mole was. */}
      {lastMeasured && (
        <div aria-hidden className="pointer-events-none absolute bottom-2 right-3 lg:bottom-4 lg:right-4">
          {/* The glow: one of the brand's three gradients, "behind Sunny on hero moments". */}
          <div className="absolute -inset-8 rounded-full"
            style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--brand-yellow) 35%, transparent), transparent 70%)' }} />
          <img
            src={goalMet ? '/brand/sunny-delighted-on-dark.svg' : '/brand/sunny-on-dark.svg'}
            alt=""
            width={60}
            height={66}
            className="relative h-16 w-auto -rotate-12 lg:h-[76px]"
          />
        </div>
      )}
    </div>
  );
}
