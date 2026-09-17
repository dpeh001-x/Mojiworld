// Gravitos: the gap between one-hit-KOs is strict (v0.30.x ohko-gap).
//   node scripts/grav_ohko_gap_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build)
// Per user: "for the 3rd form ensure strict time gap of the OHKO, it is still casting back to back".
// Drives the REAL boss AI in a booted game. Rests are counted in WORLD frames (calls of bossAI for the boss) - the
// clock a lethal field lives on - as well as on the wall clock, under hit-stop and across a solo pause.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '10361';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
try {
  const ctxB = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' });
  const page = await ctxB.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  const TBL = path.join(process.env.TEMP || '', 'gs_tables');
  if (existsSync(TBL)) await page.route((u) => /data[/]sprite_(bbox|edges|frame_index)[.]js/.test(u.pathname), (r) => { try { r.fulfill({ status: 200, contentType: 'application/javascript', body: readFileSync(path.join(TBL, r.request().url().split('/').pop().split('?')[0])) }); } catch (e) { r.continue(); } });
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof hitMonster === 'function' && typeof bossAI === 'function', null, { timeout: 120000 });
  await page.evaluate(() => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false;
    player.level = 100; player.cls = 'warrior'; player.invulnerable = 0; player.hp = player.maxHp = 99999; player._god = true;
    loadMap('gravitosArena'); game.paused = false;
    // the world-frame clock: one tick per bossAI call for the boss - it stands still in hit-stop and in a pause
    window.__aiF = 0; const _o = window.bossAI; window.bossAI = function (m) { if (m && m.type === 'gravitos') window.__aiF++; return _o.apply(this, arguments); };
    window.__T = {
      sleep: (ms) => new Promise((s) => setTimeout(s, ms)),
      boss: () => game.monsters.find((x) => x && x.type === 'gravitos' && x.currentHp > 0),
      clear: () => { const sb = document.getElementById('story-beat-overlay'); for (let k = 0; k < 12 && sb && sb.classList.contains('on'); k++) sb.click(); const bi = document.getElementById('boss-intro-overlay'); if (bi) bi.classList.remove('on'); },
      live: () => game.hazards.filter((h) => h && h.type === 'gravitos_singularity' && h.life > 0),
      quiet: (m) => { m.patternState = 'idle'; m.patternTimer = 0; m._ohkoWarnUntil = null; m._ohkoQueued = null; m._instaTimer = m._rainTimer = m._soulTimer = 99999; m._warpTimer = 99999; m._sgSpawned = false; m._rainIdx = 0; m._rainNextAt = null; m._rainRestF = 0; for (let i = game.hazards.length - 1; i >= 0; i--) if (game.hazards[i] && game.hazards[i].type === 'gravitos_singularity') game.hazards.splice(i, 1); },
      // watch a forced rain: every lethal field's spawn and resolve on both clocks, and the most fields live at once
      rain: async (m, boxes, opts) => {
        const T = window.__T; T.quiet(m);
        m.patternState = 'collapseRain'; m.patternTimer = 0; m._rainIdx = 0; m._rainNextAt = null; m._rainBand0 = null; m._rainRestF = 0;
        const seen = new Map(); let most = 0, stopHs = false; const t0 = performance.now();
        if (opts && opts.hitStop) (async () => { while (!stopHs) { addHitStop(opts.hitStop); await T.sleep(250); } })();
        let paused = null;
        while (performance.now() - t0 < (opts && opts.limit || 60000)) {
          await new Promise((r) => requestAnimationFrame(r));
          player.hp = player.maxHp; player._god = true; T.clear();
          const live = T.live(); most = Math.max(most, live.length);
          for (const h of live) if (!seen.has(h)) seen.set(h, { s: window.__aiF, sw: performance.now(), e: null, ew: null });
          for (const [h, r] of seen) if (r.e == null && !(h.life > 0 && game.hazards.includes(h))) { r.e = window.__aiF; r.ew = performance.now(); }
          if (opts && opts.pauseAtLife && !paused) { const h = live[0]; if (h && h.life <= opts.pauseAtLife) { paused = { at: performance.now(), life: h.life, n: seen.size, g0: game.time | 0 }; game.paused = true; } }
          if (paused && !paused.done && performance.now() - paused.at >= opts.pauseMs) { paused.done = true; paused.nAfter = seen.size; paused.g1 = game.time | 0; paused.lifeAfter = (T.live()[0] || {}).life; game.paused = false; }
          if (paused && !paused.done) game.paused = true;
          const rs = [...seen.values()];
          if (rs.length >= boxes && rs.slice(0, boxes).every((r) => r.e != null) && (!paused || paused.done)) break;
        }
        stopHs = true; const rs = [...seen.values()]; T.quiet(m);
        const rests = [], restsWall = [], s2s = [], lives = [];
        for (let i = 1; i < rs.length; i++) if (rs[i - 1].e != null) { rests.push(rs[i].s - rs[i - 1].e); restsWall.push(+((rs[i].sw - rs[i - 1].ew) / 1000).toFixed(2)); s2s.push(+((rs[i].sw - rs[i - 1].sw) / 1000).toFixed(2)); }
        for (const r of rs) if (r.e != null) lives.push(+((r.ew - r.sw) / 1000).toFixed(2));
        const s2sF = []; for (let i = 1; i < rs.length; i++) s2sF.push(rs[i].s - rs[i - 1].s);
        return { boxes: rs.length, most, rests, restsWall, s2s, s2sF, lives, paused };
      },
      // does an OHKO warning start inside `ms`? The boss is held idle so no regular pattern can stamp _lastSkillAt.
      warns: async (m, ms, prep) => {
        const T = window.__T; const t0 = performance.now(); let at = null;
        while (performance.now() - t0 < ms) {
          await new Promise((r) => requestAnimationFrame(r));
          T.clear(); player.hp = player.maxHp; player._god = true; m.patternState = 'idle'; m.patternTimer = 0; m._ohkoGapRoll = 0; if (prep) prep();
          if (m._ohkoWarnUntil != null) { at = +((performance.now() - t0) / 1000).toFixed(2); break; }
        }
        return at;
      },
    };
  });
  await page.waitForFunction(() => game.monsters.some((m) => m && m.type === 'gravitos' && m.currentHp > 0), null, { timeout: 60000 }).catch(() => {});
  await page.waitForFunction(() => ![...document.querySelectorAll('video')].some((v) => v.offsetParent && !v.paused && v.id.indexOf('map-bg-video') !== 0), null, { timeout: 60000 }).catch(() => {});

  // ---------- FORM 1: unchanged behaviour ----------
  const f1 = await page.evaluate(async () => {
    const T = window.__T; T.clear(); await T.sleep(1500); T.clear();
    const m = T.boss(); if (!m) return { err: 'no boss' };
    const now = () => game.time | 0;
    // the cast-based window: 31 s since the cast, only 3 s since the end - forms 1-2 still fire
    T.quiet(m); m._lastSkillAt = -999999; m._lastSingAt = -999999; m._lastOhkoAt = now() - 31 * 60; m._lastOhkoEndAt = now() - 3 * 60; m._soulTimer = -1;
    const warnAt = await T.warns(m, 1500, () => { m._soulTimer = -1; });
    T.quiet(m);
    const rain = await T.rain(m, 2, { limit: 20000 });
    return { form: (m._gravitosPhase || 1) | 0, warnAt, rain };
  });
  console.log(`\nFORM ${f1.form}  warn after a cast-based window ${f1.warnAt} s · rain rests ${JSON.stringify(f1.rain && f1.rain.rests)} world frames, spawn to spawn ${JSON.stringify(f1.rain && f1.rain.s2s)} s`);
  check(f1.form === 1 && f1.warnAt != null, 'form 1 keeps the cast-based OHKO window (31 s since the cast, 3 s since the end: it warns)', f1);
  check(f1.rain && f1.rain.boxes >= 2 && f1.rain.s2sF[0] >= 232 && f1.rain.s2sF[0] <= 262 && f1.rain.s2s[0] >= 3.9, 'form 1 rain keeps its rhythm: boxes 4 s apart (240 world frames: the 1.4 s box and a 2.6 s rest), and never under 4 s of real time', f1.rain);
  check(f1.rain && f1.rain.most === 1, 'form 1 rain: never two lethal fields at once', f1.rain);

  // ---------- to FORM 3 ----------
  const form = await page.evaluate(async () => {
    const T = window.__T; const phaseOf = (m) => (m && (m._gravitosPhase || 1)) | 0;
    for (let want = 2; want <= 3; want++) { let m = T.boss(), tries = 0; while (m && phaseOf(m) < want && tries++ < 6) { T.clear(); game.paused = false; m.evasion = 0; m._dying = false; m.currentHp = 1; hitMonster(m, 99999999, false, 'phys'); for (let k = 0; k < 30; k++) { await T.sleep(250); T.clear(); const b = T.boss(); if (b && phaseOf(b) >= want) break; } m = T.boss(); } }
    T.clear(); await T.sleep(2500); T.clear();
    const m = T.boss(); if (!m) return 0;
    for (let k = 0; k < 40 && (m.phase | 0) !== 3; k++) { T.clear(); game.paused = false; m.currentHp = Math.floor(m.maxHp * 0.25); await T.sleep(100); }   // HP tier 3: the 28-58 s window (roll pinned to 0 = 28 s)
    return phaseOf(m) * 10 + (m.phase | 0);
  });
  check(form === 33, 'the boss is in form 3, HP tier 3', form);

  const f3 = await page.evaluate(async () => {
    const T = window.__T, m = T.boss(), now = () => game.time | 0, out = {};
    const hold = () => { m.currentHp = Math.floor(m.maxHp * 0.25); };
    // A. 40 s since the cast but only 10 s since the OHKO ENDED: no warning
    T.quiet(m); m._lastSkillAt = -999999; m._lastSingAt = -999999; m._lastOhkoAt = now() - 40 * 60; m._lastOhkoEndAt = now() - 10 * 60;
    out.earlyWarn = await T.warns(m, 1800, () => { hold(); m._soulTimer = -1; });
    // ... and 29 s since it ended: it warns
    T.quiet(m); m._lastSkillAt = -999999; m._lastOhkoAt = now() - 60 * 60; m._lastOhkoEndAt = now() - 29 * 60;
    out.dueWarn = await T.warns(m, 1800, () => { hold(); m._soulTimer = -1; });
    // B. a lethal field still on screen is the OHKO still running
    T.quiet(m); m._lastSkillAt = -999999; m._lastOhkoAt = now() - 90 * 60; m._lastOhkoEndAt = now() - 90 * 60;
    const hz = { type: 'gravitos_singularity', x: 0, y: 0, w: game.mapData.worldWidth || 2200, h: 620, cx: m.x + m.w / 2, cy: m.y + m.h / 2, life: 900, maxLife: 900, atk: 99999, safeZones: [{ x: player.x - 40, y: player.y - 30, w: 120, h: 90 }] };
    game.hazards.push(hz);
    out.warnUnderField = await T.warns(m, 1800, () => { hold(); m._soulTimer = -1; if (!game.hazards.includes(hz)) game.hazards.push(hz); hz.life = 900; });
    T.quiet(m);
    // C. a solo pause does not spend the window: 20 s since the end, then 10 s behind a menu
    m._lastSkillAt = -999999; m._lastOhkoAt = now() - 20 * 60; m._lastOhkoEndAt = now() - 20 * 60;
    const g0 = now(); game.paused = true; const tp = performance.now();
    while (performance.now() - tp < 10000) { await T.sleep(100); game.paused = true; m.patternState = 'idle'; m.patternTimer = 0; }
    out.pauseFrames = now() - g0; game.paused = false;
    out.warnAfterPause = await T.warns(m, 2000, () => { hold(); m._soulTimer = -1; });
    T.quiet(m);
    // D. a pause in the middle of a rain box: nothing new lands on top of it
    out.rainPause = await T.rain(m, 2, { pauseAtLife: 50, pauseMs: 5000, limit: 40000 });
    // E. the rain under hit-stop (a player landing hits): the rest is counted on the world's clock
    out.rainHs = await T.rain(m, 3, { hitStop: 100, limit: 70000 });
    return out;
  });
  console.log(`\nFORM 3 window  early ${f3.earlyWarn}  due ${f3.dueWarn}  under a live field ${f3.warnUnderField}  after a ${f3.pauseFrames}-frame pause ${f3.warnAfterPause}`);
  console.log(`FORM 3 rain, paused mid-box  ${JSON.stringify(f3.rainPause)}`);
  console.log(`FORM 3 rain under hit-stop   ${JSON.stringify(f3.rainHs)}`);
  check(f3.earlyWarn == null, 'form 3: 40 s after the cast but 10 s after the OHKO ENDED - no warning (the window runs from the end)', f3.earlyWarn);
  check(f3.dueWarn != null, 'form 3: 29 s after it ended the next OHKO warns (guards a vacuous pass)', f3.dueWarn);
  check(f3.warnUnderField == null, 'no OHKO warning while a lethal field is still on screen', f3.warnUnderField);
  check(f3.pauseFrames >= 300, 'game.time really runs through a solo pause (guards a vacuous pass)', f3.pauseFrames);
  check(f3.warnAfterPause == null, 'a 10 s menu does not spend the OHKO window (20 s + 10 s paused is still 20 s)', f3.warnAfterPause);
  const rp = f3.rainPause || {}, rh = f3.rainHs || {};
  check(rp.paused && rp.paused.done && rp.paused.nAfter === rp.paused.n, 'no box spawns during the pause', rp.paused);
  check(rp.most === 1, 'paused mid-box: never two lethal fields at once (previous build: the next box landed on the live one)', rp);
  check(rp.rests && rp.rests.length >= 1 && rp.rests.every((r) => r >= 290), 'paused mid-box: the next box still waits out its 5 s rest after the resolve', rp.rests);
  check(rh.boxes >= 3 && rh.most === 1, 'under hit-stop: three boxes, never two live at once', rh);
  check(rh.rests && rh.rests.length >= 2 && rh.rests.every((r) => r >= 290), 'under hit-stop: every rest is 300 world frames (previous build: the wall-clock tick left a handful)', rh.rests);
  check(rh.restsWall && rh.restsWall.every((r) => r >= 4.9), 'under hit-stop: and never under 5 s of real time', rh.restsWall);
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
} finally { await browser.close().catch(() => {}); srv.kill(); }
console.log(bad === 0 ? `\nall ${total} passed` : `\n${bad} of ${total} FAILED`);
process.exit(bad === 0 ? 0 : 1);
