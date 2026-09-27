// Cloud paint cap: a painted hero's progress reaches the account cloud again (follow-up to paint-save, 2026-09-27).
// ============================================================================
// Bug: the account cloud refuses a save over 512 KB (CSAVE_CAP in mp-cf/src/index.js answers 413 "save missing or too
// large"). Every account-cloud push is a whole save with the Wardrobe paint in it (up to 12 PNG layers, 1-3 MB), so a
// painted player's push was refused every time: their progress never reached the account cloud at all, silently.
// Fix (client only - the server is untouched):
//   - _LX_CLOUD_SAVE_CAP mirrors CSAVE_CAP. _lxCloudSaveBody builds the push body: the whole save when it fits, else the
//     save WITHOUT the paint (_lxSaveNoPaint: no paint fields, player._lxPaintLocalOnly = true), and then a one-per-session
//     toast: "Your wardrobe paint is too big for cloud sync - it stays on this device; progress still syncs."
//   - _lxCloudPost is the one POST for both pushes (the throttled flush / pagehide push and the first-login push); a 413
//     anyway (a server cap lower than the mirror) retries once without the paint.
//   - a pull of such a save keeps the paint this device already has: _lxSaveStoreRaw no longer drops the paint record for
//     it, and _lxPaintLoad uses the local record. A fresh device gets the progress with no paint.
//   - Steam Cloud is unchanged: no cap in the game, the wrapper (steam_integration.js writeFile) or Steam's 100 MB file
//     limit that a save comes near; only the per-user byte quota set in Steamworks applies.
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('function _lxCloudSaveBody(')) { console.log('already applied'); process.exit(0); }
if (!s.includes('function _lxSaveWithPaint(')) { console.error('ABORT paint-save is not on this build'); process.exit(1); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };
// the paint-save lines carry their shipped version (v0.30.1181); match any version so a retag cannot strand this script
const onceRe = (re, b, what) => { const m = s.match(new RegExp(re.source, 'g')) || []; if (m.length !== 1) die(what + ' matched ' + m.length); s = s.replace(re, () => b); };

// the helpers, ahead of the account-cloud push
once('let _lxCloudPushAt = 0;', J(
  '// v0.30.1185 cloud-paint-cap - the account cloud refuses a save over 512 KB (CSAVE_CAP in mp-cf/src/index.js answers 413; keep',
  '// this in step with it). A painted Wardrobe (1-3 MB of PNG layers) put a painted hero\'s whole save over it, so their progress',
  '// never reached the account cloud. A push that would not fit goes WITHOUT the paint, marked _lxPaintLocalOnly: the progress',
  '// syncs, the paint stays on this device, and a pull of it keeps the paint the receiving device already has (a fresh device',
  '// gets the progress unpainted). A 413 anyway (a lower cap on the server) retries once without the paint. Steam Cloud has no',
  '// such cap and still gets the whole save.',
  'const _LX_CLOUD_SAVE_CAP = 512 * 1024;',
  'let _lxCloudPaintToastShown = false;   // v0.30.1185 cloud-paint-cap - once per session',
  'function _lxSaveNoPaint(raw) {   // v0.30.1185 cloud-paint-cap - the save minus its paint, marked as kept on the device',
  '  try {',
  "    if (typeof raw !== 'string') return raw;",
  '    const i = raw.indexOf(\'"_lxPaintRef":"\');',
  '    if (i >= 0) { const j = raw.indexOf(\'"\', i + 15); if (j > 0) return raw.slice(0, i) + \'"_lxPaintLocalOnly":true\' + raw.slice(j + 1); }',
  '    if (raw.indexOf(\'"customPaint\') < 0) return raw;',
  '    const sv = _lxSafeJsonParse(raw);   // the paint inline (an old save, or storage too full for the paint record)',
  "    if (!sv || !sv.player || typeof sv.player !== 'object' || !_lxPaintOf(sv.player).has) return raw;",
  '    delete sv.player.customPaint; delete sv.player.customPaintLayers; sv.player._lxPaintLocalOnly = true;',
  '    return JSON.stringify(sv);',
  '  } catch (e) { return raw; }',
  '}',
  '// v0.30.1185 cloud-paint-cap - the body for an account-cloud push of a save as stored: whole (paint included) when it fits the',
  '// cap, else without the paint - and then, once per session, a toast saying so',
  'function _lxCloudSaveBody(raw, noPaint) {',
  "  if (!noPaint) { const whole = _lxSaveWithPaint(raw); if (typeof whole !== 'string' || whole.length <= _LX_CLOUD_SAVE_CAP) return whole; }",
  '  const bare = _lxSaveNoPaint(raw);',
  '  if (bare !== raw && !_lxCloudPaintToastShown) {',
  '    _lxCloudPaintToastShown = true;',
  "    try { if (typeof showToast === 'function') showToast('Your wardrobe paint is too big for cloud sync \\u2014 it stays on this device; progress still syncs.', 'rare'); } catch (e) {}",
  '  }',
  '  return bare;',
  '}',
  '// v0.30.1185 cloud-paint-cap - the one account-cloud POST of a save as stored (the flush / pagehide push and the first-login',
  '// push); refused as too large anyway (413: the server\'s cap is below _LX_CLOUD_SAVE_CAP) -> once more without the paint',
  'function _lxCloudPost(token, raw, force) {',
  "  const post = (b) => fetch(_LX_API_BASE + '/api/save', {",
  "    method: 'POST', keepalive: !!force,",
  "    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },",
  '    body: b,',
  '  });',
  '  const body = _lxCloudSaveBody(raw);',
  '  post(body).then((r) => {',
  '    if (!r || r.status !== 413) return;',
  '    const bare = _lxCloudSaveBody(raw, true);',
  '    if (bare !== body) return post(bare);',
  '  }).catch(() => {});',
  '}',
  'let _lxCloudPushAt = 0;'), 'the cloud push throttle');

