// The frame around every signed-in page: the Mole lockup, the product name,
// where you can go, who you are, and — in sample mode — the banner.
//
// On brand (sunny-kit docs/products.md, Mole Sense): the canonical Mole logo,
// never recoloured, then "Sense" in micro caps in Loop's green, the colour that
// says where you are. The current page in the nav is green for the same reason.

import { CalendarDays, LogOut, Radio } from 'lucide-react';
import type { ReactNode } from 'react';
import type { MoleOrg } from '../../supabase/functions/_shared/contract.ts';
import type { Account } from '../data/backend.ts';
import { Link } from '../lib/Link.tsx';
import { Logo, SampleBanner } from './Brand.tsx';

export function Shell({ account, orgs, sample, path, onSignOut, children }: {
  account: Account | null;
  orgs: MoleOrg[];
  sample: boolean;
  path: string;
  onSignOut: () => void;
  children: ReactNode;
}) {
  const navItem = (to: string, label: string, icon: ReactNode, active: boolean) => (
    <Link
      to={to}
      aria-current={active ? 'page' : undefined}
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-chip px-3 text-sm font-semibold transition-colors
        ${active ? 'bg-loop-tint text-ink' : 'text-fg-muted hover:bg-surface-3 hover:text-ink'}`}
    >
      {icon}
      {label}
    </Link>
  );
  const sensorsTo = orgs.length === 1 ? `/orgs/${orgs[0]!.orgId}/sensors` : '/sensors';

  return (
    <div className="min-h-screen bg-loop-ground">
      {sample && <SampleBanner />}
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          <Link to="/" className="inline-flex min-h-11 items-center rounded-chip focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple">
            <Logo />
          </Link>
          {orgs.length === 1 && (
            <span className="hidden border-l border-line pl-4 text-sm font-semibold text-fg-muted md:inline">{orgs[0]!.orgName}</span>
          )}
          <nav aria-label="Main" className="flex items-center gap-1">
            {navItem('/', 'Events', <CalendarDays className="h-4 w-4" aria-hidden />, path === '/' || path.startsWith('/events'))}
            {orgs.length > 0 && navItem(sensorsTo, 'Sensors', <Radio className="h-4 w-4" aria-hidden />, path.includes('/sensors'))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            {account?.email && <span className="hidden text-fg-muted sm:inline">{account.email}</span>}
            <button onClick={onSignOut} className="inline-flex min-h-11 items-center gap-1.5 rounded-chip px-3 font-semibold text-fg-muted hover:bg-surface-3 hover:text-ink">
              <LogOut className="h-4 w-4" aria-hidden /> Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
