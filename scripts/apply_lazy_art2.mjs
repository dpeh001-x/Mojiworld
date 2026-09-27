// Monster, NPC, tile and prop art loads for the map you are on and the maps next door, not all of it after the title
// (pre-launch audits 2026-09-26: asset #2, perf #2; second half of lazy-art).
// ============================================================================
// lazy-art made boss frames and far backdrops wait until they are wanted, and the title came up after ~60 MB. But ~250 MB
// still streamed in right behind the title: every monster sheet (111 types, ~23 MB), every NPC sheet (~45, ~18 MB), every
// floor / platform tile (~24 MB, fetched twice: the tile loader and the boot loader's DEFERRED list) and every map prop
// (~8 MB), wherever the player was. In play the WORLD STREAMER then walked every map of the game and every monster type.
// Now the same mechanism as lazy-art handles map-tied art: the image is created as before, marked _lxLazy, and the boot
// image hold PARKS it (menu or not) until something asks. Nothing else about the loaders changed (same files, same
// onload work, same fallbacks).
//   1) the marks (_lxArt2Mark, one key per art: 'mon:<type>', 'npc:<name>', 'tile:<key>', 'prop:<key>'): the monster
//      statics (_loadEntitySprite for Sprites/monsters/), the NPC sheets (_lxLoadNpcSpriteInto; the boot pool of six is
//      skipped while the hold parks - it would wait on parked sheets forever), every LX_TILES tile, floor and platform,
//      and the map props of LX_OBJECTS_FILES (column_pillar, chests, potholes and launch pads stay eager). Only the boot
//      sweeps park a monster / NPC sheet (_LX_ART2.boot): a load of one started later (a self-heal, a backoff retry)
//      is itself a want. The boot loader's DEFERRED list skips a parked file, as it does a parked backdrop.
//   2) the asks (_lxArt2Want): lazy-art's _lxLazyWantMap now also asks for the map's monster types (lazy-art's list:
//      spawns, declared bosses, Tower / Hall of Echoes runtime bosses, plus the Octobaby's tentacles), its NPCs (and the
//      Echo Keeper on an arena), its floor theme / override tiles and its MAP_PROPS - so on every map entry (high
//      priority), for every portal neighbour 3 s later, and in the map preloaders. Also: spawnMonster (summons, event
//      and boss adds, party-quest waves, Tower floors, co-op mirrors), a monster's frame set or an NPC's idle set being
//      built, the draw fallbacks' self-heal (_lxNudgeMonsterSprite / _lxRetryNpcSprite - they no longer start a second
//      copy while the first is on its way), and the dex portraits: _monsterDexSprite hands its <img> callers the sheet
//      even while it is parked (its src is the file; that <img> fetches it itself when shown, loading=lazy honoured),
//      the MojiDex thumbs / portrait measure it through _lxBiBox, which asks for it, and the MojiMon world draw still
//      takes only a loaded one (_lxArt2Drawable). A key asked for once stays asked for. Before the menu is up, a
//      background ask (a portal neighbour, a frame set being built) waits for it (_lxArt2Later): the title comes first.
//   3) the map veil (lazy-art's _lxReadyGate) waits, bounded, for the map's monster / NPC sheets, tiles and props before
//      it decodes and bakes; _lxPreloadMapAssets tracks the sheets so the boot's commence gate holds for them too.
//   4) the world streamer only warms the current map and its portal neighbours; its every-map / every-monster-type
//      sweeps now run only with the hold off (?lxhold=0 - which also turns every mark above off: the old eager boot).
// Needs lazy-art (its hold API and _lxLazyWantMap). Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('function _lxArt2Want(')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
if (!s.includes('function _lxLazyWantMap(') || !s.includes('want: (img) =>')) die('lazy-art is not on this build (needs its _lxLazyWantMap + _lxBootHold.want)');
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };
const after = (a, add, what) => once(a, J(a, ...add), what);
const before = (a, add, what) => once(a, J(...add, a), what);
const T = 'v0.30.1205 lazy-art2';

