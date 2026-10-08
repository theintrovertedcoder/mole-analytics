import { describe, expect, it } from 'vitest';
import { parseDeviceQr } from '../../supabase/functions/_shared/qr.ts';

describe('parseDeviceQr', () => {
  it('takes a bare code', () => {
    expect(parseDeviceQr('  PLX-7F3A-91C2 ')).toEqual({ ok: true, code: 'PLX-7F3A-91C2' });
  });

  it('takes the code from a pairing link', () => {
    expect(parseDeviceQr('https://example.com/pair?code=PLX-1234')).toEqual({ ok: true, code: 'PLX-1234' });
    expect(parseDeviceQr('https://example.com/pair?device=abc_123')).toEqual({ ok: true, code: 'abc_123' });
    expect(parseDeviceQr('https://example.com/d/PLX-9999/')).toEqual({ ok: true, code: 'PLX-9999' });
  });

  it('refuses things that are not a device code', () => {
    expect(parseDeviceQr('')).toEqual({ ok: false, reason: 'empty' });
    expect(parseDeviceQr('hello world')).toEqual({ ok: false, reason: 'not_a_device_code' });
    expect(parseDeviceQr('https://example.com/')).toEqual({ ok: false, reason: 'not_a_device_code' });
    expect(parseDeviceQr('https://example.com/pair?code=<script>')).toEqual({ ok: false, reason: 'not_a_device_code' });
    expect(parseDeviceQr('https://exa mple.com')).toEqual({ ok: false, reason: 'unreadable' });
  });

  it('does not take a profile link from a Mole card for a device', () => {
    // The likeliest wrong thing to scan at a Mole event.
    expect(parseDeviceQr('https://mole.is/')).toEqual({ ok: false, reason: 'not_a_device_code' });
  });
});
