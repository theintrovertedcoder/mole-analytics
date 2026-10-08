// supabase/functions/_shared/qr.ts
// ─────────────────────────────────────────────────────────────────────────────
// What a PLExyz device's QR code says, turned into the code we pair with.
// ─────────────────────────────────────────────────────────────────────────────
// We have not seen a PLExyz QR yet (docs/PLEXYZ_INTEGRATION.md, question 4), so
// this accepts the shapes a device QR usually takes and nothing looser:
//
//   • a bare code                       PLX-7F3A-91C2
//   • a URL with the code in the query  https://<plexyz host>/pair?code=PLX-…
//                                       (also ?device= and ?id=)
//   • a URL with the code as its last path segment
//                                       https://<plexyz host>/d/PLX-7F3A-91C2
//
// Shared by the app (to tell the person at once that they scanned the wrong
// thing) and the server (which never trusts the app to have checked).
// ─────────────────────────────────────────────────────────────────────────────

export type QrResult =
  | { ok: true; code: string }
  | { ok: false; reason: 'empty' | 'unreadable' | 'not_a_device_code' };

const CODE = /^[A-Za-z0-9][A-Za-z0-9_-]{3,63}$/;

export function parseDeviceQr(raw: string): QrResult {
  const text = (raw ?? '').trim();
  if (!text) return { ok: false, reason: 'empty' };

  if (/^https?:\/\//i.test(text)) {
    let url: URL;
    try {
      url = new URL(text);
    } catch {
      return { ok: false, reason: 'unreadable' };
    }
    for (const key of ['code', 'device', 'id']) {
      const v = url.searchParams.get(key)?.trim();
      if (v) return CODE.test(v) ? { ok: true, code: v } : { ok: false, reason: 'not_a_device_code' };
    }
    const last = url.pathname.split('/').filter(Boolean).pop();
    if (last && CODE.test(last)) return { ok: true, code: decodeURIComponent(last) };
    return { ok: false, reason: 'not_a_device_code' };
  }

  return CODE.test(text) ? { ok: true, code: text } : { ok: false, reason: 'not_a_device_code' };
}

export const QR_REASON_TEXT: Record<Exclude<QrResult, { ok: true }>['reason'], string> = {
  empty: 'Nothing was read. Hold the code steady inside the frame, or type it in.',
  unreadable: "That link couldn't be read. Type the code printed under the QR instead.",
  not_a_device_code: "That QR isn't a PLExyz device code. Check you're scanning the sticker on the sensor.",
};
