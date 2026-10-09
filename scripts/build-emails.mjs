// scripts/build-emails.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Mole's sign-in emails, as HTML, from one layout.
// ─────────────────────────────────────────────────────────────────────────────
// Supabase sends six emails for Mole V3's accounts, and they are the first
// thing a new person sees of Mole. These are the six, in Mole's colours and
// voice, with Sunny.
//
//   node scripts/build-emails.mjs            write docs/paste/emails/*.html
//   node scripts/build-emails.mjs --check    fail if they are out of date
//
// Email isn't a web page: no stylesheet, no script, no SVG (Gmail drops them),
// so it is tables with inline styles, PNG pictures served from
// https://sense.mole.is/email/, and colours that are sunny-kit's tokens and
// nothing else (tests/unit/emails.test.ts holds them to that, and measures
// every text pair). The {{ … }} words are Supabase's own: it fills them in.
//
// The wording is Mole's: sentence case, British spelling, no emoji, and a
// little fun, because a sign-in email is a small moment worth a smile.
// ─────────────────────────────────────────────────────────────────────────────

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const OUT = join(root, 'docs', 'paste', 'emails');
export const ASSET_BASE = process.env.EMAIL_ASSET_BASE ?? 'https://sense.mole.is/email';

// ── Colours: the kit's tokens, by name ───────────────────────────────────────
const css = readFileSync(join(root, 'brand', 'colours', 'tokens.css'), 'utf8');
const tok = Object.fromEntries([...css.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6});/g)].map(m => [m[1], m[2]]));
const LOOP = tok['loop'];
const SUNNY = tok['brand-yellow'];
const C = {
  page: tok['brand-base'], card: tok['neutral-surface'], line: tok['neutral-border'],
  ink: tok['brand-ink'], muted: tok['neutral-fg-muted'],
  purple: tok['brand-purple'], purpleTint: tok['brand-purple-tint'], purpleText: tok['brand-purple-text'], purpleBorder: tok['brand-purple-border'],
  sunnyTint: tok['brand-yellow-tint'], onFill: tok['neutral-on-fill'],
};

const FONT = "'Poppins','Segoe UI','Helvetica Neue',Helvetica,Arial,sans-serif";

// ── The six ──────────────────────────────────────────────────────────────────
// Supabase's names: Confirm signup, Invite user, Magic link or OTP, Change
// email address, Reset password, Reauthentication.
export const EMAILS = [
  {
    file: 'confirm-signup',
    supabase: 'Confirm signup',
    subject: 'Welcome to Mole: confirm your email',
    preheader: 'One tap and you are in. Your code is inside too.',
    sunny: ['sunny', 'Sunny, the Mole mascot, smiling'],
    title: 'Welcome to Mole',
    body: 'You are one tap from being in. Confirm your email and Sunny will take it from there.',
    button: ['Confirm my email', '{{ .ConfirmationURL }}'],
    code: 'Or type this code where you signed up',
    note: 'If you didn’t sign up, ignore this email. Nothing happens until you confirm.',
  },
  {
    file: 'magic-link-or-otp',
    supabase: 'Magic link or OTP',
    subject: 'Your Mole sign-in code',
    preheader: 'Type this code to sign in. It runs out soon.',
    sunny: ['sunny', 'Sunny, the Mole mascot, smiling'],
    title: 'Here is your sign-in code',
    body: 'Type it where you asked to sign in. Sunny is holding the door.',
    code: 'Your code',
    note: 'It works once and runs out soon. If you didn’t ask for it, ignore this email; your account is fine.',
  },
  {
    file: 'invite-user',
    supabase: 'Invite user',
    subject: 'You are invited to Mole',
    preheader: 'Someone has saved you a seat.',
    sunny: ['sunny-delighted', 'Sunny, the Mole mascot, delighted'],
    title: 'You are invited to Mole',
    body: 'Someone has saved you a seat. Accept the invite and set up your account in a minute.',
    button: ['Accept the invite', '{{ .ConfirmationURL }}'],
    note: 'Weren’t expecting this? You can ignore it, and nothing will change.',
  },
  {
    file: 'reset-password',
    supabase: 'Reset password',
    subject: 'Reset your Mole password',
    preheader: 'It happens to everyone. Choose a new one.',
    sunny: ['sunny-thinking', 'Sunny, the Mole mascot, thinking it over'],
    title: 'Forgotten your password? It happens',
    body: 'Choose a new one and you are straight back in.',
    button: ['Choose a new password', '{{ .ConfirmationURL }}'],
    note: 'If you didn’t ask for this, ignore this email. Your password hasn’t changed.',
  },
  {
    file: 'change-email-address',
    supabase: 'Change email address',
    subject: 'Confirm your new Mole email address',
    preheader: 'Confirm the change and your new address is live.',
    sunny: ['sunny-thinking', 'Sunny, the Mole mascot, thinking it over'],
    title: 'Confirm your new email',
    body: 'You asked to change the email on your Mole account from <strong style="color:INK">{{ .Email }}</strong> to <strong style="color:INK">{{ .NewEmail }}</strong>.',
    button: ['Confirm the change', '{{ .ConfirmationURL }}'],
    note: 'If this wasn’t you, ignore this email and your address stays as it is. It’s worth changing your password too.',
  },
  {
    file: 'reauthentication',
    supabase: 'Reauthentication',
    subject: 'Your Mole confirmation code',
    preheader: 'A quick check that it is you.',
    sunny: ['sunny-thinking', 'Sunny, the Mole mascot, thinking it over'],
    title: 'A quick check that it is you',
    body: 'You are about to do something that needs a fresh confirmation. Type this code to carry on.',
    code: 'Your code',
    note: 'If you didn’t ask for this, ignore this email, and think about changing your password.',
  },
];

