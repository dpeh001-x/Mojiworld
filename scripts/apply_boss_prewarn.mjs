// Boss swing PREWARN sprites: every boss's heavy-swing windup drew the same warning (boss swing prewarn, 2026-10-15).
// ============================================================================
// Per user: "for this sprite it seems to appear on ALL bosses identically, using ludo.ai generate unique customised sprite
// for each boss", "it should be a prewarn striking swing sprite before impact", "remove the yellow and black", "Instead of an
// arc see if any better design concepts". While a boss winds up a big swing the game marks where it will land. A boss with
// no swing art of its own (Aetherion, Distorted Mira) drew the shared tg_swing - an orange arc with yellow-and-black hazard
// stripes, identical on every boss; one with swing art (the Ossuary Tyrant, the Master Conductor) drew a faint ghost of the
// strike itself, so the warning and the hit looked alike.
// Now each of these bosses has its own WARNING sprite (picked by the user from ludo.ai concepts): Aetherion's violet
// tear-crystals (gold haloed tears once he becomes the Tearborn Ascendant), Mira's frost blade (planted feathers after her
// revive), the Tyrant's bone crowns, the Conductor's red-lit pocket watches. During the windup it is stretched over the zone
// (mirrored for a left swing) and charges like the arc it replaces: faint, brightening, near-full just before the hit. The
// strike itself is unchanged (swing_<type> or the tinted fx_heavyswing).
//   - one registry line per sprite (LX_FX 'tgsw_' + type; '2' = a second form / second life) - _lxSwingPrewarnKey picks it
//   - the zone carries pw: <key>; _lxSwingPrewarnDraw draws it before the ghost / tg_swing (not loaded yet: asked for, and
//     the old draw that frame)
//   - lazy-fx: a monster's tgsw_ art comes with it and its map (_lxFxMobTags, _lxPrewarmMobFx pins it); the Conductor, spawned
//     at runtime on the Ticket Rush stage-4 arena (clockworkExpress), now counts as that map's monster for its fx
//   - the Ossuary Tyrant is a rare elite, not a boss, so its swing was never marked at all: a swinger with a warning sprite of
//     its own always shows it (draw only - the zone's punish rule, _zoneAttack, is computed apart and unchanged)
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('function _lxSwingPrewarnKey(')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };

// 1) the registry: one line per boss sprite, beside the shared arc they replace
{
  const A = "    tg_swing:                       'tg_swing.webp',                       // hollow warning frame + ghost slash arc";
  once(A, J(A,
    "    // v0.30.1769 boss-prewarn - PER-BOSS SWING WARNINGS (per user: the striped arc \"appear[s] on ALL bosses identically\"; ludo.ai,",
    "    // one picked per boss). Drawn over the swing zone during the windup only, in place of tg_swing / the swing's ghost; the",
    "    // strike keeps swing_<type> / fx_heavyswing. Keyed 'tgsw_' + type, + '2' for a second form / second life (_lxSwingPrewarnKey):",
    "    // adding a boss is one line here - the zone, the arena prefetch and the draw all follow the key.",
    "    tgsw_aetherion:      'tgsw_aetherion.webp',      // v0.30.1769 boss-prewarn: Aetherion, form 1 - five violet tear-crystals poised to fall",
    "    tgsw_aetherion2:     'tgsw_aetherion2.webp',     // v0.30.1769 boss-prewarn: Aetherion, Tearborn Ascendant - five gold tears in halos",
    "    tgsw_miraFallen:     'tgsw_miraFallen.webp',     // v0.30.1769 boss-prewarn: Distorted Mira, first life - her frost blade laid along the reach",
    "    tgsw_miraFallen2:    'tgsw_miraFallen2.webp',    // v0.30.1769 boss-prewarn: Distorted Mira, after her revive - five planted feathers",
    "    tgsw_ossuaryTyrant:  'tgsw_ossuaryTyrant.webp',  // v0.30.1769 boss-prewarn: Ossuary Tyrant - five glowing bone crowns",
    "    tgsw_pqConductor:    'tgsw_pqConductor.webp',    // v0.30.1769 boss-prewarn: The Master Conductor - five red-lit pocket watches"), 'the tg_swing registry line');
}