// 1) the registry and the asks - right after the boot image hold, before the first loader it marks (LX_OBJECTS)
after(J('    setTimeout(_fsTick, 20000);', '  } catch (e) {}', '})();'), [
  '// ' + T + ' - MAP-TIED ART waits for its map, like boss frames (lazy-art): a monster sheet (\'mon:<type>\'), an NPC sheet',
  '// (\'npc:<name>\'), a floor / platform tile (\'tile:<key>\') and a map prop (\'prop:<key>\') are marked _lxLazy when created, so',
  '// the hold above PARKS them until asked (_lxArt2Want): by _lxLazyWantMap (map entry, portal neighbours, the preloaders),',
  '// spawnMonster, a frame / idle set being built, the draw fallbacks\' self-heal and the dex portraits. Asked once = asked for good.',
  'const _LX_ART2 = { reg: Object.create(null), want: Object.create(null), path: new Map(), boot: false, later: [], laterT: 0 };',
  '// ' + T + ' - sweep: false = a monster / NPC sheet load started outside the boot sweep (a self-heal, a retry): that load is a want',
  'function _lxArt2Mark(key, img, path, sweep) {',
  '  if (!img || !key) return img;',
  '  if (sweep === false) _LX_ART2.want[key] = true;',
  '  (_LX_ART2.reg[key] = _LX_ART2.reg[key] || []).push(img); img._lxArt2Key = key;',
  '  if (!_LX_ART2.want[key] && window._lxBootHold) { img._lxLazy = true; if (path) _LX_ART2.path.set(path, img); }   // ' + T + ' - ?lxhold=0: eager, as before',
  '  return img;',
  '}',
  'function _lxArt2Want(key, hi) {',
  '  if (!key) return 0;',
  '  _LX_ART2.want[key] = true;',
  '  // ' + T + ' - before the menu is up a background ask (a portal neighbour, a frame set being built) waits for it: the',
  '  // title files go first (a map being entered asks with hi and starts at once)',
  '  try { const H = window._lxBootHold; if (!hi && H && !H.stats().open) { if (_LX_ART2.later.indexOf(key) < 0) _LX_ART2.later.push(key); if (!_LX_ART2.laterT) _LX_ART2.laterT = setTimeout(_lxArt2Later, 400); return 0; } } catch (e) {}',
  '  let n = 0; const a = _LX_ART2.reg[key];',
  "  if (a) for (const im of a) { try { if (typeof _lxWantImg === 'function' && _lxWantImg(im, hi)) n++; } catch (e) {} }",
  '  return n;',
  '}',
  'function _lxArt2Later() {',
  '  _LX_ART2.laterT = 0;',
  '  try { const H = window._lxBootHold; if (H && !H.stats().open) { _LX_ART2.laterT = setTimeout(_lxArt2Later, 400); return; } } catch (e) {}',
  '  for (const k of _LX_ART2.later.splice(0)) _lxArt2Want(k);',
  '}',
  '// ' + T + ' - a sheet still parked or on its way (the self-heals must not start a second copy of it)',
  'function _lxArt2Busy(key) { const a = _LX_ART2.reg[key]; if (a) for (const im of a) if (im && !im.complete) return true; return false; }',
  '// ' + T + ' - the key\'s image that has not failed (loaded, on its way or parked), for an <img> that loads the same file itself',
  'function _lxArt2Img(key) { const a = _LX_ART2.reg[key]; if (a) for (const im of a) if (im && !(im.complete && !(im.naturalWidth > 0))) return im; return null; }',
  'function _lxArt2Drawable(im) { return (im && typeof HTMLImageElement !== \'undefined\' && im instanceof HTMLImageElement && !(im.complete && im.naturalWidth > 0)) ? null : im; }',
  '// ' + T + ' - the boot loader\'s DEFERRED list names the tile, NPC and prop files too: a parked one is left to its map',
  'function _lxArt2LazyPath(p) { const im = _LX_ART2.path.get(p); return !!(im && !im._lxWanted); }',
  '// ' + T + ' - types pushed straight into game.monsters (not through spawnMonster) by the type that brings them',
  "const _LX_ART2_ADDS = { octobaby: ['octoLegPoison', 'octoLegFreeze', 'octoLegSkillLock', 'octoLegStun'] };",
  "function _lxArt2WantMon(type, hi) { if (!type) return 0; let n = _lxArt2Want('mon:' + type, hi); for (const a of (_LX_ART2_ADDS[type] || [])) n += _lxArt2Want('mon:' + a, hi); return n; }",
  '// ' + T + ' - _pickFloorTheme reads the CURRENT map\'s id; ask it about this one (a portal neighbour)',
  'function _lxArt2FloorTheme(id) {',
  "  const md = (typeof MAPS === 'object' && MAPS[id]) || null;",
  "  if (!md || typeof _pickFloorTheme !== 'function' || typeof game === 'undefined' || !game) return null;",
  '  const cm = game.currentMap;',
  '  try { game.currentMap = id; return _pickFloorTheme(md); } catch (e) { return null; } finally { game.currentMap = cm; }',
  '}',
  'function _lxArt2MapKeys(id) {',
  "  const md = (typeof MAPS === 'object' && MAPS[id]) || null, out = [];",
  '  if (!md) return out;',
  '  const add = (k) => { if (k && out.indexOf(k) < 0) out.push(k); };',
  "  const mon = (t) => { add('mon:' + t); for (const a of (_LX_ART2_ADDS[t] || [])) add('mon:' + a); };",
  "  try { for (const t of _lxMapBossTypes(id)) mon(t); } catch (e) { for (const sp of (md.spawns || [])) if (sp && sp.type) mon(sp.type); }   // " + T + ' - lazy-art\'s list: every spawn type too',
  "  for (const n of (md.npcs || [])) if (n && n.name) add('npc:' + n.name);",
  "  if (md.isBossArena) add('npc:Echo Keeper');   // " + T + ' - loadMap adds him on an arena already won',
  '  try {',
  '    const th = _lxArt2FloorTheme(id);',
  "    if (th && _THEME_FLOOR_KEY[th]) add('tile:' + _THEME_FLOOR_KEY[th]);",
  "    if (th && _THEME_PLATFORM_KEY[th]) add('tile:' + _THEME_PLATFORM_KEY[th]);",
  "    if (MAP_FLOOR_OVERRIDES[id]) add('tile:' + MAP_FLOOR_OVERRIDES[id]);",
  "    const po = MAP_PLATFORM_OVERRIDES[id]; if (po) { if (po.default) add('tile:' + po.default); for (const tg in (po.byTag || {})) add('tile:' + po.byTag[tg]); }",
  "    if (md.sanctum) add('tile:pillarSanctum');",
  '  } catch (e) {}',
  "  try { for (const pr of (MAP_PROPS[id] || [])) if (pr && pr.key) add('prop:' + pr.key); } catch (e) {}",
  '  return out;',
  '}',
  'function _lxArt2WantMap(id, hi) { let n = 0; for (const k of _lxArt2MapKeys(id)) n += _lxArt2Want(k, hi); return n; }',
  '// ' + T + ' - settles when every sheet the map asked for has loaded or failed (the veil waits on it, bounded)',
  'function _lxArt2Settled(id) {',
  '  const ims = []; for (const k of _lxArt2MapKeys(id)) for (const im of (_LX_ART2.reg[k] || [])) ims.push(im);',
  "  if (typeof _lxImgSettled !== 'function') return Promise.resolve(ims.length);",
  '  return Promise.all(ims.map(_lxImgSettled)).then(() => ims.length);',
  '}'], 'the boot image hold tail');

