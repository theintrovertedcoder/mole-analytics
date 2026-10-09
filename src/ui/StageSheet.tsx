// Tap a funnel stage → what it means, how it is counted, and its number.
// The prototype's sheet: up from the bottom on a phone, in from the right on
// a wide screen. A real dialog: Escape and the backdrop close it, focus moves
// into it and goes back where it came from.

import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { formatCount, formatPercent } from '../domain/format.ts';
import type { Stage } from '../domain/funnel.ts';

export function StageSheet({ stage, onClose }: { stage: Stage | null; onClose: () => void }) {
  const [shown, setShown] = useState<Stage | null>(stage);
  const [visible, setVisible] = useState(false);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);

  // A new stage replaces the one shown at once (React's "adjust state while
  // rendering"); closing keeps the old one on screen while it slides away.
  if (stage && stage !== shown) setShown(stage);
  const open = visible && !!stage;

  useEffect(() => {
    if (stage) {
      returnTo.current = document.activeElement as HTMLElement | null;
      // Slide in on the next frame, so the closed position is painted first.
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    const t = setTimeout(() => {
      setVisible(false);
      setShown(null);
      returnTo.current?.focus?.();
    }, 260);
    return () => clearTimeout(t);
  }, [stage]);

  useEffect(() => {
    if (!open) return;
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!shown) return null;
  const rate = shown.value != null && shown.of != null ? formatPercent(shown.value, shown.of) : null;

  return (
    <div className="fixed inset-0 z-overlay">
      <div
        onClick={onClose}
        className={`absolute inset-0 transition-opacity duration-normal ${open ? 'opacity-100' : 'opacity-0'}`}
        style={{ background: 'color-mix(in srgb, var(--brand-ink) 58%, transparent)' }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="stage-sheet-title"
        className={`absolute bottom-0 left-0 right-0 flex max-h-[85vh] flex-col rounded-t-[32px] bg-surface p-6 shadow-large
          transition-transform duration-slow ease-enter
          lg:bottom-0 lg:left-auto lg:top-0 lg:h-full lg:max-h-full lg:w-[400px] lg:rounded-l-[32px] lg:rounded-tr-none
          ${open ? 'translate-x-0 translate-y-0' : 'translate-y-full lg:translate-x-full lg:translate-y-0'}`}
      >
        <div className="mx-auto mb-6 h-1.5 w-12 rounded-full bg-line lg:hidden" aria-hidden />
        <div className="mb-6 flex items-start justify-between gap-4 lg:mt-4">
          <div>
            <h2 id="stage-sheet-title" className="text-xl font-extrabold tracking-tight text-ink">{shown.label}</h2>
            <p className="mt-1 text-sm text-fg-muted">What this number is</p>
          </div>
          <button ref={closeBtn} onClick={onClose} aria-label="Close" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-3 text-fg-muted hover:text-ink">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto pb-24">
          <div className="rounded-panel border border-line bg-surface-2 p-4">
            <h3 className="mb-2 text-sm font-semibold text-ink">What this means</h3>
            <p className="text-sm leading-relaxed text-fg-muted">{shown.meaning}</p>
          </div>

          <div>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-purple-text">
              <span className="h-2 w-2 animate-pulse rounded-full bg-purple" aria-hidden />
              {shown.source === 'sensors' ? 'Counted by PLExyz sensors' : 'Recorded in Mole'}
            </h3>
            <p className="text-sm leading-relaxed text-fg-muted">{shown.how}</p>
          </div>

          <div className="flex items-center justify-between border-t border-line pt-4">
            <span className="text-sm text-fg-muted">{rate ? `Now · ${rate} of the step before` : 'Now'}</span>
            <span className="text-2xl font-extrabold tabular-nums text-ink">{shown.value == null ? 'Not measured' : formatCount(shown.value)}</span>
          </div>
          {shown.value == null && shown.missing && <p className="text-sm text-fg-muted">{shown.missing}</p>}
        </div>

        <div className="absolute bottom-6 left-6 right-6 lg:bottom-8">
          <button onClick={onClose} className="w-full rounded-panel bg-ink py-4 font-semibold text-on-fill transition-transform active:scale-[0.98]">
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