// 2) which warning, and its draw - beside the ghost it takes over from
once('function _lxSwingGhost(z) {', J(
  "// v0.30.1769 boss-prewarn - WHICH WARNING A SWING'S WINDUP DRAWS (per user: \"a prewarn striking swing sprite before impact\", one of",
  "// its own per boss). 'tgsw_' + type; a second form / second life (Aetherion's Tearborn Ascendant - _phaseSprite 'aetherion2' -,",
  "// Distorted Mira after her revive - _revivedOnce) takes 'tgsw_' + type + '2' when that is registered, else the first. null: no",
  "// warning of its own (the ghost / tg_swing as before). ask: a parked sprite is asked for - the windup's safety net; the arena",
  "// has normally asked already (_lxFxMobTags, _lxPrewarmMobFx).",
  'function _lxSwingPrewarnKey(m, ask) {',
  "  if (!m || !m.type || typeof LX_FX === 'undefined' || !LX_FX) return null;",
  "  const b = 'tgsw_' + m.type, k = ((m._phaseSprite === m.type + '2' || m._revivedOnce) && LX_FX[b + '2']) ? b + '2' : (LX_FX[b] ? b : null);",
  "  if (k && ask) { const im = LX_FX[k]; if (im && im._lxLazy === true && !im._lxWanted && typeof _lxWantImg === 'function') _lxWantImg(im, true); }",
  '  return k;',
  '}',
  "// v0.30.1769 boss-prewarn - the warning over the swing zone, stretched to it and mirrored for a left swing. It charges like the arc",
  "// it replaces: 30% at the windup's start, brightening with prog, 97% for the last beats before the hit. World y, as the ghost and",
  "// the monsters draw (the frame loop has already applied camera.y). false = not loaded yet (_lxFxReady asks): the old draw, once.",
  'function _lxSwingPrewarnDraw(z, sx) {',
  '  const art = LX_FX[z.pw]; if (!_lxFxReady(art)) return false;',
  '  const img = _lxPinned(art);',
  '  ctx.save(); ctx.globalAlpha = z.prog > 0.82 ? 0.97 : (0.30 + z.prog * 0.55);',
  "  if (z.dir === 'left') { ctx.translate(sx + z.w, z.y); ctx.scale(-1, 1); ctx.drawImage(img, 0, 0, z.w, z.h); }",
  '  else ctx.drawImage(img, sx, z.y, z.w, z.h);',
  '  ctx.restore(); return true;',
  '}',
  'function _lxSwingGhost(z) {'), '_lxSwingGhost');

// 3) the zone: marked for a swinger with a warning of its own, and carrying the key
once("&& (m.traits.bigMelee.radiance || _lxZoneWorthy(m, (m.traits.bigMelee.dmgMul || 1.5))",
  "&& (m.traits.bigMelee.radiance || _lxZoneWorthy(m, (m.traits.bigMelee.dmgMul || 1.5)) || _lxSwingPrewarnKey(m)   /* v0.30.1769 boss-prewarn - its own warning is always shown (the Ossuary Tyrant is a rare elite, not a boss); draw only */",
  'the swing zone gate');
once("dir: _facing > 0 ? 'right' : 'left', tg: 'tg_swing',",
  "dir: _facing > 0 ? 'right' : 'left', tg: 'tg_swing', pw: _lxSwingPrewarnKey(m, true),   // v0.30.1769 boss-prewarn - its own warning sprite (null: the ghost / tg_swing)",
  'the swing zone push');

// 4) the draw: the warning first
once("    if (z.kind === 'swing' && z.sg && _lxSwingGhost(z)) continue;", J(
  "    if (z.pw && _lxSwingPrewarnDraw(z, sx)) continue;   // v0.30.1769 boss-prewarn - the boss's own warning, in place of the ghost / tg_swing",
  "    if (z.kind === 'swing' && z.sg && _lxSwingGhost(z)) continue;"), 'the zone draw ghost line');

// 5) lazy-fx: it comes with the monster and its map, and is pinned before the first windup
{
  const A = "    for (const pre of ['swing_', 'tg_col_', 'tg_dash_']) key(pre + type);";
  once(A, J(A, "    key('tgsw_' + type); key('tgsw_' + type + '2');   // v0.30.1769 boss-prewarn - its swing warning (and its second form's) with the monster and its map"), '_lxFxMobTags prefixes');
}
{
  const A = "    one(FX['swing_' + type]); one(FX['tg_col_' + type]);";
  once(A, J(A, "    one(FX['tgsw_' + type]); one(FX['tgsw_' + type + '2']);   // v0.30.1769 boss-prewarn - the swing warning, decoded and pinned before its first windup"), '_lxPrewarmMobFx pins');
}
{
  const A = "  try { for (const t of _lxMapBossTypes(id)) { out.push(t); for (const a of ((typeof _LX_ART2_ADDS !== 'undefined' && _LX_ART2_ADDS[t]) || [])) out.push(a); } } catch (e) {}";
  once(A, J(A, "  if (id === 'clockworkExpress' && out.indexOf('pqConductor') < 0) out.push('pqConductor');   // v0.30.1769 boss-prewarn - the Ticket Rush stage-4 duel spawns him at runtime: his art (the swing warning too) comes with the arena"), '_lxFxMapTypes');
}

const grew = s.length - n0;
if (grew < 3500 || grew > 8000) die('size moved ' + grew);
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
console.log('applied: boss-prewarn (+' + grew + ' chars)');
