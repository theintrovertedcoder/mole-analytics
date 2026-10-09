// A Mole dialog for "are you sure?", in place of the browser's confirm() box
// (W-7), which can't be styled, names the site instead of the action, and on a
// phone looks like a system warning.
//
// The native <dialog> opened with showModal(): the browser keeps focus inside
// it, Escape cancels, and everything behind it is inert. Cancel has the focus
// first, so a stray Enter never deletes anything.

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Button } from './kit.tsx';

export interface Ask {
  title: string;
  body: string;
  /** The verb on the button, e.g. "Delete zone". */
  confirm: string;
  tone?: 'danger' | 'primary';
}

type Pending = Ask & { resolve: (ok: boolean) => void };

export function useConfirm(): [ReactNode, (ask: Ask) => Promise<boolean>] {
  const [pending, setPending] = useState<Pending | null>(null);
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();

  useEffect(() => {
    if (pending && !ref.current?.open) ref.current?.showModal();
  }, [pending]);

  const finish = (ok: boolean) => {
    pending?.resolve(ok);
    ref.current?.close();
    setPending(null);
  };

  const ask = useCallback((a: Ask) => new Promise<boolean>(resolve => setPending({ ...a, resolve })), []);

  const dialog = pending && (
    <dialog
      ref={ref}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-body`}
      onCancel={e => { e.preventDefault(); finish(false); }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-card border border-line bg-surface p-6 text-ink shadow-elevated
        backdrop:bg-[color-mix(in_srgb,var(--brand-ink)_58%,transparent)]"
    >
      <h2 id={`${id}-title`} className="text-lg font-extrabold tracking-tight">{pending.title}</h2>
      <p id={`${id}-body`} className="mt-2 text-sm text-fg-muted">{pending.body}</p>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button tone="secondary" autoFocus onClick={() => finish(false)}>Cancel</Button>
        <Button tone={pending.tone ?? 'danger'} onClick={() => finish(true)}>{pending.confirm}</Button>
      </div>
    </dialog>
  );

  return [dialog, ask];
}
