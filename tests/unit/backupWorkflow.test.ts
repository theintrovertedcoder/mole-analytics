// The nightly backup (.github/workflows/backup.yml). A backup that is empty,
// unencrypted, of the wrong project or stored where anyone can read it is worse
// than none, because it is trusted. Each rule is checked here by running the
// workflow's own shell steps.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const WF = readFileSync(new URL('../../.github/workflows/backup.yml', import.meta.url), 'utf8');
const code = WF.split('\n').filter((l) => !l.trim().startsWith('#')).join('\n');

function step(name: string): string {
  const body = new RegExp(`- name: ${name}\\n\\s+run: \\|\\n([\\s\\S]*?)\\n\\n`).exec(code)?.[1];
  if (!body) throw new Error(`step "${name}" is missing`);
  return body.replace(/^ {10}/gm, '');
}
const bash = (script: string, env: Record<string, string>, cwd?: string) =>
  spawnSync('bash', ['-eo', 'pipefail', '-c', script], { encoding: 'utf8', cwd, env: { PATH: process.env.PATH ?? '', MOLE_V3_REF: 'czuquiqpsjwpiqmcllbd', ...env } });

const SENSE = 'postgresql://postgres.abcdefghijklmnopqrst:pw@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres';
const PASS = 'x'.repeat(32);

describe('nightly backup workflow', () => {
  it('runs every night and by hand, never on a push, and cannot write to the repo', () => {
    const on = /^on:\n([\s\S]*?)\n\S/m.exec(code)?.[1] ?? '';
    expect(on).toMatch(/schedule:\n\s+- cron: '\d+ \d+ \* \* \*'/);
    expect(on).toMatch(/workflow_dispatch:/);
    expect(on).not.toMatch(/\b(push|pull_request|workflow_run)\b/);
    expect(code).toMatch(/^permissions:\n\s+contents: read$/m);
    expect(code).not.toMatch(/git (commit|push)|set -x/);
    for (const s of ['BACKUP_DB_URL', 'BACKUP_PASSPHRASE']) expect(code).toContain(`${s}: \${{ secrets.${s} }}`);
    for (const m of code.matchAll(/uses: ([\w./-]+)@(\S+)/g)) expect(m[2], m[1]).toMatch(/^v\d+(\.\d+)*$/);
  });

  it('takes a Mole Sense pooler address, and refuses Mole V3, the direct address and missing secrets', () => {
    const guard = step('Check the two secrets');
    const ok = bash(guard, { BACKUP_DB_URL: SENSE, BACKUP_PASSPHRASE: PASS });
    expect(ok.status).toBe(0);
    expect(ok.stdout).toContain('abcdefgh…');
    expect(ok.stdout).not.toMatch(/abcdefghijklmnopqrst|pw@|x{9}/); // at most 8 characters of anything secret
    const v3 = bash(guard, { BACKUP_DB_URL: SENSE.replaceAll('abcdefghijklmnopqrst', 'czuquiqpsjwpiqmcllbd'), BACKUP_PASSPHRASE: PASS });
    expect(v3.status).not.toBe(0);
    expect(v3.stdout).toMatch(/Mole V3's project/);
    const direct = bash(guard, { BACKUP_DB_URL: 'postgresql://postgres:pw@db.abcdefghijklmnopqrst.supabase.co:5432/postgres', BACKUP_PASSPHRASE: PASS });
    expect(direct.status).not.toBe(0);
    expect(direct.stdout).toMatch(/Session pooler/);
    expect(bash(guard, { BACKUP_DB_URL: SENSE }).stdout).toMatch(/Not set: BACKUP_PASSPHRASE/);
    expect(bash(guard, { BACKUP_DB_URL: SENSE, BACKUP_PASSPHRASE: 'short' }).status).not.toBe(0);
  });

  it('refuses an empty or partial dump', () => {
    const check = step('Check it is a whole database');
    const run = (schema: string, data: string) => {
      const dir = mkdtempSync(join(tmpdir(), 'bk-'));
      writeFileSync(join(dir, 'roles.sql'), 'x');
      writeFileSync(join(dir, 'schema.sql'), schema);
      writeFileSync(join(dir, 'data.sql'), data);
      return bash(check, {}, dir).status;
    };
    const five = ['zones', 'devices', 'device_credentials', 'presence_sessions', 'webhook_receipts'].map((t) => `CREATE TABLE IF NOT EXISTS "public"."${t}" (`).join('\n');
    expect(run(five, 'COPY "public"."zones" FROM stdin;')).toBe(0);
    // Too few tables, even with the key one present.
    expect(run(five.split('\n').slice(2, 4).join('\n'), 'COPY x')).not.toBe(0);
    expect(run(five.replace('presence_sessions', 'other'), 'COPY x')).not.toBe(0);
    expect(run(five, '')).not.toBe(0);
  });

  it('encrypts, proves the file opens, deletes the plain dump, then keeps only the encrypted file', () => {
    const at = (s: string) => code.indexOf(s);
    const order = ['Check the two secrets', 'supabase db dump', 'Check it is a whole database', 'openssl enc -aes-256-cbc', 'rm -f roles.sql schema.sql data.sql', 'openssl enc -d', 'upload-artifact'];
    order.slice(1).forEach((next, i) => {
      const prev = order[i] ?? '';
      expect(at(prev), `${prev} is missing`).toBeGreaterThan(0);
      expect(at(prev), `${prev} must come before ${next}`).toBeLessThan(at(next));
    });
    expect(code).toContain('path: ${{ steps.pack.outputs.name }}.tar.gz.enc');
  });
});
