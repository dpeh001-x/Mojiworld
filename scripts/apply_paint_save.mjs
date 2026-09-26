// Paint save: the Wardrobe paint is stored under its own key and written only when it changes (perf audit #4, 2026-09-27).
// ============================================================================
// Bug: every save (6-11 a minute in a fight) re-serialised and re-wrote the Wardrobe paint - up to 11 painted layers plus
// the full-body paint, each a PNG data URL - inside the one save blob. A painted hero's save was 1.2 MB with realistic
// strokes (29 ms per save) and 3.25 MB with a noisy paint (65 ms per save, ~62% of the storage quota), so a painted player
// got a stall every 5-10 s in combat and kept fewer Save Backups (the slots trim themselves to fit).
// Fix:
//   - the save flush (_flushSaveStateNow) now goes through _lxPaintWrite: the save gets a small reference
//     (player._lxPaintRef = the id stamped on the paint record) and the paint record (levelx_save_v1_paint) is written only
//     when the paint really changed - a cheap string-identity compare against what was last stored, so every edit path
//     (Wardrobe apply, clear, the legacy head-circle scrub, a load) is covered without hooking each one.
//   - loadState (_lxPaintLoad) puts the paint back on the save's player before it is applied. An OLD save with the paint
//     inline loads exactly as before, and its next save moves the paint out (migration).
//   - every copy that leaves the browser or becomes a backup gets the paint spliced back in as plain text
//     (_lxSaveWithPaint): Save Backups, the auto backups before a cloud sync, the unloadable-save keeper, file export /
//     copy / Secure Save, the account cloud push (flush, pagehide, first login) and Steam Cloud (push + the sync quit
//     write). Those copies are ordinary whole saves that any build imports.
//   - a whole save coming back in (backup restore, import, account cloud pull, Steam Cloud pull) is split again by
//     _lxSaveStoreRaw. New Game / Erase (clearSave) removes the paint record too.
//   - storage full while writing the paint record: the save keeps the paint inline, the old way (nothing is lost, the next
//     save tries again); if even that does not fit, the save points back at the paint record still stored and the failure
//     is reported like any other full save (the existing quota toast).
//   - co-op is untouched: peers get the paint from memory (_mpPaintWire), never from storage.
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('function _lxPaintWrite(')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };
const each = (a, b, want, what) => { const n = s.split(a).length - 1; if (n !== want) die(what + ' matched ' + n + ' (want ' + want + ')'); s = s.split(a).join(b); };

