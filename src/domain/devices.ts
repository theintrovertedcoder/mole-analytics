import { ONLINE_WITHIN_MINUTES, type Device } from '../../supabase/functions/_shared/contract.ts';

/** Paired, and reported recently enough to call it working. */
export function isOnline(d: Device, now = Date.now()): boolean {
  return d.status === 'active' && !!d.lastSeenAt && now - Date.parse(d.lastSeenAt) < ONLINE_WITHIN_MINUTES * 60_000;
}
