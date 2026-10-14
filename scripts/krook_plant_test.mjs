// King Krook stands still while he attacks, and walks when he moves (v0.30.1759 krook-plant).
//   node scripts/krook_plant_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build)
// Per user: "the issue is him sliding around when he is playing the attacking sprites, ensure attacking sprites are played and boss is kept in the same spot without sliding" and
// "when moving he needs strictly to play the walking sprites" (the same slip-and-slide the Arbiter and Gravitos had).
// Every one of his nine patterns is FORCED from a settled idle on a controlled clock (1/30 s a step) with _drawBossSprite wrapped, so each frame says which of his four art sets was
// drawn (walk / idle / attack / stomp) and where his body stood at that draw. Measured on v0.30.1758: the claw drew 12 frames of idle / walk art before its swipe and stepped 18 px under
// them, the jump slam drew 37 frames of walk / idle art and glided 80 px through the air, every other pattern drew 5-6 frames of idle / walk art first.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '10597';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const env = { ...process.env }; delete env.MOJI_GAME_FILE;
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const NAMES = ['claw', 'jumpSlam', 'shellSpin', 'firebomb', 'stomp', 'megaFireball', 'fireBreath', 'fireballRain', 'earthquake'];
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
    game.paused = false; loadMap('krookThrone', 300); });
  await page.waitForTimeout(3500);
  await page.evaluate(() => {
    for (const id of ['story-beat-overlay', 'boss-intro-overlay', 'dialog']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    const m = game.monsters.find((x) => x && x.type === 'kingKrook'); window.__m = m; m._introDone = true; m.aggroTarget = player;
    const WALK = BOSS_WALK_FRAMES.kingKrook || [], IDLE = (typeof BOSS_IDLE_FRAMES !== 'undefined' && BOSS_IDLE_FRAMES.kingKrook) || [], ATK = (typeof BOSS_ATTACK_FRAMES !== 'undefined' && BOSS_ATTACK_FRAMES.kingKrook) || [], STO = (typeof BOSS_ATTACK_FRAMES !== 'undefined' && BOSS_ATTACK_FRAMES.kingKrookstomp) || [];
    window.__drawn = null; const od = window._drawBossSprite;
    window._drawBossSprite = function (img, mm) { if (mm === m) window.__drawn = { st: WALK.indexOf(img) >= 0 ? 'walk' : IDLE.indexOf(img) >= 0 ? 'idle' : ATK.indexOf(img) >= 0 ? 'attack' : STO.indexOf(img) >= 0 ? 'stomp' : 'other', x: m.x }; return od.apply(this, arguments); };
    window.__keep = () => { const m = window.__m; m.currentHp = m.maxHp * 0.4; player.hp = getMaxHp(); player.invulnerable = 1e9; player.vx = 0; m._stagger = 0; m._staggerCd = 1e12; m._dirOpenT = 0; m._dirRollT = 1e12; m._dirStanceT = 1e12; m._kString = null;
      player.x = Math.max(10, m.x - 420);   // off to his left, out of every melee brush
      for (const id of ['story-beat-overlay', 'boss-intro-overlay', 'dialog']) { const el = document.getElementById(id); if (el && el.style.display !== 'none') el.style.display = 'none'; } };
    window.__setup = { claw: "m.patternState='claw'; m.patternTimer=0; m._kFired=false;", jumpSlam: "m.patternState='jumpSlam'; m.patternTimer=0; m._kJumped=false; m._kJumpAir=false; m._kFired=false;",
      shellSpin: "m.patternState='shellSpin'; m.patternTimer=0; m._kAnnounced=false; m._shellDir=0; m._shellPasses=0;", firebomb: "m.patternState='firebomb'; m.patternTimer=0; m._kFired=false;",
      stomp: "m.patternState='stomp'; m.patternTimer=0; m._kFired=false; m._kAnnounced=false;", megaFireball: "m.patternState='megaFireball'; m.patternTimer=0; m._kFired=false; m._megaAnnounced=false;",
      fireBreath: "m.patternState='fireBreath'; m.patternTimer=0; m._fireAnnounced=false;", fireballRain: "m.patternState='fireballRain'; m.patternTimer=0; m._kFired=false;", earthquake: "m.patternState='earthquake'; m.patternTimer=0; m._kFired=false; m._kAnnounced=false;" };
    window.__go = (name) => { const m = window.__m; eval(window.__setup[name]); };
  });
  for (let i = 0; i < 22; i++) { await page.evaluate(() => window.__keep()); await page.waitForTimeout(300); }
  const now = await page.evaluate(() => Date.now()); await page.clock.pauseAt(now + 1500);
  const snap = () => page.evaluate(() => { const m = window.__m, d = window.__drawn;
    const sl = game.projectiles.filter((p) => p && p._krookSlam).length, cl = game.projectiles.find((p) => p && p.skill === 'claw');
    return { x: +m.x.toFixed(2), w: m.w, vx: +(m.vx || 0).toFixed(2), ps: m.patternState || '', og: !!m.onGround, y: +m.y.toFixed(1), d: d ? d.st : null, dx0: d ? +d.x.toFixed(2) : null, sh: m._shellDir || 0, waves: sl, clawX: cl ? +cl.x.toFixed(2) : null, face: m.facing }; });
  const step = async () => { await page.evaluate(() => { window.__keep(); window.__drawn = null; }); await page.clock.runFor(33); return snap(); };
  const runs = {};
  for (const name of NAMES) {
    for (let w = 0; w < 500; w++) { const s = await step(); if (s.ps === 'idle' && s.og) break; }
    for (let i = 0; i < 6; i++) await step();
    const before = await snap();
    await page.evaluate((n) => window.__go(n), name);
    const F = [];
    for (let i = 0; i < 400; i++) { const s = await step(); if (i > 0 && s.ps === 'idle' && s.og) break; F.push(s); }
    let lead = null, lastX = null; const by = {}; let slidNonWalk = 0, chargeNonWalk = 0, chargeMoved = 0, minY = before.y, waves = 0, clawGap = null, maxXdev = 0;
    for (let i = 0; i < F.length; i++) { const f = F[i]; if (lead == null && (f.d === 'attack' || f.d === 'stomp')) lead = i; minY = Math.min(minY, f.y); waves = Math.max(waves, f.waves);
      if (f.clawX != null && clawGap == null) clawGap = f.face > 0 ? f.clawX - (f.x + f.w) : (f.x - 50) - f.clawX;
      maxXdev = Math.max(maxXdev, Math.abs(f.x - before.x));
      if (f.d) { const dx = lastX == null ? 0 : Math.abs(f.dx0 - lastX); lastX = f.dx0; const r = by[f.d] || (by[f.d] = { n: 0, px: 0 }); r.n++; r.px += dx;
        if (dx > 0.3 && f.d !== 'walk') slidNonWalk += dx;
        if (name === 'shellSpin' && f.sh) { chargeMoved += dx > 0.3 ? 1 : 0; if (f.d !== 'walk') chargeNonWalk++; } } }
    runs[name] = { frames: F.length, lead, by, slidNonWalk: +slidNonWalk.toFixed(2), chargeNonWalk, chargeMoved, rose: +(before.y - minY).toFixed(0), waves, clawGap, maxXdev: +maxXdev.toFixed(1) };
  }
  R = { runs, unit: await page.evaluate(() => {
    if (typeof _krookWalkPos !== 'function') return { missing: true };
    const out = {}; const t0 = game.time;
    const walkAt = (v, steps) => { const m = { type: 'kingKrook', x: 100 }; game.time = 100000; _krookWalkPos(m, 9); let pos = null; for (let i = 1; i <= steps; i++) { game.time = 100000 + i; m.x += v; pos = _krookWalkPos(m, 9); } return pos; };
    out.a = walkAt(1, 54); out.b = walkAt(2, 27); out.c = walkAt(1.5, 36);   // 54 px: a full cycle at three speeds
    out.h1 = walkAt(1, 27); out.h2 = walkAt(1.5, 18); out.h3 = walkAt(0.5, 54);   // ~27 px: half a cycle at three speeds
    out.charge = walkAt(13, 10); out.capped = walkAt(2.4, 10);   // the shell charge covers the same cadence as a 2.4 px a step walk
    const m2 = { type: 'kingKrook', x: 0 }; game.time = 200000; _krookWalkPos(m2, 9); game.time = 200001; m2.x += 2; _krookWalkPos(m2, 9); game.time = 200100; m2.x += 30; out.afterPause = _krookWalkPos(m2, 9);   // a gap over 8 steps restarts the walk
    // the frame the draw hands over really is the one the position names
    const fr = BOSS_WALK_FRAMES.kingKrook; for (let i = 0; i < 6; i++) _bossWalkFrame('kingKrook', { type: 'kingKrook', x: 0, h: 344 });
    const m3 = { type: 'kingKrook', x: 0, h: 344 }; game.time = 300000; _bossWalkFrame('kingKrook', m3); let img = null, idx = null; for (let i = 1; i <= 20; i++) { game.time = 300000 + i; m3.x += 2; img = _bossWalkFrame('kingKrook', m3); } idx = Math.floor(_krookWalkPos(m3, fr.length));
    out.frameMatches = img === fr[idx % fr.length]; out.ready = fr._readyN; out.n = fr.length;
    game.time = t0; return out; }) };
  await page.clock.resume();
} finally { await browser.close(); srv.kill(); }
if (!R) { check(false, 'the harness produced results', errs.slice(0, 3)); process.exit(1); }
const r = R.runs;
for (const n of NAMES) check(r[n] && r[n].frames > 8, `${n} ran to its end`, r[n]);
for (const n of NAMES) check(r[n].lead === 0, `${n}: attack art opens on the pattern's first frame (was 5-37 frames of idle / walk art first)`, { lead: r[n].lead, by: r[n].by });
for (const n of NAMES) check(r[n].slidNonWalk === 0, `${n}: his body never moves under attack / idle art`, { slid: r[n].slidNonWalk });
check(r.claw.maxXdev < 0.6 && r.claw.by.walk === undefined, 'claw: he swipes from where he stands, attack art the whole way (was a 18-26 px step-in on walk frames)', r.claw);
check(r.jumpSlam.maxXdev < 0.6 && r.jumpSlam.by.walk === undefined, 'jump slam: straight up and down on the spot, attack art the whole way (was an 80-167 px glide on walk frames)', r.jumpSlam);
check(r.jumpSlam.rose >= 100 && r.jumpSlam.waves === 2, 'jump slam: he still leaves the floor (>= 100 px) and lands two shockwaves', { rose: r.jumpSlam.rose, waves: r.jumpSlam.waves });
check(r.claw.clawGap != null && r.claw.clawGap >= 25 && r.claw.clawGap < 36, 'claw: the swipe box starts 26 px further out (it has flown 0-4 px by the first look) - the reach the step-in used to give it', { gap: r.claw.clawGap });
check(r.shellSpin.chargeMoved >= 20 && r.shellSpin.chargeNonWalk === 0, 'shell spin: the charge moves him and every frame of it is his WALK art, strictly', { moved: r.shellSpin.chargeMoved, nonWalk: r.shellSpin.chargeNonWalk });
check(r.shellSpin.by.attack && r.shellSpin.by.attack.n >= 10 && r.shellSpin.by.attack.px === 0, 'shell spin: the 700 ms wind-up is attack art, rooted', r.shellSpin.by);
const u = R.unit;
check(!u.missing, 'the build paces his walk by distance (_krookWalkPos)', u);
if (!u.missing) {
check(Math.abs(u.a - u.b) < 0.05 && Math.abs(u.b - u.c) < 0.05 && (u.a < 0.2 || u.a > 8.8), 'walk cadence follows distance: 54 px is one full cycle at 1, 2 and 1.5 px a step', { a: u.a, b: u.b, c: u.c });
check(Math.abs(u.h1 - u.h2) < 0.1 && Math.abs(u.h1 - u.h3) < 0.1 && u.h1 > 3 && u.h1 < 6, '...and 27 px is the same half-cycle frame at 1, 2 and 0.5 px a step (the wall-clock walk differed by whole frames)', { h1: u.h1, h2: u.h2, h3: u.h3 });
check(Math.abs(u.charge - u.capped) < 0.01, 'the shell charge (13 px a step) cycles his legs at the 2.4 px a step cadence instead of strobing nine frames over 13 px', { charge: u.charge, capped: u.capped });
check(u.afterPause === 0 || u.afterPause < 0.01, 'a walk begun after a pause starts on its first frame', { afterPause: u.afterPause });
check(u.frameMatches === true && u.ready === u.n, 'the frame _bossWalkFrame draws is the one that position names', { match: u.frameMatches, ready: u.ready, n: u.n });
}
check(errs.length === 0, 'no page errors', errs.slice(0, 3));
console.log(`\n${total - bad}/${total} checks passed`);
process.exit(bad ? 1 : 0);
