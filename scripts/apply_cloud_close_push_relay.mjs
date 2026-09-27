// Cloud close push, relay half (2026-09-27) - mp-cf/, the Cloudflare Worker + Durable Object that is the game's account /
// cloud-save API. Run as LX_APPLY2 next to scripts/apply_cloud_close_push.mjs (the game half).
// ============================================================================
// Bug: the game's last cloud push when a tab closes (pagehide) is a keepalive fetch, and browsers refuse a keepalive body
// over 64 KB. A late-game save is ~90 KB, so that push never left: progress from just before closing only reached the
// cloud next session.
// Fix, relay side: POST /api/save also takes the save gzipped (Content-Encoding: gzip; ~90 KB of save JSON is ~20 KB
// gzipped), and says so: its /api/save answers carry "gz":1. The game only ever gzips toward a relay that said "gz":1,
// so the live relay (which does not say it) is never sent a gzipped body. Details:
//   - CORS allows the content-encoding request header (the preflight refused it, so a gzipped POST never got through).
//   - the body is read at most 3 x CSAVE_CAP bytes (more UTF-8 bytes than that is more than CSAVE_CAP characters: the same
//     413 as before, only without buffering it all); a body that starts with the gzip magic bytes is gunzipped under the
//     same bound (a gzip bomb stops there: 413); a broken gzip is a 400 like broken JSON. Then the CSAVE_CAP check and
//     JSON.parse exactly as before - a plain body behaves exactly as it did.
// NEEDS A DEPLOY: the live relay changes only when the owner runs `cd mp-cf && npx wrangler deploy` (the deploy workflow
// skips without the CLOUDFLARE_API_TOKEN secret). Until then the game's tab-close push of a big save is skipped, and the
// push the game now makes the moment the tab is hidden carries that save instead.
// Also a README bullet. Only touches files under ${ROOT}/mp-cf - never mojiworld_game.html. Guarded + atomic + idempotent.
// EOL-aware. Markers are version-free: "cloud-close-push (2026-09-27)".
import { readFileSync, writeFileSync, renameSync, statSync, existsSync } from 'node:fs';
const ROOT = (process.env.LX_MP_ROOT || 'C:/Users/dpeh0/Mojiworld').replace(/[\\/]+$/, '');
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const files = [];   // { path, rel, before, after, grew }
function edit(rel, marker, lo, hi, fn) {
  const path = ROOT + '/mp-cf/' + rel;
  if (/mojiworld_game\.html$/i.test(path)) die('refusing to touch the game file');
  if (!existsSync(path)) die(rel + ' missing under ' + ROOT);
  const before = readFileSync(path, 'utf8');
  if (before.includes(marker)) { console.log('  ' + rel + ': already applied'); return; }
  const crlf = (before.match(/\r\n/g) || []).length, lf = (before.match(/\n/g) || []).length;
  const EOL = crlf > lf / 2 ? '\r\n' : '\n';
  let s = before;
  const J = (...L) => L.join(EOL);
  const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(rel + ': ' + what + ' matched ' + n); s = s.replace(a, () => b); };
  fn({ J, once });
  const grew = s.length - before.length;
  if (grew < lo || grew > hi) die(rel + ': size moved ' + grew);
  if (!s.includes(marker)) die(rel + ': marker missing after edit');
  files.push({ path, rel, before, after: s, grew });
}

