// Sign in with a Mole account. There is no separate account for this product:
// a code by email, Google, or a password, all Mole V3's own sign-in.

import { useEffect, useState, type FormEvent } from 'react';
import { PRODUCT_NAME } from '../config/product.ts';
import type { Backend } from '../data/backend.ts';
import { Button, ErrorNote, Field } from '../ui/kit.tsx';
import { inputClass } from '../ui/styles.ts';
import { AuthLayout } from '../ui/AuthLayout.tsx';
import { SampleBanner } from '../ui/Brand.tsx';

export function SignIn({ backend }: { backend: Backend }) {
  // Sample mode asks for nothing. A form that accepted any password would
  // teach people to type their real Mole password into a page that isn't Mole
  // sign-in — and the sample build is public at sense.mole.is.
  if (backend.mode === 'sample') return <SampleSignIn backend={backend} />;
  return <LiveSignIn backend={backend} />;
}

function SampleSignIn({ backend }: { backend: Backend }) {
  const [busy, setBusy] = useState(false);
  return (
    <AuthLayout banner={<SampleBanner />}>
      <h1 className="text-[28px] font-black leading-tight tracking-tight text-ink">Take the tour</h1>
      <p className="mt-2 text-sm text-fg-muted">
        {PRODUCT_NAME} shows event organisers and exhibitors who came, who stopped at each booth, who stayed, and who
        connected. This is a tour on made-up numbers; there is nothing to sign in to.
      </p>
      <Button className="mt-8 w-full" busy={busy} onClick={async () => {
        setBusy(true);
        try { await backend.signInWithGoogle(); } finally { setBusy(false); }
      }}>
        Explore the sample
      </Button>
    </AuthLayout>
  );
}

const CODE = /^\d{6,10}$/;
const RESEND_AFTER = 30;

// The simple way in (roadmap 1.1): an email, then the code that arrives. No
// password to make or forget, and no separate sign-up: Mole V3 makes the
// account if there isn't one. Google stays; a password stays for people who
// already have one.
function LiveSignIn({ backend }: { backend: Backend }) {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [withPassword, setWithPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'send' | 'verify' | 'password' | 'google' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait(w => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const run = async (what: NonNullable<typeof busy>, fn: () => Promise<void>) => {
    setBusy(what);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const send = () => run('send', async () => {
    await backend.sendEmailCode(email.trim());
    setCode('');
    setStep('code');
    setWait(RESEND_AFTER);
  });

  const onEmail = (e: FormEvent) => {
    e.preventDefault();
    if (withPassword) void run('password', () => backend.signInWithPassword(email.trim(), password));
    else void send();
  };

  const onCode = (e: FormEvent) => {
    e.preventDefault();
    const c = code.replace(/\s+/g, '');
    if (!CODE.test(c)) { setError('The code is the 6 digits in the email.'); return; }
    void run('verify', () => backend.signInWithEmailCode(email.trim(), c));
  };

  return (
    <AuthLayout>
        <h1 className="text-[28px] font-black leading-tight tracking-tight text-ink">
          {step === 'code' ? 'Check your email' : 'Sign in with your Mole account'}
        </h1>
        <p className="mt-2 text-sm text-fg-muted">
          {step === 'code'
            ? <>We sent a code to <span className="font-semibold text-ink">{email.trim()}</span>. Type it here to sign in. If it isn’t there, look in spam.</>
            : <>{PRODUCT_NAME} uses the same account as the Mole app. Type your email and we’ll send you a code. New to Mole? That makes your account too.</>}
        </p>

        <div className="mt-8 rounded-card border border-line bg-surface p-6 shadow-subtle">
          {step === 'code' ? (
            <form onSubmit={onCode} className="space-y-4">
              <Field label="Code">
                <input
                  className={`${inputClass} text-center text-lg font-semibold tracking-[0.3em]`}
                  inputMode="numeric" autoComplete="one-time-code" maxLength={12} required autoFocus
                  value={code} onChange={e => setCode(e.target.value)}
                />
              </Field>
              {error && <ErrorNote error={error} />}
              <Button type="submit" className="w-full" busy={busy === 'verify'}>Sign in</Button>
              <div className="flex flex-wrap justify-between gap-2">
                <Button type="button" tone="quiet" onClick={() => { setStep('email'); setError(null); }}>Use a different email</Button>
                <Button type="button" tone="quiet" disabled={wait > 0} busy={busy === 'send'} onClick={() => void send()}>
                  {wait > 0 ? `Send a new code (${wait}s)` : 'Send a new code'}
                </Button>
              </div>
            </form>
          ) : (
            <>
              <form onSubmit={onEmail} className="space-y-4">
                <Field label="Email">
                  <input className={inputClass} type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />
                </Field>
                {withPassword && (
                  <Field label="Password">
                    <input className={inputClass} type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} />
                  </Field>
                )}
                {error && <ErrorNote error={error} />}
                <Button type="submit" className="w-full" busy={busy === 'send' || busy === 'password'}>
                  {withPassword ? 'Sign in' : 'Email me a code'}
                </Button>
                <Button type="button" tone="quiet" className="w-full" onClick={() => { setWithPassword(p => !p); setError(null); }}>
                  {withPassword ? 'Email me a code instead' : 'Use my password instead'}
                </Button>
              </form>

              <div className="my-6 flex items-center gap-3 text-xs text-fg-subtle">
                <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
              </div>

              <Button
                tone="secondary"
                className="w-full"
                busy={busy === 'google'}
                onClick={() => void run('google', () => backend.signInWithGoogle())}
              >
                Continue with Google
              </Button>
            </>
          )}
        </div>

        <p className="mt-6 text-xs text-fg-muted">
          You will see the events of the Loop organisations you run in Mole, and any event you have been made an editor of.
          The Mole team gives that access, so a new account sees nothing until they do.
        </p>
    </AuthLayout>
  );
}

export function NotConfigured() {
  return (
    <AuthLayout>
      <h1 className="text-2xl font-black tracking-tight text-ink">This site isn’t connected yet</h1>
      <p className="mt-3 text-sm text-fg-muted">
        {PRODUCT_NAME} was built without the settings that connect it to Mole, so there is nothing to show. It does not
        fall back to sample numbers, because sample numbers on a real site would look real.
      </p>
      <p className="mt-3 text-sm text-fg-muted">
        For whoever runs it: the three <code className="font-mono text-xs">VITE_</code> settings in{' '}
        <code className="font-mono text-xs">docs/YOUR_TURN.md</code> are missing from the hosting service.
      </p>
    </AuthLayout>
  );
}
