// Boss frames and far backdrops load on demand; nothing but the title and the start map loads before the title
// (pre-launch audits 2026-09-26: asset #2, perf #2).
// ============================================================================
// A cold first visit fetched ~400 MB before the title (localhost: 2,338 files, 416 MB, title at 22 s): every boss's
// frame sets (_loadBossFrames runs eleven times at script start: attack / idle / walk / weave / duck + six zodiac
// sets, ~140 MB), every map's backdrop (BG_IMAGES / _loadBG, ~75 MB), and every fx / monster / equipment / npc sheet.
// The web build already had the BOOT IMAGE HOLD (v0.30.806): script-set art waits until the menu is up, then streams
// in x16 - but it was off on localhost, file:// and the packaged app, and even on the web it released EVERYTHING,
// ~380 MB, right after the title. Now:
//   1) the hold is on for every build (?lxhold=0 still turns it off - and with it everything below, which is then the
//      old eager load); a page that opens the world without the menu (window._lxBootGateDone) releases it too.
//   2) LAZY art: boss frame images and the backdrops of maps you are not in are marked _lxLazy and PARKED by the hold -
//      menu or not - until wanted (_lxBootHold.want). A parked image reads as still loading, the state every renderer
//      already handles on a slow CDN. Wanted: on entering a map (its bosses' sets and its backdrop), 3 s later for every
//      map behind its portals (their backdrops and their arena bosses), when a boss spawns or is summoned
//      (_lxWarmBossFrames), and by the map preloaders / _warmMapArt. The cycle plates (forest ... dungeon), main and the
//      town fallback stay on the ordinary stream: _pickBGImage chooses among whichever of them have loaded.
//      A want for the map being entered is stamped fetchPriority 'high' (it jumps the background stream) and also starts
//      the boss's queued base portraits (_lxBootHold.match): BOSS_SPRITES / BOSS_SPRITE_META only learn a key once its
//      portrait has loaded, and _warmMapArt + the size derive walk those keys. tower_b5/b10 and boss_rush add the
//      bosses they spawn at runtime.
//   3) nothing waits on parked art: the preloader, the registry decode sweeps (and so the commence gate), _warmMapArt's
//      slots (a 'king' arena also matched kingKrook by prefix) and the boot loader's DEFERRED list skip it.
//   4) the map veil (_lxReadyGate) now also waits - bounded - for the map's boss art and for its backdrop to load and
//      decode, so a boss never opens on its fallback pose and a map never opens on a blank sky. And only the LATEST
//      loadMap may lift it: a map entered within ~4 s of the last one was unveiled by the last one's gate or cap timer.
//      Boss art that lands after the gate's wait is warmed again once it is in (so the bake and the boss-bake size
//      derive see it), and a map's own backdrop still loading holds the veil up to 3 s more (_lxVeilBackdrop).
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('function _lxLazyWantMap(')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };
const after = (a, add, what) => once(a, J(a, ...add), what);
const before = (a, add, what) => once(a, J(...add, a), what);

// 1) + 2) the boot image hold: every build, parks lazy art, releases on a world opened without the menu
once("    if (/[?&]lxhold=0\\b/.test(qs) || (local && !/[?&]lxhold=1\\b/.test(qs))) return;", J(
  '    // v0.30.1196 lazy-art - ON for every build now (file://, localhost and the packaged app too): a cold local boot measured',
  '    // 416 MB / 2,338 files before the title (22 s), and the lazy art below needs the hold to park it. ?lxhold=0 turns it',
  '    // off, and the lazy art with it (everything then loads at boot, as before).',
  "    if (/[?&]lxhold=0\\b/.test(qs)) return;"), 'the hold on/off line');
once('    let held = [], open = false, started = 0;',
  '    let held = [], open = false, started = 0; const lazyQ = [];   // v0.30.1196 lazy-art - parked lazy images', 'the hold state');
after(J('      get() { return this._lxHeldSrc != null ? abs(this._lxHeldSrc) : dSrc.get.call(this); },', '      set(v) {'), [
  '        // v0.30.1196 lazy-art - a LAZY image (boss frames, a far map\'s backdrop) is parked, menu or not, until it is wanted',
  "        if (this._lxLazy === true && !this._lxWanted && typeof v === 'string' && RX.test(v) && !this.isConnected) { if (this._lxHeldSrc == null) lazyQ.push(this); this._lxHeldSrc = v; return; }"],
  'the hold src setter');
