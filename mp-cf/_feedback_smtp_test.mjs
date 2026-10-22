// FEEDBACK PORTAL - the Google SMTP transport (mp-cf/src/feedback_smtp.js) against a fake mail server.   node mp-cf/_feedback_smtp_test.mjs
// The real SMTP code talks to a local server through a Node socket adapter standing in for cloudflare:sockets, so the whole dialogue (greeting, EHLO, AUTH PLAIN, MAIL, RCPT, DATA, QUIT),
// the failures (wrong app password, refused recipient, silence, a dropped connection) and the secret handling are checked without a Google account.
import net from 'node:net';
import { smtpSend, dotStuff } from './src/feedback_smtp.js';
import { sendReportMail, buildMime, mailSubject, mailText } from './src/feedback_mail.js';
import { feedbackApi } from './src/feedback_api.js';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) pass++; else fail++; console.log((c ? '  PASS ' : '  FAIL ') + m + (x !== undefined && !c ? '  [' + JSON.stringify(x).slice(0, 240) + ']' : '')); };
const USER = 'admin@moji-studios.com', PASSWORD = 'abcd efgh ijkl mnop', jpeg = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/yQALCAABAAEBAREA/8wABgAQEAX/2gAIAQEAAD8A0s8g/9k=';
// ---- the fake server: modes 'ok' | 'badpass' | 'norcpt' | 'silent' | 'drop'; `seen` collects what a real server would
function fake(mode) {
  const seen = { cmds: [], auth: null, mailFrom: null, rcpt: [], data: null, connections: 0 };
  const srv = net.createServer((s) => {
    seen.connections++; let buf = '', inData = false, data = ''; s.on('error', () => {});   // a client that closes right after QUIT resets the socket
    const w = (t) => s.write(t + '\r\n');
    if (mode === 'silent') return;   // accepts the connection and never says a word
    w('220 smtp.gmail.com ESMTP fake');
    s.on('data', (d) => {
      buf += d.toString('utf8');
      for (;;) {
        if (inData) { const e = buf.indexOf('\r\n.\r\n'); if (e < 0) { if (buf.startsWith('.\r\n')) { /* empty body */ } else return; }
          const body = e < 0 ? '' : buf.slice(0, e); buf = buf.slice(e < 0 ? 3 : e + 5); inData = false; seen.data = body.replace(/(^|\r\n)\.\./g, '$1.'); w('250 2.0.0 OK queued'); continue; }
        const i = buf.indexOf('\r\n'); if (i < 0) return; const line = buf.slice(0, i); buf = buf.slice(i + 2); seen.cmds.push(line.startsWith('AUTH') ? 'AUTH PLAIN <redacted>' : line);
        if (/^EHLO/i.test(line)) { s.write('250-smtp.gmail.com at your service\r\n250-SIZE 35882577\r\n250-AUTH LOGIN PLAIN\r\n250 8BITMIME\r\n'); }
        else if (/^AUTH PLAIN /i.test(line)) { const dec = Buffer.from(line.slice(11), 'base64').toString('utf8').split(String.fromCharCode(0)); seen.auth = { user: dec[1], pass: dec[2] };
          if (mode === 'badpass' || dec[2] !== PASSWORD) w('535-5.7.8 Username and Password not accepted. For more information, go to\r\n535 5.7.8 https://support.google.com/mail/?p=BadCredentials'); else w('235 2.7.0 Accepted'); }
        else if (/^MAIL FROM:/i.test(line)) { seen.mailFrom = line.slice(10); w('250 2.1.0 OK'); }
        else if (/^RCPT TO:/i.test(line)) { if (mode === 'norcpt') w('550 5.1.1 The email account that you tried to reach does not exist'); else { seen.rcpt.push(line.slice(8)); w('250 2.1.5 OK'); } }
        else if (/^DATA/i.test(line)) { w('354 Go ahead'); inData = true; if (mode === 'drop') { s.destroy(); return; } }
        else if (/^QUIT/i.test(line)) { w('221 2.0.0 closing connection'); s.end(); return; }
        else w('502 5.5.1 unrecognized command');
      }
    });
  }).listen(0);
  return { port: srv.address().port, seen, close: () => srv.close() };
}
const nodeConnect = (port) => () => {   // the cloudflare:sockets connect() shape, over a plain socket to the fake
  const s = net.connect(port, '127.0.0.1');
  const readable = new ReadableStream({ start(c) { s.on('data', (d) => c.enqueue(new Uint8Array(d))); s.on('end', () => { try { c.close(); } catch (_) {} }); s.on('error', (e) => { try { c.error(e); } catch (_) {} }); }, cancel() { s.destroy(); } });
  const writable = new WritableStream({ write(ch) { return new Promise((res, rej) => s.write(ch, (e) => (e ? rej(e) : res()))); }, close() { s.end(); } });
  return { readable, writable, close() { s.destroy(); } };
};
const rec = (o) => ({ id: '1800000000000-abc123', t: 1_800_000_000_000, type: 'bug', status: 'new', ver: 'v0.30.1857', msg: 'The portal on the cliff sends me back to town.\n.this line starts with a dot\nIt happens every time.', contact: 'player@example.com', diag: { map: 'cliff', level: 12, cls: 'mage', platform: 'steam', errors: ['TypeError: x is undefined'] }, ...o });
const mimeOf = (r, shot) => buildMime({ from: USER, to: USER, subject: mailSubject(r), text: mailText(r, !!shot), shotDataUrl: shot, replyTo: r.contact, id: r.id, now: r.t });

