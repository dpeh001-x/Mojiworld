// Mojiworld FEEDBACK PORTAL - email to the studio (v0.30.1851, per user: "sends in an email to admin@moji-studios.com").
// Pure functions + three transports, no Cloudflare globals at load (tests run it in plain Node). First one configured wins: Resend, then Google SMTP, then the Apps Script webhook, then the send_email binding.
//   0. Google SMTP (SMTP_PASS secret = an app password for the mailbox; feedback_smtp.js): signs in to smtp.gmail.com as SMTP_USER (default admin@moji-studios.com) and mails the report to the
//      same mailbox. No third-party service and no DNS change - the right route when the domain mail is already Google Workspace (as moji-studios.com is).
//   1. Resend (https://resend.com) when the RESEND_API_KEY secret is set - a plain HTTPS call, works to any address once the sending domain is verified there.
//   2. Cloudflare Email Routing's send_email binding (FEEDBACK_MAIL in wrangler.toml) - no key, but the destination must be a verified Email Routing address.
// A report is stored BEFORE it is mailed; a mail failure never loses it (the record keeps {mail:{ok:false,error}} and the dashboard has "Email again").
import { smtpSend, SMTP_HOST_DEFAULT, SMTP_PORT_DEFAULT } from './feedback_smtp.js';
export const MAIL_TO_DEFAULT = 'admin@moji-studios.com', MAIL_FROM_DEFAULT = 'feedback@moji-studios.com';
const CTRL = /[\u0000-\u001f\u007f]/g;
const oneLine = (v, n) => String(v == null ? '' : v).replace(CTRL, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const okAddr = (a) => /^[^\s<>@,;"']+@[^\s<>@,;"']+\.[^\s<>@,;"']{2,}$/.test(String(a || ''));
const utf8 = (s) => new TextEncoder().encode(s);
function b64(bytes) { let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(bin); }
const wrap76 = (s) => s.replace(/(.{76})/g, '$1\r\n');
// RFC 2047 encoded words (<= 75 chars each), split on code point boundaries: a subject with an emoji or an accent survives every mail client
export function encodeHeader(v) {
  const s = oneLine(v, 300); if (/^[\x20-\x7e]*$/.test(s)) return s;
  const words = []; let cur = '', curB = 0;
  for (const ch of s) { const n = utf8(ch).length; if (curB + n > 42) { words.push(cur); cur = ''; curB = 0; } cur += ch; curB += n; }
  if (cur) words.push(cur);
  return words.map((w) => '=?UTF-8?B?' + b64(utf8(w)) + '?=').join('\r\n ');
}
export function mailSubject(rec) {
  const d = rec.diag || {}, tag = ({ bug: 'bug', feedback: 'feedback', idea: 'idea', praise: 'praise' })[rec.type] || 'report';
  return '[Mojiworld ' + tag + '] ' + [rec.ver, d.map].filter(Boolean).join(' · ') + ' — ' + oneLine(rec.msg, 70);
}
export function mailText(rec, hasShot) {
  const d = rec.diag || {}, L = [];
  L.push('Type:      ' + rec.type, 'Report id: ' + rec.id, 'Received:  ' + new Date(rec.t).toISOString(), 'Version:   ' + (rec.ver || '?'));
  if (rec.contact) L.push('Contact:   ' + rec.contact + '   (reply to this email to answer, if it is an address)');
  L.push('', 'MESSAGE', '-------', rec.msg, '');
  const keys = Object.keys(d).filter((k) => k !== 'errors' && k !== 'ver');
  if (keys.length || (d.errors && d.errors.length)) {
    L.push('GAME INFO', '---------');
    for (const k of keys) L.push(k.padEnd(10) + ' ' + (Array.isArray(d[k]) ? d[k].join(', ') : String(d[k])));
    if (d.errors && d.errors.length) { L.push('', 'RECENT SCRIPT ERRORS'); for (const e of d.errors) L.push('  - ' + e); }
    L.push('');
  }
  L.push(hasShot ? 'A screenshot of the game is attached.' : 'No screenshot attached.', '', 'Triage at /feedback-admin on the Mojiworld Worker (status: ' + rec.status + ').');
  return L.join('\r\n');
}
// the raw RFC 5322 message: text + (optionally) the screenshot as a JPEG attachment. Every header value is a single sanitised line (no header injection).
export function buildMime({ from, to, subject, text, shotDataUrl, replyTo, id, now }) {
  const bnd = '=_mojifb_' + String(id).replace(/[^0-9a-z]/gi, '').slice(-16) + '_' + (now % 1e6), H = [];
  H.push('From: Mojiworld Feedback <' + from + '>', 'To: ' + to, 'Subject: ' + encodeHeader(subject), 'Date: ' + new Date(now).toUTCString(), 'Message-ID: <fb-' + String(id).replace(/[^0-9a-z-]/gi, '') + '@moji-studios.com>', 'MIME-Version: 1.0', 'X-Mojiworld-Report: ' + String(id).replace(/[^0-9a-z-]/gi, ''));
  if (okAddr(replyTo)) H.push('Reply-To: ' + replyTo);
  const shot = shotDataUrl && /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(shotDataUrl);
  const textPart = 'Content-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n' + wrap76(b64(utf8(text)));
  if (!shot) return H.join('\r\n') + '\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n' + wrap76(b64(utf8(text))) + '\r\n';
  H.push('Content-Type: multipart/mixed; boundary="' + bnd + '"');
  return H.join('\r\n') + '\r\n\r\n--' + bnd + '\r\n' + textPart + '\r\n--' + bnd + '\r\nContent-Type: image/jpeg; name="report-' + String(id).slice(-6) + '.jpg"\r\nContent-Disposition: attachment; filename="report-' + String(id).slice(-6) + '.jpg"\r\nContent-Transfer-Encoding: base64\r\n\r\n' + wrap76(shot[1]) + '\r\n--' + bnd + '--\r\n';
}
// -> { ok, via, error? }. deps: { fetchFn, EmailMessage, now } for tests. Never throws.
export async function sendReportMail(rec, shot, env, deps) {
  deps = deps || {}; env = env || {};
  const to = okAddr(env.FEEDBACK_EMAIL_TO) ? env.FEEDBACK_EMAIL_TO : MAIL_TO_DEFAULT, from = okAddr(env.FEEDBACK_EMAIL_FROM) ? env.FEEDBACK_EMAIL_FROM : MAIL_FROM_DEFAULT;
  const subject = mailSubject(rec), text = mailText(rec, !!shot), now = (deps.now || Date.now)();
  try {
    if (env.RESEND_API_KEY) {
      const att = shot && /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(shot);
      const body = { from: 'Mojiworld Feedback <' + from + '>', to: [to], subject: oneLine(subject, 200), text, ...(okAddr(rec.contact) ? { reply_to: rec.contact } : {}), ...(att ? { attachments: [{ filename: 'report-' + String(rec.id).slice(-6) + '.jpg', content: att[1] }] } : {}) };
      const f = deps.fetchFn || fetch;
      const r = await f('https://api.resend.com/emails', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + env.RESEND_API_KEY, 'idempotency-key': 'mojifb-' + rec.id }, body: JSON.stringify(body), signal: AbortSignal.timeout ? AbortSignal.timeout(9000) : undefined });
      if (r.ok) return { ok: true, via: 'resend', to };
      let why = ''; try { why = oneLine((await r.text()), 160); } catch (_) {}
      return { ok: false, via: 'resend', error: 'Resend ' + r.status + (why ? ': ' + why : '') };
    }
    if (env.SMTP_PASS) {   // Google SMTP: From must be the mailbox we sign in to, so SMTP_USER is also the sender
      const user = okAddr(env.SMTP_USER) ? env.SMTP_USER : to;
      const raw = buildMime({ from: user, to, subject, text, shotDataUrl: shot, replyTo: rec.contact, id: rec.id, now });
      await smtpSend({ host: env.SMTP_HOST || SMTP_HOST_DEFAULT, port: SMTP_PORT_DEFAULT, user, pass: env.SMTP_PASS, from: user, to, raw, connect: deps.connect, timeoutMs: deps.smtpTimeoutMs });
      return { ok: true, via: 'smtp', to };
    }
    if (env.MAIL_WEBHOOK_URL) {   // Google Apps Script web app that mails as the mailbox owner (no app password, no 2-Step Verification, no DNS): see docs/guides/FEEDBACK_PORTAL.md
      if (!/^https:[/][/](script[.]google[.]com|script[.]googleusercontent[.]com)[/]/.test(env.MAIL_WEBHOOK_URL)) return { ok: false, via: 'webhook', error: 'MAIL_WEBHOOK_URL must be the https://script.google.com/macros/s/.../exec address of the deployed script.' };
      const f = deps.fetchFn || fetch;
      const r = await f(env.MAIL_WEBHOOK_URL, { method: 'POST', redirect: 'follow', headers: { 'content-type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ key: env.MAIL_WEBHOOK_KEY || '', to, subject: oneLine(subject, 200), body: text, replyTo: okAddr(rec.contact) ? rec.contact : '', id: rec.id, shot: shot && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(shot) ? shot.slice(shot.indexOf(',') + 1) : '' }), signal: AbortSignal.timeout ? AbortSignal.timeout(15000) : undefined });
      let j = null, raw = ''; try { raw = await r.text(); j = JSON.parse(raw); } catch (_) {}
      if (r.ok && j && j.ok) return { ok: true, via: 'webhook', to };
      return { ok: false, via: 'webhook', error: j && j.error ? 'The mail script said: ' + oneLine(j.error, 140) : 'The mail script did not accept the request (' + r.status + ') - is it deployed as a web app that runs as you, with access "Anyone"? ' + oneLine(raw, 80) };
    }
    if (env.FEEDBACK_MAIL && typeof env.FEEDBACK_MAIL.send === 'function') {
      const EM = deps.EmailMessage || (await import('cloudflare:email')).EmailMessage;
      const raw = buildMime({ from, to, subject, text, shotDataUrl: shot, replyTo: rec.contact, id: rec.id, now });
      await env.FEEDBACK_MAIL.send(new EM(from, to, raw));
      return { ok: true, via: 'cloudflare', to };
    }
    return { ok: false, via: 'none', error: 'No email transport is configured (set MAIL_WEBHOOK_URL - the Google Apps Script mailer -, or SMTP_PASS - a Google app password -, or RESEND_API_KEY, or enable the FEEDBACK_MAIL send_email binding).' };
  } catch (e) { const pw = String(env.SMTP_PASS || ''); let msg = oneLine((e && e.message) || e, 200); if (pw) msg = msg.split(pw).join('***'); return { ok: false, via: env.RESEND_API_KEY ? 'resend' : pw ? 'smtp' : env.MAIL_WEBHOOK_URL ? 'webhook' : 'cloudflare', error: msg }; }
}
