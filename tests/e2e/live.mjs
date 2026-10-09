// tests/e2e/live.mjs
// ─────────────────────────────────────────────────────────────────────────────
// The live build's sign-in, in a real browser, against a stand-in for Mole V3.
// ─────────────────────────────────────────────────────────────────────────────
//   npm run test:e2e     (runs this after the sample journeys)
//
// The sample build never shows the real sign-in, so this builds the app in
// live mode with its Mole address pointed at a small local server that
// answers the few auth and RPC calls sign-in makes, the way Supabase does. It
// proves the screens and the calls; it doesn't prove Mole V3's email template
// carries the code (that is YOUR_TURN, with a check of its own).
// ─────────────────────────────────────────────────────────────────────────────

import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { axe, expectText, finish, journey, start } from './harness.mjs';

const MOLE_PORT = 4197;
const MOLE = `http://localhost:${MOLE_PORT}`;
const GOOD_CODE = '123456';

// ── The stand-in ─────────────────────────────────────────────────────────────
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const user = (email) => ({ id: '00000000-0000-4000-8000-0000000000aa', aud: 'authenticated', role: 'authenticated', email, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() });
const session = (email) => {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return {
    access_token: `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: user(email).id, email, role: 'authenticated', aud: 'authenticated', exp })}.sig`,
    token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'refresh', user: user(email),
  };
};

export const calls = [];
const stub = createServer(async (req, res) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors).end(); return; }
  let raw = '';
  for await (const chunk of req) raw += chunk;
  const body = raw ? JSON.parse(raw) : {};
  const url = new URL(req.url, MOLE);
  calls.push({ path: url.pathname, body });
  const json = (status, data) => res.writeHead(status, { ...cors, 'Content-Type': 'application/json' }).end(JSON.stringify(data));

  if (url.pathname === '/auth/v1/otp') return json(200, {});
  if (url.pathname === '/auth/v1/verify') {
    return body.token === GOOD_CODE
      ? json(200, session(body.email))
      : json(403, { code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid' });
  }
  if (url.pathname === '/auth/v1/user') return json(200, user('new@example.com'));
  if (url.pathname.startsWith('/rest/v1/rpc/api_v1_')) return json(200, []);
  if (url.pathname === '/auth/v1/logout') return json(204, {});
  json(404, { msg: `the stand-in has no ${url.pathname}` });
});
await new Promise(r => stub.listen(MOLE_PORT, r));

// ── The live build ───────────────────────────────────────────────────────────
execFileSync('npx', ['vite', 'build', '--outDir', 'dist-live', '--emptyOutDir'], {
  stdio: 'ignore',
  env: {
    ...process.env,
    VITE_SAMPLE_DATA: 'false',
    VITE_MOLE_SUPABASE_URL: MOLE,
    VITE_MOLE_SUPABASE_ANON_KEY: 'anon-key-for-tests',
    VITE_ANALYTICS_API_URL: `${MOLE}/functions/v1/api`,
  },
});

const BASE = await start({ dist: 'dist-live', port: 4198 });
console.log('\nLive sign-in, against a stand-in for Mole V3');

await journey('a new person signs in with a code from their email', async page => {
  await page.goto(BASE);
  await expectText(page, 'Sign in with your Mole account');
  await expectText(page, 'New to Mole?');
  await axe(page, 'the sign-in page');

  await page.getByLabel('Email').fill('new@example.com');
  await page.getByRole('button', { name: 'Email me a code' }).click();
  await expectText(page, 'Check your email');
  const otp = calls.find(c => c.path === '/auth/v1/otp');
  if (otp?.body.email !== 'new@example.com' || otp.body.create_user !== true) {
    throw new Error(`the code request was ${JSON.stringify(otp?.body)}; it should name the email and make the account if new`);
  }
  if (!(await page.getByRole('button', { name: /Send a new code \(\d+s\)/ }).isDisabled())) {
    throw new Error('a new code can be asked for straight away');
  }
  await axe(page, 'the code step');

  await page.getByLabel('Code').fill('12 34');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expectText(page, 'The code is the 6 digits in the email.');

  await page.getByLabel('Code').fill('000000');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expectText(page, 'That code isn’t right, or it has expired.');

  await page.getByLabel('Code').fill(GOOD_CODE);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expectText(page, 'No events yet');
  const verify = calls.filter(c => c.path === '/auth/v1/verify').at(-1);
  if (verify?.body.type !== 'email' || verify.body.email !== 'new@example.com') {
    throw new Error(`the code was checked as ${JSON.stringify(verify?.body)}`);
  }
}, undefined, [/status of 403/]); // the wrong code, refused on purpose

await journey('someone with a password can still use it, and can go back to a code', async page => {
  await page.goto(BASE);
  await page.getByRole('button', { name: 'Use my password instead' }).click();
  await page.getByLabel('Password').waitFor();
  await axe(page, 'sign-in with a password');
  await page.getByRole('button', { name: 'Email me a code instead' }).click();
  await page.getByRole('button', { name: 'Email me a code' }).waitFor();
  if (await page.getByLabel('Password').count()) throw new Error('the password field stayed');
});

await journey('a typo in the email can be fixed without starting over', async page => {
  await page.goto(BASE);
  await page.getByLabel('Email').fill('typo@exmaple.com');
  await page.getByRole('button', { name: 'Email me a code' }).click();
  await expectText(page, 'typo@exmaple.com');
  await page.getByRole('button', { name: 'Use a different email' }).click();
  const kept = await page.getByLabel('Email').inputValue();
  if (kept !== 'typo@exmaple.com') throw new Error(`the email field was "${kept}", not what they typed`);
});

stub.close();
await finish();