// ---------------------------------------------------------------- mp-cf/src/index.js
edit('src/index.js', 'async function readSaveBody(', 1800, 4200, ({ J, once }) => {
  once("  'access-control-allow-headers': 'content-type, authorization',", J(
    "  // cloud-close-push (2026-09-27) - content-encoding: the game's tab-close push may send the save gzipped (see readSaveBody)",
    "  'access-control-allow-headers': 'content-type, authorization, content-encoding',"), 'the CORS allowed headers');
  once('const jsonResp = (obj, status) => new Response(JSON.stringify(obj), {', J(
    '// cloud-close-push (2026-09-27) - a save POST may come gzipped: the game\'s last push when a tab closes is a keepalive',
    '// request, and browsers refuse a keepalive body over 64 KB (a late-game save is ~90 KB; ~20 KB gzipped). The game gzips',
    '// only toward a relay whose /api/save answers carry "gz":1, so an older relay is never sent one.',
    '// readCapped: the bytes of a stream, or null once past max (then the rest is not read)',
    'async function readCapped(stream, max) {',
    '  const rd = stream.getReader(), parts = [];',
    '  let n = 0;',
    '  for (;;) {',
    '    const { value, done } = await rd.read();',
    '    if (done) break;',
    '    n += value.byteLength;',
    '    if (n > max) { try { await rd.cancel(); } catch (_) {} return null; }',
    '    parts.push(value);',
    '  }',
    '  const out = new Uint8Array(n);',
    '  let o = 0;',
    '  for (const p of parts) { out.set(p, o); o += p.byteLength; }',
    '  return out;',
    '}',
    '// cloud-close-push (2026-09-27) - the text of a save POST: \'\' when empty, null when surely over CSAVE_CAP characters (more',
    '// than 3 UTF-8 bytes per character is impossible, so 3 x CSAVE_CAP bytes bounds it - plain or gunzipped: a gzip bomb',
    '// stops there), undefined for a broken gzip body. A body that starts with the gzip magic bytes is gunzipped whatever its',
    '// headers say (a JSON save starts with "{"), so one the edge already inflated still reads as plain.',
    'async function readSaveBody(request) {',
    "  if (!request.body) return '';",
    '  let bytes = await readCapped(request.body, CSAVE_CAP * 3);',
    '  if (bytes && bytes.length > 1 && bytes[0] === 0x1f && bytes[1] === 0x8b) {',
    "    try { bytes = await readCapped(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')), CSAVE_CAP * 3); }",
    '    catch (_) { return undefined; }',
    '  }',
    '  if (bytes === null) return null;',
    '  return new TextDecoder().decode(bytes);',
    '}',
    'const jsonResp = (obj, status) => new Response(JSON.stringify(obj), {'), 'the jsonResp helper');
  once('    return jsonResp({ ok: true, save });',
    '    return jsonResp({ ok: true, save, gz: 1 });   // cloud-close-push (2026-09-27) - gz: this relay takes a gzipped save POST',
    "apiGetSave's answer");
  once(J(
    '    const text = await request.text();',
    "    if (!text || text.length > CSAVE_CAP) return jsonResp({ ok: false, error: 'save missing or too large' }, 413);"), J(
    '    const text = await readSaveBody(request);   // cloud-close-push (2026-09-27) - plain or gzipped, read under the cap',
    "    if (text === undefined) return jsonResp({ ok: false, error: 'bad save json' }, 400);",
    "    if (!text || text.length > CSAVE_CAP) return jsonResp({ ok: false, error: 'save missing or too large' }, 413);"), "apiPutSave's body read");
  once(J(
    '    await this.storage.put(CSAVE_KEY(key), save);',
    '    return jsonResp({ ok: true });'), J(
    '    await this.storage.put(CSAVE_KEY(key), save);',
    '    return jsonResp({ ok: true, gz: 1 });   // cloud-close-push (2026-09-27) - gz: see apiGetSave'), "apiPutSave's answer");
});

// ---------------------------------------------------------------- mp-cf/README.md
edit('README.md', 'cloud-close-push, 2026-09-27', 300, 1200, ({ J, once }) => {
  once(J('', '## Files'), J(
    '',
    '## Gzipped save push (cloud-close-push, 2026-09-27)',
    '',
    '- `POST /api/save` also takes the save gzipped (`Content-Encoding: gzip`; CORS allows the header). The game\'s last',
    '  push when a tab closes is a keepalive request, and browsers refuse a keepalive body over 64 KB (a late-game save is',
    '  ~90 KB, ~20 KB gzipped). Bodies are read under a 3 x `CSAVE_CAP` byte bound, gunzipped under the same bound, then',
    '  checked against `CSAVE_CAP` as before. `/api/save` answers carry `"gz":1`; the game gzips only toward a relay that',
    '  said so, so an older deploy is never sent a gzipped body. **Needs a `wrangler deploy` to take effect.**',
    '',
    '## Files'), 'the Files heading');
});

// ---------------------------------------------------------------- write everything (all edits computed first)
if (!files.length) { console.log('already applied'); process.exit(0); }
for (const f of files) {
  writeFileSync(f.path + '.tmp', f.after, 'utf8');
  if (statSync(f.path + '.tmp').size < f.before.length) die(f.rel + ': tmp smaller than the original');
}
for (const f of files) {
  let done = false, lastErr = null;
  for (let a = 1; a <= 8 && !done; a++) {
    try { renameSync(f.path + '.tmp', f.path); done = true; }
    catch (e) { lastErr = e; if (e.code !== 'EPERM' && e.code !== 'EBUSY') throw e; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500 * a); }
  }
  if (!done) die(f.rel + ': rename kept failing: ' + lastErr.code);
  console.log('applied: cloud-close-push ' + f.rel + ' (+' + f.grew + ' chars)');
}