once("    const start = (img) => { const u = img._lxHeldSrc; if (u == null) return false; img._lxHeldSrc = null; started++; dSrc.set.call(img, u); return true; };", J(
  '    const start = (img) => { const u = img._lxHeldSrc; if (u == null) return false; img._lxHeldSrc = null; started++; dSrc.set.call(img, u);',
  "      const w = img._lxDecodeQ; if (w) { img._lxDecodeQ = null; for (const r of w) { try { const p = oDecode.call(img); if (p && p.then) p.then(r, r); else r(); } catch (e) { r(); } } }   // v0.30.1196 lazy-art - decode()s that waited on a parked image",
  '      return true; };'), 'the hold start()');
once("      set(v) { dPri.set.call(this, v); if (v === 'high' && open) start(this); } });",
  "      set(v) { dPri.set.call(this, v); if (v === 'high' && open && !(this._lxLazy === true && !this._lxWanted)) start(this); } });   // v0.30.1196 lazy-art - a priority is not a want",
  'the hold fetchPriority setter');
after('      if (this._lxHeldSrc == null) return oDecode.apply(this, arguments);', [
  "      if (this._lxLazy === true && !this._lxWanted) { const me = this; return new Promise((res) => { (me._lxDecodeQ = me._lxDecodeQ || []).push(res); }); }   // v0.30.1196 lazy-art - settles once wanted and decoded (no polling)"],
  'the hold decode()');
once('      const q = held.filter((im) => im._lxHeldSrc != null);',
  '      const q = held.filter((im) => im._lxHeldSrc != null && !(im._lxLazy === true && !im._lxWanted));   // v0.30.1196 lazy-art - parked art stays parked',
  'the hold release queue');
once('    window._lxBootHold = { release, now: start, peek: () => held.find((im) => im._lxHeldSrc != null) || null,', J(
  '    window._lxBootHold = { release, now: start, peek: () => held.find((im) => im._lxHeldSrc != null && !(im._lxLazy === true && !im._lxWanted)) || null,',
  '      want: (img) => { if (!img) return false; img._lxWanted = true; return start(img); },   // v0.30.1196 lazy-art',
  '      // v0.30.1196 lazy-art - the queued (not lazy) images whose URL matches: started now, all returned (a boss base portrait)',
  "      match: (re) => { const out = []; for (const im of held) { const u = (im._lxHeldSrc != null) ? im._lxHeldSrc : dSrc.get.call(im); if (u && re.test(u)) { if (im._lxHeldSrc != null && !(im._lxLazy === true && !im._lxWanted)) start(im); out.push(im); } } return out; },"),
  'the hold API');
once('      stats: () => ({ open, held: held.filter((im) => im._lxHeldSrc != null).length, started }) };', J(
  '      // v0.30.1196 lazy-art - held = still to stream (it drains after the menu); parked = lazy art nothing has asked for yet',
  '      stats: () => ({ open, held: held.filter((im) => im._lxHeldSrc != null && !(im._lxLazy === true && !im._lxWanted)).length, started,',
  '        parked: lazyQ.concat(held).filter((im) => im._lxLazy === true && !im._lxWanted && im._lxHeldSrc != null).length }) };'),
  'the hold stats');
before('    setTimeout(_fsTick, 20000);', [
  '    // v0.30.1196 lazy-art - a page that opens the world without the menu (a deep link, a test harness: window._lxBootGateDone)',
  '    const _wdTick = () => { if (open) return; if (window._lxBootGateDone) return release(\'world up\'); setTimeout(_wdTick, 400); };',
  '    setTimeout(_wdTick, 400);'], 'the hold failsafe');

// 2) lazy marks: every boss frame, and every backdrop but the cycle / main / town-fallback plates
before("      img.src = 'Sprites/bosses/' + subdir + '/' + type + '_' + i + '.webp';", [
  '      img._lxLazy = true;   // v0.30.1196 lazy-art - parked by the boot image hold until the boss is wanted (_lxBossArtWant)'],
  '_loadBossFrames src');
