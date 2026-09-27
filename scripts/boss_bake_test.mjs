// Boss art measuring stays off the hot path (v0.30.x boss-bake).
//   node scripts/boss_bake_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build; PORT=<port>)
// Perf audit 2026-09-26: (1) the boss-sizing pre-derive ran as ONE synchronous loop (every Gravitos form x 9 idle frames
// x 2 scans) and, behind a held bake pump, landed as a ~4.9 s freeze on the NEXT map; (3) the boss card's art scan ran
// inside loadMap with a synchronous full-size decode. Deterministic checks (no fps, no wall-clock windows): scans are
// tagged with a macrotask id (a MessageChannel ping-pong bumps it between tasks) and with the loadMap call they ran in.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '11341';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
// files the (possibly stale) working copy lacks are served from origin/main, like the font route
const MISSING = new Set();
try { for (const f of execFileSync('git', ['ls-tree', '-r', '--name-only', 'origin/main'], { cwd: ROOT, maxBuffer: 1 << 26 }).toString().split('\n')) if (f && !existsSync(path.join(ROOT, f))) MISSING.add(f); } catch (e) {}
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await p.route((u) => /[/]assets[/]fonts[/].*[.]woff2$/.test(u.pathname) || MISSING.has(decodeURIComponent(u.pathname).replace(/^[/]/, '')), async (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
    if (existsSync(path.join(ROOT, rel))) return r.continue();
    try { r.fulfill({ status: 200, contentType: /\.woff2$/.test(rel) ? 'font/woff2' : undefined, body: execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 26 }) }); } catch (e) { r.continue(); }
  });
  await p.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await p.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof _warmMapArt === 'function' && typeof _deriveBossRefHeight === 'function' && typeof _lxBiScan === 'function', null, { timeout: 150000 });
  await p.evaluate(async () => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; player.cls = 'rogue'; player.level = 70;
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true }); try { for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
    player._gravitosCineSeen = true;   // the first-entry film would pause everything; later entries keep the quake + card
    loadMap('mushroom'); await new Promise((s) => setTimeout(s, 2500)); document.getElementById('everdawn-welcome-overlay')?.remove();
    player.invulnerable = 999999; game.monsters.length = 0;
    // ---- probes ------------------------------------------------------------------------------------------------
    const O = { bso: _lxBoxSourceOf, er: _lxEdgeRows, drh: _deriveBossRefHeight, drb: _deriveBossRefBodyH, scan: _lxBiScan, lm: loadMap, wma: _warmMapArt };
    const R = window.__rec = { watch: false, scans: [], inside: [], bi: [], sets: [], warmP: {} };
    let tick = 0, tickOn = false, inRef = false, depth = 0, inLM = 0, nScan = 0;
    const ch = new MessageChannel(); ch.port1.onmessage = () => { tick++; if (tickOn) ch.port2.postMessage(0); };
    window.__tickStart = () => { if (!tickOn) { tickOn = true; ch.port2.postMessage(0); } };
    window.__tickStop = () => { tickOn = false; };
    const ids = new WeakMap(); let nid = 0; const idOf = (o) => { if (!ids.has(o)) ids.set(o, ++nid); return ids.get(o); };
    const gravKey = (img) => { for (const k of Object.keys(BOSS_IDLE_FRAMES)) if (k.indexOf('gravitos') === 0 && BOSS_IDLE_FRAMES[k].indexOf(img) >= 0) return k; return null; };
    window._lxBoxSourceOf = function (img) {
      const r = O.bso.apply(this, arguments);
      if (!inRef && r && r.W && r.H) { nScan++; if (R.watch) { const k = gravKey(img); if (k) R.scans.push({ tick, id: idOf(img), k, map: game.currentMap }); } }
      return r;
    };
    const wrapDerive = (fn) => function () { const n0 = nScan; depth++; try { return fn.apply(this, arguments); } finally { depth--; R.inside.push({ key: arguments[0], n: nScan - n0 }); } };
    window._deriveBossRefHeight = wrapDerive(O.drh); window._deriveBossRefBodyH = wrapDerive(O.drb);
    window._lxBiScan = function () { R.bi.push({ inLM: inLM > 0, map: game.currentMap }); return O.scan.apply(this, arguments); };
    window.loadMap = function () { inLM++; try { return O.lm.apply(this, arguments); } finally { inLM--; } };
    window._warmMapArt = function (id) { const pr = O.wma.apply(this, arguments); (R.warmP[id] = R.warmP[id] || []).push(Promise.resolve(pr)); return pr; };
    // the ORIGINAL measurement, clean-room (fresh canvas per scan, no caches), run the moment a size is recorded
    const cleanBox = (img, aMin) => {
      const s = O.bso(img); if (!s.W || !s.H) return null;
      try { const cv = document.createElement('canvas'); cv.width = s.W; cv.height = s.H; const c = cv.getContext('2d', { willReadFrequently: true }); c.drawImage(s.img, 0, 0, s.W, s.H);
        const e = O.er(c, 0, 0, s.W, s.H, aMin); const top = e ? e.top : -1, bottom = e ? e.bottom : -1;
        if (top >= 0 && bottom >= top) return (s.scale === 1) ? { top, bottom } : { top: Math.round(top * s.scale), bottom: Math.round(bottom * s.scale) };
      } catch (_) {} return null;
    };
    const cleanMed = (key, aMin) => {
      const set = (ZODIAC_SPRITE_TYPES.indexOf(key) >= 0) ? ZODIAC_IDLE_FRAMES[key] : BOSS_IDLE_FRAMES[key]; const hs = [];
      for (const im of (set || [])) { const b = cleanBox(im, aMin); if (b && b.bottom > b.top) hs.push(b.bottom - b.top + 1); }
      if (!hs.length) return null; hs.sort((a, b) => a - b); return hs[hs.length >> 1];
    };
    const hookSet = (map, kind, aMin) => { map.set = function (k, v) { inRef = true; let ref = null; try { ref = cleanMed(k, aMin); } catch (e) {} inRef = false; R.sets.push({ kind, key: k, v, ref, map: game.currentMap }); return Map.prototype.set.call(this, k, v); }; };
    hookSet(_bossRefContentH, 'content', 64); hookSet(_bossRefBodyH, 'body', 235);
    window.__frames = async (n, capMs) => { const g0 = game.time | 0, t0 = performance.now(); while ((game.time | 0) - g0 < n && performance.now() - t0 < capMs) await new Promise((r) => setTimeout(r, 50)); return (game.time | 0) - g0; };
    window.__until = async (fn, capMs) => { const t0 = performance.now(); while (performance.now() - t0 < capMs) { try { if (fn()) return true; } catch (e) {} await new Promise((r) => setTimeout(r, 100)); } return false; };
  });
  // the art these checks use is on the page before the first arena (the origin build loads every boss at boot)
  const art = await p.evaluate(() => __until(() => BOSS_SPRITES.kingKrook && BOSS_SPRITES.kingKrook.complete && BOSS_SPRITES.gravitos
    && Object.keys(BOSS_IDLE_FRAMES).filter((k) => k.indexOf('gravitos') === 0).every((k) => BOSS_IDLE_FRAMES[k].every((i) => i.complete))
    && (ZODIAC_IDLE_FRAMES.scorpio || []).every((i) => i.complete), 150000));
  console.log('boss art on the page before the first arena: ' + art);
  // (3) the card's art box: King Krook's first entry, then a zodiac sign (its idle frame is a baked canvas -> _lxSrc)
  const card = (map, re) => p.evaluate(async ([map, re]) => {
    __rec.bi.length = 0;
    loadMap(map);
    const E = () => game._bossIntroEls;
    const on = await __until(() => E() && E().overlay && E().overlay.classList.contains('on'), 40000);
    const laid = await __until(() => E().biArt && E().biArt.classList.contains('bi-in'), 15000);
    const o = E() && E().overlay, src = (E() && E().biImg && E().biImg.getAttribute('src')) || '';
    const r = { on, laid, noart: !!(o && o.classList.contains('bi-noart')), art: new RegExp(re, 'i').test(src), src: src.slice(-48), cropW: (E() && E().biCrop && E().biCrop.style.width) || '', bi: __rec.bi.slice(0, 6) };
    try { _dismissBossIntro(); } catch (e) {}
    return r;
  }, [map, re]);
  const kb = await card('krookThrone', 'kingKrook');
  check(kb.bi.length > 0 && kb.bi.every((b) => !b.inLM), "the boss card's art scan does not run inside loadMap (King Krook's first entry)", kb.bi);
  check(kb.on && kb.laid && !kb.noart && kb.art && !!kb.cropW, "King Krook's intro card shows, his art cropped and laid out", kb);
  const kd = await p.evaluate(() => __until(() => _bossRefContentH.get('kingKrook') != null && _bossRefBodyH.get('kingKrook') != null, 90000));
  const sc = await card('zod_scorpio', 'scorpio');
  check(sc.on && sc.laid && !sc.noart && sc.art && !!sc.cropW && sc.bi.every((b) => !b.inLM), "Scorpio's intro card shows, the sign's art cropped and laid out (scan outside loadMap)", sc);
  const sd = await p.evaluate(() => __until(() => _bossRefContentH.get('scorpio') != null, 90000));
  // (1) a fight whose bake pump is held (as under a blackout / the entry film), then the player leaves for the forest
  const a1 = await p.evaluate(async () => {
    window.__budget0 = _lxBakeBudget; window._lxBakeBudget = () => 0;
    __rec.warmP.gravitosArena = [];
    loadMap('gravitosArena');
    const warmed = await __until(() => (__rec.warmP.gravitosArena || []).length > 0, 30000);
    const f = await __frames(60, 20000);
    const spawned = game.monsters.some((m) => m && /^gravitos/.test(m.type || ''));
    try { _dismissBossIntro(); } catch (e) {}
    loadMap('forest');
    await __frames(30, 15000);
    __rec.scans.length = 0; __rec.inside.length = 0; __rec.watch = true; __tickStart();
    window._lxBakeBudget = window.__budget0;   // the pump resumes - on the forest
    const t0 = performance.now();
    const settled = await Promise.race([Promise.allSettled(__rec.warmP.gravitosArena).then(() => true), new Promise((r) => setTimeout(() => r(false), 150000))]);
    const ms = Math.round(performance.now() - t0);
    await __frames(30, 15000);
    __tickStop(); __rec.watch = false;
    const per = {}; for (const s of __rec.scans) (per[s.tick] = per[s.tick] || new Set()).add(s.id);
    let maxPer = 0; for (const t in per) maxPer = Math.max(maxPer, per[t].size);
    const inside = __rec.inside.filter((x) => /^gravitos/.test(String(x.key)));
    return { warmed, f, spawned, settled, ms, map: game.currentMap, scans: __rec.scans.length, onForest: __rec.scans.filter((s) => s.map === 'forest').length, maxPer, maxInside: inside.reduce((a, x) => Math.max(a, x.n), 0), derivedHere: [..._bossRefContentH.keys()].filter((k) => /^gravitos/.test(k)) };
  });
  console.log('late-pump run: ' + JSON.stringify(a1));
  check(a1.settled && a1.maxPer <= 1, 'after leaving the Gravitos arena, at most one Gravitos frame is measured per task', a1);
  check(a1.settled && a1.maxInside <= 1, 'no size-derive call runs a stack of frame scans by itself', a1);
  check(a1.settled && a1.onForest === 0, "none of Gravitos's backlog is measured on the forest (it waits for his own map)", a1);
  // back in his arena: the derive finishes there, one frame per task
  const c1 = await p.evaluate(async () => {
    __rec.scans.length = 0; __rec.watch = true; __tickStart();
    loadMap('gravitosArena');
    const keys = () => Object.keys(BOSS_SPRITES).filter((k) => k.indexOf('gravitos') === 0 && (BOSS_IDLE_FRAMES[k] || []).length);
    const ok = await __until(() => { const ks = keys(); return ks.length > 0 && ks.every((k) => _bossRefContentH.get(k) != null && _bossRefBodyH.get(k) != null); }, 150000);
    __tickStop(); __rec.watch = false;
    const per = {}; for (const s of __rec.scans) (per[s.tick] = per[s.tick] || new Set()).add(s.id);
    let maxPer = 0; for (const t in per) maxPer = Math.max(maxPer, per[t].size);
    return { ok, keys: keys(), map: game.currentMap, scans: __rec.scans.length, maxPer };
  });
  check(c1.ok && c1.map === 'gravitosArena' && c1.maxPer <= 1, 'on his own map every Gravitos form gets its sizes, one frame per task', c1);
  // the sizes themselves: each recorded value against the ORIGINAL measurement of the same frames at that moment
  const v = await p.evaluate(() => __rec.sets.map((s) => ({ kind: s.kind, key: s.key, v: s.v, ref: s.ref })));
  const need = [['content', 'kingKrook'], ['body', 'kingKrook'], ['content', 'scorpio']];
  for (const k of c1.keys) need.push(['content', k], ['body', k]);
  const miss = need.filter(([kind, key]) => !v.some((s) => s.kind === kind && s.key === key)).map((x) => x.join(':'));
  const wrong = v.filter((s) => s.v !== s.ref);
  console.log('SIZES ' + v.filter((s) => /^(gravitos|kingKrook|scorpio)/.test(s.key)).map((s) => s.kind[0] + ':' + s.key + '=' + s.v).join(' '));
  check(kd && sd && !miss.length && !wrong.length, `derived sizes equal the original measurement (Gravitos x${c1.keys.length} forms, King Krook, Scorpio)`, { kd, sd, miss, wrong: wrong.slice(0, 4) });
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
  await ctx.close();
} finally { await browser.close().catch(() => {}); srv.kill(); }
console.log(bad ? `\n${bad} of ${total} FAILED` : `\nall ${total} passed`);
process.exit(bad ? 1 : 0);
