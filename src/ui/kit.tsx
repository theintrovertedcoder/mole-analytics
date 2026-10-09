// src/ui/kit.tsx — the handful of pieces every page is built from.
// Colours are Mole tokens only (tailwind.config.js); text pairs are held to
// 4.5:1 by tests/unit/brand.test.ts.

import { AlertCircle, CheckCircle2, Clock, Info, Loader2, XCircle } from 'lucide-react';
import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { BUTTON, BUTTON_BASE, type Tone } from './styles.ts';


export function Button({
  tone = 'primary', busy = false, className = '', children, disabled, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone; busy?: boolean }) {
  return (
    <button
      {...rest}
      disabled={disabled || busy}
      className={`${BUTTON_BASE} ${BUTTON[tone]} ${className}`}
    >
      {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function Card({ children, className = '', as: As = 'section' }: { children: ReactNode; className?: string; as?: 'section' | 'div' | 'article' }) {
  return <As className={`rounded-card border border-line bg-surface p-5 shadow-subtle sm:p-6 ${className}`}>{children}</As>;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-[11px] font-extrabold uppercase tracking-[0.13em] text-fg-subtle">{children}</p>;
}

/** Sunny's moods, from the kit's drawings (brand book: one mood per moment). */
export type Mood = 'thinking' | 'loading' | 'sad' | '404';

/** Sunny on the soft yellow disc the brand book asks for, so Sunny reads as a character. */
export function SunnyDisc({ mood, size = 'md' }: { mood: Mood; size?: 'sm' | 'md' }) {
  const box = size === 'sm' ? 'h-14 w-14' : 'h-20 w-20';
  return (
    <span aria-hidden className={`flex ${box} shrink-0 items-center justify-center rounded-full bg-sunny-tint`}>
      <img src={`/brand/sunny-${mood}.svg`} alt="" width={200} height={205} className="h-[78%] w-auto" />
    </span>
  );
}

/**
 * A wait. Under a second a spinner is enough; after that, Sunny's loading face
 * (the brand book's rule), so a slow network has someone to look at.
 */
export function Spinner({ label = 'Loading' }: { label?: string }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 1000);
    return () => clearTimeout(t);
  }, []);
  return (
    <div role="status" className="flex flex-col items-center gap-3 py-10 text-sm text-fg-muted">
      {slow && <SunnyDisc mood="loading" size="sm" />}
      <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {label}…</span>
    </div>
  );
}

export function ErrorNote({ error, onRetry }: { error: Error | string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-panel border border-bad-border bg-bad-tint p-4 text-sm text-bad-text">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="flex-1">{typeof error === 'string' ? error : error.message}</div>
      {onRetry && <button className="-my-3 min-h-11 font-semibold underline" onClick={onRetry}>Try again</button>}
    </div>
  );
}

/** A status always has an icon as well as its colour and word: success and Loop share one green (W-4). */
const STATUS_ICON = { ok: CheckCircle2, warn: Clock, bad: XCircle, info: Info } as const;

export function Pill({ tone, children }: { tone: 'ok' | 'warn' | 'bad' | 'info' | 'neutral' | 'purple' | 'events'; children: ReactNode }) {
  const Icon = tone in STATUS_ICON ? STATUS_ICON[tone as keyof typeof STATUS_ICON] : null;
  const t = {
    ok: 'bg-ok-tint text-ok-text',
    warn: 'bg-warn-tint text-warn-text',
    bad: 'bg-bad-tint text-bad-text',
    info: 'bg-info-tint text-info-text',
    neutral: 'bg-surface-3 text-fg-muted',
    purple: 'bg-purple-tint text-purple-text',
    events: 'bg-events-tint text-events-text',
  }[tone];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${t}`}>
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />}
      {children}
    </span>
  );
}

export function EmptyState({ mood, title, children, action }: { mood: Mood; title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-card border border-dashed border-line-strong bg-surface px-6 py-12 text-center">
      <div className="mb-4"><SunnyDisc mood={mood} /></div>
      <h2 className="text-lg font-extrabold tracking-tight text-ink">{title}</h2>
      <div className="mt-2 max-w-md text-sm text-fg-muted">{children}</div>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12.5px] font-semibold text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-fg-subtle">{hint}</span>}
    </label>
  );
}