after("const _BG_CYCLE = ['forest', 'valley', 'meadow', 'misty', 'dungeon'];", [
  '// v0.30.1196 lazy-art - a backdrop is fetched when its map (or a map next door) is entered, not at boot. The cycle plates,',
  '// main and the town fallback stay on the ordinary stream: _pickBGImage picks among whichever of them have LOADED, so a',
  '// map without a plate of its own only gets its usual backdrop once they are all in.',
  '(function _lxLazyBackdrops() {',
  '  try {',
  "    const keep = new Set(_BG_CYCLE.concat(['main', 'everdawnMegamall']));",
  '    for (const k in BG_IMAGES) if (BG_IMAGES[k] && !keep.has(k)) BG_IMAGES[k]._lxLazy = true;',
  "    if (_ART_PACK !== 'cinematic') for (const im of BG_CINEMATIC_VARIANTS) if (im) im._lxLazy = true;",
  '  } catch (e) {}',
  '})();'], 'the backdrop cycle list');
// 2) the want side: helpers next to the spawn-time boss warm, which now also wants
before('function _lxWarmBossFrames(type) {', [
  '// v0.30.1196 lazy-art - parked = a lazy image nothing has asked for yet (boss frames, a far backdrop). See _lxBootImageHold.',
  'function _lxParked(img) { return !!(img && img._lxLazy === true && !img._lxWanted && img._lxHeldSrc != null); }',
  '// v0.30.1196 lazy-art - hi: this is for the map being entered, so it jumps the background stream (Chromium re-prioritises queued',
  '// and in-flight requests); a portal neighbour is prefetched at the ordinary priority',
  'function _lxHi(img) { try { if (img && !(img.complete && img.naturalWidth > 0) && \'fetchPriority\' in img && img.fetchPriority !== \'high\') img.fetchPriority = \'high\'; } catch (e) {} }',
  'function _lxWantImg(img, hi) {',
  '  if (hi) _lxHi(img);',
  '  if (!img || img._lxWanted) return false;',
  '  img._lxWanted = true;',
  '  try { if (img._lxHeldSrc != null && window._lxBootHold && window._lxBootHold.want) return window._lxBootHold.want(img); } catch (e) {}',
  '  return false;',
  '}',
  '// v0.30.1196 lazy-art - a boss\'s own sets: its key and keys that continue it in lowercase or a digit (gravitos -> gravitos2,',
  '// gravitospunch; king does NOT take kingKrook), idle first; a zodiac_<sign> type takes its sign\'s six sets',
  'function _lxBossArtSets(type) {',
  '  const out = [];',
  '  if (!type) return out;',
  '  const mine = (k) => { if (k === type) return true; if (k.length <= type.length || k.indexOf(type) !== 0) return false; const c = k.charCodeAt(type.length); return (c >= 97 && c <= 122) || (c >= 48 && c <= 57); };',
  '  try {',
  "    for (const map of [typeof BOSS_IDLE_FRAMES !== 'undefined' ? BOSS_IDLE_FRAMES : null, typeof BOSS_WALK_FRAMES !== 'undefined' ? BOSS_WALK_FRAMES : null,",
  "      typeof BOSS_ATTACK_FRAMES !== 'undefined' ? BOSS_ATTACK_FRAMES : null, typeof BOSS_WEAVE_FRAMES !== 'undefined' ? BOSS_WEAVE_FRAMES : null,",
  "      typeof BOSS_DUCK_FRAMES !== 'undefined' ? BOSS_DUCK_FRAMES : null]) { if (map) for (const k in map) if (mine(k) && map[k] && map[k].length) out.push(map[k]); }",
  '    const sign = /^zodiac[_-]/.test(type) ? type.replace(/^zodiac[_-]/, \'\') : null;',
  '    if (sign) for (const map of [ZODIAC_IDLE_FRAMES, ZODIAC_WALK_FRAMES, ZODIAC_ATTACK_FRAMES, ZODIAC_CHARGE_FRAMES, ZODIAC_POUNCE_FRAMES, ZODIAC_FLY_FRAMES]) if (map && map[sign] && map[sign].length) out.push(map[sign]);',
  '  } catch (e) {}',
  '  return out;',
  '}',
  '// v0.30.1196 lazy-art - and its BASE portraits (Sprites/bosses/<type>*, attack/<type>*, zodiac/<sign>): not lazy, but after the',
  '// menu they queue behind ~1,000 other images, and BOSS_SPRITES / BOSS_SPRITE_META only learn a key once its portrait has',
  '// loaded (_warmMapArt and the size derive walk those keys). Started now and kept, so the veil can wait for them too.',
  'const _LX_BOSS_BASE = Object.create(null);',
  'function _lxBossBaseWant(type) {',
  '  if (!type || _LX_BOSS_BASE[type] || !window._lxBootHold || !window._lxBootHold.match) return _LX_BOSS_BASE[type] || [];',
  "  const sign = /^zodiac[_-]/.test(type) ? type.replace(/^zodiac[_-]/, '') : null;",
  "  const re = sign ? new RegExp('/bosses/zodiac/' + sign + '[.](?:webp|png)') : new RegExp('/bosses/(?:attack/)?' + type.replace(/[^A-Za-z0-9_]/g, '') + '[a-z0-9]*[.](?:webp|png)');",
  '  try { return (_LX_BOSS_BASE[type] = window._lxBootHold.match(re)); } catch (e) { return []; }',
  '}',
  'function _lxBossArtWant(type, hi) {',
  '  let n = 0;',
  '  try { const b = _lxBossBaseWant(type); if (hi) for (const im of b) _lxHi(im); } catch (e) {}',
  '  for (const arr of _lxBossArtSets(type)) for (const im of arr) { if (hi) _lxHi(im); if (_lxParked(im) && _lxWantImg(im)) n++; }',
  '  return n;',
  '}',
  '// v0.30.1196 lazy-art - what a map needs: every type it spawns or declares (the list _warmMapArt warms), and its backdrop',
  'function _lxMapBossTypes(id) {',
  "  const md = (typeof MAPS === 'object' && MAPS[id]) || null, out = [];",
  '  if (!md) return out;',
  '  for (const sp of (md.spawns || [])) if (sp && sp.type && out.indexOf(sp.type) < 0) out.push(sp.type);',
  '  if (md.bossType && out.indexOf(md.bossType) < 0) out.push(md.bossType);',
  '  for (const k of (md.bossSequence || [])) if (k && out.indexOf(k) < 0) out.push(k);',
  "  if (id === 'tower_b5') out.push('towerArbiter'); else if (id === 'tower_b10') out.push('towerSovereign');   // v0.30.1196 lazy-art - spawned at runtime (_expeditionSpawnTowerBoss)",
  "  if (id === 'boss_rush') { try { for (const t of _bossRushRoster()) if (t && out.indexOf(t) < 0) out.push(t); } catch (e) {} }   // v0.30.1196 lazy-art - the echoes this save has earned",
  '  return out;',
  '}',
  'function _lxMapBackdrops(id) {',
  "  const md = (typeof MAPS === 'object' && MAPS[id]) || null;",
  "  if (!md || typeof BG_IMAGES === 'undefined') return [];",
  '  if (md.bg && BG_IMAGES[md.bg]) return [BG_IMAGES[md.bg]];',
  '  if (md.sanctum || md.singularity || md.isCarriage || md.isZodiac || md.isZodiacHub || md.isVoid) return [];   // v0.30.1196 lazy-art - drawn procedurally',
  "  const out = []; for (const k of (md.isTown ? ['everdawnMegamall', 'valley'] : _BG_CYCLE.concat(['main']))) if (BG_IMAGES[k]) out.push(BG_IMAGES[k]);",
  '  return out;',
  '}',
  'function _lxLazyWantMap(id, hi) {',
  '  try { for (const t of _lxMapBossTypes(id)) _lxBossArtWant(t, hi); } catch (e) {}',
  '  try { for (const im of _lxMapBackdrops(id)) _lxWantImg(im, hi); } catch (e) {}',
  '}',
  '// v0.30.1196 lazy-art - settles when an image has loaded or failed (a parked one: at once - it is not coming)',
  'function _lxImgSettled(im) {',
  '  return new Promise((res) => {',
  '    if (!im || _lxParked(im) || im.complete) { res(); return; }',
  "    im.addEventListener('load', () => res(), { once: true }); im.addEventListener('error', () => res(), { once: true });",
  '  });',
  '}',
  'function _lxBossArtSettled(id) {',
  '  const ims = []; for (const t of _lxMapBossTypes(id)) { for (const im of (_LX_BOSS_BASE[t] || [])) ims.push(im); for (const arr of _lxBossArtSets(t)) for (const im of arr) if (im) ims.push(im); }',
  '  return Promise.all(ims.map(_lxImgSettled)).then(() => ims.length);',
  '}',
  'function _lxBackdropSettled(id) {',
  '  return Promise.all(_lxMapBackdrops(id).map((im) => _lxImgSettled(im).then(() => { try { if (im.naturalWidth > 0 && im.decode) return im.decode().catch(() => {}); } catch (e) {} }))).then(() => true);',
  '}',
  '// v0.30.1196 lazy-art - the veil\'s last word (loadMap\'s _fadeGo): a map\'s own backdrop still on its way holds the veil up to',
  '// 3 s more, then the sky gradient shows as it always has; a newer map entry takes the veil over',
  'function _lxVeilBackdrop(id, gen, go) {',
  "  const md = (typeof MAPS === 'object' && MAPS[id]) || null, im = (md && md.bg && typeof BG_IMAGES !== 'undefined') ? BG_IMAGES[md.bg] : null;",
  '  const t0 = Date.now();',
  '  const tick = () => {',
  '    if (game._lxFadeGen !== gen) return;',
  '    const ready = !im || im._loaded || im._lxFailed || _lxParked(im) || (im.complete && !(im.naturalWidth > 0));',
  '    if (ready || Date.now() - t0 > 3000) { try { if (im && im._loaded && Date.now() - t0 > 50) _lxPrimeBackdrop(id); } catch (e) {} go(); return; }   // v0.30.1196 lazy-art - it came late: bake its draw size under the veil',
  '    setTimeout(tick, 100);',
  '  };',
  '  tick();',
  '}',
  '// v0.30.1196 lazy-art - the boot loader\'s DEFERRED list names every backdrop file too: a parked one is left to its map',
  'function _lxLazyBgPath(p) {',
  "  if (!window._lxBootHold || typeof BG_IMAGES === 'undefined') return false;",
  '  for (const k in BG_IMAGES) { const im = BG_IMAGES[k]; if (im && im._lxLazy && !im._lxWanted && im._lxPath === p) return true; }',
  "  try { for (const im of BG_CINEMATIC_VARIANTS) if (im && im._lxLazy && !im._lxWanted && im._lxPath === p) return true; } catch (e) {}",
  '  return false;',
  '}'], 'the lazy helpers');
