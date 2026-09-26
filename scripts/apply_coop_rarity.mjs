// Co-op loot could carry a script into the item windows (launch security audit, infra #2, 2026-09-26).
// ============================================================================
// The bug: a co-op guest takes a copy of every loot drop the host announces (_coopApplyDrop). The only cleaning on
// the way in was _mpScrubStrings, which removes < and > from the item's TOP-LEVEL strings. That stops a <tag>, but
// not a quote: the item windows build HTML like  class="name rarity-text-${it.rarity}"  so a host that sends
//   rarity: 'x" onmouseover="..." data-y="'
// closes the class attribute and opens an event handler (the tooltip, the Forge lists, the sell desk, the Reforge
// bench). stars had the same hole (_starBadgeHtml prints it into aria-label="..."), and nested strings were never
// cleaned at all. The item then sits in the bag, rides every save and cloud save, and fires on each hover - in a page
// whose localStorage holds the cloud-save token. Needs the attacker to be the elected co-op host.
// The fix, in three layers:
//   1) the way in - _lxScrubInboundItem() builds a clean copy of the dropped item: every string at every depth loses
//      " ' ` < > (still capped at 64), every number is finite, prototype keys are dropped, and rarity / stars / tier /
//      dropLevel are pinned (rarity must be common / rare / epic / legendary / god). A catalog name that owns an
//      apostrophe ("Hunter's Shortbow") gets its spelling back. The host's boon-orb rarity is pinned the same way.
//   2) the way out - every HTML rarity-text sink reads _lxRarityCls(r), which returns a known id or 'common'.
//   3) saves - loadState heals the bag and every equipped slot through _lxRepairSavedItem, so an item picked up
//      before the fix stops being dangerous on the next load.
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('function _lxScrubInboundItem(')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const B = (t) => t.replace(/^\n/, '').replace(/\n$/, '').split('\n').join(EOL);   // a String.raw block, in the file's EOL
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };
const each = (a, b, want, what) => { const n = s.split(a).length - 1; if (n !== want) die(what + ' matched ' + n + ' (want ' + want + ')'); s = s.split(a).join(b); };

// 1) + 2) + 3) the helpers, right after the peer-string scrub they extend
const SCRUB_END = J(
  "    if (typeof obj[k] === 'string') obj[k] = obj[k].replace(/[<>]/g, '').slice(0, 64);",
  '  }',
  '  return obj;',
  '}');
once(SCRUB_END, SCRUB_END + EOL + B(String.raw`
// v0.30.1179 coop-rarity - the item rarity ids the game knows. Every class="rarity-text-..." built as HTML reads this, so a
// rarity that is anything else (a co-op host's 'x" onmouseover="..."', an array, a number) prints as 'common'.
function _lxRarityCls(r) {
  return (r === 'common' || r === 'rare' || r === 'epic' || r === 'legendary' || r === 'god') ? r : 'common';
}
// v0.30.1179 coop-rarity - heal one item in place (loadState runs it over the bag and every equipped slot, and it is the
// last step of _lxScrubInboundItem): a rarity that is not a known id -> 'common'; stars / tier / dropLevel that are
// not finite numbers -> numbers (stars is printed into aria-label="..."); " backtick < > out of name / baseName / slot /
// icon / cls (no real item uses them; an apostrophe stays - "Hunter's Shortbow"). True when it changed anything.
function _lxRepairSavedItem(it) {
  if (!it || typeof it !== 'object') return false;
  let fixed = false;
  if (it.rarity != null && _lxRarityCls(it.rarity) !== it.rarity) { it.rarity = 'common'; fixed = true; }
  for (const k of ['stars', 'tier', 'dropLevel']) {
    if (it[k] != null && !(typeof it[k] === 'number' && Number.isFinite(it[k]))) { const x = +it[k]; it[k] = Number.isFinite(x) ? x : 0; fixed = true; }
  }
  for (const k of ['name', 'baseName', 'slot', 'icon', 'cls']) {
    if (typeof it[k] === 'string' && /["\x60<>]/.test(it[k])) { it[k] = it[k].replace(/["\x60<>]/g, ''); fixed = true; }
  }
  return fixed;
}
// v0.30.1179 coop-rarity - a loot item that arrives from the network (the co-op host's drop frame). _mpScrubStrings only
// took < > off the top-level strings, so a quote walked out of class="rarity-text-..." into onmouseover=, and nested
// strings were never touched. This builds a fresh copy: every string at every depth loses " ' backtick < > (capped at 64,
// as before), every number is finite (JSON.parse reads 1e999 as Infinity), prototype keys and odd key names are
// dropped, then _lxRepairSavedItem pins rarity / stars / tier / dropLevel. A base item this client knows whose name
// owns an apostrophe gets its spelling back (trusted local text - a local drop of it carries the same).
function _lxScrubInboundItem(src, depth) {
  const d = depth | 0;
  if (!src || typeof src !== 'object' || d > 4) return null;
  const out = Array.isArray(src) ? [] : {};
  let n = 0;
  for (const k of Object.keys(src)) {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype' || !/^[\w$]{1,40}$/.test(k) || ++n > 200) continue;
    const v = src[k];
    if (typeof v === 'string') out[k] = v.replace(/["'\x60<>]/g, '').slice(0, 64);
    else if (typeof v === 'number') out[k] = Number.isFinite(v) ? Math.max(-1e15, Math.min(1e15, v)) : 0;
    else if (typeof v === 'boolean' || v === null) out[k] = v;
    else if (typeof v === 'object') { const c = _lxScrubInboundItem(v, d + 1); if (c) out[k] = c; }
  }
  if (d) return out;
  _lxRepairSavedItem(out);
  if (!_lxScrubInboundItem._apos) {
    const a = [];
    try { for (const c in ITEM_POOL) for (const b of (ITEM_POOL[c] || [])) if (b && typeof b.name === 'string' && b.name.indexOf("'") >= 0) a.push(b.name); } catch (e) {}
    _lxScrubInboundItem._apos = a;
  }
  for (const nm of _lxScrubInboundItem._apos) {
    const bare = nm.replace(/'/g, '');
    if (out.baseName === bare) out.baseName = nm;
    if (typeof out.name === 'string' && out.name.indexOf(bare) >= 0) out.name = out.name.replace(bare, () => nm);
  }
  return out;
}`), '_mpScrubStrings tail');

