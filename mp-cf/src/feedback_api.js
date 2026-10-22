// Mojiworld FEEDBACK PORTAL - HTTP routes (v0.30.1851), served by the 'feedback' Durable Object instance (see index.js).
//   POST /api/feedback                public   a player's report {type,msg,contact?,diag?,shot?,cid?,hp?}  -> {ok,id,mail} | 429 {retryAfter} (ONE report per connection per hour)
//   POST /api/feedback/resend         admin    {id}   email a stored report again (after a failed send)
//   GET  /api/feedback/list           admin    ?status=&type=&q=&limit=&before=&format=csv                 -> {ok,items,counts,next} | text/csv
//   GET  /api/feedback/shot?id=       admin    the screenshot as image/jpeg
//   POST /api/feedback/update         admin    {id,status?,note?}
//   POST /api/feedback/delete         admin    {id}
// Every accepted report is also EMAILED to admin@moji-studios.com (feedback_mail.js: Resend, or the FEEDBACK_MAIL send_email binding); the report is stored first, so a mail
// failure loses nothing. Admin = the request carries the FEEDBACK_ADMIN_KEY secret as "Authorization: Bearer <key>". With no secret set the admin routes answer 503
// (closed, not open). Setup: `npx wrangler secret put FEEDBACK_ADMIN_KEY`; optional `FEEDBACK_WEBHOOK` posts each new report to Discord/Slack.
import { FB_TYPES, FB_STATUS, FB_CAP, FB_GAP_MS, sanitizeReport, storeReport, KEY, webhookText, ipHash, limitLeft, setLimit } from './feedback.js';
import { sendReportMail } from './feedback_mail.js';

