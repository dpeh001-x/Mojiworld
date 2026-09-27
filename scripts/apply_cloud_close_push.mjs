// Cloud close push: the progress made just before closing the tab reaches the account cloud (v0.30.1222 cloud-close-push).
// ============================================================================
// Bug: the account-cloud push on pagehide is a fetch with keepalive:true, and browsers refuse a keepalive body over 64 KB
// (Chrome: "TypeError: Failed to fetch", nothing sent). A late-game save is ~87 KB, so that last push never left. Worse, it
// had already restarted the 15 s push throttle, so the save flushed on the tab's hide right after was throttled too: the
// progress of up to the last 15 s before closing reached the cloud only next session (never, if the next session was on
// another device).
// Fix (client first; works against the live relay as it is):
//   - the moment the page is hidden (visibilitychange -> hidden: a tab or app switch, and a close) the save goes by an
//     ORDINARY fetch, past the 15 s throttle, when the cloud does not have it yet; the page is usually still alive then.
//     "Has it" = the last push was this save (its stamp, signature and clocks aside) and it landed or is still on its way.
//   - pagehide: a keepalive push only for a body that fits (<= 60 KB); a bigger one goes gzipped (CompressionStream, which
//     finishes inside the pagehide task) - but only to a relay that said it takes gzip ("gz":1 on its /api/save answers;
//     the relay half, scripts/apply_cloud_close_push_relay.mjs, adds that and needs a wrangler deploy). Otherwise the
//     pagehide push is skipped: the hide push carried the save. A keepalive push replaces a same-save ordinary push still
//     on its way (the close would cut that one); a save that landed is never pushed again, and after a close push the
//     unload's own hide does not push a second time.
//   - every push notes what it sent and whether it landed (a slow push is never cut short by the next one). The 15 s
//     throttle counts from the hide / close pushes too. Never throws.
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('function _lxCloudClosePush(')) { console.log('already applied'); process.exit(0); }
if (!s.includes('function _lxCloudSaveBody(')) { console.error('ABORT cloud-paint-cap is not on this build'); process.exit(1); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };
// the cloud-paint-cap lines carry their shipped version (v0.30.1185); match any version so a retag cannot strand this script
const onceRe = (re, b, what) => { const m = s.match(new RegExp(re.source, 'g')) || []; if (m.length !== 1) die(what + ' matched ' + m.length); s = s.replace(re, (x) => b + x); };