console.log('dot stuffing');
ok(dotStuff('a\r\n.b\r\n..c\r\nd') === 'a\r\n..b\r\n...c\r\nd' && dotStuff('.x') === '..x', 'a line starting with a dot gets one more (so the lone dot that ends DATA cannot be forged)');
ok(dotStuff('no dots here\r\nat all') === 'no dots here\r\nat all', 'text without leading dots is untouched');

console.log('the dialogue');
let f = fake('ok'); let raw = mimeOf(rec(), jpeg);
await smtpSend({ host: 'x', port: 465, user: USER, pass: PASSWORD, from: USER, to: USER, raw, connect: nodeConnect(f.port) }); await new Promise((r) => setTimeout(r, 150));   // the client closes right after QUIT; let the server read it
ok(f.seen.cmds.join(' > ') === 'EHLO moji-studios.com > AUTH PLAIN <redacted> > MAIL FROM:<admin@moji-studios.com> > RCPT TO:<admin@moji-studios.com> > DATA > QUIT', 'the commands go in the right order: EHLO, AUTH PLAIN, MAIL FROM, RCPT TO, DATA, QUIT', f.seen.cmds);
ok(f.seen.auth && f.seen.auth.user === USER && f.seen.auth.pass === PASSWORD, 'it signs in as admin@moji-studios.com with the app password (AUTH PLAIN, NUL-separated, base64)');
ok(f.seen.data === raw.replace(/\r\n$/, ''), 'the message arrives byte for byte, including the line that starts with a dot', f.seen.data && f.seen.data.length);
ok(/^From: Mojiworld Feedback <admin@moji-studios\.com>/m.test(f.seen.data) && /^To: admin@moji-studios\.com/m.test(f.seen.data) && /^Reply-To: player@example\.com/m.test(f.seen.data) && /image\/jpeg/.test(f.seen.data), 'the mail is From the mailbox, To the mailbox, Reply-To the player, with the screenshot attached');
f.close();
f = fake('ok'); raw = 'Subject: edge\r\n\r\nline one\r\n.\r\nline after a lone dot\r\n';
await smtpSend({ host: 'x', user: USER, pass: PASSWORD, from: USER, to: USER, raw, connect: nodeConnect(f.port) });
ok(f.seen.data === 'Subject: edge\r\n\r\nline one\r\n.\r\nline after a lone dot', 'a message containing a lone "." line is not cut short (nothing after it is lost, and it cannot end DATA early)', f.seen.data); f.close();

