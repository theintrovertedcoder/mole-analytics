// The Mole lockup and the sample-data banner: the two things every screen,
// signed in or not, can show. Kept apart from the signed-in frame (Shell.tsx)
// so the sign-in page doesn't download the dashboard to show a logo.
//
// On brand (sunny-kit docs/products.md, Mole Sense): the canonical Mole logo,
// never recoloured, then "Sense" in micro caps in Loop's green, the colour that
// says where you are. The logo is only ever shown on a light ground: how it
// sits on dark is the brand owner's call and still open (docs/brand.md).

import { PRODUCT_NAME } from '../config/product.ts';

export function SampleBanner() {
  return (
    <div className="bg-sunny-tint text-sunny-text" role="note">
      <p className="mx-auto max-w-6xl px-4 py-2 text-center text-xs font-semibold sm:px-6">
        Sample data. Every number on this page is made up, to show how {PRODUCT_NAME} works. Nothing here is a real event.
      </p>
    </div>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2" aria-label={PRODUCT_NAME} role="img">
      <img src="/brand/mole-logo.svg" alt="" width={82} height={30} className="h-[30px] w-auto" />
      <span aria-hidden className="mt-1 text-[11px] font-extrabold uppercase tracking-[0.13em] text-loop-text">{PRODUCT_NAME.replace(/^Mole /, '')}</span>
    </span>
  );
}
