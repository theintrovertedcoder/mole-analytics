// Who is signed in, and which page the path is.

import { lazy, Suspense, useEffect, useState } from 'react';
import type { MoleOrg } from '../supabase/functions/_shared/contract.ts';
import type { Account, Backend } from './data/backend.ts';
import { loadBackend } from './data/index.ts';
import { usePath } from './lib/router.ts';
import { NotConfigured, SignIn } from './pages/SignIn.tsx';
import { Spinner } from './ui/kit.tsx';

// The signed-in half is loaded when it is needed, not before.
const SignedIn = lazy(() => import('./SignedIn.tsx'));

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
    <Suspense fallback={<div className="mx-auto max-w-md px-4"><Spinner /></div>}>
      <SignedIn backend={backend} account={account} orgs={orgs} path={path} />
    </Suspense>
  );
}
