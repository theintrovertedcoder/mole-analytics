// The top of a page: where you came from, what this is, and what you can do
// from here. The same shape on every page, so the title is always in the same
// place.

import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from '../lib/Link.tsx';

export function PageHeader({ back, title, meta, badge, actions }: {
  back?: { to: string; label: string };
  title: string;
  meta?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        {back && (
          <Link to={back.to} className="mb-1 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-fg-muted hover:text-ink">
            <ArrowLeft className="h-4 w-4" aria-hidden /> {back.label}
          </Link>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[28px] font-black leading-tight tracking-tight text-ink lg:text-[32px]">{title}</h1>
          {badge}
        </div>
        {meta && <p className="mt-1 text-sm text-fg-muted">{meta}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
