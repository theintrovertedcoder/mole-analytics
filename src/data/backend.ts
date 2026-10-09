// src/data/backend.ts
// ─────────────────────────────────────────────────────────────────────────────
// Everything a screen can ask for, as one interface with two implementations:
// live (Mole V3 + this product's api function) and sample (in memory). Screens
// import `backend` and never know which one they have, except to show the
// sample banner.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  Device, EventOutcomes, MoleEvent, MoleOrg, PresenceQuery, PresenceReport, Zone, ZoneKind,
} from '../../supabase/functions/_shared/contract.ts';

export interface Account {
  id: string;
  email: string | null;
}

export interface Backend {
  mode: 'sample' | 'live';

  account(): Promise<Account | null>;
  onAccountChange(cb: (a: Account | null) => void): () => void;
  signInWithPassword(email: string, password: string): Promise<void>;
  /**
   * Email a 6-digit code (Mole V3's own sign-in). If there is no Mole account
   * for the address yet, this makes one: it is the same Mole account the app uses.
   */
  sendEmailCode(email: string): Promise<void>;
  signInWithEmailCode(email: string, code: string): Promise<void>;
  signInWithGoogle(): Promise<void>;
  signOut(): Promise<void>;

  myOrgs(): Promise<MoleOrg[]>;
  myEvents(): Promise<MoleEvent[]>;
  event(id: string): Promise<MoleEvent | null>;
  outcomes(eventId: string): Promise<EventOutcomes | null>;

  zones(eventId: string): Promise<Zone[]>;
  createZone(eventId: string, z: { name: string; kind: ZoneKind }): Promise<Zone>;
  updateZone(id: string, patch: { name?: string; kind?: ZoneKind }): Promise<Zone>;
  deleteZone(id: string): Promise<void>;

  devices(orgId: string): Promise<Device[]>;
  pairDevice(orgId: string, d: { code: string; label: string }): Promise<Device>;
  refreshDevice(id: string): Promise<Device>;
  updateDevice(id: string, patch: { label?: string; zoneId?: string | null }): Promise<Device>;
  unpairDevice(id: string): Promise<{ device: Device; plexyzConfirmed: boolean }>;

  presence(eventId: string, q: Partial<PresenceQuery>): Promise<{ query: PresenceQuery; report: PresenceReport }>;

  /** Sample mode only: what the device's owner does in the PLExyz dashboard. */
  simulateOwnerDecision?(deviceId: string, decision: 'approved' | 'rejected'): Promise<void>;
}

/** An error with a message written for the person reading it. */
export class UserFacingError extends Error {
  constructor(message: string, public code: string = 'error') {
    super(message);
  }
}
