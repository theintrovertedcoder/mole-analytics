// tests/db/run.mjs
// ─────────────────────────────────────────────────────────────────────────────
// The database, tested against a real Postgres.
// ─────────────────────────────────────────────────────────────────────────────
//   npm run test:db
//
// Starts a throwaway Postgres, applies every migration in order, and checks
// three things that reading the SQL cannot prove:
//
//   1. Nobody gets in with this project's anon key. Each read and write is
//      ATTEMPTED as `anon` and as `authenticated`, and must fail.
//   2. The SQL report and presence.ts agree, number for number, on the same
//      sessions — across whole-event, one-booth, one-room, no-venue-sensor and
//      part-of-the-day cases.
//   3. Ingest files sessions where they belong, drops what it cannot file,
//      ignores a retry, and a zone with history cannot be deleted.
//
// Nothing persists. Set PGTEST_KEEP=1 to leave the server up for poking at.
// ─────────────────────────────────────────────────────────────────────────────

import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { presenceReport, staffKeys } from '../../supabase/functions/_shared/presence.ts';
import { normaliseReport } from '../../supabase/functions/_shared/report.ts';
import { generateSessions } from '../../src/data/sample/generate.ts';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');
const PORT = process.env.PGTEST_PORT ?? '5466';
const PGBIN = process.env.PGBIN ?? '/usr/lib/postgresql/16/bin';
const DATA = join(tmpdir(), `ma-pgtest-${process.pid}`);
const SOCK = join(tmpdir(), `ma-pgsock-${process.pid}`);
const asRoot = process.getuid?.() === 0;

const sh = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: 'utf8', ...opts });
// initdb refuses to run as root, which is what a container runs as.
const pgsh = (cmd) => asRoot ? sh('su', ['-s', '/bin/bash', 'nobody', '-c', cmd]) : sh('bash', ['-c', cmd]);

function psql(sql, { role } = {}) {
  const r = sh('psql', [
    '-h', SOCK, '-p', PORT, '-U', 'postgres', '-d', 'postgres',
    '-v', 'ON_ERROR_STOP=1', '-q', '-t', '-A',
    '-c', role ? `SET ROLE ${role}; ${sql}` : sql,
  ]);
  if (r.status !== 0) throw new Error((r.stderr || r.stdout || '').trim());
  return (r.stdout ?? '').trim();
}

function psqlFile(path) {
  const r = sh('psql', ['-h', SOCK, '-p', PORT, '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q', '-f', path]);
  if (r.status !== 0) throw new Error(`${path}: ${(r.stderr || r.stdout).trim()}`);
}

// ── Server ───────────────────────────────────────────────────────────────────
rmSync(DATA, { recursive: true, force: true });
mkdirSync(SOCK, { recursive: true, mode: 0o777 });
mkdirSync(DATA, { recursive: true, mode: 0o777 });
if (asRoot) sh('chown', ['nobody', DATA, SOCK]);

let r = pgsh(`${PGBIN}/initdb -D ${DATA} -U postgres -A trust >/dev/null`);
if (r.status !== 0) { console.error(r.stderr || r.stdout); process.exit(1); }
r = pgsh(`${PGBIN}/pg_ctl -D ${DATA} -o "-p ${PORT} -k ${SOCK} -c listen_addresses=''" -w start >/dev/null`);
if (r.status !== 0) { console.error(r.stderr || r.stdout); process.exit(1); }

let failures = 0;
let passes = 0;
function check(name, fn) {
  try {
    fn();
    passes++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failures++;
    console.log(`  ✗ ${name}\n      ${String(e.message).split('\n').join('\n      ')}`);
  }
}
function refused(sql, role) {
  try {
    psql(sql, { role });
  } catch (e) {
    if (/permission denied|must be owner/i.test(e.message)) return;
    throw new Error(`failed, but not as a refusal: ${e.message}`);
  }
  throw new Error(`${role} was allowed: ${sql}`);
}

