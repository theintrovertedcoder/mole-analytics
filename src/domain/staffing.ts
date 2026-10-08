import type { TrafficBucket } from '../../supabase/functions/_shared/contract.ts';

/** The busiest buckets, busiest first, each with its end time. Empty buckets never count. */
export function busiestSlots(traffic: TrafficBucket[], n = 3) {
  const step = traffic.length > 1 ? Date.parse(traffic[1]!.start) - Date.parse(traffic[0]!.start) : 3_600_000;
  return [...traffic]
    .filter(b => b.count > 0)
    .sort((a, b) => b.count - a.count || a.start.localeCompare(b.start))
    .slice(0, n)
    .map(b => ({ ...b, end: new Date(Date.parse(b.start) + step).toISOString() }));
}
