// Everything you see once signed in: the frame and the pages. It is its own
// chunk, so the sign-in page, which most people see first, doesn't download the
// dashboard to show a form (the first-load budget, scripts/check-bundle-budget).

import type { MoleOrg } from '../supabase/functions/_shared/contract.ts';
import type { Account, Backend } from './data/backend.ts';
import { match } from './lib/router.ts';
import { EventDashboard } from './pages/EventDashboard.tsx';
import { EventSetup } from './pages/EventSetup.tsx';
import { EventsPage } from './pages/EventsPage.tsx';
import { PairSensor } from './pages/PairSensor.tsx';
import { SensorsIndex, SensorsPage } from './pages/SensorsPage.tsx';
import { EmptyState } from './ui/kit.tsx';
import { Shell } from './ui/Shell.tsx';

function Routes({ backend, path }: { backend: Backend; path: string }) {
  let p: Record<string, string> | null;
  if (path === '/' || path === '/events') return <EventsPage backend={backend} />;
  if ((p = match('/events/:id/setup', path))) return <EventSetup backend={backend} eventId={p.id!} />;
  if ((p = match('/events/:id', path))) return <EventDashboard key={p.id} backend={backend} eventId={p.id!} />;
  if (path === '/sensors') return <SensorsIndex backend={backend} />;
  if ((p = match('/orgs/:org/sensors/pair', path))) return <PairSensor backend={backend} orgId={p.org!} />;
  if ((p = match('/orgs/:org/sensors', path))) return <SensorsPage backend={backend} orgId={p.org!} />;
  return (
    <EmptyState mood="404" title="Nothing at this address">
      The link may be old. Your events are on the first page.
    </EmptyState>
  );
}

export default function SignedIn({ backend, account, orgs, path }: {
  backend: Backend; account: Account; orgs: MoleOrg[]; path: string;
}) {
  return (
    <Shell account={account} orgs={orgs} sample={backend.mode === 'sample'} path={path} onSignOut={() => backend.signOut()}>
      <Routes backend={backend} path={path} />
    </Shell>
  );
}
