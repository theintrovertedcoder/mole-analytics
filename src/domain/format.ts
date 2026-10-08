// How numbers, durations and times are written, everywhere in the app.

const nf = new Intl.NumberFormat('en-MY');

/**
 * Times are shown in the event's own clock, not the viewer's. Mole V3 events
 * carry no time zone yet, and every Mole event so far is in Malaysia, so this
 * is that zone. When events get a `time_zone` column, it replaces this.
 * Shown in the viewer's clock instead, a 9am opening read as 1am to anyone
 * whose computer was set to UTC — which is how it was caught.
 */
export const DISPLAY_TIME_ZONE = 'Asia/Kuala_Lumpur';

export const formatCount = (n: number) => nf.format(n);

export function formatPercent(part: number, whole: number): string | null {
  if (!whole) return null;
  const p = (part / whole) * 100;
  return `${p >= 10 || p === 0 ? Math.round(p) : p.toFixed(1)}%`;
}

export function formatDuration(seconds: number | null): string {
  if (seconds == null) return '—';
  const s = Math.round(seconds);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60), r = s % 60;
  if (m < 60) return r ? `${m} min ${r} s` : `${m} min`;
  const h = Math.floor(m / 60), mm = m % 60;
  return mm ? `${h} h ${mm} min` : `${h} h`;
}

export function formatMinutes(min: number): string {
  return Number.isInteger(min) ? `${min} min` : `${min.toFixed(1)} min`;
}

const dateF = new Intl.DateTimeFormat('en-MY', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: DISPLAY_TIME_ZONE });
const timeF = new Intl.DateTimeFormat('en-MY', { hour: 'numeric', minute: '2-digit', timeZone: DISPLAY_TIME_ZONE });
const hourF = new Intl.DateTimeFormat('en-MY', { hour: 'numeric', timeZone: DISPLAY_TIME_ZONE });

export const formatDate = (iso: string) => dateF.format(new Date(iso));
export const formatTime = (iso: string) => timeF.format(new Date(iso));
export const formatHour = (iso: string) => hourF.format(new Date(iso)).replace(/\s/g, '').toLowerCase();

export function formatEventWhen(startsAt: string | null, endsAt: string | null): string {
  if (!startsAt) return 'No date yet';
  const start = new Date(startsAt);
  if (!endsAt) return `${formatDate(startsAt)}, ${formatTime(startsAt)}`;
  const end = new Date(endsAt);
  const sameDay = formatDate(start.toISOString()) === formatDate(end.toISOString());
  return sameDay
    ? `${formatDate(startsAt)}, ${formatTime(startsAt)} – ${formatTime(endsAt)}`
    : `${formatDate(startsAt)} – ${formatDate(endsAt)}`;
}

/** "3 minutes ago", for a sensor's last report. */
export function formatAgo(iso: string | null, now = Date.now()): string {
  if (!iso) return 'never';
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}