// the helpers, right under the save key
once("const SAVE_KEY = 'levelx_save_v1';", J(
  "const SAVE_KEY = 'levelx_save_v1';",
  '// v0.30.1181 paint-save - the Wardrobe paint (up to 11 layers + the full-body paint, PNG data URLs: 1-3 MB on a painted hero)',
  '// lives under its OWN key and is written only when it changes. Every save used to re-serialise and re-write all of it: 29-65 ms',
  '// per save, 6-11 saves a minute in a fight, and most of the storage quota (fewer Save Backups fitted). The save carries',
  '// player._lxPaintRef, the id stamped on the paint record. A copy that leaves the browser or becomes a backup gets the paint',
  '// spliced back in (_lxSaveWithPaint: an ordinary whole save); a whole save coming back in (restore, import, cloud pull) is',
  '// split again by _lxSaveStoreRaw. An old save with the paint inline loads as before; its next save moves the paint out.',
  "const _LX_PAINT_KEY = SAVE_KEY + '_paint';",
  'let _lxPaintStored = null;   // v0.30.1181 paint-save - what the paint key holds: { id, full, layers } | 0 (no key) | null (unknown)',
  "function _lxPaintNewId() { return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }",
  '// v0.30.1181 paint-save - the record: \'{"id":"..",\' + the two player fields exactly as a whole save spells them (spliceable as text)',
  'function _lxPaintRecord(id, full, layers) {',
  '  return \'{"id":"\' + id + \'","customPaint":\' + JSON.stringify(full) + \',"customPaintLayers":\' + JSON.stringify(layers) + \'}\';',
  '}',
  'function _lxPaintOf(p) {   // v0.30.1181 paint-save - the paint on a save\'s player object, normalised',
  "  const full = (p && typeof p.customPaint === 'string' && p.customPaint) ? p.customPaint : null;",
  "  const layers = (p && p.customPaintLayers && typeof p.customPaintLayers === 'object') ? p.customPaintLayers : {};",
  '  return { full, layers, has: !!full || Object.keys(layers).length > 0 };',
  '}',
  'function _lxPaintSame(rec, pp) {   // v0.30.1181 paint-save - the strings last stored? (=== is a pointer check while unchanged)',
  '  if (!rec || rec.full !== pp.full) return false;',
  '  const ka = Object.keys(rec.layers), kb = Object.keys(pp.layers);',
  '  if (ka.length !== kb.length) return false;',
  '  for (const k of kb) if (rec.layers[k] !== pp.layers[k]) return false;',
  '  return true;',
  '}',
  '// v0.30.1181 paint-save - the save flush\'s write. SAVE_KEY gets the save with a paint reference; the paint key only a CHANGED',
  '// paint. Returns the JSON now in SAVE_KEY; throws (quota) only when the save itself could not be stored.',
  'function _lxPaintWrite(s) {',
  '  const p = s.player, pp = _lxPaintOf(p);',
  '  delete p.customPaint; delete p.customPaintLayers; delete p._lxPaintRef;',
  '  if (!pp.has) {',
  '    const json = JSON.stringify(s);',
  '    localStorage.setItem(SAVE_KEY, json);',
  '    if (_lxPaintStored !== 0) { try { localStorage.removeItem(_LX_PAINT_KEY); } catch (e) {} _lxPaintStored = 0; }',
  '    return json;',
  '  }',
  '  if (_lxPaintStored && _lxPaintSame(_lxPaintStored, pp)) {',
  '    p._lxPaintRef = _lxPaintStored.id;',
  '    const json = JSON.stringify(s);',
  '    localStorage.setItem(SAVE_KEY, json);',
  '    return json;',
  '  }',
  '  // changed, or an old save still holding it inline: the save first (that frees an inline copy), then the paint record',
  '  const prev = _lxPaintStored, id = _lxPaintNewId();',
  '  p._lxPaintRef = id;',
  '  const json = JSON.stringify(s);',
  '  localStorage.setItem(SAVE_KEY, json);   // a throw here changed nothing: the last save and its paint stay as they were',
  '  try {',
  '    localStorage.setItem(_LX_PAINT_KEY, _lxPaintRecord(id, pp.full, pp.layers));',
  '    _lxPaintStored = { id, full: pp.full, layers: Object.assign({}, pp.layers) };',
  '    return json;',
  '  } catch (e) {',
  '    // v0.30.1181 paint-save - no room for the record: the paint goes inline, the way every save stored it before',
  '    delete p._lxPaintRef; p.customPaint = pp.full; p.customPaintLayers = pp.layers;',
  '    const inline = JSON.stringify(s);',
  '    try { localStorage.setItem(SAVE_KEY, inline); }',
  '    catch (e2) {',
  '      // not even that: point the save back at the record still stored (the previous paint), then fail like any full save',
  '      delete p.customPaint; delete p.customPaintLayers;',
  '      if (prev && prev.id) p._lxPaintRef = prev.id;',
  '      try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch (e3) {}',
  '      throw e2;',
  '    }',
  '    try { localStorage.removeItem(_LX_PAINT_KEY); } catch (e3) {}   // the stale record is dead weight now; the next save retries',
  '    _lxPaintStored = 0;',
  '    return inline;',
  '  }',
  '}',
  '// v0.30.1181 paint-save - a save as it leaves the browser or becomes a backup: the paint record spliced back in where the',
  '// reference was, giving an ordinary whole save (every import path, and older builds, read it as they always did). The',
  '// record is the one paint this browser keeps, so it is used even under another id (a second tab saved in between); with',
  '// no record the reference is dropped, so a copy never carries a dangling one.',
  'function _lxSaveWithPaint(raw) {',
  '  try {',
  "    if (typeof raw !== 'string') return raw;",
  '    const i = raw.indexOf(\'"_lxPaintRef":"\'); if (i < 0) return raw;',
  '    const j = raw.indexOf(\'"\', i + 15); if (j < 0) return raw;',
  '    const rec = localStorage.getItem(_LX_PAINT_KEY);',
  '    const k = rec ? rec.indexOf(\'",\') : -1;',
  '    if (rec && rec.indexOf(\'{"id":"\') === 0 && k > 0) return raw.slice(0, i) + rec.slice(k + 2, -1) + raw.slice(j + 1);',
  "    if (raw.charAt(i - 1) === ',') return raw.slice(0, i - 1) + raw.slice(j + 1);",
  "    if (raw.charAt(j + 1) === ',') return raw.slice(0, i) + raw.slice(j + 2);",
  '    return raw;',
  '  } catch (e) { return raw; }',
  '}',
  '// v0.30.1181 paint-save - loadState: the paint back onto the save\'s player object before it is applied. The record is the one',
  '// paint this browser keeps: under another id than the save names (a second tab saved in between) it is still used.',
  'function _lxPaintLoad(sp) {',
  "  if (!sp || typeof sp !== 'object') return;",
  '  const ref = sp._lxPaintRef; delete sp._lxPaintRef;',
  '  _lxPaintStored = null;',
  "  if (_lxPaintOf(sp).has || typeof ref !== 'string') return;   // inline (an old save): loads as it is; its next save moves it out",
  '  let rec = null;',
  '  try { const r = localStorage.getItem(_LX_PAINT_KEY); rec = r ? _lxSafeJsonParse(r) : null; } catch (e) { rec = null; }',
  "  if (!rec || typeof rec !== 'object' || typeof rec.id !== 'string') { try { console.warn('[save] the Wardrobe paint record is missing - loading without paint'); } catch (e) {} return; }",
  "  if (rec.id !== ref) { try { console.warn('[save] the Wardrobe paint record has another id than the save - using it'); } catch (e) {} }",
  '  sp.customPaint = rec.customPaint; sp.customPaintLayers = rec.customPaintLayers;',
  '  const pp = _lxPaintOf(sp);',
  '  _lxPaintStored = { id: rec.id, full: pp.full, layers: Object.assign({}, pp.layers) };',
  '}',
  '// v0.30.1181 paint-save - store a WHOLE save coming back in (backup restore, import, cloud pull) the new way: the save with a',
  '// reference, the paint under its key. Returns what SAVE_KEY now holds; throws if the save itself could not be stored.',
  'function _lxSaveStoreRaw(raw) {',
  '  let sv = null;',
  '  if (typeof raw === \'string\' && raw.indexOf(\'"customPaint\') >= 0) { try { sv = _lxSafeJsonParse(raw); } catch (e) { sv = null; } }',
  "  const sp = (sv && sv.player && typeof sv.player === 'object') ? sv.player : null;",
  '  const pp = _lxPaintOf(sp);',
  '  _lxPaintStored = null;',
  '  if (!sp || !pp.has) {',
  '    localStorage.setItem(SAVE_KEY, raw);',
  '    if (String(raw).indexOf(\'"_lxPaintRef":"\') < 0) { try { localStorage.removeItem(_LX_PAINT_KEY); } catch (e) {} }   // it was the replaced save\'s',
  '    return raw;',
  '  }',
  '  let before = null; try { before = localStorage.getItem(SAVE_KEY); } catch (e) {}',
  '  const id = _lxPaintNewId();',
  '  delete sp.customPaint; delete sp.customPaintLayers; sp._lxPaintRef = id;',
  '  const main = JSON.stringify(sv);',
  '  localStorage.setItem(SAVE_KEY, main);',
  '  try { localStorage.setItem(_LX_PAINT_KEY, _lxPaintRecord(id, pp.full, pp.layers)); return main; }',
  '  catch (e) {',
  '    // v0.30.1181 paint-save - no room for both: store it whole (it loads, and its next save moves the paint out); if even that',
  '    // fails, put back the save that was there and fail',
  '    try { localStorage.setItem(SAVE_KEY, raw); }',
  '    catch (e2) { try { if (before != null) localStorage.setItem(SAVE_KEY, before); } catch (e3) {} throw e2; }',
  '    try { localStorage.removeItem(_LX_PAINT_KEY); } catch (e3) {}',
  '    return raw;',
  '  }',
  '}'), 'the save key');

