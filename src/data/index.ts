// Which backend this build uses (config/env.ts), loaded only when needed: a
// live build never downloads the sample world, and sample mode never
// downloads the Mole sign-in client.

import { dataMode, liveConfig } from '../config/env.ts';
import type { Backend } from './backend.ts';

export async function loadBackend(): Promise<Backend | null> {
  if (dataMode === 'live' && liveConfig) return (await import('./live/liveBackend.ts')).liveBackend(liveConfig);
  if (dataMode === 'sample') return (await import('./sample/sampleBackend.ts')).sampleBackend();
  return null;
}
