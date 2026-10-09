// The funnel, as a picture, for the sign-in page: the same purple stream and
// the same stage names as the dashboard's funnel, with no numbers. A picture of
// what the product shows, never a number that looks like one: this page is
// public, and an invented count on a real site would look real.

import { Clock, Handshake, MapPin, Users } from 'lucide-react';
import { ribbon } from '../domain/ribbon.ts';

// Only the shape matters: it narrows, stage by stage, the way a funnel does.
const SHAPE = [100, 66, 34, 14];
const STAGES = [
  { label: 'At the event', Icon: Users },
  { label: 'Visited a booth', Icon: MapPin },
  { label: 'Stayed', Icon: Clock },
  { label: 'Connections made', Icon: Handshake },
];

const glass = {
  background: 'color-mix(in srgb, var(--loop-navy) 84%, transparent)',
  backdropFilter: 'blur(6px)',
  WebkitBackdropFilter: 'blur(6px)',
};

export function StreamArt({ className = '' }: { className?: string }) {
  const r = ribbon(SHAPE, 'h')!;
  return (
    <div aria-hidden className={`relative h-[260px] overflow-hidden rounded-feature bg-loop-navy ring-1 ring-[color:color-mix(in_srgb,var(--neutral-on-fill)_13%,transparent)] ${className}`}>
      <svg viewBox="0 0 400 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <defs>
          <filter id="stream-art-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="4" /></filter>
        </defs>
        {[1, 2, 3].map(i => (
          <line key={i} x1={i * 100} x2={i * 100} y1={0} y2={100} stroke="var(--neutral-on-fill)" strokeOpacity={0.13} strokeWidth={0.5} vectorEffect="non-scaling-stroke" />
        ))}
        <path d={r.glow} fill="var(--brand-purple)" opacity={0.3} filter="url(#stream-art-blur)" />
        <path d={r.path} fill="var(--brand-purple)" />
      </svg>
      <ol className="relative grid h-full grid-cols-4">
        {STAGES.map(({ label, Icon }) => (
          <li key={label} className="flex justify-center px-1.5 pt-5">
            <span style={glass} className="flex h-fit w-full max-w-[8.5rem] flex-col items-center gap-1.5 rounded-panel px-2 py-2.5 text-center text-xs font-semibold leading-tight text-on-fill">
              <Icon className="h-4 w-4" />
              {label}
            </span>
          </li>
        ))}
      </ol>
      <div className="absolute -bottom-1 right-3">
        <div className="absolute -inset-8 rounded-full" style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--brand-yellow) 35%, transparent), transparent 70%)' }} />
        <img src="/brand/sunny-on-dark.svg" alt="" width={60} height={66} className="relative h-16 w-auto -rotate-12" />
      </div>
    </div>
  );
}
