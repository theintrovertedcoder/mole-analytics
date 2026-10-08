// Pairing, the way Haziq described it: scan the QR on the sensor, Mole asks
// PLExyz, the owner allows it in the PLExyz dashboard, and the data flows.
//
// The camera is optional. A typed code does the same thing, because the
// person holding the sensor is often on a laptop at a venue with the sensor in
// their other hand.

import { Camera, CameraOff, CheckCircle2, Clock, Radio, XCircle } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Device } from '../../supabase/functions/_shared/contract.ts';
import { parseDeviceQr, QR_REASON_TEXT } from '../../supabase/functions/_shared/qr.ts';
import type { Backend } from '../data/backend.ts';
import { Link } from '../lib/Link.tsx';
import { Button, Card, ErrorNote, Field } from '../ui/kit.tsx';
import { buttonClass, inputClass } from '../ui/styles.ts';

type Detector = (v: HTMLVideoElement, c: HTMLCanvasElement) => Promise<string | null>;

async function makeDetector(): Promise<Detector> {
  const BD = (window as any).BarcodeDetector;
  if (BD) {
    try {
      const d = new BD({ formats: ['qr_code'] });
      return async (video) => (await d.detect(video))[0]?.rawValue ?? null;
    } catch {
      // fall through to jsQR
    }
  }
  // Loaded only when a camera is actually opened, so it costs nothing otherwise.
  const { default: jsQR } = await import('jsqr');
  return async (video, canvas) => {
    const w = video.videoWidth, h = video.videoHeight;
    if (!w || !h) return null;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(video, 0, 0, w, h);
    return jsQR(ctx.getImageData(0, 0, w, h).data, w, h)?.data ?? null;
  };
}

function Scanner({ onCode }: { onCode: (text: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<'starting' | 'on' | 'denied' | 'none'>('starting');

  useEffect(() => {
    let stream: MediaStream | null = null;
    let stop = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) { setState('none'); return; }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      } catch {
        setState('denied');
        return;
      }
      if (stop) { stream.getTracks().forEach(t => t.stop()); return; }
      video.current!.srcObject = stream;
      await video.current!.play().catch(() => undefined);
      setState('on');
      const detect = await makeDetector();
      while (!stop) {
        const text = await detect(video.current!, canvas.current!).catch(() => null);
        if (text) { onCode(text); return; }
        await new Promise(r => setTimeout(r, 250));
      }
    })();
    return () => { stop = true; stream?.getTracks().forEach(t => t.stop()); };
  }, [onCode]);

  return (
    <div className="relative overflow-hidden rounded-panel bg-ink">
      <video ref={video} muted playsInline className={`aspect-[4/3] w-full object-cover ${state === 'on' ? '' : 'invisible'}`} />
      <canvas ref={canvas} className="hidden" />
      {state === 'on' && <div className="pointer-events-none absolute inset-[18%] rounded-panel border-2 border-white/80" aria-hidden />}
      {state !== 'on' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-sm text-on-fill">
          {state === 'starting' ? <Camera className="h-6 w-6" aria-hidden /> : <CameraOff className="h-6 w-6" aria-hidden />}
          {state === 'starting' && 'Opening the camera…'}
          {state === 'denied' && 'The camera is blocked for this site. Type the code instead — it’s printed under the QR.'}
          {state === 'none' && 'This browser has no camera to use. Type the code instead — it’s printed under the QR.'}
        </div>
      )}
    </div>
  );
}

