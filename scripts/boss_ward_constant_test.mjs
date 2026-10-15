// A boss's ward shield is one size, taken from his idle frame 0 (v0.30.1766 ward-ref).
//   node scripts/boss_ward_constant_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build; PORT=<port>)
// Per user (with a screenshot of the honeycomb dome): "For tower arbiter and tower sovereign this shield size keeps changing, make it constant and make sure all boss shield size is made constant
// to the size of the boss (not the canvas)" / "just make it constant to the 1 frame (idle of the boss) without having to keep changing the size of the shield".
// _lxWardBox sized the dome from the frame drawn that step (its image's opaque bounds x its drawn rect, which carries the set's calibration), so each walk frame and each attack set resized and
// moved it. Each boss is warded and driven through idle, walking and his attacks on a controlled clock (1/30 s a step) with _drawBossWardShield hooked: the box it is handed every step.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '10599';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const env = { ...process.env }; delete env.MOJI_GAME_FILE;
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const ALL = [
  { type: 'towerSovereign', atk: ['swing', 'column', 'collapse', 'volley', 'drain', 'dash'], pose: true },
  { type: 'towerArbiter', atk: ['swing', 'column', 'dash'], pose: true },
  { type: 'kingKrook', atk: ["m.patternState='claw'; m.patternTimer=0; m._kFired=false;", "m.patternState='stomp'; m.patternTimer=0; m._kFired=false; m._kAnnounced=false;", "m.patternState='firebomb'; m.patternTimer=0; m._kFired=false;", "m.patternState='megaFireball'; m.patternTimer=0; m._kFired=false; m._megaAnnounced=false;"], pose: false },
  { type: 'zodiac_leo', atk: [], pose: false },
];
const BOSSES = process.env.ONLY ? ALL.filter((b) => b.type === process.env.ONLY) : ALL;
let R = null; const errs = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 960, height: 560 }, serviceWorkers: 'block' });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.clock.install();
  await page.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof spawnMonster === 'function' && document.getElementById('lo-menu'), null, { timeout: 180000 });
  await page.waitForTimeout(4000);
  await page.evaluate(() => {
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { _lxBootHold.release('menu'); } catch (e) {} if (!player.cls) applyClass('warrior'); player.level = 99; player._god = true; player.invulnerable = 1e9; player._gravitosCineSeen = true;
    try { for (const k of Object.keys(STORY_BEATS)) (player._storyBeatsSeen = player._storyBeatsSeen || {})[k] = true; } catch (e) {}
    game.paused = false; loadMap('tower_b10', 200); });
  await page.waitForTimeout(2500);
  const out = {};
  for (const B of BOSSES) {
    await page.evaluate((B) => {
      for (const id of ['story-beat-overlay', 'boss-intro-overlay', 'dialog']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
      game.monsters = [];
      const m = spawnMonster(1200, game.mapData.worldHeight - 260, B.type, true, false); window.__m = m; m.currentHp = m.maxHp = 9e9; m._bigMeleeCd = 1e9; try { delete m.traits.columnStrike; } catch (e) {} m._hgCd = 1e9; m._introDone = true; m.aggroTarget = null;
      if (B.type === 'kingKrook') { m._krookInit = true; m._stagger = 0; m._staggerCd = 1e12; m._dirOpenT = 0; m._dirRollT = 1e12; m._dirStanceT = 1e12; }
      window.__vx = 0; Object.defineProperty(m, 'vx', { get: () => window.__vx, set: () => {}, configurable: true });
      window.__rec = []; window.__phase = 'warm'; window.__step = 0;
      const od = window._drawBossWardShield; window._drawBossWardShield = function (mm, sx, sy) { if (mm === window.__m) { try { const b = _lxWardBox(mm, sx, sy), l = (typeof _lxWardBoxLive === 'function' ? _lxWardBoxLive : _lxWardBox)(mm, sx, sy), r = mm._lxDrawRect, im = r && r.img; window.__rec.push({ n: window.__step, ph: window.__phase, size: b.size, ox: b.cx - (sx + mm.w / 2), oy: b.cy - (sy + mm.h), live: l.size, lox: l.cx - (sx + mm.w / 2), loy: l.cy - (sy + mm.h), idle0: !!(im && im._lxFi === 0 && /(^|[/])idle$/.test(im._lxSt || '')), face: mm.facing, ref: !!mm._lxWardRef, dbg: { fi: im && im._lxFi, st: im && im._lxSt, tag: im && im.tagName, mv: !!_bossMoving(mm), rw: r && r.w, t: r && r.t, now: game.time | 0 } }); } catch (e) { window.__err = String(e && e.message); } } return od.apply(this, arguments); };
      window.__orig = od;
      window.__keep = () => { const m = window.__m; m.currentHp = m.maxHp; player.hp = getMaxHp(); player.invulnerable = 1e9; player.vx = 0; player.x = 1200 - 260 + (window.__walk ? window.__walk.px : 0); if (!window.__walk) m.x = 1200; m._hgCd = 1e9; m._bigMeleeCd = 1e9; m._sovSpireAt = 1e12; m.stunTimer = 0;
        m._wardUntil = (game.time | 0) + 100000; m._wardLen = 100000; m._wardNextAt = (game.time | 0) + 1e9; m._wardGauge = 0; window.__step++;
        for (const id of ['story-beat-overlay', 'boss-intro-overlay', 'dialog']) { const el = document.getElementById(id); if (el && el.style.display !== 'none') el.style.display = 'none'; } };
    }, B);
    const SETS = ['towerSovereign', 'towerSovereignswing', 'towerSovereigncolumn', 'towerSovereigncollapse', 'towerSovereignvolley', 'towerSovereigndrain', 'towerSovereigndash', 'towerArbiter', 'towerArbitercolumn', 'towerArbiterdash'];
    for (let i = 0; i < 60; i++) { const ok = await page.evaluate((SETS) => { try { _lxBossArtWant(window.__m.type, true); } catch (e) {} if (/^tower/.test(window.__m.type)) return SETS.filter((k) => k.indexOf(window.__m.type) === 0 && BOSS_ATTACK_FRAMES[k]).every((k) => _lxFtReadyN(BOSS_ATTACK_FRAMES[k]) >= 9); return true; }, SETS); if (ok) break; await page.waitForTimeout(250); }
    for (let i = 0; i < 10; i++) { await page.evaluate(() => window.__keep()); await page.waitForTimeout(250); }
    const now = await page.evaluate(() => Date.now()); await page.clock.pauseAt(now + 1500);
    const step = async () => { await page.evaluate(() => window.__keep()); await page.clock.runFor(33); };
    await page.evaluate(() => { window.__phase = 'warm'; }); for (let i = 0; i < 60; i++) await step();   // a boss settles after it spawns (his scale, his bake): not sampled
    await page.evaluate(() => { window.__phase = 'idle'; });
    for (let i = 0; i < 70; i++) await step();                                           // idle
    await page.evaluate(() => { window.__phase = 'walk'; window.__walk = { px: 0 }; });
    for (let i = 0; i < 50; i++) { await page.evaluate(() => { window.__m.x += 3; window.__walk.px += 3; }); await step(); }   // walk
    await page.evaluate(() => { window.__walk = null; window.__m.x = 1200; window.__phase = 'idle2'; });
    for (let i = 0; i < 30; i++) await step();
    for (const a of B.atk) {
      await page.evaluate((a) => { window.__phase = 'atk:' + a.slice(0, 14); }, a);
      for (let t = 0; t < 2; t++) { await page.evaluate(([a, pose]) => { const m = window.__m; if (pose) _lxBossAtkPose(m, a, 70); else eval(a); }, [a, B.pose]); for (let i = 0; i < 45; i++) await step(); }
    }
    out[B.type] = await page.evaluate(() => ({ rec: window.__rec.slice(), err: window.__err || null, ref: window.__m._lxWardRef || null, w: window.__m.w, h: window.__m.h }));
    await page.evaluate(() => { window._drawBossWardShield = window.__orig; });
    await page.clock.resume();
  }
  R = out;
} finally { await browser.close(); srv.kill(); }
if (!R) { check(false, 'the harness produced results', errs.slice(0, 3)); process.exit(1); }
for (const B of BOSSES) {
  const o = R[B.type] || { rec: [] }; const rec = o.rec.filter((r) => r.ref && r.ph !== 'warm'), all = o.rec.filter((r) => r.ph !== 'warm');
  const sz = rec.map((r) => r.size), ox = rec.map((r) => r.ox), oy = rec.map((r) => r.oy), rng = (a) => a.length ? Math.max(...a) - Math.min(...a) : 1e9;
  const live = all.map((r) => r.live), liveRange = live.length ? (Math.max(...live) - Math.min(...live)) / (o.ref ? o.ref.size : 1) : 0;
  const phases = [...new Set(rec.map((r) => r.ph.split(':')[0] === 'atk' ? r.ph : r.ph))];
  check(rec.length > 150 && !!o.ref, `${B.type}: the dome is drawn and has an idle-frame reference`, { drawn: all.length, withRef: rec.length, ref: o.ref, err: o.err });
  check(rng(sz) < 0.5, `${B.type}: ONE size through idle, walking and every attack (${phases.length} phases, ${rec.length} samples)`, { min: Math.min(...sz), max: Math.max(...sz), phases });
  check(rng(ox) < 1.6 && rng(oy) < 1.6, `${B.type}: and one place on his body (the same offset from his feet in every pose)`, { ox: [Math.min(...ox), Math.max(...ox)], oy: [Math.min(...oy), Math.max(...oy)] });
  const i0 = o.rec.filter((r) => r.idle0).map((r) => r.live);   // every idle frame 0 the dome was drawn on, the settling steps included
  check(i0.length > 0 && Math.abs(sz[0] - i0[i0.length - 1]) < 1.0, `${B.type}: that size is the idle frame 0's own measure`, { size: sz[0], idle0: i0.slice(-4) });
  check(sz.length && sz[0] >= 72 && sz[0] <= 560, `${B.type}: within the shield's own limits (72-560 px)`, sz[0]);
  if (process.env.DBG === '2') console.log('SERIES', B.type, JSON.stringify(all.filter((r, i) => i % 12 === 0).map((r) => [r.n, r.ph.slice(0, 6), +r.size.toFixed(0), +r.live.toFixed(0), r.dbg.rw && +r.dbg.rw.toFixed(0), r.dbg.fi, r.dbg.tag === 'CANVAS' ? 'c' : 'i'])));
  if (process.env.DBG) { const c = {}; for (const r of all) { const k = [r.dbg.fi, r.dbg.st, r.dbg.tag, r.dbg.mv, r.ref].join('|'); c[k] = (c[k] || 0) + 1; } console.log('DBG', B.type, JSON.stringify(c)); }
  console.log(`      (${B.type}: the per-frame measure alone would have ranged ${(liveRange * 100).toFixed(0)}% of the dome across these poses)`);
}
check(errs.length === 0, 'no page errors', errs.slice(0, 3));
console.log(`\n${total - bad}/${total} checks passed`);
process.exit(bad ? 1 : 0);
