// Who is signed in, and which page the path is.

import { useEffect, useState } from 'react';
import type { MoleOrg } from '../supabase/functions/_shared/contract.ts';
import type { Account, Backend } from './data/backend.ts';
import { loadBackend } from './data/index.ts';
import { match, usePath } from './lib/router.ts';
import { EventDashboard } from './pages/EventDashboard.tsx';
import { EventSetup } from './pages/EventSetup.tsx';
import { EventsPage } from './pages/EventsPage.tsx';
import { PairSensor } from './pages/PairSensor.tsx';
import { SensorsIndex, SensorsPage } from './pages/SensorsPage.tsx';
import { NotConfigured, SignIn } from './pages/SignIn.tsx';
import { EmptyState, Spinner } from './ui/kit.tsx';
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
    <EmptyState icon={<span aria-hidden>?</span>} title="Nothing at this address">
      The link may be old. Your events are on the first page.
    </EmptyState>
  );
}

export function App() {
  // undefined while loading; null when this build has no backend at all.
  const [backend, setBackend] = useState<Backend | null | undefined>(undefined);
  useEffect(() => { loadBackend().then(setBackend, () => setBackend(null)); }, []);
  const path = usePath();
  const [account, setAccount] = useState<Account | null | undefined>(undefined);
  // Keyed by who they were loaded for, so signing out (or in as someone
  // else) never shows the previous person's organisations for a moment.
  const [orgsFor, setOrgsFor] = useState<{ who: string; list: MoleOrg[] } | null>(null);

  useEffect(() => {
    if (!backend) return;
    backend.account().then(setAccount, () => setAccount(null));
    return backend.onAccountChange(setAccount);
  }, [backend]);

  useEffect(() => {
    if (!backend || !account) return;
    const who = account.id;
    backend.myOrgs().then(list => setOrgsFor({ who, list }), () => setOrgsFor({ who, list: [] }));
  }, [backend, account]);
  const orgs = account && orgsFor?.who === account.id ? orgsFor.list : [];

  if (backend === undefined) return <div className="mx-auto max-w-md px-4"><Spinner /></div>;
  if (!backend) return <NotConfigured />;
  if (account === undefined) return <div className="mx-auto max-w-md px-4"><Spinner /></div>;
  if (!account) return <SignIn backend={backend} />;

  return (
    <Shell account={account} orgs={orgs} sample={backend.mode === 'sample'} path={path} onSignOut={() => backend.signOut()}>
      <Routes backend={backend} path={path} />
    </Shell>
  );
}