once(J('function _lxWarmBossFrames(type) {', '  if (!type || _LX_BOSS_WARMED[type]) return 0;'), J(
  'function _lxWarmBossFrames(type) {',
  '  try { _lxBossArtWant(type, true); } catch (e) {}   // v0.30.1196 lazy-art - a boss spawning or being summoned asks for its art',
  '  if (!type || _LX_BOSS_WARMED[type]) return 0;'), '_lxWarmBossFrames head');
// entering a map, and 3 s later its portal neighbours (the existing preload + neighbour prefetch)
before("    if (!window._lxMapPreloaded[id]) { window._lxMapPreloaded[id] = 1; _lxPreloadMapAssets(id, null, 'high'); }", [
  '    try { _lxLazyWantMap(id, true); } catch (e) {}   // v0.30.1196 lazy-art - this map\'s boss art and backdrop, on every entry'],
  'loadMap preload');
before("        if (typeof _lxWarmMap === 'function') _lxWarmMap(n);", [
  '        try { _lxLazyWantMap(n); } catch (e) {}   // v0.30.1196 lazy-art - next door: its backdrop, and the boss art of an arena behind a portal'],
  'loadMap neighbour prefetch');
after('function _lxPreloadMapAssets(id, onProgress, prio) {', [
  "  if (prio === 'high') { try { _lxLazyWantMap(id, true); } catch (e) {} }   // v0.30.1196 lazy-art - the boot map / an arena about to open"],
  '_lxPreloadMapAssets head');
