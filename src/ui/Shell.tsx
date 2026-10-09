// The frame around every signed-in page, the way a product's workspace looks:
// a sidebar (the Mole lockup, your organisation, where you can go, who you are)
// and the page beside it. On a phone the sidebar is a drawer behind a menu
// button, so the page gets the whole width.
//
// On brand (sunny-kit docs/products.md, Mole Sense): the canonical Mole logo on
// a light ground, then "Sense" in micro caps in Loop's green, the colour that
// says where you are. The current page in the nav is green for the same reason.
// The sidebar is light, not dark: how the logo sits on dark is the brand
// owner's call and still open.

import { Building2, CalendarDays, LayoutDashboard, LogOut, Menu, Radio, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { MoleOrg } from '../../supabase/functions/_shared/contract.ts';
import type { Account } from '../data/backend.ts';
import { Link } from '../lib/Link.tsx';
import { match } from '../lib/router.ts';
import { Logo, SampleBanner } from './Brand.tsx';

const initialOf = (a: Account | null) => (a?.email?.trim()[0] ?? '?').toUpperCase();

function NavLink({ to, icon, active, children }: { to: string; icon: ReactNode; active: boolean; children: ReactNode }) {
  return (
    <Link
      to={to}
      aria-current={active ? 'page' : undefined}
      className={`flex min-h-11 items-center gap-3 rounded-chip px-3 text-sm font-semibold transition-colors duration-normal
        ${active ? 'bg-loop-tint text-ink' : 'text-fg-muted hover:bg-surface-3 hover:text-ink'}`}
    >
      <span className={active ? 'text-loop-text' : 'text-fg-subtle'}>{icon}</span>
      {children}
    </Link>
  );
}

function GroupLabel({ children }: { children: ReactNode }) {
  return <p className="px-3 pb-1 pt-5 text-[11px] font-extrabold uppercase tracking-[0.13em] text-fg-muted">{children}</p>;
}

function SidebarBody({ account, orgs, path, onSignOut }: {
  account: Account | null; orgs: MoleOrg[]; path: string; onSignOut: () => void;
}) {
  const sensorsTo = orgs.length === 1 ? `/orgs/${orgs[0]!.orgId}/sensors` : '/sensors';
  const eventId = (match('/events/:id/setup', path) ?? match('/events/:id', path))?.id;
  const org = orgs[0];

  return (
    <div className="flex h-full flex-col p-4">
      <Link to="/" className="inline-flex min-h-11 items-center rounded-chip px-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple">
        <Logo />
      </Link>

      {org && (
        <div className="mt-4 flex items-center gap-3 rounded-panel border border-line bg-surface-2 p-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-chip bg-purple-tint text-purple-text"><Building2 className="h-[18px] w-[18px]" aria-hidden /></span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-ink">{org.orgName}</span>
            <span className="block truncate text-xs text-fg-muted">{orgs.length > 1 ? `and ${orgs.length - 1} more` : 'Your organisation'}</span>
          </span>
        </div>
      )}

      <nav aria-label="Main" className="mt-2">
        <GroupLabel>Workspace</GroupLabel>
        <div className="space-y-1">
          <NavLink to="/" icon={<CalendarDays className="h-[18px] w-[18px]" aria-hidden />} active={path === '/' || path === '/events'}>Events</NavLink>
          {orgs.length > 0 && (
            <NavLink to={sensorsTo} icon={<Radio className="h-[18px] w-[18px]" aria-hidden />} active={path.includes('/sensors')}>Sensors</NavLink>
          )}
        </div>
        {eventId && (
          <>
            <GroupLabel>This event</GroupLabel>
            <div className="space-y-1">
              <NavLink to={`/events/${eventId}`} icon={<LayoutDashboard className="h-[18px] w-[18px]" aria-hidden />} active={path === `/events/${eventId}`}>Overview</NavLink>
              <NavLink to={`/events/${eventId}/setup`} icon={<SlidersHorizontal className="h-[18px] w-[18px]" aria-hidden />} active={path === `/events/${eventId}/setup`}>Zones and sensors</NavLink>
            </div>
          </>
        )}
      </nav>

      <div className="mt-auto border-t border-line pt-4">
        <div className="flex items-center gap-3 px-1">
          <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-tint text-sm font-extrabold text-purple-text">{initialOf(account)}</span>
          <span className="min-w-0 truncate text-sm text-fg-muted">{account?.email ?? 'Signed in'}</span>
        </div>
        <button
          onClick={onSignOut}
          className="mt-3 flex min-h-11 w-full items-center gap-3 rounded-chip px-3 text-sm font-semibold text-fg-muted transition-colors duration-normal hover:bg-surface-3 hover:text-ink"
        >
          <LogOut className="h-[18px] w-[18px] text-fg-subtle" aria-hidden /> Sign out
        </button>
      </div>
    </div>
  );
}

export function Shell({ account, orgs, sample, path, onSignOut, children }: {
  account: Account | null;
  orgs: MoleOrg[];
  sample: boolean;
  path: string;
  onSignOut: () => void;
  children: ReactNode;
}) {
  // The phone's drawer: a native <dialog>, so focus stays inside it, Escape
  // closes it, and the page behind is inert.
  const [menu, setMenu] = useState(false);
  const drawer = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (menu && !drawer.current?.open) drawer.current?.showModal();
  }, [menu]);
  useEffect(() => { drawer.current?.close(); }, [path]);

  const body = { account, orgs, path, onSignOut };

  return (
    <div className="min-h-screen bg-loop-ground">
      {sample && <SampleBanner />}
      <div className="lg:flex">
        <aside className="hidden w-64 shrink-0 border-r border-line bg-surface lg:sticky lg:top-0 lg:block lg:h-screen lg:self-start lg:overflow-y-auto">
          <SidebarBody {...body} />
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-sticky flex items-center justify-between border-b border-line bg-surface px-4 py-1 lg:hidden">
            <Link to="/" className="inline-flex min-h-11 items-center rounded-chip focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple">
              <Logo />
            </Link>
            <button
              type="button"
              aria-label="Open the menu"
              aria-haspopup="dialog"
              onClick={() => setMenu(true)}
              className="flex h-11 w-11 items-center justify-center rounded-chip text-ink transition-colors duration-normal hover:bg-surface-3"
            >
              <Menu className="h-5 w-5" aria-hidden />
            </button>
          </header>

          <main className="mx-auto w-full max-w-[1320px] px-4 py-6 sm:px-6 lg:px-10 lg:py-8">{children}</main>
        </div>
      </div>

      <dialog
        ref={drawer}
        aria-label="Menu"
        onClose={() => setMenu(false)}
        onClick={e => { if (e.target === drawer.current) drawer.current?.close(); }}
        className="m-0 h-dvh max-h-none w-72 max-w-[85vw] bg-surface p-0 text-ink shadow-elevated backdrop:bg-[color-mix(in_srgb,var(--brand-ink)_58%,transparent)] lg:hidden"
      >
        {menu && (
          <div className="relative h-full">
            <button
              type="button"
              aria-label="Close the menu"
              onClick={() => drawer.current?.close()}
              className="absolute right-3 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full text-fg-muted hover:bg-surface-3 hover:text-ink"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
            <SidebarBody {...body} />
          </div>
        )}
      </dialog>
    </div>
  );
}
