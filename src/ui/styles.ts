// Class strings shared by components and by links styled as buttons.

export type Tone = 'primary' | 'secondary' | 'quiet' | 'danger';

export const BUTTON: Record<Tone, string> = {
  primary: 'bg-purple text-on-fill hover:brightness-95 shadow-medium',
  secondary: 'bg-surface text-ink border border-line-strong hover:bg-surface-3',
  quiet: 'text-purple-text hover:bg-purple-tint',
  danger: 'bg-surface text-bad-text border border-bad-border hover:bg-bad-tint',
};

// min-h-11: the brand book's 44px tap target (W-3; tests/e2e measures every page).
export const BUTTON_BASE = `inline-flex min-h-11 items-center justify-center gap-2 rounded-chip px-4 py-2.5 text-sm font-semibold
        transition-colors duration-normal disabled:cursor-not-allowed disabled:opacity-60
        focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple`;

/** For a link that should look like a button — never a button inside a link. */
export const buttonClass = (tone: Tone = 'primary') => `${BUTTON_BASE} ${BUTTON[tone]}`;

export const inputClass =
  'min-h-11 w-full rounded-chip border border-line-strong bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-fg-disabled '
  + 'focus:border-purple focus:outline-none focus:ring-2 focus:ring-purple-tint';
