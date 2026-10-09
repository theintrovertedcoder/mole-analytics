// The page around sign-in: what Mole Sense is on one side, the form on the
// other, the way a product's front door looks. On a phone the pitch shrinks to
// a band above the form, so the form is still the first thing you can use.
//
// The pitch is loop-navy, Loop's deep colour, with the funnel's own stream and
// Sunny's die-cut and glow (decisions D25 to D27). No logo on it: the logo goes
// on the light side, because how it sits on dark isn't decided.

import { Handshake, MapPin, Radio } from 'lucide-react';
import type { ReactNode } from 'react';
import { PRODUCT_TAGLINE } from '../config/product.ts';
import { Logo } from './Brand.tsx';
import { StreamArt } from './StreamArt.tsx';

const POINTS = [
  { Icon: Radio, title: 'Counts phones, not people', text: 'PLExyz sensors count anonymous visits. Mole keeps a scrambled key, never a name or a phone number.' },
  { Icon: MapPin, title: 'Booth by booth', text: 'See who walked up, who stayed, and who left their details.' },
  { Icon: Handshake, title: 'One Mole account', text: 'Sign in with the account you use in Mole. You see the events your organisation runs, and nothing else.' },
];

function Pitch() {
  return (
    <aside className="relative overflow-hidden bg-loop-navy px-6 pb-8 pt-8 text-on-fill sm:px-10 lg:flex lg:flex-col lg:justify-between lg:gap-10 lg:px-14 lg:py-14">
      <div>
        <p className="max-w-md pr-20 text-[38px] font-black leading-[1.05] tracking-[-0.035em] sm:text-[44px] lg:pr-0 lg:text-[56px]">
          {PRODUCT_TAGLINE}
        </p>
        <p className="mt-3 max-w-md pr-16 text-[15px] leading-relaxed text-loop-on-dark lg:pr-0 lg:text-base">
          Footfall and engagement for events, from PLExyz sensors and Mole.
        </p>
      </div>

      {/* A phone gets Sunny beside the headline; a wide screen gets the whole stream. */}
      <div aria-hidden className="pointer-events-none absolute right-5 top-6 lg:hidden">
        <div className="absolute -inset-6 rounded-full" style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--brand-yellow) 35%, transparent), transparent 70%)' }} />
        <img src="/brand/sunny-on-dark.svg" alt="" width={60} height={66} className="relative h-16 w-auto -rotate-12" />
      </div>
      <StreamArt className="hidden lg:block" />

      <ul className="hidden gap-5 lg:grid">
        {POINTS.map(({ Icon, title, text }) => (
          <li key={title} className="flex gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-panel border border-[color:color-mix(in_srgb,var(--neutral-on-fill)_13%,transparent)]">
              <Icon className="h-5 w-5 text-loop" aria-hidden />
            </span>
            <span>
              <span className="block text-[15px] font-extrabold">{title}</span>
              <span className="mt-0.5 block max-w-md text-sm leading-relaxed text-loop-on-dark">{text}</span>
            </span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

export function AuthLayout({ banner, children }: { banner?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-loop-ground">
      {banner}
      <div className="flex flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <Pitch />
        <main className="flex flex-1 flex-col px-4 py-8 sm:px-10 lg:px-16 lg:py-12">
          <Logo />
          <div className="mx-auto my-auto w-full max-w-md py-10">{children}</div>
        </main>
      </div>
    </div>
  );
}