// 1) the helpers, ahead of _lxCloudPost (inserted before its comment)
onceRe(/\/\/ v0\.30\.(?:x|\d+) cloud-paint-cap - the one account-cloud POST of a save as stored/, J(
  '// v0.30.1222 cloud-close-push - the push when the tab goes away. Browsers refuse a keepalive body over 64 KB, and the',
  '// pagehide push was keepalive: a late-game save (~87 KB) never left, and it had restarted the 15 s throttle, so the',
  '// hide flush\'s push was skipped too. Now the hide pushes by an ordinary fetch (the page is usually still alive), and',
  '// pagehide sends keepalive only what fits - the save as is, or gzipped for a relay that said it takes gzip ("gz":1).',
  'const _LX_KEEPALIVE_MAX = 60 * 1024;   // v0.30.1222 cloud-close-push - under the 64 KB keepalive limit, with a margin',
  'let _lxCloudLast = null;     // v0.30.1222 cloud-close-push - the last push: { raw, ok (landed), done (settled), ka (keepalive), ac }',
  'let _lxCloudGz = false;      // v0.30.1222 cloud-close-push - the relay takes a gzipped save (its /api/save answered "gz":1)',
  'let _lxCloudClosing = false; // v0.30.1222 cloud-close-push - between a pagehide and the next pageshow',
  '// v0.30.1222 cloud-close-push - a save as stored, minus what changes by itself (stamp, signature, clocks): two flushes of the',
  '// same progress compare equal',
  'function _lxCloudKey(raw) {',
  "  if (typeof raw !== 'string') return '';",
  "  return raw.replace(/^\\{\"v\":([^,]*),\"t\":\\d+,/, '{\"v\":$1,').replace(/,\"sig\":\"[^\"]*\"\\}$/, '}')",
  "    .replace(/\"(_playMs|_timeHW|bankLastTick|bankAccrueMs)\":-?[\\d.]+(?:e[-+]?\\d+)?/g, '\"$1\":0');",
  '}',
  'function _lxCloudHas(raw) {   // v0.30.1222 cloud-close-push - the last push was this save: { ok, done, ka } of it, else null',
  '  const l = _lxCloudLast;',
  '  return (l && (l.raw === raw || _lxCloudKey(l.raw) === _lxCloudKey(raw))) ? l : null;',
  '}',
  '// v0.30.1222 cloud-close-push - note a push as it starts. An ordinary one can be cancelled - only by a close push of the',
  '// same save replacing it (a slow push is never cut short by the next regular one: that could starve a slow link)',
  'function _lxCloudTrack(raw, abortable) {',
  "  const rec = { raw, ok: false, done: false, ka: !abortable, ac: (abortable && typeof AbortController === 'function') ? new AbortController() : null };",
  '  _lxCloudLast = rec;',
  '  return rec;',
  '}',
  'function _lxCloudLanded(rec, r) {   // v0.30.1222 cloud-close-push - a 2xx: mark it, and learn whether the relay takes gzip',
  '  if (!r || !r.ok) return false;',
  '  rec.ok = true;',
  '  try { r.json().then((j) => { if (j && j.gz === 1) _lxCloudGz = true; }).catch(() => {}); } catch (e) {}',
  '  return true;',
  '}',
  '// v0.30.1222 cloud-close-push - gzip a string. The stream is fed by hand (not a Blob), so where CompressionStream transforms',
  '// synchronously (Chrome) this resolves inside the current task: it can run from pagehide.',
  'function _lxGzip(str) {',
  '  const src = new TextEncoder().encode(str);',
  "  const rd = new ReadableStream({ start(c) { c.enqueue(src); c.close(); } }).pipeThrough(new CompressionStream('gzip')).getReader();",
  '  const parts = []; let n = 0;',
  '  const pump = () => rd.read().then(({ value, done }) => {',
  '    if (!done) { parts.push(value); n += value.byteLength; return pump(); }',
  '    const out = new Uint8Array(n); let o = 0;',
  '    for (const p of parts) { out.set(p, o); o += p.byteLength; }',
  '    return out;',
  '  });',
  '  return pump();',
  '}',
  'function _lxCloudSess() {   // v0.30.1222 cloud-close-push - the signed-in cloud session, or null',
  "  const sess = (typeof LXAuth !== 'undefined') ? LXAuth.session() : null;",
  "  return (sess && sess.kind === 'cloud' && sess.token) ? sess : null;",
  '}',
  '// v0.30.1222 cloud-close-push - the page was hidden: push the save now, past the throttle, unless the cloud has it (landed or',
  '// on its way), or the close push just went (the unload\'s own hide comes after pagehide in Chrome)',
  'function _lxCloudHidePush() {',
  '  try {',
  '    const sess = _lxCloudSess(); if (!sess) return;',
  '    const raw = localStorage.getItem(SAVE_KEY); if (!raw) return;',
  '    const l = _lxCloudLast;',
  '    if (_lxCloudClosing && l && l.ka && (l.ok || !l.done)) return;',
  '    const h = _lxCloudHas(raw);',
  '    if (h && (h.ok || !h.done)) return;',
  '    _lxCloudPushAt = Date.now();   // the 15 s throttle counts from this push',
  '    _lxCloudPost(sess.token, raw, false);',
  '  } catch (e) {}',
  '}',
  '// v0.30.1222 cloud-close-push - pagehide: a keepalive push of what fits - the body as is (<= 60 KB), or gzipped for a relay',
  '// that takes it. Else skipped: the hide push carried the save (an older relay is never sent gzip). A save that landed, or',
  '// is already going by keepalive, is not pushed again.',
  'function _lxCloudClosePush() {',
  '  try {',
  '    _lxCloudClosing = true;',
  '    const sess = _lxCloudSess(); if (!sess) return;',
  '    const raw = localStorage.getItem(SAVE_KEY); if (!raw) return;',
  '    const h = _lxCloudHas(raw);',
  '    if (h && (h.ok || (h.ka && !h.done))) return;',
  '    const body = _lxCloudSaveBody(raw);',
  '    const send = (b, gz) => {',
  '      if (h && !h.done && h.ac) { try { h.ac.abort(); } catch (e) {} }   // this save\'s ordinary push still on its way:',
  '      const rec = _lxCloudTrack(raw, false);                                // the close would cut it - this one replaces it',
  '      _lxCloudPushAt = Date.now();',
  "      const hd = { 'content-type': 'application/json', authorization: 'Bearer ' + sess.token };",
  "      if (gz) hd['content-encoding'] = 'gzip';",
  "      fetch(_LX_API_BASE + '/api/save', { method: 'POST', keepalive: true, headers: hd, body: b })",
  '        .then((r) => { _lxCloudLanded(rec, r); }, () => {}).then(() => { rec.done = true; });',
  '    };',
  "    const len = (typeof body !== 'string') ? Infinity : (body.length > _LX_KEEPALIVE_MAX ? body.length : new TextEncoder().encode(body).length);",
  '    if (len <= _LX_KEEPALIVE_MAX) { send(body, false); return; }',
  "    if (!_lxCloudGz || typeof CompressionStream !== 'function') return;   // an older relay: skipped, the hide push has it",
  '    _lxGzip(body).then((b) => { if (b && b.byteLength <= _LX_KEEPALIVE_MAX) send(b, true); }).catch(() => {});',
  '  } catch (e) {}',
  '}',
  ''), 'the cloud push helpers');