// 1) the marks
before('    img.src = LX_OBJECTS_BASE + k + \'.webp\';', [
  "    if (k !== 'column_pillar') _lxArt2Mark('prop:' + k, img, LX_OBJECTS_BASE + k + '.webp');   // " + T + ' - a map prop waits for its map (the zodiac pillar stays eager)'],
  'LX_OBJECTS src');
once(J('    img.src = base + cfg.file;', '    out[k] = img;'), J(
  "    _lxArt2Mark('tile:' + k, img, base + cfg.file);   // " + T + ' - a tile waits for a map of its theme',
  '    img.src = base + cfg.file;', '    out[k] = img;'), 'LX_TILES src');
once(J('    img.src = LX_FLOOR_PER_MAP_BASE + file;', '    out[k] = img;'), J(
  "    _lxArt2Mark('tile:' + k, img, LX_FLOOR_PER_MAP_BASE + file);   // " + T,
  '    img.src = LX_FLOOR_PER_MAP_BASE + file;', '    out[k] = img;'), 'LX_TILES floors src');
once(J('    img.src = LX_PLATFORM_PER_MAP_BASE + file;', '    out[k] = img;'), J(
  "    _lxArt2Mark('tile:' + k, img, LX_PLATFORM_PER_MAP_BASE + file);   // " + T,
  '    img.src = LX_PLATFORM_PER_MAP_BASE + file;', '    out[k] = img;'), 'LX_TILES platforms src');