// ── The layout ───────────────────────────────────────────────────────────────
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

export function render(e) {
  const [sunnyFile, sunnyAlt] = e.sunny;
  const body = e.body.replaceAll('INK', C.ink);
  const button = e.button && `
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:28px auto 0;">
                <tr><td align="center" bgcolor="${C.purple}" style="border-radius:14px;">
                  <a href="${e.button[1]}" style="display:inline-block;padding:14px 32px;font-family:${FONT};font-size:16px;line-height:20px;font-weight:700;color:${C.onFill};text-decoration:none;border-radius:14px;">${esc(e.button[0])}</a>
                </td></tr>
              </table>`;
  const code = e.code && `
              <p style="margin:${e.button ? 28 : 24}px 0 8px;font-family:${FONT};font-size:13px;line-height:20px;font-weight:600;color:${C.muted};">${esc(e.code)}</p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
                <tr><td align="center" bgcolor="${C.purpleTint}" style="border:2px dashed ${C.purpleBorder};border-radius:18px;padding:16px 28px;font-family:${FONT};font-size:36px;line-height:44px;font-weight:700;letter-spacing:8px;color:${C.ink};">{{ .Token }}</td></tr>
              </table>`;
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>${esc(e.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${C.page};">
<!-- Generated by scripts/build-emails.mjs. Supabase template: ${e.supabase}. Subject: ${e.subject} -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:${C.page};">${esc(e.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.page}" style="background:${C.page};">
  <tr><td align="center" style="padding:32px 16px 40px;">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;">
      <tr><td align="center" style="padding:0 0 20px;">
        <img src="${ASSET_BASE}/logo.png" width="120" height="44" alt="Mole" style="display:block;border:0;width:120px;height:44px;">
      </td></tr>
      <tr><td bgcolor="${C.card}" style="background:${C.card};border:1px solid ${C.line};border-radius:28px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td height="12" bgcolor="${C.purple}" style="height:12px;font-size:0;line-height:0;background:${C.purple};border-radius:27px 27px 0 0;">&nbsp;</td></tr>
          <tr><td align="center" style="padding:36px 32px 40px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 24px;">
              <tr><td align="center" valign="middle" width="148" height="148" bgcolor="${C.sunnyTint}" style="width:148px;height:148px;background:${C.sunnyTint};border-radius:74px;">
                <img src="${ASSET_BASE}/${sunnyFile}.png" width="96" alt="${sunnyAlt}" style="display:block;margin:0 auto;border:0;width:96px;height:auto;">
              </td></tr>
            </table>
            <h1 style="margin:0;font-family:${FONT};font-size:28px;line-height:34px;font-weight:800;letter-spacing:-0.5px;color:${C.ink};">${esc(e.title)}</h1>
            <p style="margin:12px auto 0;max-width:420px;font-family:${FONT};font-size:16px;line-height:25px;color:${C.muted};">${body}</p>${button ?? ''}${code ?? ''}
            <p style="margin:32px auto 0;max-width:420px;font-family:${FONT};font-size:13px;line-height:20px;color:${C.muted};">${esc(e.note)}</p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:28px auto 0;">
              <tr>
                <td width="28" height="8" bgcolor="${C.purple}" style="width:28px;height:8px;font-size:0;line-height:0;border-radius:4px;">&nbsp;</td><td width="6" style="width:6px;font-size:0;line-height:0;">&nbsp;</td>
                <td width="28" height="8" bgcolor="${LOOP}" style="width:28px;height:8px;font-size:0;line-height:0;border-radius:4px;">&nbsp;</td><td width="6" style="width:6px;font-size:0;line-height:0;">&nbsp;</td>
                <td width="28" height="8" bgcolor="${SUNNY}" style="width:28px;height:8px;font-size:0;line-height:0;border-radius:4px;">&nbsp;</td>
              </tr>
            </table>
          </td></tr>
        </table>
      </td></tr>
      <tr><td align="center" style="padding:24px 16px 0;font-family:${FONT};font-size:12px;line-height:18px;color:${C.muted};">
        Sent by Mole. You are getting this because someone used this email address on Mole.<br>
        <a href="https://mole.is" style="color:${C.purpleText};font-weight:600;text-decoration:underline;">mole.is</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>
`;
}

/** What goes in the Supabase screen besides the body: the subject line, by template. */
export function manifest() {
  return EMAILS.map(({ file, supabase, subject }) => ({ file: `${file}.html`, supabase, subject }));
}

export function build() {
  return [
    ...EMAILS.map(e => ({ file: join(OUT, `${e.file}.html`), content: render(e) })),
    { file: join(OUT, 'subjects.json'), content: JSON.stringify(manifest(), null, 2) + '\n' },
  ];
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const check = process.argv.includes('--check');
  mkdirSync(OUT, { recursive: true });
  let stale = 0;
  for (const { file, content } of build()) {
    let current = '';
    try { current = readFileSync(file, 'utf8'); } catch { /* missing */ }
    if (current === content) continue;
    if (check) { stale++; console.error(`✗ ${file} is out of date: run node scripts/build-emails.mjs`); }
    else { writeFileSync(file, content); console.log(`wrote ${file}`); }
  }
  process.exit(stale ? 1 : 0);
}
