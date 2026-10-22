// Mojiworld FEEDBACK PORTAL - a small SMTP client for the Worker (v0.30.1857, per user: email the reports through Google with an app password).
// admin@moji-studios.com is a Google Workspace mailbox, so the reports are mailed by signing in to smtp.gmail.com as that mailbox (an "app password", kept as the SMTP_PASS secret)
// over implicit TLS on port 465 (cloudflare:sockets), and sending to the same mailbox. No third-party service, no DNS change.
// The socket comes in as `connect` so plain Node can test the whole dialogue against a fake server. The password exists only inside the AUTH line: it is never logged,
// never put in an error message, and never stored.
const enc = new TextEncoder(), dec = new TextDecoder();
export const SMTP_HOST_DEFAULT = 'smtp.gmail.com', SMTP_PORT_DEFAULT = 465;
const b64 = (s) => { const bytes = enc.encode(s); let bin = ''; for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]); return btoa(bin); };
// SMTP "dot stuffing": a line that starts with "." gets one more, so the lone "." that ends DATA cannot be forged by the message
export const dotStuff = (s) => s.replace(/(^|\r\n)\./g, '$1..');
const NUL = String.fromCharCode(0);
const okAddr = (a) => /^[^\s<>@,;"'\u0000-\u001f]+@[^\s<>@,;"'\u0000-\u001f]+\.[^\s<>@,;"'\u0000-\u001f]{2,}$/.test(String(a || ''));
function lineReader(readable) {
  const rd = readable.getReader(); let buf = '';
  // one reply, which may span several lines ("250-..." continues, "250 ..." ends it)
  async function reply() {
    const lines = [];
    for (;;) {
      let i; while ((i = buf.indexOf('\r\n')) < 0) { const r = await rd.read(); if (r.done) throw new Error('the mail server closed the connection'); buf += dec.decode(r.value, { stream: true }); }
      const line = buf.slice(0, i); buf = buf.slice(i + 2); lines.push(line);
      if (/^\d{3}( |$)/.test(line)) return { code: +line.slice(0, 3), text: lines.join(' | ').slice(0, 200) };
    }
  }
  return { reply, cancel: () => { try { Promise.resolve(rd.cancel()).catch(() => {}); } catch (_) {} } };   // cancelling a stream that has already errored rejects: swallow it
}
// -> resolves when the message is accepted; throws an Error with a plain reason otherwise. `connect(opts, sockOpts)` is cloudflare:sockets' connect.
export async function smtpSend({ host, port, user, pass, from, to, raw, connect, timeoutMs }) {
  if (!okAddr(user) || !okAddr(from) || !okAddr(to)) throw new Error('bad mail address');
  if (!pass || /[\r\n]/.test(pass)) throw new Error('no SMTP password is set');
  const conn = connect || (await import('cloudflare:sockets')).connect;
  const sock = conn({ hostname: host || SMTP_HOST_DEFAULT, port: port || SMTP_PORT_DEFAULT }, { secureTransport: 'on', allowHalfOpen: false });
  const w = sock.writable.getWriter(), r = lineReader(sock.readable);
  const send = (s) => w.write(enc.encode(s + '\r\n'));
  const expect = async (okCodes, what) => {
    const x = await r.reply();
    if (!okCodes.includes(x.code)) {
      const why = x.code === 535 || x.code === 534 || x.code === 530 ? 'Google refused the sign-in (' + x.code + '): the app password is wrong, revoked, or app passwords are switched off for this account'
        : x.code === 550 || x.code === 553 || x.code === 554 ? 'the mail server refused the message (' + x.code + ')'
        : 'unexpected reply to ' + what + ' (' + x.code + ')';
      throw new Error(why + ' - ' + x.text.replace(/\s+/g, ' ').slice(0, 120));
    }
    return x;
  };
  let timer; const guard = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('the mail server did not answer in time')), timeoutMs || 12000); });
  const dialogue = (async () => {
    await expect([220], 'the greeting');
    await send('EHLO moji-studios.com'); await expect([250], 'EHLO');
    await send('AUTH PLAIN ' + b64(NUL + user + NUL + pass)); await expect([235], 'sign-in');
    await send('MAIL FROM:<' + from + '>'); await expect([250], 'MAIL FROM');
    await send('RCPT TO:<' + to + '>'); await expect([250, 251], 'RCPT TO');
    await send('DATA'); await expect([354], 'DATA');
    await w.write(enc.encode(dotStuff(raw).replace(/(\r\n)?$/, '\r\n') + '.\r\n')); await expect([250], 'the message');
    try { await send('QUIT'); } catch (_) {}
  })();
  try { await Promise.race([dialogue, guard]); }
  finally { clearTimeout(timer); try { r.cancel(); } catch (_) {} try { w.releaseLock(); } catch (_) {} try { Promise.resolve(sock.close()).catch(() => {}); } catch (_) {} dialogue.catch(() => {}); guard.catch(() => {}); }
}