console.log('failures');
f = fake('badpass'); let err = ''; try { await smtpSend({ host: 'x', user: USER, pass: PASSWORD, from: USER, to: USER, raw: 'x', connect: nodeConnect(f.port) }); } catch (e) { err = String(e.message); }
ok(/Google refused the sign-in \(535\)/.test(err) && /app password/.test(err) && !err.includes(PASSWORD) && !err.includes('efgh'), 'a wrong app password gives a plain reason (535 - the app password is wrong or revoked) and the password is nowhere in it', err); ok(f.seen.mailFrom === null, 'and it stops before MAIL FROM (nothing was sent)'); f.close();
f = fake('norcpt'); err = ''; try { await smtpSend({ host: 'x', user: USER, pass: PASSWORD, from: USER, to: USER, raw: 'x', connect: nodeConnect(f.port) }); } catch (e) { err = String(e.message); }
ok(/refused the message \(550\)/.test(err) && f.seen.data === null, 'a refused recipient (550) is reported and no message body is sent', err); f.close();
f = fake('silent'); const t0 = Date.now(); err = ''; try { await smtpSend({ host: 'x', user: USER, pass: PASSWORD, from: USER, to: USER, raw: 'x', connect: nodeConnect(f.port), timeoutMs: 500 }); } catch (e) { err = String(e.message); }
ok(/did not answer in time/.test(err) && Date.now() - t0 < 2500, 'a server that says nothing is given up on after the timeout, not waited for forever', [err, Date.now() - t0]); f.close();
f = fake('drop'); err = ''; try { await smtpSend({ host: 'x', user: USER, pass: PASSWORD, from: USER, to: USER, raw: 'x', connect: nodeConnect(f.port) }); } catch (e) { err = String(e.message); }
ok(/closed the connection|ECONNRESET|reset/i.test(err), 'a connection dropped mid-message is reported', err); f.close();
for (const [name, args] of [['a CR/LF in the user (command injection)', { user: USER + '\r\nRCPT TO:<x@y.zz>' }], ['a bad recipient', { to: 'not-an-address' }], ['a password with a newline', { pass: 'abc\r\nQUIT' }], ['no password', { pass: '' }]]) {
  f = fake('ok'); err = ''; try { await smtpSend({ host: 'x', user: USER, pass: PASSWORD, from: USER, to: USER, raw: 'x', connect: nodeConnect(f.port), ...args }); } catch (e) { err = String(e.message); }
  ok(err.length > 0 && f.seen.connections === 0, name + ' is refused before any connection is made', [err, f.seen.connections]); f.close(); }

console.log('through the mail module');
f = fake('ok'); let r = await sendReportMail(rec(), jpeg, { SMTP_PASS: PASSWORD }, { connect: nodeConnect(f.port), now: () => rec().t });
ok(r.ok && r.via === 'smtp' && r.to === 'admin@moji-studios.com' && f.seen.auth.user === 'admin@moji-studios.com', 'with only SMTP_PASS set it mails admin@moji-studios.com as admin@moji-studios.com (the defaults)', r); f.close();
f = fake('ok'); r = await sendReportMail(rec(), '', { SMTP_PASS: PASSWORD, SMTP_USER: 'admin@moji-studios.com', FEEDBACK_EMAIL_TO: 'owner@moji-studios.com' }, { connect: nodeConnect(f.port) });
ok(r.ok && f.seen.rcpt[0] === '<owner@moji-studios.com>' && f.seen.mailFrom === '<admin@moji-studios.com>', 'SMTP_USER and FEEDBACK_EMAIL_TO can be overridden', f.seen); f.close();
f = fake('ok'); r = await sendReportMail(rec(), '', { SMTP_PASS: PASSWORD, SMTP_USER: 'bad\r\nRCPT TO:<x@y.zz>' }, { connect: nodeConnect(f.port) });
ok(r.ok && f.seen.auth.user === 'admin@moji-studios.com' && f.seen.rcpt.length === 1, 'a SMTP_USER that is not a clean address falls back to the default mailbox, never into a command', f.seen); f.close();
f = fake('badpass'); r = await sendReportMail(rec(), '', { SMTP_PASS: PASSWORD }, { connect: nodeConnect(f.port) });
ok(!r.ok && r.via === 'smtp' && /535/.test(r.error) && !JSON.stringify(r).includes(PASSWORD), 'a sign-in refusal comes back as { ok: false, via: smtp } with the reason and without the password', r); f.close();
r = await sendReportMail(rec(), '', { SMTP_PASS: PASSWORD }, { connect: () => { throw new Error('connect failed using ' + PASSWORD); } });
ok(!r.ok && !r.error.includes(PASSWORD) && /\*\*\*/.test(r.error), 'even if some error message contained the password it is blanked out before it is stored or shown', r.error);
let resendCalls = 0; f = fake('ok'); r = await sendReportMail(rec(), '', { SMTP_PASS: PASSWORD, RESEND_API_KEY: 'k' }, { connect: nodeConnect(f.port), fetchFn: async () => { resendCalls++; return new Response('{}', { status: 200 }); } });
ok(r.via === 'resend' && resendCalls === 1 && f.seen.connections === 0, 'when Resend is also configured it wins, and SMTP is not also used (no double mail)'); f.close();
f = fake('ok'); let bound = 0; r = await sendReportMail(rec(), '', { SMTP_PASS: PASSWORD, FEEDBACK_MAIL: { send: async () => { bound++; } } }, { connect: nodeConnect(f.port) });
ok(r.via === 'smtp' && bound === 0 && f.seen.connections === 1, 'SMTP wins over the Cloudflare binding'); f.close();
r = await sendReportMail(rec(), '', {}, {}); ok(!r.ok && /SMTP_PASS/.test(r.error), 'with nothing configured the message now names SMTP_PASS first');