before('    img.src = basePath + fname + ext;', [
  "    if (basePath === 'Sprites/monsters/') _lxArt2Mark('mon:' + type, img, basePath + fname + ext, _LX_ART2.boot);   // " + T + ' - a monster sheet waits for a map (or a spawn) that has him'],
  '_loadEntitySprite src');
once("    _loadEntitySprite(MONSTER_SPRITES, MONSTER_SPRITE_META, 'Sprites/monsters/', type, 'MonsterSprite', fileBase);",
  "    _LX_ART2.boot = true; try { _loadEntitySprite(MONSTER_SPRITES, MONSTER_SPRITE_META, 'Sprites/monsters/', type, 'MonsterSprite', fileBase); } finally { _LX_ART2.boot = false; }   // " + T + ' - the boot sweep: these park',
  '_loadMonsterSprites sweep');
before("      img.src = 'Sprites/npc/' + filename;", [
  "      _lxArt2Mark('npc:' + name, img, 'Sprites/npc/' + filename, _LX_ART2.boot);   // " + T + ' - an NPC sheet waits for a map that has her'],
  '_lxLoadNpcSpriteInto src');
before("  window._lxNpcSpritesReady = (typeof _lxAsyncPool === 'function')", [
  '  // ' + T + ' - with the hold on every sheet is created now and parked until wanted; a pool of six would wait on parked',
  '  // sheets forever (nothing awaits _lxNpcSpritesReady since v0.30.794)',
  '  if (window._lxBootHold) { _LX_ART2.boot = true; try { for (const n of names) _lxLoadNpcSpriteInto(n); } finally { _LX_ART2.boot = false; } window._lxNpcSpritesReady = Promise.resolve(names.length); return; }'],
  '_loadNpcSprites pool');
once("  const DEFERRED = REQUIRED.filter(p => !BAZAAR_PATHS.has(p) && !CRITICAL_PATHS.has(p) && !(typeof _lxLazyBgPath === 'function' && _lxLazyBgPath(p)));", J(
  '  // ' + T + ' - and a parked tile / NPC / prop file waits for its map too (the tiles came twice: here and from LX_TILES)',
  "  const DEFERRED = REQUIRED.filter(p => !BAZAAR_PATHS.has(p) && !CRITICAL_PATHS.has(p) && !(typeof _lxLazyBgPath === 'function' && _lxLazyBgPath(p)) && !(typeof _lxArt2LazyPath === 'function' && _lxArt2LazyPath(p)));"),
  'the boot DEFERRED list');

// 2) the asks
after('  try { for (const im of _lxMapBackdrops(id)) _lxWantImg(im, hi); } catch (e) {}', [
  '  try { _lxArt2WantMap(id, hi); } catch (e) {}   // ' + T + ' - and its monster / NPC sheets, tiles and props'],
  '_lxLazyWantMap body');
before(J("    if (typeof _monsterFramesFor === 'function') _monsterFramesFor(type);", "    const _st = (typeof MONSTER_SPRITES !== 'undefined') ? MONSTER_SPRITES[type] : null;"), [
  '    try { _lxArt2WantMon(type, true); } catch (e) {}   // ' + T + ' - a summon, an event or boss add, a PQ wave, a Tower floor, a co-op mirror'],
  'spawnMonster warm');
after('  set = MONSTER_FRAMES[type] = {};', [
  "  try { _lxArt2WantMon(type); } catch (e) {}   // " + T + ' - whoever builds a type\'s frames needs its sheet'],
  '_monsterFramesFor');
after('  if (!type || MONSTER_SPRITES[type] || !_MONSTER_SPRITE_TYPE_SET.has(type)) return;', [
  "  try { _lxArt2Want('mon:' + type, true); if (_lxArt2Busy('mon:' + type)) return; } catch (e) {}   // " + T + ' - drawn before its sheet: ask, and do not fetch a second copy'],
  '_lxNudgeMonsterSprite');
after('  if (!name || NPC_SPRITES[name] || !NPC_SPRITE_FILES[name]) return;', [
  "  try { _lxArt2Want('npc:' + name, true); if (_lxArt2Busy('npc:' + name)) return; } catch (e) {}   // " + T + ' - drawn before her sheet: ask, and do not fetch a second copy'],
  '_lxRetryNpcSprite');
after('  let arr = NPC_IDLE_FRAMES[base];', [
  "  if (arr === undefined) { try { _lxArt2Want('npc:' + npcName); } catch (e) {} }   // " + T + ' - her idle set is being built: her sheet too'],
  '_npcIdleFrame');
