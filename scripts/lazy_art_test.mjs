// Boss frames and far backdrops load on demand; the title waits only for itself and the start map (v0.30.x lazy-art).
//   node scripts/lazy_art_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build; PORT=<port>)
// Pre-launch audits 2026-09-26: a cold boot fetched ~400 MB before the title (every boss frame set, every backdrop, every
// fx / monster / equipment / npc sheet). Part A boots a fresh profile to the title and logs every request; part B plays:
// three arenas entered cold (their frames parked until then), twelve maps' backdrops, a portal neighbour, a summon.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '11347';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
const ORIGIN_MB = 416;   // origin 76542b3d (v0.30.1172) in this harness: 2,338 files / 416.3 MB before the title, at 22 s
// the drawn height (m._visH, world px, the most common one after the veil) of each boss in the build before lazy-art, this
// harness (1280x720, DPR 1); a change to his art or BOSS_DRAW_SCALE moves it - re-measure on the parent build then
// the drawn height (m._visH, world px) of each boss's IDLE set - its most common size, since a set can also play under
// another state's calibration - on the parent build (origin + boss-bake), this harness (1280x720, DPR 1); a change to
// his art, calib or BOSS_DRAW_SCALE moves it - re-measure on the parent build then
const ORIGIN_VIS = { king: 314, gravitos: 578, zodiac_scorpio: 302 };
// and the boss sizing derive's values (_bossRefContentH c: / _bossRefBodyH b:) on the parent build, same caveat
const ORIGIN_DERIVED = { 'c:king': 589, 'b:king': 587, 'c:gravitos': 567, 'b:gravitos': 564, 'c:gravitos2': 1118, 'b:gravitos2': 1115, 'c:gravitos3': 917, 'b:gravitos3': 905, 'c:scorpio': 786 };
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
// files the (possibly stale) working copy lacks are served from origin/main, like the font route
const MISSING = new Set();
try { for (const f of execFileSync('git', ['ls-tree', '-r', '--name-only', 'origin/main'], { cwd: ROOT, maxBuffer: 1 << 26 }).toString().split('\n')) if (f && !existsSync(path.join(ROOT, f))) MISSING.add(f); } catch (e) {}
const routes = (p) => p.route((u) => /[/]assets[/]fonts[/].*[.]woff2$/.test(u.pathname) || MISSING.has(decodeURIComponent(u.pathname).replace(/^[/]/, '')), async (r) => {
  const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
  if (existsSync(path.join(ROOT, rel))) return r.continue();
  try { r.fulfill({ status: 200, contentType: /\.woff2$/.test(rel) ? 'font/woff2' : undefined, body: execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 26 }) }); } catch (e) { r.continue(); }
});
const FRAME_RX = /^\/Sprites\/bosses\/(?:zodiac\/)?(?:idle|walk|attack|weave|duck|charge|pounce|fly)\/[^/]+_[1-9]\d*\.webp$/;   // frame 0 of an attack set doubles as the static pose
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const errs = [];
try {
  // ---- A: a cold boot (fresh profile, no cache) to the title, then 20 s on it -------------------------------------------
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' }); const p = await ctx.newPage();
    p.on('pageerror', (e) => errs.push('A ' + String(e).slice(0, 160)));
    const reqs = []; p.on('requestfinished', async (r) => { const t = Date.now(); let n = 0; try { n = (await r.sizes()).responseBodySize; } catch (e) {} reqs.push({ u: decodeURIComponent(new URL(r.url()).pathname), t, n }); });
    await routes(p);
    const t0 = Date.now();
    await p.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await p.waitForFunction(() => { const o = document.getElementById('loading-overlay'), m = document.getElementById('lo-menu'); return !!(o && o.classList.contains('menu-up') && m && m.offsetParent !== null); }, null, { timeout: 180000, polling: 100 });
    const tTitle = Date.now();
    await p.waitForTimeout(20000);
    const far = await p.evaluate(() => {   // every backdrop file but the towns', the cycle plates, main and the start map's (the void: none)
      const keep = new Set(['forest', 'valley', 'meadow', 'misty', 'dungeon', 'main', 'everdawnMegamall']);
      for (const id in MAPS) if (MAPS[id].isTown && MAPS[id].bg) keep.add(MAPS[id].bg);
      const keepP = new Set(); for (const k of keep) if (BG_IMAGES[k]) keepP.add(BG_IMAGES[k]._lxPath);
      const out = new Set(); for (const k in BG_IMAGES) { const pth = BG_IMAGES[k]._lxPath; if (pth && !keepP.has(pth)) out.add('/' + pth); }
      return [...out];
    });
    const farSet = new Set(far);
    const pre = reqs.filter((r) => r.t <= tTitle), mb = pre.reduce((s, r) => s + r.n, 0) / 1e6;
    const fr = (a) => a.filter((r) => FRAME_RX.test(r.u)).length, fb = (a) => a.filter((r) => farSet.has(r.u)).length;
    const info = { titleMs: tTitle - t0, files: pre.length, mb: +mb.toFixed(1), originMb: ORIGIN_MB, framesPre: fr(pre), framesBy20s: fr(reqs), farBgPre: fb(pre), farBgBy20s: fb(reqs), farBgFiles: far.length, allBy20sMb: +(reqs.reduce((s, r) => s + r.n, 0) / 1e6).toFixed(1) };
    console.log('cold boot: ' + JSON.stringify(info));
    check(mb <= ORIGIN_MB * 0.3, `a cold boot reaches the title having fetched at most 30% of the ${ORIGIN_MB} MB it used to`, info);
    check(info.framesPre === 0 && info.framesBy20s === 0, 'no boss animation frame is fetched before the title, nor in the 20 s spent on it', info);
    check(info.farBgPre === 0 && info.farBgBy20s === 0 && far.length > 40, `none of the ${far.length} far-map backdrops is fetched before the title, nor in the 20 s spent on it`, info);
    await ctx.close();
  }
  // ---- B: play (the harness boot recipe) ---------------------------------------------------------------------------------
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' }); const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push('B ' + String(e).slice(0, 160)));
  await routes(p);
  await p.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await p.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof _drawBossSprite === 'function' && typeof spawnMonster === 'function', null, { timeout: 150000 });
  await p.evaluate(async () => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; player.cls = 'rogue'; player.level = 70;
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true }); try { for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
    player._gravitosCineSeen = true;   // the first-entry film would pause everything; later entries keep the quake + card
    loadMap('mushroom'); await new Promise((s) => setTimeout(s, 2500)); document.getElementById('everdawn-welcome-overlay')?.remove();
    player.invulnerable = 999999; game.monsters.length = 0;
    const O = { dbs: _drawBossSprite };
    window.__veil = () => !!(game._mapFadeEl && game._mapFadeEl.classList.contains('on'));
    window.__bd = [];   // every boss draw: under the veil or not, from a frame (_lxSt) or a fallback pose, and its size
    window._drawBossSprite = function (sprite, m) { const r = O.dbs.apply(this, arguments); try { if (m && m.isBoss) { const _s0 = (sprite && sprite._lxSrc && sprite._lxSrc.src) ? sprite._lxSrc : sprite; const _set = (String((_s0 && _s0.src) || '').match(/bosses[/](.+?)_[0-9]+[.]webp/) || [])[1] || null; __bd.push({ veil: __veil(), set: _set, frame: !!(sprite && (sprite._lxSt || (sprite._lxSrc && sprite._lxSrc._lxSt))), h: m._visH, w: m._visW, t: m.type }); } } catch (e) {} return r; };
    window.__parked = (im) => (typeof _lxParked === 'function') ? _lxParked(im) : false;
    window.__frames = async (n, capMs) => { const g0 = game.time | 0, t0 = performance.now(); while ((game.time | 0) - g0 < n && performance.now() - t0 < capMs) await new Promise((r) => setTimeout(r, 50)); return (game.time | 0) - g0; };
    window.__until = async (fn, capMs) => { const t0 = performance.now(); while (performance.now() - t0 < capMs) { try { if (fn()) return true; } catch (e) {} await new Promise((r) => setTimeout(r, 100)); } return false; };
    window.__raf = () => new Promise((r) => requestAnimationFrame(r));
    // the ORIGINAL size measurement (fresh canvas, no caches) of the same frames, taken the moment a derived size is stored
    const cleanMed = (key, aMin) => {
      const set = (ZODIAC_SPRITE_TYPES.indexOf(key) >= 0) ? ZODIAC_IDLE_FRAMES[key] : BOSS_IDLE_FRAMES[key]; const hs = [];
      for (const im of (set || [])) { const s = _lxBoxSourceOf(im); if (!s.W || !s.H) continue;
        try { const cv = document.createElement('canvas'); cv.width = s.W; cv.height = s.H; const c = cv.getContext('2d', { willReadFrequently: true }); c.drawImage(s.img, 0, 0, s.W, s.H);
          const e = _lxEdgeRows(c, 0, 0, s.W, s.H, aMin); if (!e || e.top < 0 || e.bottom < e.top) continue;
          const top = (s.scale === 1) ? e.top : Math.round(e.top * s.scale), bottom = (s.scale === 1) ? e.bottom : Math.round(e.bottom * s.scale);
          if (bottom > top) hs.push(bottom - top + 1); } catch (_) {} }
      if (!hs.length) return null; hs.sort((a, b) => a - b); return hs[hs.length >> 1];
    };
    window.__sets = [];
    const hook = (map, kind, aMin) => { map.set = function (k, v) { let ref = null; try { ref = cleanMed(k, aMin); } catch (e) {} __sets.push({ kind, key: k, v, ref }); return Map.prototype.set.call(this, k, v); }; };
    hook(_bossRefContentH, 'content', 64); hook(_bossRefBodyH, 'body', 235);
  });
  // arenas entered COLD: the veil must not lift onto a fallback pose, and the size must be the one the frames give
  const arena = (map, type, sign, need) => p.evaluate(async ([map, type, sign, need]) => {
    const idle = sign ? ZODIAC_IDLE_FRAMES[sign] : BOSS_IDLE_FRAMES[type];
    const parkedBefore = (idle || []).filter(__parked).length;
    __bd.length = 0;
    loadMap(map);
    const t0 = performance.now();
    await __raf(); while (__veil() && performance.now() - t0 < 20000) await __raf();
    const veilMs = Math.round(performance.now() - t0);
    // the intro card (and Gravitos's quake beat) come and go on their own clocks; the size is read once the fight has settled
    await __until(() => game._bossIntroEls && game._bossIntroEls.overlay && game._bossIntroEls.overlay.classList.contains('on'), 5000);
    try { _dismissBossIntro(); } catch (e) {}
    // hold the boss in his idle pattern while the size is sampled: on a loaded machine his pattern clock can open an
    // attack inside the window and the sample then holds no idle draw at all (seen once: Gravitos idle null at the ship gate)
    let hold = true;
    (function keepIdle() { const b = game.monsters.find((m) => m && m.type === type); if (b) { b.patternState = 'idle'; b.patternTimer = 0; b.vx = 0; } if (hold) requestAnimationFrame(keepIdle); })();
    await __frames(60, 10000);
    await __frames(40, 8000);
    // stay until this boss's size derive (the one-frame-a-task boss-bake pass) has finished on his own map
    const derived = await __until(() => need.every(([kind, key]) => (kind === 'body' ? _bossRefBodyH : _bossRefContentH).get(key) != null), 90000);
    hold = false;
    const post = __bd.filter((d) => !d.veil && d.t === type);
    const bySet = {}; for (const d of post) if (d.frame && d.set) { const b = (bySet[d.set] = bySet[d.set] || {}); b[d.h] = (b[d.h] || 0) + 1; }
    const sizes = {}; for (const k in bySet) sizes[k] = +Object.keys(bySet[k]).sort((a, b) => bySet[k][b] - bySet[k][a])[0];   // each set's most common size
    const idleKey = sign ? ('zodiac/idle/' + sign) : ('idle/' + type);
    return { map, parkedBefore, veilMs, draws: post.length, firstIsFrame: post.length ? post[0].frame : null, fallbackDraws: post.filter((d) => !d.frame).length, sizes, idle: (sizes[idleKey] != null) ? sizes[idleKey] : null, derived };
  }, [map, type, sign, need]);
  const BOSSES = [['slimeCave', 'king', null, [['content', 'king'], ['body', 'king']]],
    ['gravitosArena', 'gravitos', null, [['content', 'gravitos'], ['body', 'gravitos'], ['content', 'gravitos2'], ['body', 'gravitos2'], ['content', 'gravitos3'], ['body', 'gravitos3']]],
    ['zod_scorpio', 'zodiac_scorpio', 'scorpio', [['content', 'scorpio']]]];
  const cold = {};
  for (const [map, type, sign, need] of BOSSES) {
    const r = cold[type] = await arena(map, type, sign, need);
    console.log('cold ' + type + ': ' + JSON.stringify(r));
    check(r.draws > 0 && r.firstIsFrame === true && r.fallbackDraws === 0,
      `${type}: from the first frame the veil lifts he is drawn from his own animation frames, never a fallback pose (${r.parkedBefore} idle frames were parked before entry)`, r);
  }
  // a map with a portal to an arena asks for that arena's boss art and backdrop (3 s after entry)
  const nb = await p.evaluate(async () => {
    const krook = () => (BOSS_IDLE_FRAMES.kingKrook || []), bg = () => BG_IMAGES[MAPS.krookThrone.bg];
    const before = { frames: krook().filter(__parked).length, bg: __parked(bg()) };
    loadMap('sauroSlope');
    const ok = await __until(() => krook().length > 0 && krook().every((im) => !__parked(im) && im.complete && im.naturalWidth > 0) && bg()._loaded, 30000);
    return { before, ok, after: { frames: krook().filter(__parked).length, bg: __parked(bg()) } };
  });
  check(nb.ok, "next door to King Krook's hall, his frames and the hall's backdrop arrive before the player walks in", nb);
  // a boss summoned on a field map asks for its own art, and is drawn from its frames once they land
  const sm = await p.evaluate(async () => {
    loadMap('forest'); await __frames(30, 8000);
    const idle = () => (BOSS_IDLE_FRAMES.mooma || []);
    const before = idle().filter(__parked).length;
    game.monsters.length = 0; __bd.length = 0;
    spawnMonster(player.x + 260, player.y - 40, 'mooma', true);
    const loaded = await __until(() => idle().length > 0 && idle().every((im) => im.complete && im.naturalWidth > 0), 30000);
    __bd.length = 0; await __frames(40, 8000);
    const d = __bd.filter((x) => x.t === 'mooma');
    game.monsters.length = 0;
    return { before, loaded, draws: d.length, frames: d.filter((x) => x.frame).length };
  });
  check(sm.loaded && sm.draws > 0 && sm.frames === sm.draws, 'Mooma summoned on a field map asks for her art, and draws from her frames once it lands', sm);
  // twelve maps across the level range: the backdrop is there when the veil lifts
  // twelve field maps with a backdrop of their own, evenly spaced over the level range (by levelReq), skipping the entry
  // map's portal neighbours so most are entered cold
  const MAPS12 = await p.evaluate(() => {
    const keep = new Set(['forest', 'valley', 'meadow', 'misty', 'dungeon', 'main', 'everdawnMegamall']), seenBg = new Set();
    const c = Object.keys(MAPS).filter((id) => { const md = MAPS[id]; return md.bg && BG_IMAGES[md.bg] && !keep.has(md.bg) && !md.isTown && !md.isBossArena && !/^tower/.test(id) && (md.spawns || []).length; })
      .map((id) => [id, MAPS[id].levelReq || Math.max(0, ...(MAPS[id].spawns || []).map((sp) => (monsterTypes[sp.type] && monsterTypes[sp.type].level) || 0))]).sort((a, b) => (a[1] - b[1]) || (a[0] < b[0] ? -1 : 1)).map((x) => x[0]).filter((id) => !seenBg.has(MAPS[id].bg) && seenBg.add(MAPS[id].bg));
    const out = []; for (let k = 0; k < 12 && c.length; k++) { const id = c[Math.round(k * (c.length - 1) / 11)]; if (out.indexOf(id) < 0) out.push(id); }
    return out;
  });
  const bgs = [];
  for (const id of MAPS12) {
    bgs.push(await p.evaluate(async (id) => {
      const md = MAPS[id], im = BG_IMAGES[md.bg], cold = __parked(im);
      loadMap(id);
      const t0 = performance.now();
      await __raf(); while (__veil() && performance.now() - t0 < 20000) await __raf();
      const veilMs = Math.round(performance.now() - t0);
      let after = 0; while (!(im._loaded && im.naturalWidth > 0) && after < 240) { await __raf(); after++; }
      const log = (window._lxReadyGateLog || []).filter((r) => r.id === id).pop();
      const lv = md.levelReq || Math.max(0, ...(md.spawns || []).map((sp) => (monsterTypes[sp.type] && monsterTypes[sp.type].level) || 0));
      return { id, lv, cold, veilMs, framesAfterVeil: after, primed: !!(log && log.backdrop) };
    }, id));
  }
  console.log('backdrops: ' + bgs.map((b) => `${b.id}(L${b.lv}${b.cold ? ', cold' : ''}) veil ${b.veilMs} ms +${b.framesAfterVeil}f`).join(' | '));
  const lazyBuild = await p.evaluate(() => typeof _lxParked === 'function');
  const bgBad = bgs.filter((b) => b.framesAfterVeil > 2 || b.veilMs > 8000);
  check(!bgBad.length && (!lazyBuild || bgs.filter((b) => b.cold).length >= 8), `12 maps (Lv ${Math.min(...bgs.map((b) => b.lv))}-${Math.max(...bgs.map((b) => b.lv))}) show their backdrop within 2 frames of the veil lifting (${bgs.filter((b) => b.cold).length} entered cold)`, bgBad.length ? bgBad : bgs);
  // warm re-entry: the size a boss is drawn at does not depend on how his art arrived
  const warm = {};
  for (const [map, type, sign, need] of BOSSES) warm[type] = await arena(map, type, sign, need);
  const sz = BOSSES.map(([, t]) => `${t} ${cold[t].idle}/${warm[t].idle}`).join(', ');
  console.log('BOSSSETS ' + BOSSES.map(([, t]) => `${t} ${JSON.stringify(cold[t].sizes)} / ${JSON.stringify(warm[t].sizes)}`).join(', '));
  console.log('BOSSVIS ' + sz);
  // every state seen, cold or warm, is drawn at the size the build before the change drew it in; at least one state per boss
  const visOk = (t) => cold[t].idle != null && cold[t].idle === ORIGIN_VIS[t] && warm[t].idle === ORIGIN_VIS[t];
  check(BOSSES.every(([, t]) => visOk(t)),
    `each boss is drawn at the size the build before the change drew him, idle, entered cold and warm (${sz}; before: ${BOSSES.map(([, t]) => ORIGIN_VIS[t]).join(', ')})`, { cold, warm, before: ORIGIN_VIS });
  // the sizing derive (the boss-bake pass) ran on frames that had arrived, and matches the original measurement
  const v = await p.evaluate(() => __sets.map((x) => ({ kind: x.kind, key: x.key, v: x.v, ref: x.ref })));
  const need = [['content', 'king'], ['body', 'king'], ['content', 'gravitos'], ['body', 'gravitos'], ['content', 'gravitos2'], ['content', 'gravitos3'], ['content', 'scorpio']];
  const miss = need.filter(([k, key]) => !v.some((x) => x.kind === k && x.key === key)).map((x) => x.join(':'));
  const wrong = v.filter((x) => x.v !== x.ref || x.v == null || (ORIGIN_DERIVED[x.kind[0] + ':' + x.key] != null && ORIGIN_DERIVED[x.kind[0] + ':' + x.key] !== x.v));
  console.log('SIZES ' + v.filter((x) => /^(king|gravitos|scorpio)/.test(x.key)).map((x) => x.kind[0] + ':' + x.key + '=' + x.v).join(' '));
  check(!miss.length && !wrong.length, 'the derived boss sizes (King Gloopaloo, Gravitos x3, Scorpio) equal the parent build\'s and a clean-room measurement of the arrived frames', { miss, wrong: wrong.slice(0, 4) });
  await ctx.close();
} finally { await browser.close().catch(() => {}); srv.kill(); }
check(errs.length === 0, 'no page errors', errs.slice(0, 3));
console.log(bad ? `\n${bad} of ${total} FAILED` : `\nall ${total} passed`);
process.exit(bad ? 1 : 0);