// 1) the drop frame and the boon-orb frame
once('    const _it = _mpScrubStrings(msg.it);',
  "    const _it = _lxScrubInboundItem(msg.it);   // v0.30.1179 coop-rarity - was _mpScrubStrings: a quote in rarity / stars still broke out of an attribute",
  "_coopApplyDrop's item scrub");
once("rarity: String(msg.rr || 'common').slice(0, 12),",
  'rarity: _lxRarityCls(msg.rr),   /* v0.30.1179 coop-rarity - a known id, like the items */',
  "_coopApplyDrop's orb rarity");

// 2) the HTML sinks (className assignments are DOM properties, not parsed, so they are left alone)
once("rarity-text-${it.rarity || 'common'}", 'rarity-text-${_lxRarityCls(it.rarity)}', 'the sell desk row');
once("rarity-text-${rarity || 'common'}", 'rarity-text-${_lxRarityCls(rarity)}', 'makeShopRow');
once("    const rar = (it && it.rarity) || 'common';",
  '    const rar = _lxRarityCls(it && it.rarity);   // v0.30.1179 coop-rarity - printed into two class="..." attributes below',
  'the Reforge bench cards');
once("'<div class=\"rf-name rarity-text-' + (it.rarity || 'common') + '\">'",
  "'<div class=\"rf-name rarity-text-' + _lxRarityCls(it.rarity) + '\">'", 'the Reforge preview');
each('rarity-text-${it.rarity}"', 'rarity-text-${_lxRarityCls(it.rarity)}"', 3, 'the Forge lists + the item tooltip');

// 3) loadState heals what a save already carries
const INV = J("    if (typeof _refreshEqEmptyFlag === 'function') _refreshEqEmptyFlag();",
  '    if (!Array.isArray(player.inventory)) player.inventory = [];');
once(INV, INV + EOL + B(String.raw`
    // v0.30.1179 coop-rarity - heal items a save carries from before the fix (a co-op drop whose rarity was
    // 'x" onmouseover=...'), in the bag and every equipped slot - see _lxRepairSavedItem.
    { let _fx = 0;
      for (const _it of player.inventory) if (_lxRepairSavedItem(_it)) _fx++;
      if (player.equipped && typeof player.equipped === 'object') for (const _sl in player.equipped) if (_lxRepairSavedItem(player.equipped[_sl])) _fx++;
      if (_fx) { player._equipBonusCache = null; console.warn('[save] repaired ' + _fx + ' item(s) with an unknown rarity or bad fields'); } }`),
  'loadState inventory defaulter');

const grew = s.length - n0;
if (grew < 3000 || grew > 8000) die('size moved ' + grew);
{ const m = (s.match(/v0\.30\.x coop-rarity/g) || []).length; if (m !== 7) die('marker count ' + m); }
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
console.log('applied: coop-rarity (+' + grew + ' chars)');