// the flush: the paint only when it changed
once(J('    const _json = JSON.stringify(s);', '    localStorage.setItem(SAVE_KEY, _json);'), J(
  '    // v0.30.1181 paint-save - the Wardrobe paint goes under its own key, and only when it changed (see _lxPaintWrite)',
  '    const _json = _lxPaintWrite(s);'), 'the flush write');
// loadState: the paint back before the save is applied
once('    Object.assign(player, _lxPickSaveFields(s.player, PLAYER_SAVE_FIELDS));   // v0.30.917 only what a save writes', J(
  '    try { _lxPaintLoad(s.player); } catch (e) {}   // v0.30.1181 paint-save - the Wardrobe paint, from its own key',
  '    Object.assign(player, _lxPickSaveFields(s.player, PLAYER_SAVE_FIELDS));   // v0.30.917 only what a save writes'), 'the loadState assign');
// New Game / Erase / the Amnesiac: the paint record goes with the save
once('  try { localStorage.removeItem(SAVE_KEY); } catch (e) {}', J(
  '  try { localStorage.removeItem(SAVE_KEY); } catch (e) {}',
  '  try { localStorage.removeItem(_LX_PAINT_KEY); _lxPaintStored = 0; } catch (e) {}   // v0.30.1181 paint-save - the Wardrobe paint goes too'),
  'clearSave');

