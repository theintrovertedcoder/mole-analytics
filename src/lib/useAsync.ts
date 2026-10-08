import { useCallback, useEffect, useRef, useState } from 'react';

export type Async<T> =
  | { status: 'loading'; data?: T }
  | { status: 'error'; error: Error; data?: T }
  | { status: 'ready'; data: T };

/**
 * Loads `fn()` whenever `deps` change, keeps the last good data while a new
 * load is in flight (so a slider does not blank the chart), and drops answers
 * that arrive after a newer request was made.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): Async<T> & { reload: () => void } {
  const [state, setState] = useState<Async<T>>({ status: 'loading' });
  const seq = useRef(0);
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    const mine = ++seq.current;
    // Marking the old answer as stale is the point of this hook: the screen
    // keeps showing it, dimmed, until the new one lands. One extra render per
    // request, which is the cost the rule warns about and the one we want.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(s => ({ status: 'loading', data: s.data }));
    fn().then(
      data => { if (mine === seq.current) setState({ status: 'ready', data }); },
      error => { if (mine === seq.current) setState(s => ({ status: 'error', error, data: s.data })); },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  return { ...state, reload };
}
