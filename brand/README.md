# brand/

Mole's design system, copied from
[sunny-kit](https://github.com/theintrovertedcoder/sunny-kit), the canonical
set for every Mole product (the brand owner, 2026-10-08). Nothing here is
edited by hand.

| Here | From sunny-kit |
|---|---|
| `colours/tokens.css`, `colours/tokens.json` | `brand/colours/` |
| `fonts/` (Poppins, Latin, 400–900, and its licence) | `brand/fonts/` |
| `public/brand/mole-logo.svg`, `mole-badge.svg`, `public/favicon.svg` | `brand/logos/` |
| `public/brand/sunny.svg` (the hand-drawn Sunny, canonical) | `assets/brand/mole-character.svg` |
| `public/brand/sunny-delighted.svg` | `brand/sunny/delighted.svg` |

`sunny-kit.json` lists every copied file with the kit commit and its SHA-256.
`tests/unit/brand.test.ts` fails if a file no longer matches its hash, so a
hand edit cannot slip through.

`public/brand/*-on-dark.svg` are generated, not copied: the two Sunnys inside
the kit's white die-cut, for the dark funnel panel (`scripts/sunny-on-dark.mjs`,
the kit's "On dark backgrounds" rule).

## Updating

1. Change the design system in sunny-kit, not here.
2. Copy the files in the table above from the new kit commit.
3. Update `commit` and each `sha256` in `sunny-kit.json`.
4. `node scripts/sunny-on-dark.mjs` if a Sunny changed.
5. `npm run check`: the contrast test re-measures every pair the app uses
   against the new values.