console.log('whole path: a player POST -> one email through Google');
class Store { constructor() { this.m = new Map(); } async get(k) { return this.m.get(k); } async put(k, v) { this.m.set(k, JSON.parse(JSON.stringify(v))); } async delete(k) { return this.m.delete(k); }
  async list(o = {}) { let ks = [...this.m.keys()].filter((k) => !o.prefix || k.startsWith(o.prefix)).sort(); if (o.reverse) ks.reverse(); if (o.limit) ks = ks.slice(0, o.limit); return new Map(ks.map((k) => [k, this.m.get(k)])); } }
const st = new Store(); f = fake('ok'); let clock = 1_800_000_000_000;
const call = (path, body, ip, key) => feedbackApi(new Request('https://w.test' + path, { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip, ...(key ? { authorization: 'Bearer ' + key } : {}) }, body: JSON.stringify(body) }), { storage: st, env: { SMTP_PASS: PASSWORD, FEEDBACK_ADMIN_KEY: 'integration-admin-key' }, throttle: async () => true, cors: {}, now: () => (clock += 1000), connect: nodeConnect(f.port) });
let x = await call('/api/feedback', { type: 'idea', msg: 'Please add a dance emote for Guguma', contact: 'fan@example.com', ver: 'v0.30.1857', diag: { map: 'forest' }, shot: jpeg, cid: 'smtp-1' }, '203.0.113.5'); let j = await x.json();
ok(x.status === 200 && j.ok && j.mail === true && f.seen.connections === 1, 'POST /api/feedback stores the report and sends exactly one email through Google', [x.status, j, f.seen.connections]);
const subjHdr = (/^Subject: ([\s\S]*?)\r\n(?=[A-Za-z-]+: )/m.exec(f.seen.data) || [0, ''])[1].replace(/\r\n /g, ''), subj = subjHdr.replace(/=\?UTF-8\?B\?([^?]+)\?=/g, (m, b) => Buffer.from(b, 'base64').toString('utf8'));   // the subject has a middle dot and a dash, so it travels as a MIME encoded word; decode it as a mail client would
ok(/^\[Mojiworld idea\]/.test(subj) && /^Reply-To: fan@example\.com/m.test(f.seen.data) && f.seen.rcpt[0] === '<admin@moji-studios.com>', 'to admin@moji-studios.com, subject tagged [Mojiworld idea], the fan as Reply-To');
const stored = [...(await st.list({ prefix: 'fb:' })).values()][0]; ok(stored.mail.ok === true && stored.mail.via === 'smtp' && !JSON.stringify(stored).includes(PASSWORD), 'the stored report records it was mailed via smtp, and holds no password');
x = await call('/api/feedback', { type: 'bug', msg: 'A second one inside the hour should be refused', ver: 'v0.30.1857' }, '203.0.113.5'); ok(x.status === 429 && f.seen.connections === 1, 'a second report from the same connection inside the hour: 429 and no second email');
x = await call('/api/feedback/resend', { id: stored.id }, '198.51.100.1', 'integration-admin-key'); j = await x.json(); ok(x.status === 200 && j.ok && f.seen.connections === 2, 'admin Email again sends it through Google once more', [x.status, j && j.error]);
const before = (await st.list({ prefix: 'fb:' })).size;
x = await call('/api/feedback/testmail', {}, '198.51.100.2', 'integration-admin-key'); j = await x.json();
ok(x.status === 200 && j.ok && j.via === 'smtp' && j.to === 'admin@moji-studios.com' && f.seen.connections === 3 && /TEST email/.test(Buffer.from((/base64\r\n\r\n([\s\S]*?)(\r\n--|$)/.exec(f.seen.data) || [0, ''])[1].replace(/\s+/g, ''), 'base64').toString('utf8')), 'admin Send test email mails one labelled TEST message through Google', [x.status, j]);
ok((await st.list({ prefix: 'fb:' })).size === before, 'and the test email stores no report');
x = await call('/api/feedback', { type: 'bug', msg: 'a real report after the test email, same connection as the admin', ver: 'v0.30.1857' }, '198.51.100.2'); ok(x.status === 200, 'and it does not use up the hourly slot of the connection it came from');
x = await call('/api/feedback/testmail', {}, '198.51.100.3'); ok(x.status === 401, 'Send test email needs the admin key');
f.close(); f = fake('badpass'); x = await call('/api/feedback/testmail', {}, '198.51.100.4', 'integration-admin-key'); j = await x.json(); ok(x.status === 200 && j.ok === false && /535/.test(j.error) && !JSON.stringify(j).includes(PASSWORD), 'when Google refuses, the test email says so plainly (and never shows the password) - the quickest way to find a wrong app password', j); f.close();
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