// the throttled push (flush, pagehide)
onceRe(/    json = _lxSaveWithPaint\(json\);   \/\/ v0\.30\.(?:x|\d+) paint-save - the account copy is a whole save, paint included\r?\n    fetch\(_LX_API_BASE \+ '\/api\/save', \{\r?\n      method: 'POST', keepalive: !!force,\r?\n      headers: \{ 'content-type': 'application\/json', authorization: 'Bearer ' \+ sess\.token \},\r?\n      body: json,\r?\n    \}\)\.catch\(\(\) => \{\}\);/,
  "    _lxCloudPost(sess.token, json, force);   // v0.30.1185 cloud-paint-cap - whole when it fits the cloud's cap, else without the paint",
  'the account cloud push');
// the first-login push
onceRe(/fetch\(_LX_API_BASE \+ '\/api\/save', \{ method: 'POST', headers: \{ 'content-type': 'application\/json', authorization: 'Bearer ' \+ session\.token \}, body: _lxSaveWithPaint\(localRaw\) \/\* v0\.30\.(?:x|\d+) paint-save - paint included \*\/ \}\)\.catch\(\(\) => \{\}\);/,
  '_lxCloudPost(session.token, localRaw, false);   /* v0.30.1185 cloud-paint-cap - without the paint when over the cap */',
  'the first-login push');

// a pull of a save pushed without its paint keeps this device's paint
once("    if (String(raw).indexOf('\"_lxPaintRef\":\"') < 0) { try { localStorage.removeItem(_LX_PAINT_KEY); } catch (e) {} }   // it was the replaced save's", J(
  "    // v0.30.1185 cloud-paint-cap - a cloud save pushed without its paint (_lxPaintLocalOnly) keeps this device's paint record",
  "    if (String(raw).indexOf('\"_lxPaintRef\":\"') < 0 && String(raw).indexOf('\"_lxPaintLocalOnly\":true') < 0) { try { localStorage.removeItem(_LX_PAINT_KEY); } catch (e) {} }   // it was the replaced save's"),
  "_lxSaveStoreRaw's record drop");
once('  const ref = sp._lxPaintRef; delete sp._lxPaintRef;', J(
  '  const ref = sp._lxPaintRef; delete sp._lxPaintRef;',
  "  const localOnly = sp._lxPaintLocalOnly === true; delete sp._lxPaintLocalOnly;   // v0.30.1185 cloud-paint-cap - cloud copy without its paint: this device's"),
  "_lxPaintLoad's reference");
once("  if (_lxPaintOf(sp).has || typeof ref !== 'string') return;", "  if (_lxPaintOf(sp).has || (typeof ref !== 'string' && !localOnly)) return;", "_lxPaintLoad's early return");
once("{ try { console.warn('[save] the Wardrobe paint record is missing - loading without paint'); } catch (e) {} return; }",
  "{ if (!localOnly) { try { console.warn('[save] the Wardrobe paint record is missing - loading without paint'); } catch (e) {} } return; }",
  "_lxPaintLoad's missing-record warning");
once('  if (rec.id !== ref) {', '  if (rec.id !== ref && !localOnly) {', "_lxPaintLoad's other-id warning");

const grew = s.length - n0;
if (grew < 2500 || grew > 6500) die('size moved ' + grew);
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
console.log('applied: cloud-paint-cap (+' + grew + ' chars)');