once('    if (!img || !img.src) return;', '    if (!img || !img.src || _lxParked(img)) return;   // v0.30.1196 lazy-art - parked art (a far backdrop) is not this preload\'s', '_lxPreloadMapAssets track');
// 3) _warmMapArt: wants its own map, never waits on parked art
after('  if (!def) return Promise.resolve(0);', ['  try { _lxLazyWantMap(id, true); } catch (e) {}   // v0.30.1196 lazy-art'], '_warmMapArt head');
after('    if (_LX_WARM_SKIP && bakeKey && _LX_WARM_SKIP.test(bakeKey)) return;   // deferred to a later pass', [
  '    if (_lxParked(holder && holder[key])) return;   // v0.30.1196 lazy-art - another boss\'s parked art (king takes kingKrook by prefix): its load would never settle'],
  '_warmMapArt addImg');
// 3) the registry decode sweeps (and so the commence gate's watch) skip parked art
once('        seen.add(v); imgs.push(v); return;', J(
  "        if (typeof _lxParked === 'function' && _lxParked(v)) return;   // v0.30.1196 lazy-art - parked art is not the boot's to wait for",
  '        seen.add(v); imgs.push(v); return;'), '_warmDecodeRegistries collect');
once('  const DEFERRED = REQUIRED.filter(p => !BAZAAR_PATHS.has(p) && !CRITICAL_PATHS.has(p));',
  "  const DEFERRED = REQUIRED.filter(p => !BAZAAR_PATHS.has(p) && !CRITICAL_PATHS.has(p) && !(typeof _lxLazyBgPath === 'function' && _lxLazyBgPath(p)));   // v0.30.1196 lazy-art - a parked backdrop waits for its map",
  'the boot DEFERRED list');