const json = (obj, status, cors) => new Response(JSON.stringify(obj), { status: status || 200, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...(cors || {}) } });
async function sha(s) { return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(s)))); }
async function adminOk(request, env) {   // compare digests, not strings: no early exit on the first wrong character
  const key = env && env.FEEDBACK_ADMIN_KEY; if (!key || String(key).length < 8) return 503;
  const m = /^Bearer\s+(.+)$/i.exec(request.headers.get('authorization') || ''); if (!m) return 401;
  const a = await sha(m[1]), b = await sha(key); let d = 0; for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0 ? 200 : 401;
}
const csvCell = (v) => { let s = String(v == null ? '' : v).replace(/\r?\n/g, ' ⏎ '); if (/^[=+\-@\t]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };   // a spreadsheet must not run a report as a formula
export function toCsv(items) {
  const cols = ['id', 'time', 'type', 'status', 'ver', 'map', 'level', 'cls', 'job', 'platform', 'contact', 'message', 'note', 'errors'];
  const rows = [cols.join(',')];
  for (const r of items) { const d = r.diag || {};
    rows.push([r.id, new Date(r.t).toISOString(), r.type, r.status, r.ver, d.map, d.level, d.cls, d.job, d.platform, r.contact, r.msg, r.note, (d.errors || []).join(' | ')].map(csvCell).join(',')); }
  return rows.join('\r\n') + '\r\n';
}

export async function feedbackApi(request, ctx) {
  const { storage, env, throttle, cors } = ctx; const now = (ctx.now || Date.now)();
  const url = new URL(request.url), path = url.pathname.replace(/\/+$/, ''), J = (o, s) => json(o, s, cors);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  try {
    if (path === '/api/feedback' && request.method === 'POST') {
      if (!(await throttle(request, 'fb', 30, 10 * 60 * 1000))) return J({ ok: false, error: 'Too many requests from this connection - please try again in a few minutes.' }, 429);   // a coarse flood guard that counts everything; the real limit is the hourly one below
      const text = await request.text(); if (text.length > FB_CAP.shot + 20000) return J({ ok: false, error: 'Report too large.' }, 413);
      let body; try { body = JSON.parse(text); } catch (_) { return J({ ok: false, error: 'bad request' }, 400); }
      const s = sanitizeReport(body);
      if (s.spam) return J({ ok: true, id: 'ok' });   // a bot gets the same answer a person would, and nothing is stored or mailed
      if (s.error) return J({ ok: false, error: s.error }, 400);   // a refused report costs the player nothing
      const gap = Math.max(60 * 1000, Math.min(24 * 3600 * 1000, Number(env && env.FEEDBACK_GAP_MS) || FB_GAP_MS)), ipH = await ipHash(request.headers.get('cf-connecting-ip') || 'unknown');
      if (s.rec.cid) { const old = await storage.get('fbc:' + s.rec.cid); const r0 = old && await storage.get(KEY(old)); if (r0) return J({ ok: true, id: r0.id, dup: true, mail: r0.mail && r0.mail.ok }); }   // a retry of a report already stored: answered, never limited, never mailed twice
      const left = await limitLeft(storage, ipH, now, gap);
      if (left > 0) return J({ ok: false, error: 'Thanks - we already have a report from you in the last hour. You can send another in ' + Math.ceil(left / 60) + ' min.', retryAfter: left }, 429);
      const r = await storeReport(storage, s.rec, s.shot, request.headers.get('cf-connecting-ip'), now);
      await setLimit(storage, ipH, now, gap);
      const mailer = ctx.mail || sendReportMail;
      const m = await mailer(r.rec, s.shot, env, { fetchFn: ctx.fetchFn, now: () => now });
      r.rec.mail = { ok: !!m.ok, via: m.via, at: now, ...(m.ok ? {} : { error: String(m.error || 'failed').slice(0, 200) }) };
      try { await storage.put(KEY(r.rec.id), r.rec); } catch (_) {}
      if (env && env.FEEDBACK_WEBHOOK && /^https:[/][/]/.test(env.FEEDBACK_WEBHOOK)) {
        try { const f = ctx.fetchFn || fetch; await f(env.FEEDBACK_WEBHOOK, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content: webhookText(r.rec), text: webhookText(r.rec), allowed_mentions: { parse: [] } }), signal: AbortSignal.timeout ? AbortSignal.timeout(3000) : undefined }); } catch (_) {}
      }
      return J({ ok: true, id: r.rec.id, mail: r.rec.mail.ok });
    }
    // everything below is admin
    if (!(await throttle(request, 'fbadm', 60, 10 * 60 * 1000))) return J({ ok: false, error: 'slow down' }, 429);
    const auth = await adminOk(request, env);
    if (auth === 503) return J({ ok: false, error: 'The feedback admin key is not configured on this server.' }, 503);
    if (auth !== 200) return J({ ok: false, error: 'unauthorized' }, 401);
    if (path === '/api/feedback/list' && request.method === 'GET') {
      const all = await storage.list({ prefix: 'fb:', reverse: true, limit: FB_CAP.keep + 100 });
      const items = [...all.values()], counts = { total: items.length, byStatus: {}, byType: {} };
      for (const r of items) { counts.byStatus[r.status] = (counts.byStatus[r.status] || 0) + 1; counts.byType[r.type] = (counts.byType[r.type] || 0) + 1; }
      const q = (url.searchParams.get('q') || '').toLowerCase(), st = url.searchParams.get('status'), ty = url.searchParams.get('type'), before = url.searchParams.get('before');
      let out = items.filter((r) => (!st || r.status === st) && (!ty || r.type === ty) && (!before || r.id < before) && (!q || (r.msg + ' ' + r.contact + ' ' + r.ver + ' ' + (r.diag && r.diag.map || '') + ' ' + r.note).toLowerCase().includes(q)));
      if (url.searchParams.get('format') === 'csv') return new Response(toCsv(out), { status: 200, headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="mojiworld-feedback.csv"', ...cors } });
      const lim = Math.max(1, Math.min(500, parseInt(url.searchParams.get('limit'), 10) || 200)); const next = out.length > lim ? out[lim - 1].id : null; out = out.slice(0, lim);
      return J({ ok: true, items: out, counts, next });
    }
    if (path === '/api/feedback/shot' && request.method === 'GET') {
      const id = String(url.searchParams.get('id') || '').replace(/[^0-9a-f-]/g, ''), d = id && await storage.get('fbs:' + id);
      if (!d) return J({ ok: false, error: 'no screenshot' }, 404);
      const bin = Uint8Array.from(atob(d.slice(d.indexOf(',') + 1)), (c) => c.charCodeAt(0));
      return new Response(bin, { status: 200, headers: { 'content-type': 'image/jpeg', 'cache-control': 'private, max-age=3600', ...cors } });
    }
    if ((path === '/api/feedback/update' || path === '/api/feedback/delete') && request.method === 'POST') {
      let b; try { b = await request.json(); } catch (_) { return J({ ok: false, error: 'bad request' }, 400); }
      const id = String((b && b.id) || '').replace(/[^0-9a-f-]/g, ''), rec = id && await storage.get(KEY(id));
      if (!rec) return J({ ok: false, error: 'not found' }, 404);
      if (path.endsWith('/delete')) { await storage.delete(KEY(id)); await storage.delete('fbs:' + id); if (rec.cid) await storage.delete('fbc:' + rec.cid); return J({ ok: true }); }
      if (b.status != null) { if (!FB_STATUS.includes(b.status)) return J({ ok: false, error: 'bad status' }, 400); rec.status = b.status; }
      if (b.note != null) rec.note = String(b.note).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, FB_CAP.note);
      await storage.put(KEY(id), rec); return J({ ok: true, item: rec });
    }
    if (path === '/api/feedback/resend' && request.method === 'POST') {
      let b; try { b = await request.json(); } catch (_) { return J({ ok: false, error: 'bad request' }, 400); }
      const id = String((b && b.id) || '').replace(/[^0-9a-f-]/g, ''), rec = id && await storage.get(KEY(id)); if (!rec) return J({ ok: false, error: 'not found' }, 404);
      const m = await (ctx.mail || sendReportMail)(rec, rec.hasShot ? await storage.get('fbs:' + id) : '', env, { fetchFn: ctx.fetchFn, now: () => now });
      rec.mail = { ok: !!m.ok, via: m.via, at: now, ...(m.ok ? {} : { error: String(m.error || 'failed').slice(0, 200) }) }; await storage.put(KEY(id), rec);
      return J({ ok: !!m.ok, item: rec, error: m.ok ? undefined : rec.mail.error });
    }
    return J({ ok: false, error: 'not found' }, 404);
  } catch (_) { return J({ ok: false, error: 'server error' }, 500); }
}
export { FB_TYPES };
