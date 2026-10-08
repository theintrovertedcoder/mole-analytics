// A link that moves without reloading the page, and still opens in a new tab
// on a middle click or with a modifier key.

import type { AnchorHTMLAttributes, MouseEvent } from 'react';
import { navigate } from './router.ts';

export function Link({ to, onClick, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) {
  return (
    <a
      href={to}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(e);
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        navigate(to);
      }}
      {...rest}
    />
  );
}