// 4) a map entered within ~4 s of the last one had its veil lifted by the LAST map's gate (its cap timer and its gate both
//    call the old _fadeGo, whose release clears 'on' from the shared overlay): the new map opened before its art was ready
once('      const _fadeGo = () => { if (!_fadeDone) { _fadeDone = true; _fadeRelease(); } };', J(
  '      const _fadeGen = game._lxFadeGen = (game._lxFadeGen || 0) + 1;   // v0.30.1196 lazy-art - only the latest map entry lifts the veil',
  "      const _fadeGo = () => { if (!_fadeDone && game._lxFadeGen === _fadeGen) { _fadeDone = true; if (typeof _lxVeilBackdrop === 'function') _lxVeilBackdrop(id, _fadeGen, _fadeRelease); else _fadeRelease(); } };"), 'loadMap _fadeGo');
// 4) the map veil waits (bounded) for the boss frames and the backdrop
once(J('  const run = (async () => {', '    let t = Date.now();'), J(
  '  const run = (async () => {',
  '    let t = Date.now();',
  "    try { if (typeof _lxLazyWantMap === 'function') _lxLazyWantMap(id, true); } catch (e) {}   // v0.30.1196 lazy-art - started now, awaited below",
  "    const _lzBoss = (typeof _lxBossArtSettled === 'function') ? _lxBossArtSettled(id) : null, _lzBg = (typeof _lxBackdropSettled === 'function') ? _lxBackdropSettled(id) : null;"),
  '_lxReadyGate run head');
before('    try { if (typeof _warmMapArt === \'function\') await capped(_warmMapArt(id, opts.skip ? { skip: opts.skip } : undefined), CAP * 0.3); } catch (e) {}', [
  '    let _lzLate = !!_lzBoss;   // v0.30.1196 lazy-art - still landing when the wait below gives up',
  '    try { if (_lzBoss) await capped(_lzBoss.then(() => { _lzLate = false; }), CAP * 0.35); } catch (e) {}   // v0.30.1196 lazy-art - the boss frames land before the veil lifts',
  '    // v0.30.1196 lazy-art - art that lands after that cap (a slow link, a busy disk) is warmed again once it is all in, if the',
  '    // player is still here: _warmMapArt only takes what is still unbaked, and its size derive only what is still unmeasured',
  "    try { if (_lzLate && !opts.boot) _lzBoss.then((n) => { try { if (n && game.currentMap === id && typeof _warmMapArt === 'function') _warmMapArt(id, opts.skip ? { skip: opts.skip } : undefined); } catch (e) {} }); } catch (e) {}"],
  '_lxReadyGate warm');
before('    rec.backdrop = _lxPrimeBackdrop(id);', [
  '    try { if (_lzBg) await capped(_lzBg, CAP * 0.35); } catch (e) {}   // v0.30.1196 lazy-art - no blank sky on entry'],
  '_lxReadyGate backdrop');

const grew = s.length - n0;
if (grew < 10000 || grew > 17000) die('size moved ' + grew);
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
console.log('applied: lazy-art (+' + grew + ' chars)');