// 2) _lxCloudPost notes what it sends and can be cancelled by a newer push
once(J(
  'function _lxCloudPost(token, raw, force) {',
  "  const post = (b) => fetch(_LX_API_BASE + '/api/save', {",
  "    method: 'POST', keepalive: !!force,"), J(
  'function _lxCloudPost(token, raw, force) {',
  '  const rec = _lxCloudTrack(raw, !force);   // v0.30.1222 cloud-close-push - what went, and whether it landed',
  "  const post = (b) => fetch(_LX_API_BASE + '/api/save', {",
  "    method: 'POST', keepalive: !!force, signal: rec.ac ? rec.ac.signal : undefined,   // v0.30.1222 cloud-close-push - a close push may replace it"),
  "_lxCloudPost's fetch");
once(J(
  '  post(body).then((r) => {',
  '    if (!r || r.status !== 413) return;',
  '    const bare = _lxCloudSaveBody(raw, true);',
  '    if (bare !== body) return post(bare);',
  '  }).catch(() => {});'), J(
  '  post(body).then((r) => {',
  '    if (_lxCloudLanded(rec, r)) return;   // v0.30.1222 cloud-close-push - landed (and the relay may have said it takes gzip)',
  '    if (!r || r.status !== 413) return;',
  '    const bare = _lxCloudSaveBody(raw, true);',
  '    if (bare !== body) return post(bare).then((r2) => { _lxCloudLanded(rec, r2); });',
  '  }).catch(() => {}).then(() => { rec.done = true; });   // v0.30.1222 cloud-close-push - settled, landed or not'),
  "_lxCloudPost's answer");

// 3) the sign-in pull learns it too
once('    if (!j || !j.ok) return;             // unauthorized / server error -> keep local', J(
  '    if (!j || !j.ok) return;             // unauthorized / server error -> keep local',
  '    if (j.gz === 1) _lxCloudGz = true;   // v0.30.1222 cloud-close-push - this relay takes a gzipped save'),
  "_lxCloudSyncOnLogin's pull");

// 4) the listeners: hide -> ordinary push; pagehide -> the keepalive push that fits (was: always keepalive, any size)
once("try { window.addEventListener('pagehide', () => { try { const raw = localStorage.getItem(SAVE_KEY); if (raw) _lxCloudPushSave(raw, true); } catch (e) {} }); } catch (e) {}", J(
  '// v0.30.1222 cloud-close-push - on window, registered after the hide flush above it (so the save is fresh when this runs)',
  "try { window.addEventListener('visibilitychange', () => { if (document.hidden) _lxCloudHidePush(); }); } catch (e) {}",
  "try { window.addEventListener('pagehide', () => { _lxCloudClosePush(); }); } catch (e) {}   // v0.30.1222 cloud-close-push",
  "try { window.addEventListener('pageshow', () => { _lxCloudClosing = false; }); } catch (e) {}   // v0.30.1222 cloud-close-push - back from the bfcache"),
  'the pagehide push');

const grew = s.length - n0;
if (grew < 5000 || grew > 9500) die('size moved ' + grew);
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 5000000) die('tmp small');
{
  let done = false, lastErr = null;
  for (let a = 1; a <= 8 && !done; a++) {
    try { renameSync(F + '.tmp', F); done = true; }
    catch (e) { lastErr = e; if (e.code !== 'EPERM' && e.code !== 'EBUSY') throw e; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500 * a); }
  }
  if (!done) die('rename kept failing: ' + lastErr.code);
}
console.log('applied: cloud-close-push (+' + grew + ' chars)');
