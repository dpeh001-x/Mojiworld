// Skill effects, projectiles, summons and gear icons load for the character and the map in play (v0.30.x lazy-fx).
//   node scripts/lazy_fx_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build; PORT=<port>)
// Pre-launch audits 2026-09-26 (asset #2, perf #2), third part of lazy-art: with boss frames, backdrops and map art lazy,
// ~60 MB still streamed in right behind the title (every skill effect, gear icon, projectile, summon and boon icon) and
// the world streamer then asked for every projectile / effect / summon animation set. Part A boots a fresh profile to the
// title and logs every request for 20 s. Part B plays: the streamer's reach; three classes at a job, every skill on the bar
// cast for the FIRST time with the effect / projectile / summon ready checks wrapped (a check that finds its sprite not
// loaded is the draw falling back); monster shots on five maps entered cold; gear icons in the inventory and the shop.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '11435';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
// origin a49d6aa7 (v0.30.1230: lazy-art + lazy-art2 on it), this harness: title + 20 s = 1,099 files / 171.3 MB
const O_FILES = 1099, O_MB = 171.3;
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
// files the (possibly stale) working copy lacks are served from origin/main, like the font route
const MISSING = new Set();
try { for (const f of execFileSync('git', ['ls-tree', '-r', '--name-only', 'origin/main'], { cwd: ROOT, maxBuffer: 1 << 26 }).toString().split('\n')) if (f && !existsSync(path.join(ROOT, f))) MISSING.add(f); } catch (e) {}
const routes = (p) => p.route((u) => /[/]assets[/]fonts[/].*[.]woff2$/.test(u.pathname) || MISSING.has(decodeURIComponent(u.pathname).replace(/^[/]/, '')), async (r) => {
  const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
  if (existsSync(path.join(ROOT, rel))) return r.continue();
  try { r.fulfill({ status: 200, contentType: /\.woff2$/.test(rel) ? 'font/woff2' : undefined, body: execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 26 }) }); } catch (e) { r.continue(); }
});
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
    // how many distinct files each folder's registries name (what "wholesale" would fetch)
    const reg = await p.evaluate(() => {
      const path = (im) => { try { return decodeURIComponent(new URL(im.src, location.href).pathname); } catch (e) { return null; } };
      const set = (objs) => { const s = new Set(); for (const o of objs) for (const k in o) { const im = o[k]; if (im && im.tagName === 'IMG') { const q = path(im); if (q) s.add(q.replace(/\.png$/, '.webp')); } } return s.size; };
      return { fx: set([LX_FX]), proj: set([LX_MOB_PROJ, LX_PLAYER_PROJ, LX_BULT_PROJ]), gear: set([LX_ITEMS]), summons: set([LX_SUMMON]), boons: POWERUPS.length, cls: (typeof player !== 'undefined' && player) ? player.cls || null : null };
    });
    const pre = reqs.filter((r) => r.t <= tTitle), sum = (a) => a.reduce((s, r) => s + r.n, 0) / 1e6;
    const n = (rx) => new Set(reqs.filter((r) => rx.test(r.u)).map((r) => r.u.replace(/\.png$/, '.webp'))).size;
    const got = { fx: n(/^\/Sprites\/fx\/[^/]+$/), proj: n(/^\/Sprites\/projectiles\/[^/]+$/), gear: n(/^\/Sprites\/(?:equipment|items)\//), summons: n(/^\/Sprites\/summons\/[^/]+$/), boons: n(/^\/Sprites\/boons\//),
      animSets: new Set(reqs.filter((r) => /^\/Sprites\/(?:fx|projectiles|summons)\/anim\//.test(r.u)).map((r) => r.u.replace(/_\d+\.webp$/, ''))).size };
    const mb = (rx) => +sum(reqs.filter((r) => rx.test(r.u))).toFixed(1);
    const info = { titleMs: tTitle - t0, preFiles: pre.length, preMb: +sum(pre).toFixed(1), files: reqs.length, mb: +sum(reqs).toFixed(1), oFiles: O_FILES, oMb: O_MB, got, of: reg,
      folderMb: { fx: mb(/^\/Sprites\/fx\//), proj: mb(/^\/Sprites\/projectiles\//), gear: mb(/^\/Sprites\/(?:equipment|items)\//), summons: mb(/^\/Sprites\/summons\//), boons: mb(/^\/Sprites\/boons\//) } };
    console.log('cold boot: ' + JSON.stringify(info));
    console.log(`BYTES title+20s: ${info.files} files / ${info.mb} MB  (origin: ${O_FILES} / ${O_MB} MB)  |  before the title: ${info.preFiles} / ${info.preMb} MB at ${info.titleMs} ms`);
    console.log(`FOLDERS title+20s (fetched / named): fx ${got.fx}/${reg.fx} (${info.folderMb.fx} MB), projectiles ${got.proj}/${reg.proj} (${info.folderMb.proj} MB), equipment+items ${got.gear}/${reg.gear} (${info.folderMb.gear} MB), summons ${got.summons}/${reg.summons}, boons ${got.boons}/${reg.boons}; anim sets ${got.animSets}`);
    check(info.mb <= O_MB * 0.8 && info.files <= O_FILES * 0.8, `title + 20 s fetches at most 80% of the bytes and files it did before (${info.mb} MB / ${info.files} files vs ${O_MB} / ${O_FILES})`, info);
    check(got.fx <= reg.fx * 0.25 && got.proj <= reg.proj * 0.2 && got.gear <= reg.gear * 0.15 && got.summons <= reg.summons * 0.25 && got.boons <= reg.boons * 0.25,
      `effects, projectiles, gear icons, summons and boon icons are no longer fetched wholesale by title + 20 s (fx ${got.fx}/${reg.fx}, projectiles ${got.proj}/${reg.proj}, gear ${got.gear}/${reg.gear}, summons ${got.summons}/${reg.summons}, boons ${got.boons}/${reg.boons})`, info);
    check(info.preMb <= 75, `the title still comes after at most 75 MB (${info.preMb} MB, ${info.titleMs} ms)`, info);
    await ctx.close();
  }
  // ---- B: play (the harness boot recipe) ---------------------------------------------------------------------------------
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' }); const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push('B ' + String(e).slice(0, 160)));
  // in-flight effect / projectile / summon / gear requests (the "prefetch has settled" wait)
  const busy = new Set(); const ART = /\/Sprites\/(?:fx|projectiles|summons|equipment|items)\//;
  p.on('request', (r) => { if (ART.test(r.url())) busy.add(r); });
  p.on('requestfinished', (r) => busy.delete(r)); p.on('requestfailed', (r) => busy.delete(r));
  const quiet = async (ms, cap) => { const t0 = Date.now(); let q0 = Date.now(); while (Date.now() - t0 < cap) { if (busy.size) q0 = Date.now(); else if (Date.now() - q0 >= ms) return Date.now() - t0; await new Promise((r) => setTimeout(r, 100)); } return -1; };
  await routes(p);
  await p.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await p.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof castSkill === 'function' && typeof fireMonsterProjectile === 'function' && typeof renderInventory === 'function' && typeof _lxStreamWorld === 'function', null, { timeout: 150000 });
  await p.evaluate(async () => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    // the first class is the saved character's: set before the hold lets go, so its art is the post-title prefetch
    player.cls = 'rogue'; player.job = 'ninja'; player.master = null;
    window._lxBootGateDone = true; window._prologueActive = false; player.level = 45;
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true }); try { for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
    player._gravitosCineSeen = true;
    loadMap('mushroom'); await new Promise((s) => setTimeout(s, 2500)); document.getElementById('everdawn-welcome-overlay')?.remove();
    player.invulnerable = 999999;
    window.__veil = () => !!(game._mapFadeEl && game._mapFadeEl.classList.contains('on'));
    window.__frames = async (n, capMs) => { const g0 = game.time | 0, t0 = performance.now(); while ((game.time | 0) - g0 < n && performance.now() - t0 < capMs) await new Promise((r) => setTimeout(r, 50)); return (game.time | 0) - g0; };
    window.__until = async (fn, capMs) => { const t0 = performance.now(); while (performance.now() - t0 < capMs) { try { if (fn()) return true; } catch (e) {} await new Promise((r) => setTimeout(r, 100)); } return false; };
    window.__raf = () => new Promise((r) => requestAnimationFrame(r));
    window.__lazy = (typeof _lxFxWant === 'function');
    window.__parked = (im) => !!(im && im._lxLazy === true && !im._lxWanted && im._lxHeldSrc != null);
    // every registry sprite by tag, and the draws that FALL BACK: a ready check (the draw's own gate) on a sprite that
    // has not loaded, or an animation loop that has no frame yet (the draw then takes the static sprite)
    const T = window.__T = new Map();
    const regs = { fx: LX_FX, pp: LX_PLAYER_PROJ, bp: LX_BULT_PROJ, sm: LX_SUMMON, mp: LX_MOB_PROJ, mc: LX_MOB_CAST };
    for (const [pre, o] of Object.entries(regs)) for (const k of Object.keys(o)) { const im = o[k]; if (im && im.tagName === 'IMG') T.set(im, pre + ':' + k); }
    window.__fb = null; window.__seen = null;
    const rec = (tag, ok) => { if (!window.__fb || !tag) return; __seen.add(tag); if (!ok) __fb.set(tag, (__fb.get(tag) | 0) + 1); };
    for (const fn of ['_lxFxReady', '_lxPlayerProjReady', '_lxMobProjReady', '_lxSummonReady', '_lxMobCastReady']) {
      // a file that is not there at all (complete, no pixels, not parked) is the art's gap, not a load that came late
      const o = window[fn]; window[fn] = function (img) { const r = o.apply(this, arguments); rec(img && T.get(img), r || !!(img && img._lxHeldSrc == null && img.complete && !(img.naturalWidth > 0))); return r; };
    }
    const fa = window._fxAnimFrames; window._fxAnimFrames = function (k) { const a = fa.apply(this, arguments); if (a) for (const im of a) if (im && im.tagName === 'IMG' && !T.has(im)) T.set(im, 'fa:' + k); return a; };
    // (a set being REQUESTED - the lazy-fx queue calls the same loaders to start one - is not a draw)
    window.__asking = false;
    if (typeof window._lxFxAnimGo === 'function') { const go = window._lxFxAnimGo; window._lxFxAnimGo = function () { window.__asking = true; try { return go.apply(this, arguments); } finally { window.__asking = false; } }; }
    const pa = window._projAnimFrame; window._projAnimFrame = function (k) { const r = pa.apply(this, arguments); if (window.__fb && !window.__asking && _PROJ_ANIM_KEYS.has(k) && (PROJ_ANIM_FRAMES[k] || []).length) rec('pa:' + k, !!r); return r; };
    const sa = window._summonAnimFrame; window._summonAnimFrame = function (k, st) { const r = sa.apply(this, arguments); if (window.__fb && !window.__asking && k && st && (SUMMON_ANIM_FRAMES[k + '_' + st] || []).length) rec('sa:' + k, !!r); return r; };
  });
  // the world streamer (it starts 8 s after the world opens; run here with its map sweep stubbed): does its phase 1 still
  // ask for every projectile / effect / summon animation set? 15 s with no monster about (three sets a beat when calm)
  const st = await p.evaluate(async () => {
    const O = { w: window._lxWarmMap, m: window._lxStreamMonWorld }; window._lxWarmMap = () => Promise.resolve(0); window._lxStreamMonWorld = () => {};
    window._lxWorldStreamed = false; game.monsters.length = 0; _lxStreamWorld();
    const t0 = performance.now(); while (performance.now() - t0 < 15000) { game.monsters.length = 0; await new Promise((r) => setTimeout(r, 250)); }
    window._lxWarmMap = O.w; window._lxStreamMonWorld = O.m;
    return { proj: Object.keys(PROJ_ANIM_FRAMES).length, projKeys: _PROJ_ANIM_KEYS.size, fx: Object.keys(FX_ANIM_FRAMES).length, fxKeys: _FX_ANIM_KEYS.size,
    summons: Object.keys(SUMMON_ANIM_FRAMES).filter((k) => (SUMMON_ANIM_FRAMES[k] || []).length).length, streamed: !!window._lxWorldStreamed };
  });
  console.log('streamer: ' + JSON.stringify(st));
  check(st.streamed && st.proj <= st.projKeys * 0.4 && st.fx <= st.fxKeys * 0.4, `the world streamer no longer asks for every animation set (projectile ${st.proj}/${st.projKeys}, effect ${st.fx}/${st.fxKeys}, summon sets ${st.summons})`, st);
  // three classes at a job: every skill on the bar cast for the FIRST time, its effects / projectiles / summons drawn from
  // loaded sprites and frames (no ready check falls back). The first class is the one the title prefetched; the other two
  // are job / class changes in play (the change is the ask). Pinned dummies to hit, as the skill sweeps do.
  const CLASSES = [['rogue', 'ninja'], ['mage', 'archmage'], ['archer', 'ranger']];
  const casts = [];
  for (let ci = 0; ci < CLASSES.length; ci++) {
    const [cls, job] = CLASSES[ci];
    const parkedBefore = await p.evaluate(([cls, job, first]) => {
      if (!first) { player.cls = cls; player.job = job; player.master = null; }
      if (typeof _lxFxClassTags !== 'function') return null;
      return _lxFxClassTags().filter((t) => __parked(_lxFxImg(t))).length;
    }, [cls, job, ci === 0]);
    const settle = await quiet(3000, 60000);
    const r = await p.evaluate(async ([cls, job]) => {
      const W = window, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const ids = Object.keys(SKILLS).filter((id) => { const s = SKILLS[id]; return s.cls === cls && s.slot && !s.master && (!s.job || s.job === job); });
      const realMax = W.getMaxMp; W.getMaxMp = () => 1e6;
      if (!W.__home) W.__home = { x: player.x, y: player.y };
      const clear = () => { (player._pendingTimeouts || []).forEach((t) => clearTimeout(t)); player._pendingTimeouts = [];
        for (const k of ['projectiles', 'hazards', 'smoothFx', 'particles']) if (Array.isArray(game[k])) game[k].length = 0; game.monsters.length = 0; };
      const mine = (t) => /^(?:fx|fa|pp|bp|sm|sa):/.test(t) || (/^pa:/.test(t) && !Object.prototype.hasOwnProperty.call(LX_MOB_PROJ, t.slice(3)));
      const out = [];
      for (const id of ids) {
        clear();
        player.x = __home.x; player.y = __home.y; player.vx = 0; player.vy = 0; player.facing = 1; player._god = true; player.invulnerable = 999999;
        player.mp = 1e6; player.skillCooldowns = {}; player._skillLockTimer = 0;
        player.skillRanks = player.skillRanks || {}; player.skillRanks[id] = Math.max(1, player.skillRanks[id] | 0);
        const pcx = __home.x + player.w / 2, feet = __home.y + player.h, foes = [];
        game._tutorialSpawn = true;
        for (const [dx, dy] of [[70, 0], [200, 0], [420, 0], [-150, 0], [90, -170]]) { const m = spawnMonster(pcx + dx - 21, feet - 47 + dy, 'slime'); if (m) { m.currentHp = m.maxHp = 1e12; m.flies = dy < 0; foes.push([m, dx, dy]); } }
        game._tutorialSpawn = false;
        let pin = true; const pinF = () => { if (!pin) return; game.monsters = game.monsters.filter((m) => foes.some((f) => f[0] === m)); for (const [m, dx, dy] of foes) { m.x = pcx + dx - m.w / 2; m.y = feet - m.h + dy; m.vx = 0; m.vy = 0; if (m.currentHp <= 0) m.currentHp = 1e12; } requestAnimationFrame(pinF); }; pinF();
        await __frames(10, 3000);
        W.__fb = new Map(); W.__seen = new Set();
        let err = null; const cast = () => { player.mp = 1e6; try { castSkill(id); } catch (e) { err = String(e).slice(0, 80); } };
        cast(); const ok = (player.skillCooldowns[id] || 0) > 0;
        const win = /every press|free-cast|free cast|press inside|tap again|tap once to arm/i.test(SKILLS[id].desc || '');
        const g0 = game.time | 0, t0 = performance.now(); let presses = 1;
        while ((game.time | 0) - g0 < 150 && performance.now() - t0 < 15000) { await sleep(100); if (win && presses < 4 && performance.now() - t0 > presses * 700) { player._skillLockTimer = 0; player.skillCooldowns[id] = 0; cast(); presses++; } }
        const seen = [...__seen].filter(mine).sort(), fb = {}; for (const [t, n] of __fb) if (mine(t)) fb[t] = n;
        W.__fb = null; W.__seen = null; pin = false; clear();
        out.push({ id, ok, err, seen, fb });
      }
      W.getMaxMp = realMax;
      return out;
    }, [cls, job]);
    const fbN = r.reduce((s, x) => s + Object.keys(x.fb).length, 0), art = new Set(r.flatMap((x) => x.seen));
    casts.push({ cls, job, parkedBefore, settle, r });
    console.log(`casts ${cls}/${job} (settled ${settle} ms, ${parkedBefore} class sprites parked at the change): ` + r.map((x) => `${x.id}${x.ok ? '' : '(no cast)'} ${x.seen.length}${Object.keys(x.fb).length ? ' FALLBACK ' + JSON.stringify(x.fb) : ''}`).join(' | '));
    check(r.length >= 7 && r.every((x) => x.ok && !x.err) && fbN === 0 && art.size >= 6,
      `${cls} (${job}): all ${r.length} skills on the bar cast, their effects, projectiles and summons drawn from loaded art on the first cast (${art.size} sprites / sets drawn, ${fbN} fell back${parkedBefore != null ? (ci ? '; ' + parkedBefore + ' were parked at the change' : '; prefetched after the title') : ''})`,
      r.filter((x) => !x.ok || x.err || Object.keys(x.fb).length));
  }
  // five field maps with ranged monsters across the level range, entered cold (none next door to another): every shot the
  // map's monsters fire is drawn from its loaded sprite, cast flash and loop (the map entry asked for them)
  const MAPS5 = await p.evaluate(() => {
    const plain = (id) => { const md = MAPS[id]; return md && !md.isBossArena && !md.isVoid && !md.isZodiac && !md.isZodiacHub && !md.sanctum && !md.isTown && !/^tower|^boss/.test(id); };
    const lv = (id) => (typeof _mapGearLevel === 'function') ? _mapGearLevel(MAPS[id]) : (MAPS[id].levelReq || 0);
    window.__shooters = (id) => [...new Set((MAPS[id].spawns || []).filter((sp) => sp && sp.type && !sp.boss && monsterTypes[sp.type] && monsterTypes[sp.type].shoot && LX_MOB_PROJ[monsterTypes[sp.type].shoot]).map((sp) => sp.type))];
    const c = Object.keys(MAPS).filter((id) => plain(id) && __shooters(id).length).sort((a, b) => (lv(a) - lv(b)) || (a < b ? -1 : 1));
    const near = new Set(['mushroom', 'forest', 'town', 'void', game.currentMap].concat(_lxMapNeighbors('mushroom'), _lxMapNeighbors(game.currentMap)));
    const out = [];
    for (let k = 0; k < 5; k++) for (let d = 0; d < c.length; d++) { const id = c[(Math.round(k * (c.length - 1) / 4) + d) % c.length]; if (out.indexOf(id) >= 0 || near.has(id)) continue; out.push(id); near.add(id); for (const n of _lxMapNeighbors(id)) near.add(n); break; }
    return out;
  });
  const mobs = [];
  for (const id of MAPS5) {
    mobs.push(await p.evaluate(async (id) => {
      const types = __shooters(id), keys = [...new Set(types.map((t) => monsterTypes[t].shoot))];
      const cold = keys.filter((k) => __parked(LX_MOB_PROJ[k])).length;
      loadMap(id);
      const t0 = performance.now(); await __raf(); while (__veil() && performance.now() - t0 < 20000) await __raf();
      const veilMs = Math.round(performance.now() - t0);
      await __frames(20, 6000);
      player.invulnerable = 999999; player._god = true;
      const live = () => game.monsters.filter((m) => m && !m.dead && m.currentHp > 0 && m.shoot && !m.isBoss && !m.ally && types.indexOf(m.type) >= 0);
      await __until(() => live().length > 0, 10000);
      for (const t of types) if (!live().some((m) => m.type === t)) { try { spawnMonster(player.x + 260, player.y - 40, t, false, false); } catch (e) {} }
      window.__fb = new Map(); window.__seen = new Set();
      let shots = 0;
      for (let round = 0; round < 3; round++) {
        const seenType = new Set();
        for (const m of live()) { if (seenType.has(m.type)) continue; seenType.add(m.type); m.x = player.x + 200 + seenType.size * 60; m.y = player.y - 30; const b = game.projectiles.length; try { fireMonsterProjectile(m); } catch (e) {} if (game.projectiles.length > b) shots++; }
        await __frames(20, 5000);
      }
      const shot = (t) => /^(?:mp|mc|pa):/.test(t);
      const seen = [...__seen].filter(shot).sort(), fb = {}; for (const [t, n] of __fb) if (shot(t)) fb[t] = n;
      window.__fb = null; window.__seen = null;
      return { id, lv: (typeof _mapGearLevel === 'function') ? _mapGearLevel(MAPS[id]) : null, keys, cold, veilMs, shots, seen, fb };
    }, id));
  }
  console.log('shots: ' + mobs.map((m) => `${m.id}(L${m.lv}, ${m.keys.join('/')}${m.cold ? ', ' + m.cold + ' parked' : ''}) veil ${m.veilMs} ms, ${m.shots} shots, drew ${m.seen.join(' ')}${Object.keys(m.fb).length ? ' FALLBACK ' + JSON.stringify(m.fb) : ''}`).join(' | '));
  const lazyBuild = await p.evaluate(() => __lazy);
  const mobBad = mobs.filter((m) => !m.shots || !m.seen.some((t) => /^(?:mp|pa):/.test(t)) || Object.keys(m.fb).length);
  check(mobs.length === 5 && !mobBad.length && (!lazyBuild || mobs.filter((m) => m.cold).length >= 4),
    `5 maps (${mobs.map((m) => m.id).join(', ')}): every monster shot is drawn from its loaded sprite and loop (${mobs.reduce((s, m) => s + m.shots, 0)} shots; ${mobs.filter((m) => m.cold).length} maps entered with the shot art parked)`, mobBad.length ? mobBad : mobs);
  // gear icons: eight pieces never shown before, in the inventory; then the weapon shop
  const pn = await p.evaluate(async () => {
    const pool = [].concat(ITEM_POOL.weapons || [], ITEM_POOL.armors || [], ITEM_POOL.accessories || []);
    const art = (x) => { const k = _itemKey(x); return k ? LX_ITEMS['_pending_' + k] : null; };
    const withArt = pool.filter((x) => art(x)), cold = withArt.filter((x) => __parked(art(x)));
    const src = cold.length >= 8 ? cold : withArt, pick = []; for (let k = 0; k < 8 && src.length; k++) pick.push(src[Math.round(k * (src.length - 1) / 7)]);
    const slotOf = (x) => (ITEM_POOL.weapons || []).indexOf(x) >= 0 ? 'weapon' : (ITEM_POOL.armors || []).indexOf(x) >= 0 ? 'armor' : 'accessory';
    const items = pick.map((x) => ({ ...x, slot: slotOf(x), stars: 0, rarity: 'common', level: 10 }));
    const parked = items.filter((it) => __parked(art(it))).length;
    player.inventory = (player.inventory || []).filter((it) => _itemTab(it) !== 'equip').concat(items);
    const modal = document.getElementById('inventory-modal'); modal.style.display = 'flex'; game._invTab = 'equip'; renderInventory('');
    const imgOf = (it) => [...modal.querySelectorAll('img')].find((im) => im.getAttribute('alt') === it.name);
    const withImg = items.filter(imgOf).length;
    const loaded = await __until(() => items.every((it) => { const im = imgOf(it); return im && im.complete && im.naturalWidth > 0; }), 20000);
    const inv = { n: items.length, parked, withImg, loaded, loadedN: items.filter((it) => { const im = imgOf(it); return im && im.complete && im.naturalWidth > 0; }).length };
    modal.style.display = 'none';
    const shopParked = withArt.filter((x) => __parked(art(x))).length;
    openShop('weapon');
    const list = document.getElementById('shop-list');
    const imgs = () => [...list.querySelectorAll('img')].filter((im) => /\/Sprites\/(?:equipment|items)\//.test(im.src));
    const shop = { n: imgs().length, parkedPool: shopParked };
    shop.loaded = await __until(() => imgs().length > 0 && imgs().every((im) => im.complete && im.naturalWidth > 0), 20000);
    shop.loadedN = imgs().filter((im) => im.complete && im.naturalWidth > 0).length;
    try { closeAllModals(); } catch (e) {} game.paused = false;
    return { inv, shop };
  });
  console.log('panels: ' + JSON.stringify(pn));
  check(pn.inv.n === 8 && pn.inv.withImg === 8 && pn.inv.loaded && (!lazyBuild || pn.inv.parked >= 6), `the inventory shows a loaded icon for 8 gear pieces never shown before (${pn.inv.loadedN}/8 loaded; ${pn.inv.parked} were parked when it opened)`, pn.inv);
  check(pn.shop.n >= 4 && pn.shop.loaded, `the weapon shop shows loaded gear icons (${pn.shop.loadedN}/${pn.shop.n})`, pn.shop);
  await ctx.close();
} finally { await browser.close().catch(() => {}); srv.kill(); }
check(errs.length === 0, 'no page errors', errs.slice(0, 3));
console.log(bad ? `\n${bad} of ${total} FAILED` : `\nall ${total} passed`);
process.exit(bad ? 1 : 0);