try {
  // Just enough of Supabase: its three roles.
  psql(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
        GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
        -- Supabase's default: every new table granted to everyone. The migration
        -- has to take this back, so the test starts from the hostile default.
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;`);

  const dir = join(repo, 'supabase', 'migrations');
  for (const f of readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) psqlFile(join(dir, f));
  console.log('· migrations applied');

  // ── 1 · Nobody gets in ─────────────────────────────────────────────────────
  console.log('\nThe anon key opens nothing');
  const tables = ['zones', 'devices', 'device_credentials', 'presence_sessions', 'webhook_receipts'];
  for (const role of ['anon', 'authenticated']) {
    for (const t of tables) {
      check(`${role} cannot read ${t}`, () => refused(`SELECT * FROM public.${t} LIMIT 1;`, role));
    }
    check(`${role} cannot add a zone`, () => refused(
      `INSERT INTO public.zones (mole_event_id, mole_org_id, name, kind, created_by)
       VALUES (gen_random_uuid(), gen_random_uuid(), 'x', 'booth', gen_random_uuid());`, role));
    check(`${role} cannot pair a device`, () => refused(
      `INSERT INTO public.devices (mole_org_id, code, label, requested_by)
       VALUES (gen_random_uuid(), 'PLX-0001', 'x', gen_random_uuid());`, role));
    check(`${role} cannot run a report`, () => refused(
      `SELECT public.presence_report(gen_random_uuid(), now(), now(), 3, NULL, 3600);`, role));
    check(`${role} cannot ingest`, () => refused(
      `SELECT public.ingest_presence(gen_random_uuid(), '[]'::jsonb);`, role));
  }

  // ── 2 · SQL and TypeScript agree ───────────────────────────────────────────
  console.log('\nThe SQL report equals presence.ts');
  const ORG = 'aaaaaaaa-0000-0000-0000-000000000001';
  const USER = 'aaaaaaaa-0000-0000-0000-0000000000ff';
  const mkZones = (eventId, spec) => spec.map(([name, kind], i) => ({
    id: `${eventId.slice(0, 8)}-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
    eventId, name, kind,
  }));
  const EV1 = 'e1e1e1e1-0000-4000-8000-000000000001';
  const EV2 = 'e2e2e2e2-0000-4000-8000-000000000002';
  const z1 = mkZones(EV1, [['Main hall', 'venue'], ['North entrance', 'entrance'],
    ['Booth A12', 'booth'], ['Booth B04', 'booth'], ['Booth C99', 'booth'], ['Booth D01', 'booth'], ['Stage room', 'room']]);
  const z2 = mkZones(EV2, [['Our stand', 'booth']]); // an exhibitor: one booth, no venue sensor

  const day = { start: '2026-10-10T01:00:00.000Z', end: '2026-10-10T10:00:00.000Z' };
  const s1 = generateSessions({ zones: z1, ...day, visitors: 900, seed: 7, staffPerBooth: 2 });
  // Random times almost never land on a bucket edge, so the edges are placed by
  // hand: a mutation from `<` to `<=` at a boundary walked straight past the
  // random fixture alone.
  s1.push(
    { zoneId: z1[2].id, visitorKey: 'edge-1', startedAt: '2026-10-10T03:00:00.000Z', endedAt: '2026-10-10T03:03:00.000Z' },
    { zoneId: z1[2].id, visitorKey: 'edge-2', startedAt: '2026-10-10T03:57:00.000Z', endedAt: '2026-10-10T04:00:00.000Z' },
    { zoneId: z1[3].id, visitorKey: 'edge-3', startedAt: '2026-10-10T09:59:59.000Z', endedAt: '2026-10-10T10:30:00.000Z' },
    { zoneId: z1[3].id, visitorKey: 'edge-4', startedAt: '2026-10-10T10:00:00.000Z', endedAt: '2026-10-10T10:30:00.000Z' },
    // Either side of the staff line (STAFF_HOURS = 3, at one booth, summed).
    { zoneId: z1[5].id, visitorKey: 'staff-exact', startedAt: '2026-10-10T01:00:00.000Z', endedAt: '2026-10-10T04:00:00.000Z' },
    { zoneId: z1[5].id, visitorKey: 'staff-short', startedAt: '2026-10-10T01:00:00.000Z', endedAt: '2026-10-10T03:59:59.000Z' },
    { zoneId: z1[4].id, visitorKey: 'staff-split', startedAt: '2026-10-10T01:00:00.000Z', endedAt: '2026-10-10T02:30:00.000Z' },
    { zoneId: z1[4].id, visitorKey: 'staff-split', startedAt: '2026-10-10T05:00:00.000Z', endedAt: '2026-10-10T06:30:00.000Z' },
    { zoneId: z1[4].id, visitorKey: 'two-booths', startedAt: '2026-10-10T01:00:00.000Z', endedAt: '2026-10-10T03:00:00.000Z' },
    { zoneId: z1[5].id, visitorKey: 'two-booths', startedAt: '2026-10-10T04:00:00.000Z', endedAt: '2026-10-10T06:00:00.000Z' },
    { zoneId: z1[6].id, visitorKey: 'room-long', startedAt: '2026-10-10T01:00:00.000Z', endedAt: '2026-10-10T06:00:00.000Z' },
  );
  const s2 = generateSessions({ zones: z2, ...day, visitors: 300, seed: 11 });

  const dev = (n) => `dddddddd-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const rows = [];
  for (const [zs, ss, ev] of [[z1, s1, EV1], [z2, s2, EV2]]) {
    for (const z of zs) {
      psql(`INSERT INTO public.zones (id, mole_event_id, mole_org_id, name, kind, created_by)
            VALUES ('${z.id}', '${ev}', '${ORG}', '${z.name}', '${z.kind}', '${USER}');`);
    }
    ss.forEach((s, i) => rows.push({ ...s, ev, src: `${ev.slice(0, 4)}-${i}` }));
  }
  // One device per zone so the rows look like what ingest writes.
  const zoneDevice = new Map([...z1, ...z2].map((z, i) => [z.id, dev(i + 1)]));
  for (const [zid, did] of zoneDevice) {
    psql(`INSERT INTO public.devices (id, mole_org_id, code, label, status, zone_id, requested_by)
          VALUES ('${did}', '${ORG}', 'PLX-${did.slice(-4)}', 'sensor', 'active', '${zid}', '${USER}');`);
  }
  const csv = rows.map(s => [zoneDevice.get(s.zoneId), s.zoneId, s.ev, s.visitorKey, s.startedAt, s.endedAt, s.src].join(',')).join('\n');
  const csvPath = join(DATA, 'sessions.csv');
  writeFileSync(csvPath, csv + '\n');
  if (asRoot) sh('chown', ['nobody', csvPath]);
  psql(`\\copy public.presence_sessions (device_id, zone_id, mole_event_id, visitor_key, started_at, ended_at, source_id) FROM '${csvPath}' WITH (FORMAT csv)`);
  console.log(`· ${rows.length} sessions loaded`);

  const sqlReport = (ev, q) => {
    const out = psql(`SELECT public.presence_report('${ev}', '${q.from}', '${q.to}', ${q.thresholdMinutes},
                      ${q.zoneId ? `'${q.zoneId}'` : 'NULL'}, ${q.bucketSeconds});`);
    return normaliseReport(JSON.parse(out));
  };
  const tsReport = (zones, sessions, q) => normaliseReport(presenceReport({ zones, sessions, ...q }));

  const full = { from: day.start, to: day.end, thresholdMinutes: 3, zoneId: null, bucketSeconds: 3600 };
  const cases = [
    ['whole event, 3 min', EV1, z1, s1, full],
    ['whole event, 10 min', EV1, z1, s1, { ...full, thresholdMinutes: 10 }],
    ['whole event, 2.5 min', EV1, z1, s1, { ...full, thresholdMinutes: 2.5 }],
    ['one booth', EV1, z1, s1, { ...full, zoneId: z1[3].id }],
    ['one room', EV1, z1, s1, { ...full, zoneId: z1[6].id }],
    ['the entrance, as a focus', EV1, z1, s1, { ...full, zoneId: z1[1].id }],
    ['a zone from another event', EV1, z1, s1, { ...full, zoneId: z2[0].id }],
    ['an afternoon, 15-minute buckets', EV1, z1, s1,
      { ...full, from: '2026-10-10T05:30:00.000Z', to: '2026-10-10T07:45:00.000Z', bucketSeconds: 900 }],
    ['a window with nobody in it', EV1, z1, s1, { ...full, from: '2026-10-11T00:00:00.000Z', to: '2026-10-11T02:00:00.000Z' }],
    ['a year, so the bucket widens', EV1, z1, s1, { ...full, from: '2026-01-01T00:00:00.000Z', to: '2027-01-01T00:00:00.000Z' }],
    ['exhibitor with no venue sensor', EV2, z2, s2, full],
  ];
  for (const [name, ev, zones, sessions, q] of cases) {
    check(name, () => {
      const a = sqlReport(ev, q);
      const b = tsReport(zones, sessions, q);
      const ja = JSON.stringify(a), jb = JSON.stringify(b);
      if (ja !== jb) {
        // Name the first field that differs, not two walls of JSON.
        for (const k of Object.keys(b)) {
          if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) {
            throw new Error(`"${k}" differs\n  sql: ${JSON.stringify(a[k]).slice(0, 400)}\n  ts:  ${JSON.stringify(b[k]).slice(0, 400)}`);
          }
        }
      }
    });
  }
  check('the fixture is not trivially empty', () => {
    const a = sqlReport(EV1, full);
    if (!(a.funnel.venue > 500 && a.funnel.visited > 100 && a.funnel.stayed > 10 && a.funnel.stayed < a.funnel.visited)) {
      throw new Error(`a funnel this flat proves nothing: ${JSON.stringify(a.funnel)}`);
    }
  });
  check('booth staff are left out, and only booth staff', () => {
    const staff = staffKeys(z1, s1);
    const wrong = [['staff-exact', true], ['staff-split', true], ['staff-short', false], ['two-booths', false], ['room-long', false]]
      .filter(([k, want]) => staff.has(k) !== want).map(([k]) => k);
    if (wrong.length) throw new Error(`misjudged: ${wrong.join(', ')}`);
    const generated = [...staff].filter(k => k.includes('-staff')).length;
    if (generated !== 8) throw new Error(`expected the fixture's 8 staff phones, got ${generated}`);
    const a = sqlReport(EV1, full);
    if (a.staffLeftOut !== staff.size) throw new Error(`sql left out ${a.staffLeftOut}, ts ${staff.size}`);
  });
  check('an exhibitor without a venue sensor gets no "at the event" number', () => {
    const a = sqlReport(EV2, full);
    if (a.funnel.venue !== null) throw new Error(`venue = ${a.funnel.venue}`);
  });

  // ── 3 · Ingest ─────────────────────────────────────────────────────────────
  console.log('\nIngest');
  const PEND = dev(900), NOZONE = dev(901), LIVE = dev(902);
  psql(`INSERT INTO public.devices (id, mole_org_id, code, label, status, zone_id, requested_by) VALUES
        ('${PEND}', '${ORG}', 'PLX-PEND', 'waiting', 'pending_approval', '${z1[2].id}', '${USER}'),
        ('${NOZONE}', '${ORG}', 'PLX-NOZN', 'unplaced', 'active', NULL, '${USER}'),
        ('${LIVE}', '${ORG}', 'PLX-LIVE', 'live', 'active', '${z1[4].id}', '${USER}');`);
  const batch = JSON.stringify([
    { visitor_key: 'k1', started_at: '2026-10-12T02:00:00Z', ended_at: '2026-10-12T02:05:00Z', source_id: 'a' },
    { visitor_key: 'k2', started_at: '2026-10-12T02:00:00Z', ended_at: '2026-10-12T01:00:00Z', source_id: 'backwards' },
  ]).replace(/'/g, "''");
  const ingest = (d) => JSON.parse(psql(`SELECT public.ingest_presence('${d}', '${batch}'::jsonb);`, { role: 'service_role' }));

  check('a device still waiting for approval stores nothing', () => {
    const x = ingest(PEND);
    if (x.stored !== 0) throw new Error(JSON.stringify(x));
  });
  check('a device in no zone stores nothing, and says so', () => {
    const x = ingest(NOZONE);
    if (x.stored !== 0 || x.dropped_no_zone !== 2) throw new Error(JSON.stringify(x));
  });
  check('an active device files under its zone and its event', () => {
    const x = ingest(LIVE);
    if (x.stored !== 1) throw new Error(`stored ${x.stored}, expected 1 (the backwards session must be skipped)`);
    const row = psql(`SELECT zone_id || '|' || mole_event_id FROM public.presence_sessions WHERE device_id = '${LIVE}';`);
    if (row !== `${z1[4].id}|${EV1}`) throw new Error(row);
  });
  check('the same delivery twice stores it once', () => {
    const x = ingest(LIVE);
    if (x.stored !== 0) throw new Error(JSON.stringify(x));
  });
  check('moving the sensor does not move what it already counted', () => {
    psql(`UPDATE public.devices SET zone_id = '${z1[5].id}' WHERE id = '${LIVE}';`);
    const row = psql(`SELECT zone_id FROM public.presence_sessions WHERE device_id = '${LIVE}' AND source_id = 'a';`);
    if (row !== z1[4].id) throw new Error(`the old session moved to ${row}`);
  });
  check('a zone with history cannot be deleted', () => {
    try {
      psql(`DELETE FROM public.zones WHERE id = '${z1[2].id}';`);
    } catch (e) {
      if (/violates foreign key/.test(e.message)) return;
      throw e;
    }
    throw new Error('the zone, and its history, were deleted');
  });
  check('one sensor cannot be paired to two orgs at once', () => {
    try {
      psql(`INSERT INTO public.devices (mole_org_id, code, label, requested_by)
            VALUES (gen_random_uuid(), 'PLX-LIVE', 'theirs', gen_random_uuid());`);
    } catch (e) {
      if (/devices_one_live_pairing/.test(e.message)) return;
      throw e;
    }
    throw new Error('a second org paired the same sensor');
  });
  check('once unpaired, the sensor can be paired again', () => {
    psql(`UPDATE public.devices SET status = 'revoked' WHERE id = '${LIVE}';
          INSERT INTO public.devices (mole_org_id, code, label, requested_by)
          VALUES (gen_random_uuid(), 'PLX-LIVE', 'next event', gen_random_uuid());`);
  });
} catch (e) {
  failures++;
  console.error(`\n✗ setup failed: ${e.message}`);
} finally {
  if (!process.env.PGTEST_KEEP) {
    pgsh(`${PGBIN}/pg_ctl -D ${DATA} -m immediate stop >/dev/null`);
    rmSync(DATA, { recursive: true, force: true });
    rmSync(SOCK, { recursive: true, force: true });
  } else {
    console.log(`\nleft running: psql -h ${SOCK} -p ${PORT} -U postgres`);
  }
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
