// supabase/functions/_shared/contract.ts
// ─────────────────────────────────────────────────────────────────────────────
// The shapes that cross a wire. The app and the edge functions both import
// this file, so a field renamed on one side is a type error on the other.
//
// Pure TypeScript only: no Deno globals, no DOM, no npm imports. Both Vite and
// the Supabase edge runtime have to be able to load it as it is.
// ─────────────────────────────────────────────────────────────────────────────

// ── From Mole V3 (its read-only api_v1, migration 119 in Mole-V3) ───────────

/** HOST = the org runs this event. EXHIBITOR = the org has a stand at someone else's. */
export type EventPackage = 'HOST' | 'EXHIBITOR';

export interface MoleOrg {
  orgId: string;
  orgName: string;
  role: string;
  scope: string;
}

export interface MoleEvent {
  id: string;
  title: string;
  slug: string;
  package: EventPackage;
  orgId: string;
  orgName: string;
  venue: string | null;
  /** ISO. Null when the event has no date yet, and then nothing can be windowed. */
  startsAt: string | null;
  endsAt: string | null;
  hostName: string | null;
  isPublished: boolean;
}

export interface EventOutcomes {
  /** Everybody with a row on the event: registered ahead or walked up. */
  signups: number;
  /** Of those, the people who actually arrived (checked in). */
  arrived: number;
  /**
   * Contacts the org's own team saved during the event window. Null when the
   * event has no date, because "during the event" then means nothing.
   */
  teamContacts: number | null;
  /** Arrivals per hour, ISO hour start. Empty when nobody arrived. */
  arrivalsByHour: { hour: string; count: number }[];
  window: { from: string; to: string } | null;
}

// ── Owned by this product ────────────────────────────────────────────────────

export type ZoneKind = 'venue' | 'entrance' | 'booth' | 'room';

export const ZONE_KINDS: readonly ZoneKind[] = ['venue', 'entrance', 'booth', 'room'];

export interface Zone {
  id: string;
  eventId: string;
  name: string;
  kind: ZoneKind;
}

export type DeviceStatus =
  | 'pending_approval' // asked PLExyz; waiting for the owner to allow it
  | 'active'           // allowed; data is flowing
  | 'rejected'         // the owner said no
  | 'expired'          // nobody answered in time
  | 'revoked';         // we unpaired it

export interface Device {
  id: string;
  orgId: string;
  /** What the QR said. Kept so a rejected pairing can be retried without rescanning. */
  code: string;
  label: string;
  status: DeviceStatus;
  zoneId: string | null;
  requestedAt: string;
  approvedAt: string | null;
  lastSeenAt: string | null;
  /** 0–100, when the device reports it. */
  battery: number | null;
}

/** A device is "online" if it reported within this long. */
export const ONLINE_WITHIN_MINUTES = 15;

export interface SensorFunnel {
  /** Unique people seen anywhere at the event. Null: no venue or entrance sensor. */
  venue: number | null;
  /** Unique people seen in the booth(s) in scope. Null: no booth sensor. */
  visited: number | null;
  /** Of those, people with at least one visit at least as long as the threshold. */
  stayed: number | null;
  /** Median length of a visit in the booth(s) in scope, in whole seconds. */
  medianDwellSeconds: number | null;
}

export interface TrafficBucket {
  /** ISO start of the bucket. */
  start: string;
  /** Unique people present at any point inside the bucket. */
  count: number;
}

export interface ZoneStats {
  zoneId: string;
  visitors: number;
  stayed: number;
  medianDwellSeconds: number | null;
}

export interface PresenceReport {
  funnel: SensorFunnel;
  traffic: TrafficBucket[];
  /** Booths and rooms, busiest (by people who stayed) first. */
  zones: ZoneStats[];
  sessions: number;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
}

export interface PresenceQuery {
  from: string;
  to: string;
  thresholdMinutes: number;
  /** One zone, or the whole event when null. */
  zoneId: string | null;
  bucketSeconds: number;
}

/** Errors the api function returns, as `{ error: { code, message } }`. */
export type ApiErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'invalid'
  | 'conflict'
  | 'upstream'
  | 'not_configured';