once(J("    if (typeof MONSTER_SPRITES !== 'undefined' && _rdy(_orig(MONSTER_SPRITES[k]))) return _orig(MONSTER_SPRITES[k]);", '  } catch (e) {}', '  return null;'), J(
  "    if (typeof MONSTER_SPRITES !== 'undefined' && _rdy(_orig(MONSTER_SPRITES[k]))) return _orig(MONSTER_SPRITES[k]);", '  } catch (e) {}',
  '  // ' + T + ' - a sheet not loaded yet (parked or on its way): hand back its image. Every dex surface builds an <img> from its',
  '  // src, and that <img> fetches the file itself when it is shown (loading=lazy is honoured); the MojiDex thumbs and',
  '  // portrait measure it through _lxBiBox, which asks for it; the MojiMon world draw filters it through _lxArt2Drawable',
  "  try { if (typeof _LX_ART2 !== 'undefined') { const p = _lxArt2Img('mon:' + k); if (p) return p; } } catch (e) {}",
  '  return null;'), '_monsterDexSprite tail');
before(J('  const src = img && img.src;', '  if (!src) { done(null); return; }'), [
  "  try { if (img && img._lxArt2Key && !img._lxWanted) _lxArt2Want(img._lxArt2Key, true); } catch (e) {}   // " + T + ' - a dex portrait waits for this load: ask for it'],
  '_lxBiBox head');
once("  const spr = frame || ((typeof _monsterDexSprite === 'function') ? _monsterDexSprite(mn.type, t || {}) : null);",
  "  const spr = frame || _lxArt2Drawable((typeof _monsterDexSprite === 'function') ? _monsterDexSprite(mn.type, t || {}) : null);   // " + T + ' - loaded art only',
  'the MojiMon world draw');
after("          if (set) for (const mode in set) (set[mode] || []).forEach(track);", [
  "          for (const im of (_LX_ART2.reg['mon:' + sp.type] || [])) track(im);   // " + T + ' - the sheet itself (MONSTER_SPRITES learns it only once loaded)'],
  '_lxPreloadMapAssets monster track');
after("          if (typeof _NPC_SPRITES !== 'undefined' && _NPC_SPRITES[n.name]) track(_NPC_SPRITES[n.name]);", [
  "          for (const im of (_LX_ART2.reg['npc:' + n.name] || [])) track(im);   // " + T + ' - her sheet (NPC_SPRITES learns it only once loaded)'],
  '_lxPreloadMapAssets NPC track');

// 3) the veil waits (bounded) for them before it decodes and bakes
after("    const _lzBoss = (typeof _lxBossArtSettled === 'function') ? _lxBossArtSettled(id) : null, _lzBg = (typeof _lxBackdropSettled === 'function') ? _lxBackdropSettled(id) : null;", [
  "    try { if (typeof _lxArt2Settled === 'function') await capped(_lxArt2Settled(id), CAP * 0.4); } catch (e) {}   // " + T + ' - the monster / NPC sheets, tiles and props land before the veil lifts'],
  '_lxReadyGate head');

// 4) the world streamer: the current map and its portal neighbours only (the old sweeps with ?lxhold=0)
once('    for (const n of _lxMapNeighbors(id)) if (!seen.has(n)) q.push(n);',
  '    if (!window._lxBootHold || order.length === 1) for (const n of _lxMapNeighbors(id)) if (!seen.has(n)) q.push(n);   // ' + T + ' - one step out, not the whole portal graph',
  '_lxStreamWorld BFS');
once("  if (!coarse && typeof MAPS !== 'undefined') for (const id in MAPS) if (!seen.has(id)) order.push(id);",
  "  if (!coarse && !window._lxBootHold && typeof MAPS !== 'undefined') for (const id in MAPS) if (!seen.has(id)) order.push(id);   // " + T + ' - not every map',
  '_lxStreamWorld all maps');
once('    if (i >= order.length) { if (!coarse) setTimeout(_lxStreamMonWorld, 800); return; }',
  '    if (i >= order.length) { if (!coarse && !window._lxBootHold) setTimeout(_lxStreamMonWorld, 800); return; }   // ' + T + ' - a spawn asks for its own sheet now',
  '_lxStreamWorld monster sweep');

const grew = s.length - n0;
if (grew < 8000 || grew > 14000) die('size moved ' + grew);
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
console.log('applied: lazy-art2 (+' + grew + ' chars)');