// copies out: whole saves, paint included
each('var data = localStorage.getItem(SAVE_KEY);',
  'var data = _lxSaveWithPaint(localStorage.getItem(SAVE_KEY));   // v0.30.1181 paint-save - the file carries the paint', 3, 'the export reads');
once('    const data = localStorage.getItem(SAVE_KEY);',
  '    const data = _lxSaveWithPaint(localStorage.getItem(SAVE_KEY));   // v0.30.1181 paint-save - the slot keeps the paint', 'the backup read');
each('          name: meta.name, level: meta.level, cls: meta.cls, map: meta.map, data: localRaw });',
  '          name: meta.name, level: meta.level, cls: meta.cls, map: meta.map, data: _lxSaveWithPaint(localRaw) });   // v0.30.1181 paint-save - with the paint',
  2, 'the backups before a cloud sync');
once("    if (!raw || typeof _lxGetBackups !== 'function' || typeof _lxStoreBackups !== 'function') return;", J(
  "    if (!raw || typeof _lxGetBackups !== 'function' || typeof _lxStoreBackups !== 'function') return;",
  '    raw = _lxSaveWithPaint(raw);   // v0.30.1181 paint-save - the kept copy keeps the paint'), 'the unloadable-save keeper');
once('    _lxCloudPushAt = now;', J(
  '    _lxCloudPushAt = now;',
  '    json = _lxSaveWithPaint(json);   // v0.30.1181 paint-save - the account copy is a whole save, paint included'), 'the account cloud push');
once('body: localRaw }', 'body: _lxSaveWithPaint(localRaw) /* v0.30.1181 paint-save - paint included */ }', 'the first-login push');
once('  _lxSteamCloudPushT = now;', J(
  '  _lxSteamCloudPushT = now;',
  '  json = _lxSaveWithPaint(json);   // v0.30.1181 paint-save - the Steam Cloud copy is a whole save, paint included'), 'the Steam Cloud push');
once('if (_raw) window.SteamAPI.cloud.writeSync(SAVE_KEY, _raw);',
  'if (_raw) window.SteamAPI.cloud.writeSync(SAVE_KEY, _lxSaveWithPaint(_raw));   // v0.30.1181 paint-save - paint included', 'the Steam quit write');

// copies in: split again
once('    localStorage.setItem(SAVE_KEY, b.data);',
  '    _lxSaveStoreRaw(b.data);   // v0.30.1181 paint-save - the paint back under its own key', 'the backup restore');
once('          localStorage.setItem(SAVE_KEY, save);',
  '          _lxSaveStoreRaw(save);   // v0.30.1181 paint-save - the paint under its own key', 'the import write');
once('    try { localStorage.setItem(SAVE_KEY, JSON.stringify(cloud)); } catch (e) {}',
  '    try { _lxSaveStoreRaw(JSON.stringify(cloud)); } catch (e) {}   // v0.30.1181 paint-save - the paint under its own key', 'the account cloud pull');
once('    try { localStorage.setItem(SAVE_KEY, cloudRaw); _wrote = localStorage.getItem(SAVE_KEY) === cloudRaw; } catch (e) {}',
  '    try { const _st = _lxSaveStoreRaw(cloudRaw); _wrote = localStorage.getItem(SAVE_KEY) === _st; } catch (e) {}   // v0.30.1181 paint-save - split like any whole save',
  'the Steam Cloud pull');

const grew = s.length - n0;
if (grew < 7000 || grew > 13000) die('size moved ' + grew);
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
console.log('applied: paint-save (+' + grew + ' chars)');
