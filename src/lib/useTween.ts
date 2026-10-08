import { useEffect, useRef, useState } from 'react';

const reduced = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Eases a list of numbers from where they were to where they are now, so the
 * funnel ribbon flows into its new shape when the slider moves (the
 * prototype's framer-motion morph, without the 40 kB). A change in the number
 * of values, or reduced motion, jumps straight there.
 */
export function useTween(target: (number | null)[], ms = 650): (number | null)[] {
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  const key = target.map(v => (v == null ? 'n' : v)).join(',');

  useEffect(() => {
    const start = from.current;
    const sameShape = start.length === target.length && start.every((v, i) => (v == null) === (target[i] == null));
    if (!sameShape || reduced()) {
      from.current = target;
      setShown(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      const e = 1 - Math.pow(1 - k, 3); // ease-out cubic
      const next = target.map((v, i) => (v == null ? null : (start[i] as number) + (v - (start[i] as number)) * e));
      from.current = next;
      setShown(next);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ms]);

  return shown;
}
