// Sign in with a Mole account. There is no separate account for this product:
// the same email and password, or the same Google, as the Mole app.

import { useState, type FormEvent } from 'react';
import { PRODUCT_NAME, PRODUCT_TAGLINE } from '../config/product.ts';
import type { Backend } from '../data/backend.ts';
import { Button, ErrorNote, Field } from '../ui/kit.tsx';
import { inputClass } from '../ui/styles.ts';
import { Logo, SampleBanner } from '../ui/Shell.tsx';

export function SignIn({ backend }: { backend: Backend }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<'password' | 'google' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy('password');
    setError(null);
    try {
      await backend.signInWithPassword(email.trim(), password);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-base">
      {backend.mode === 'sample' && <SampleBanner />}
      <div className="mx-auto flex max-w-md flex-col px-4 py-16">
        <Logo />
        <h1 className="mt-10 text-[28px] font-black leading-tight tracking-tight text-ink">Sign in with your Mole account</h1>
        <p className="mt-2 text-sm text-fg-muted">
          {PRODUCT_TAGLINE} {PRODUCT_NAME} uses the same account as the Mole app, so there is nothing new to sign up for.
        </p>

        <div className="mt-8 rounded-card border border-line bg-surface p-6 shadow-subtle">
          <Button
            tone="secondary"
            className="w-full"
            busy={busy === 'google'}
            onClick={async () => {
              setBusy('google');
              setError(null);
              try {
                await backend.signInWithGoogle();
              } catch (err) {
                setError((err as Error).message);
                setBusy(null);
              }
            }}
          >
            Continue with Google
          </Button>

          <div className="my-6 flex items-center gap-3 text-xs text-fg-subtle">
            <span className="h-px flex-1 bg-line" /> or with email <span className="h-px flex-1 bg-line" />
          </div>

          <form onSubmit={submit} className="space-y-4">
            <Field label="Email">
              <input className={inputClass} type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />
            </Field>
            <Field label="Password">
              <input className={inputClass} type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} />
            </Field>
            {error && <ErrorNote error={error} />}
            <Button type="submit" className="w-full" busy={busy === 'password'}>Sign in</Button>
          </form>
        </div>

        <p className="mt-6 text-xs text-fg-subtle">
          You will see the events of the Loop organisations you run in Mole, and any event you have been made an editor of.
        </p>
      </div>
    </div>
  );
}

export function NotConfigured() {
  return (
    <div className="min-h-screen bg-base">
      <div className="mx-auto max-w-md px-4 py-16">
        <Logo />
        <h1 className="mt-10 text-2xl font-black tracking-tight text-ink">This site isn’t connected yet</h1>
        <p className="mt-3 text-sm text-fg-muted">
          {PRODUCT_NAME} was built without the settings that connect it to Mole, so there is nothing to show. It does not
          fall back to sample numbers, because sample numbers on a real site would look real.
        </p>
        <p className="mt-3 text-sm text-fg-muted">
          For whoever runs it: the three <code className="font-mono text-xs">VITE_</code> settings in{' '}
          <code className="font-mono text-xs">docs/YOUR_TURN.md</code> are missing from the hosting service.
        </p>
      </div>
    </div>
  );
}