export function PairSensor({ backend, orgId }: { backend: Backend; orgId: string }) {
  const eventId = new URLSearchParams(window.location.search).get('event');
  const [camera, setCamera] = useState(false);
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [device, setDevice] = useState<Device | null>(null);

  const backTo = eventId ? `/events/${eventId}/setup` : `/orgs/${orgId}/sensors`;

  // While waiting, ask again every 10 seconds for two minutes, then leave it
  // to the button: the owner might not look at PLExyz until tomorrow.
  useEffect(() => {
    if (device?.status !== 'pending_approval') return;
    let n = 0;
    const t = setInterval(async () => {
      if (++n > 12) { clearInterval(t); return; }
      try { setDevice(await backend.refreshDevice(device.id)); } catch { /* the button still works */ }
    }, 10_000);
    return () => clearInterval(t);
  }, [backend, device?.id, device?.status]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const qr = parseDeviceQr(code);
    if (!qr.ok) { setError(QR_REASON_TEXT[qr.reason]); return; }
    setBusy(true);
    setError(null);
    try {
      setDevice(await backend.pairDevice(orgId, { code: qr.code, label: label.trim() || qr.code }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (device) {
    const pending = device.status === 'pending_approval';
    const ok = device.status === 'active';
    return (
      <div className="mx-auto max-w-lg">
        <Card>
          <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-panel ${ok ? 'bg-ok-tint text-ok-text' : pending ? 'bg-warn-tint text-warn-text' : 'bg-bad-tint text-bad-text'}`}>
            {ok ? <CheckCircle2 className="h-6 w-6" aria-hidden /> : pending ? <Clock className="h-6 w-6" aria-hidden /> : <XCircle className="h-6 w-6" aria-hidden />}
          </div>
          {pending && (
            <>
              <h1 className="text-xl font-extrabold tracking-tight text-ink">Waiting for the owner to allow it</h1>
              <p className="mt-2 text-sm text-fg-muted">
                Mole has asked PLExyz to pair <strong className="text-ink">{device.label}</strong>. Whoever owns the sensor
                will see the request in their PLExyz dashboard. As soon as they allow it, it starts counting — this page checks
                by itself for the next two minutes.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button tone="secondary" busy={busy} onClick={async () => { setBusy(true); try { setDevice(await backend.refreshDevice(device.id)); } finally { setBusy(false); } }}>
                  Check again
                </Button>
                <Link to={backTo} className={buttonClass('quiet')}>Do something else; it’ll keep</Link>
              </div>
              {backend.simulateOwnerDecision && (
                <div className="mt-6 rounded-panel border border-dashed border-sunny-text bg-sunny-tint p-4">
                  <p className="text-xs font-semibold text-sunny-text">Sample data only: play the sensor’s owner</p>
                  <div className="mt-2 flex gap-2">
                    <Button tone="secondary" onClick={async () => { await backend.simulateOwnerDecision!(device.id, 'approved'); setDevice(await backend.refreshDevice(device.id)); }}>Allow</Button>
                    <Button tone="secondary" onClick={async () => { await backend.simulateOwnerDecision!(device.id, 'rejected'); setDevice(await backend.refreshDevice(device.id)); }}>Refuse</Button>
                  </div>
                </div>
              )}
            </>
          )}
          {ok && (
            <>
              <h1 className="text-xl font-extrabold tracking-tight text-ink">Paired</h1>
              <p className="mt-2 text-sm text-fg-muted">
                <strong className="text-ink">{device.label}</strong> is connected. Put it in a zone and it starts counting there.
              </p>
              <Link to={backTo} className={`${buttonClass()} mt-6`}>{eventId ? 'Put it in a zone' : 'Back to sensors'}</Link>
            </>
          )}
          {!pending && !ok && (
            <>
              <h1 className="text-xl font-extrabold tracking-tight text-ink">{device.status === 'rejected' ? 'The owner didn’t allow it' : 'The request expired'}</h1>
              <p className="mt-2 text-sm text-fg-muted">Nothing was connected. Check with whoever owns the sensor, then scan it again.</p>
              <Button className="mt-6" onClick={() => { setDevice(null); setCode(''); }}>Try again</Button>
            </>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <Link to={backTo} className="mb-4 inline-flex text-sm font-semibold text-fg-muted hover:text-ink">← Back</Link>
      <h1 className="text-[28px] font-black tracking-tight text-ink">Pair a sensor</h1>
      <p className="mt-1 text-sm text-fg-muted">Scan the QR on the PLExyz sensor, or type the code printed under it.</p>

      <Card className="mt-6 space-y-5">
        {camera ? (
          <Scanner onCode={text => { setCamera(false); setCode(text.trim()); setError(null); }} />
        ) : (
          <Button tone="secondary" className="w-full" onClick={() => setCamera(true)}>
            <Camera className="h-4 w-4" aria-hidden /> Scan the QR with the camera
          </Button>
        )}

        <form onSubmit={submit} className="space-y-4">
          <Field label="Sensor code" hint="Exactly as printed, or the whole link the QR holds.">
            <input className={`${inputClass} font-mono`} value={code} onChange={e => setCode(e.target.value)} required placeholder="PLX-7F3A-91C2" />
          </Field>
          <Field label="What to call it" hint="So you can tell it apart later. You can change it.">
            <input className={inputClass} value={label} onChange={e => setLabel(e.target.value)} maxLength={80} placeholder="e.g. Hall B entrance" />
          </Field>
          {error && <ErrorNote error={error} />}
          <Button type="submit" className="w-full" busy={busy}><Radio className="h-4 w-4" aria-hidden /> Ask PLExyz to pair it</Button>
        </form>
      </Card>
      <p className="mt-4 text-xs text-fg-subtle">
        A sensor counts nearby phones as anonymous visits. Mole never stores what the sensor saw, only a scrambled key that
        can’t be traced back to a phone or matched across events.
      </p>
    </div>
  );
}
