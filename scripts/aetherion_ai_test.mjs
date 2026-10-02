// AETHERION: a boss who reads the fight.
// ============================================================================
// Per user: "improve on the AIs of aetherion boss fight ... he should be a
// relatively powerful and smart boss".
//
// Before: walk at the player, one homing Shard Lance every ten seconds, and
// the shared director stances. Now: his own pattern machine with a read on
// the player (range, airtime, hit-side pressure, dodge bias, heals) steering
// a weighted chooser. This file drives him against scripted player behaviour
// and checks that the read changes what he does, that every attack is
// telegraphed, that he respects stagger windows, and that the phases add
// the evolved and astral patterns.
// Run: node scripts/aetherion_ai_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 9859);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const EXE = [process.env.PW_EXE, process.env.MOJI_PW_EXE,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => p && existsSync(p));
const browser = await chromium.launch({
  channel: EXE ? undefined : 'msedge', executablePath: EXE || undefined,
  headless: true, args: ['--no-sandbox', '--mute-audio'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 150)));
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`,
  { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof game === 'object' && typeof spawnMonster === 'function', null, { timeout: 180000 });
await page.waitForTimeout(6500);
await page.evaluate(() => { window._lxBootGateDone = true; window._prologueActive = false; });
await page.fill('#hero-name-input', 'AeTest').catch(() => {});
await page.evaluate(() => {
  const m = document.getElementById('class-select-modal');
  if (!m) return;
  for (const el of m.querySelectorAll('button,div,li')) {
    if (el.children.length > 3) continue;
    if (getComputedStyle(el).display === 'none') continue;
    if (/^\s*warrior\s*$/i.test((el.textContent || '').trim())) { el.click(); return; }
  }
});
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 240) });
const ev = async (fn, arg) => { try { return await page.evaluate(fn, arg); } catch (e) { return { err: String(e).slice(0, 140) }; } };

// A scenario: spawn a fresh Aetherion in his Sanctum, script the player each
// frame, record his pattern log plus every enemy projectile/hazard he creates.
const scenario = await page.evaluate(() => {
  window.__ae = async (opts) => {
    loadMap('sanctum', 300);
    // loadMap schedules the first-encounter intro cinematic on a timeout keyed
    // to this generation; in a headless run the cinematic never ends and the
    // sim crawls at a third of real time underneath it (measured: ~18 sim
    // frames per 60). Bump the generation so it never starts, and clear any
    // cinematic state a previous scenario left behind.
    game._bossIntroGen = (game._bossIntroGen || 0) + 1;
    window._prologueActive = false;
    try { if (typeof _cineScoreStop === 'function') _cineScoreStop(0, false); } catch (e) {}
    await new Promise((r) => setTimeout(r, 1200));
    window._prologueActive = false;
    game.paused = false; game.monsters = []; game.projectiles.length = 0; game.hazards.length = 0;
    player.level = 70; player._god = true; player.hp = getMaxHp(); player.mp = 9e9; player.x = 900; player.y = 480 - player.h;
    // the clock's PHASE is pinned too: AI cadences key on absolute game.time ('now & 3', 'time % N'), so a scenario that
    // started on step 2005 instead of 2014 fought a different fight. Round up to a multiple of 28800 (2^7 x 3^2 x 5^2);
    // only forward, so every deadline left by the last scenario simply expires
    game.time = Math.ceil(((game.time | 0) + 1) / 28800) * 28800;
    { const r0 = Math.random; let a = ((opts.seed || 20261002) ^ 0x2545f491) >>> 0;   // the spawn's own rolls, seeded too
      Math.random = () => { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a / 4294967296; };
      try { spawnMonster(1300, 480 - 160, 'aetherion', true); } finally { Math.random = r0; } }
    const m = game.monsters[game.monsters.length - 1];
    if (!m || m.type !== 'aetherion') return { err: 'no aetherion' };
    if (opts.hpFrac != null) { m.currentHp = Math.floor(m.maxHp * opts.hpFrac); }
    if (opts.evolved) m._aetherionEvolved = true;
    let prevProj = 0, prevHz = 0; const spawns = [];   // {at, kind, state, sinceStart}
    let stateAt = 0, lastState = 'idle', staggerFires = 0, cineFrames = 0;
    // Budget the scenario in SIM STEPS, not animation frames: headless rAF runs
    // at 120-170Hz while the sim is time-banked at 60 steps/s, so 1800 frames
    // measured as only 513 steps of fight. Scripted events key on sim time too.
    const steps = opts.frames || 1500;
    // DETERMINISTIC (2026-10-02). On an unchanged build this file failed 0-3 of 13 checks per run, a different set each
    // time (variety, kiting lances, air Shardfall, heal answer, Sky-Break gap). Causes - three here, and the clock phase,
    // the pinned hero and the exact-step report, each explained where it is handled:
    //  1. His chooser (_aeChoose) drew from the page-wide Math.random, which the renderer also draws from a load-dependent
    //     number of times per frame - so even the old seeded air run (a global Math.random swap) picked differently.
    //  2. The scripted player ran once per rAF while headless runs several fixed sim steps per rAF under load: the
    //     'i % 12' hits, the heal window and the dodge script landed on different steps (and some hits never happened).
    //  3. The monster-side rolls (director openings and stances, hit rolls) shared that page-wide stream too.
    // Now the chooser draws from its own seeded stream, and the script, the monster update and the observer run per sim
    // step inside an updateMonsters wrapper on a second seeded stream, with the frame-time low-FX flags pinned (they gate
    // particle rolls inside the AI). The rAF loop only waits out the step budget.
    const _mk = (s) => { let a = s >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
    const seed = (opts.seed || 20261002) >>> 0, rngPick = _mk(seed), rngSim = _mk(seed ^ 0x5bd1e995);
    const _choose0 = window._aeChoose, _um0 = window.updateMonsters, _lf0 = LX_PERF.lowFx, _vlf0 = LX_PERF.veryLowFx;
    // every option set he picks from, for the weight checks (what his read MEANS, free of the draw's luck)
    // each one is tagged with the read it was made under ('far', 'pressed', ...) from the log entry its start() writes
    const choices = [];
    let lastLog = null;
    window._aeChoose = function (o) {
      const rec = snap ? null : { w: (o || []).map((q) => [q.s, q.w]), res: null, why: null };
      if (rec) choices.push(rec);
      const r0 = Math.random; Math.random = rngPick;
      try { const r = _choose0.apply(this, arguments); if (rec) rec.res = r; return r; } finally { Math.random = r0; }
    };
    const tagChoices = () => {   // after a step: the newest log entry belongs to the newest untagged pick (start() follows the pick in the same tick)
      const L = m._ae && m._ae.log, e = L && L[L.length - 1], c = choices[choices.length - 1];
      if (e && e !== lastLog) { lastLog = e; if (c && c.why == null && c.res === e.s) c.why = e.why || ''; }
    };
    // a named pattern's share of his pick weight, over the picks (optionally with one read) where it was allowed
    const weightShare = (name, why) => {
      const sh = choices.filter((c) => why == null || c.why === why).map((c) => { const t = c.w.reduce((a, q) => a + (q[1] > 0 ? q[1] : 0), 0), x = c.w.find((q) => q[0] === name); return (x && x[1] > 0 && t > 0) ? x[1] / t : null; }).filter((v) => v != null);
      return { n: sh.length, mean: sh.length ? +(sh.reduce((a, v) => a + v, 0) / sh.length).toFixed(3) : 0, min: sh.length ? +Math.min(...sh).toFixed(3) : 0 };
    };
    let healed = false, dodgeX = player.x;
    const script = (i) => {
      const bcx = m.x + m.w / 2;
      // the hero is PINNED every step (x per mode, and on the floor unless living in the air): knockback from his
      // contact and columns used to shove an unpinned hero a few px - by boxes that follow the DRAWN frame, so by render
      // timing - and that drift cascaded through his reads into a different fight each run
      if (opts.mode !== 'air') { player.y = 480 - player.h; player.vy = 0; player.onGround = true; }
      if (opts.mode === 'neutral' || opts.mode === 'heal' || opts.mode === 'stagger') { player.x = 900; player.vx = 0; }
      if (opts.mode === 'far') { player.x = bcx > 1000 ? 380 : 1620; player.vx = 0; }
      if (opts.mode === 'hug') { player.x = m.x - player.w - 8; player.vx = 0; if ((i % 12) === 0) { try { hitMonster(m, 1000, false, 'melee'); } catch (e) {} } }
      if (opts.mode === 'air') { player.x = bcx - 260; player.y = 480 - player.h - 140; player.vy = 0; player.onGround = false; }
      // dodging right while his shots are live: 6 px a step, vx 6 for his dodge read, wrapping back to 400 past 1900
      if (opts.mode === 'dodgeR') {
        if (game.projectiles.some((p) => p.owner === 'enemy')) { dodgeX += 6; if (dodgeX > 1900) dodgeX = 400; player.vx = 6; } else player.vx = 0;
        player.x = dodgeX;
      }
      // the heal lands on the first step from 640 on where he is free to answer it: he reads heals only from idle, inside
      // 40 steps, so a heal under a 72-step Sky-Break windup expired unread and the check failed on timing, not on the read
      if (opts.mode === 'heal' && i >= 600 && !healed) {
        const free = i >= 640 && (!m._ae || m._ae.st === 'idle') && !((m._dirOpenT | 0) > 0 || (m._stagger | 0) > 0);
        if (free) { player.hp = getMaxHp(); healed = true; } else player.hp = Math.floor(getMaxHp() * 0.4);
      } else if (opts.mode === 'heal' && healed) player.hp = getMaxHp();
      if (opts.mode === 'stagger' && i >= 200 && i < 210) { m._dirOpenT = 3000; }
      player.hp = Math.max(player.hp, 1); m.currentHp = Math.max(m.currentHp, 1);
    };
    // observe - the machine's own state, which the shared boss code cannot reset
    const observe = (i) => {
      const st = (m._ae && m._ae.st) || m.patternState || 'idle';
      if (st !== lastState) { stateAt = i; lastState = st; }
      const ep = game.projectiles.filter((p) => p.owner === 'enemy'), eh = game.hazards.filter((h) => h.owner === 'enemy' || h.type === 'mob_shockwave');
      const np = ep.length, nh = eh.length;
      if (np > prevProj || nh > prevHz) {
        const what = np > prevProj ? ('proj:' + (ep[ep.length - 1].skill || '?')) : ('hazard:' + (eh[eh.length - 1].type || '?'));
        spawns.push({ at: i, what, state: st, sinceStart: i - stateAt, stagger: (m._dirOpenT | 0) > 0 });
        if ((m._dirOpenT | 0) > 0) staggerFires++;
      }
      prevProj = np; prevHz = nh;
      tagChoices();
      // his walk speed, read 30 steps into an idle stretch (every AI tick has had its chance to restore it by then).
      // The end-of-run read caught him on the step a windup finished, before his next tick restored it.
      idleRun = (st === 'idle') ? idleRun + 1 : 0;
      if (idleRun === 30) idleSpeed = m.speed;
    };
    let idleRun = 0, idleSpeed = null;
    const gt0 = game.time | 0;
    // the report is taken on EXACTLY the budget's last monster step - the rAF loop below overshoots by however many sim
    // steps the last frame ran, and a pick in that overshoot changed the counts between runs
    const report = () => {
      const log = (m._ae && m._ae.log || []).slice();
      const picks = {}; for (const l of log) picks[l.s] = (picks[l.s] || 0) + 1;
      // windups come from the AI's own fire log (ms elapsed in the pattern at the
      // moment it fired): a pattern fires and returns to idle inside one tick, so
      // a frame-sampled observer would attribute the spawn to the new idle state
      const fires = (m._ae && m._ae.fires || []).slice();
      return { picks, n: log.length, spawns: spawns.length, fires: fires.length, staggerFires, cineFrames, simSteps: (game.time | 0) - gt0, speed: m.speed, idleSpeed, state: (m._ae && m._ae.st) || 'idle', x: m.x, px: player.x,
        minWind: fires.length ? Math.min(...fires.map((f) => f.wind)) : -1, why: log.map((l) => l.why).filter(Boolean),
        lanceW: weightShare('lanceWind'), echoPressedW: weightShare('echoWind', 'pressed'),
        gap: m._ae && m._ae.lastGap && { ...m._ae.lastGap }, dodge: m._ae && +m._ae.dodge.toFixed(2), evolvedNow: !!m._aetherionEvolved, hpFrac: +(m.currentHp / m.maxHp).toFixed(2) };
    };
    // the player's update and the projectile pass (hits on the hero: knockback, evasion rolls) ride the seeded stream too
    const seeded = (fn) => function () { const r0 = Math.random; Math.random = rngSim; LX_PERF.lowFx = true; LX_PERF.veryLowFx = true; try { return fn.apply(this, arguments); } finally { Math.random = r0; } };
    const _up0 = window.updatePlayer, _upj0 = window.updateProjectiles;
    let k = 0, snap = null;
    window.updatePlayer = seeded(_up0); window.updateProjectiles = seeded(_upj0);
    window.updateMonsters = function () {
      const i = k++, r0 = Math.random;
      Math.random = rngSim; LX_PERF.lowFx = true; LX_PERF.veryLowFx = true;
      try { if (!snap) script(i); return _um0.apply(this, arguments); }
      finally { Math.random = r0; if (!snap) { try { observe(i); } catch (e) {} if (k >= steps) snap = report(); } }
    };
    let guard = 0;
    try {
      while (!snap && guard++ < steps * 6) {
        await new Promise((r) => requestAnimationFrame(r));
        if (window._prologueActive || (typeof _cineOwnsMix !== 'undefined' && _cineOwnsMix)) cineFrames++;
      }
    } finally { window._aeChoose = _choose0; window.updateMonsters = _um0; window.updatePlayer = _up0; window.updateProjectiles = _upj0; LX_PERF.lowFx = _lf0; LX_PERF.veryLowFx = _vlf0; }
    const out = snap || report();
    game.monsters = []; game.projectiles.length = 0; game.hazards.length = 0;
    return out;
  };
  return typeof _aetherionTick === 'function';
});
ok('Aetherion has his own AI tick', scenario === true);

// ---- variety + fairness in a neutral fight -------------------------------------
const neutral = await ev(async () => await window.__ae({ mode: 'neutral', frames: 1800 }));
ok('the scenario runs at full tempo with no cinematic active (the harness guard)', !neutral.err && neutral.cineFrames === 0 && neutral.simSteps >= 1500,
  neutral.err || `${neutral.cineFrames} cinematic frames, ${neutral.simSteps} sim steps in 1800 frames`);
ok('in 30s he uses at least four distinct patterns and at least ten in all (was: one every ten seconds)', !neutral.err && Object.keys(neutral.picks).length >= 4 && neutral.n >= 10, neutral.err || `${neutral.n} picks: ${JSON.stringify(neutral.picks)}`);
ok('every attack he creates comes at least 300ms into a telegraphed windup', !neutral.err && neutral.fires > 0 && neutral.minWind >= 300, neutral.err || `${neutral.fires} attacks, shortest windup ${neutral.minWind}ms`);
ok('his walk speed is restored between patterns (the windup hold does not stick)', !neutral.err && neutral.idleSpeed != null && Math.abs(neutral.idleSpeed - 0.8) < 0.01, neutral.err || `speed ${neutral.idleSpeed} 30 steps into an idle stretch (${neutral.speed} in state ${neutral.state} at the end)`);

// ---- the read changes what he does ------------------------------------------------
const far = await ev(async () => await window.__ae({ mode: 'far', frames: 1500 }));
const farLance = far.picks ? (far.picks.lanceWind || 0) / Math.max(1, far.n) : 0;
// The share alone could not tell the range read from no read: 13 picks, and the no-three-in-a-row rule caps lances near 2/3,
// so a build with the far bias (3 + 5) removed also drew 7 lances of 13 (2026-10-02 mutant). The weights he picks from are
// exact: with the bias every allowed lance carries 8 of at most 12 (>= 0.667); without it 3 of 4-7 (mean ~0.5).
ok('a kiting player at range is answered with Shard Lances (lance share >= 45%, and >= 60% of his pick weight whenever a lance is allowed)',
  !far.err && farLance >= 0.45 && far.lanceW.n > 0 && far.lanceW.mean >= 0.6 && far.why.some((w) => w === 'far'),
  far.err || `${(farLance * 100).toFixed(0)}% lances of ${far.n} picks; lance weight mean ${far.lanceW.mean} (min ${far.lanceW.min}) over ${far.lanceW.n} allowed picks; reads: ${[...new Set(far.why)].join(',')}`);
const hug = await ev(async () => await window.__ae({ mode: 'hug', frames: 1500 }));
// One Echo Step in a fight also happens with no pressure read at all (base weight 1, about one pick in eight): a build
// without the +7 still stepped once here (2026-10-02 mutant). On the picks he makes while pressed, the weights say it:
// with the read Echo Step carries 8 of 12-15 (>= 0.53); without it 1 of 5-8 (<= 0.2).
ok('a player hugging one flank and hammering him is Echo-Stepped to the other side (and Echo Step carries >= 40% of his pick weight on the pressed picks where it is allowed)',
  !hug.err && (hug.picks.echoWind || 0) >= 1 && hug.why.some((w) => w === 'pressed') && hug.echoPressedW.n > 0 && hug.echoPressedW.mean >= 0.4,
  hug.err || `${hug.picks.echoWind || 0} echo steps; echo weight mean ${hug.echoPressedW.mean} (min ${hug.echoPressedW.min}) over ${hug.echoPressedW.n} pressed picks; reads: ${[...new Set(hug.why)].join(',')}; boss x ${Math.round(hug.x)} vs player x ${Math.round(hug.px)}`);
const air = await ev(async () => await window.__ae({ mode: 'air', frames: 3000, seed: 20260925 }));
const airShard = air.picks ? (air.picks.shardfallWind || 0) / Math.max(1, air.n) : 0;
ok('a player living in the air draws Shardfall on the landing spot (share >= 35%)', !air.err && airShard >= 0.35 && air.why.some((w) => w === 'air'), air.err || `${(airShard * 100).toFixed(0)}% shardfall of ${air.n}; reads: ${[...new Set(air.why)].join(',')}`);
const heal = await ev(async () => await window.__ae({ mode: 'heal', frames: 900 }));
ok('a big heal is answered at once with a fast lance', !heal.err && heal.why.some((w) => w === 'heal'), heal.err || `reads: ${[...new Set(heal.why)].join(',')}`);
const stag = await ev(async () => await window.__ae({ mode: 'stagger', frames: 600 }));
ok('he creates nothing while staggered — that window stays the player\'s', !stag.err && stag.staggerFires === 0, stag.err || `${stag.staggerFires} attacks landed inside stagger`);

// ---- phases ------------------------------------------------------------------------
const evolved = await ev(async () => await window.__ae({ mode: 'dodgeR', frames: 1800, hpFrac: 0.4, evolved: true }));
// the gap is judged against where the player WAS when it fired (the AI records
// it) - the dodge-right script keeps them moving afterwards
const gapC = evolved.gap ? (evolved.gap.x0 + evolved.gap.x1) / 2 : null;
ok('evolved (<50%): Sky-Break appears, and its gap centres against a right-dodger — LEFT of the player, and still reachable',
  !evolved.err && (evolved.picks.skybreakWind || 0) >= 1 && gapC != null && gapC < evolved.gap.px - 100 && evolved.gap.px - gapC <= 320,
  evolved.err || `${evolved.picks.skybreakWind || 0} sky-breaks; dodge bias ${evolved.dodge}; gap [${evolved.gap ? Math.round(evolved.gap.x0) + '..' + Math.round(evolved.gap.x1) : '-'}] centre ${gapC != null ? Math.round(gapC) : '-'} vs player x at fire ${evolved.gap ? Math.round(evolved.gap.px) : '-'}`);
const astral = await ev(async () => await window.__ae({ mode: 'neutral', frames: 1500, hpFrac: 0.2, evolved: true }));
ok('under 25%: the Astral Echo fires — the existing astral art, wired to a five-lance salvo', !astral.err && (astral.picks.astral || 0) >= 1, astral.err || JSON.stringify(astral.picks));
ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' · '));

await browser.close(); server.kill();
let fail = 0;
for (const r of res) { if (!r.pass) fail++; console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.n + (r.extra ? '  — ' + r.extra : '')); }
console.log(`\n${res.length - fail}/${res.length} checks passed`);
process.exit(fail ? 1 : 0);
