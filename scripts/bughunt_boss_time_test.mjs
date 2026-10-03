// BUG HUNT 2026-10-02, boss + pause-clock cluster (boss-1, boss-2, boss-4, boss-7, sibling2A-2, timers-1/2/7/8/9).
//   boss-1      a cancel that skips the sign handler (SPENT, stagger, phase-cross) stranded Taurus's front block, Virgo's ritual
//               (x0.4 damage taken), Gemini's lie (hits rejected) and Scorpio's burrow (immune, physics off, under the floor)
//   sibling2A-2 SPENT started no bigMelee but still started columnStrike (5 signs) and Taurus's brace charge
//   boss-2      a stunned / staggered trait boss kept sliding at lunge speed (the vx override ignored _ccHalted)
//   boss-4      King Krook's _kFR_<ms> rain beats survived a break, so the next rain skipped them
//   boss-7      the Scorpio death scrub named a type and a field that exist nowhere
//   timers      Siege Volley channel + cast lock, Holy Shield reflect, Backstab sleight gate, Mojimon QTE gate, status grace and
//               Aquarius's electrified pool were waited out behind a menu; two Date.now() throttles went dead on a clock rollback
// Every boss check drives a REALLY spawned boss in sim steps (game.time++ ; updateMonsters(16)); the pause checks use the live loop.
//   [SERVE_ROOT=<dir with serve.js>] [PORT=n] node scripts/bughunt_boss_time_test.mjs [candidate.html]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync, readFileSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '13995';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const env = { ...process.env }; if (cand) env.MOJI_GAME_FILE = path.resolve(SERVE_ROOT, cand); else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d !== undefined ? '  [' + (typeof d === 'string' ? d : JSON.stringify(d)) + ']' : '')); ok ? pass++ : fail++; };
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const SRC = readFileSync(path.resolve(SERVE_ROOT, cand || 'mojiworld_game.html'), 'utf8').replace(/\r\n/g, '\n');
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 200)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof castSkill === 'function' && typeof GAME_VERSION === 'string' && !!document.getElementById('lo-menu'), null, { timeout: 180000 });
  await page.waitForTimeout(3000);
  await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { _lxBootHold.release('menu'); } catch (e) {}
    player.level = 60; player.cls ||= 'warrior';
    try { player._storyBeatsSeen = new Proxy({}, { get: () => true, set: () => true }); } catch (e) {}
    player._gravitosCineSeen = true; player._tutorialSeen = true;
    loadMap('forest', 300); game.paused = false; await sleep(900);
    for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const o = document.getElementById(id); if (o) o.classList.remove('on'); }
    game.paused = false;
    // the shared rig: real bosses, driven in sim steps. The player stands `dx` px to the boss's right, pinned at full HP.
    const T = window.__bt = { dx: 120 };
    T.prep = () => { game.paused = false; game.monsters.length = 0; game.projectiles.length = 0; game.hazards.length = 0; if (game.damageNumbers) game.damageNumbers.length = 0;
      player._god = false; player.invulnerable = 9e9; player.hitStun = 0; player.stunTimer = 0; player.blockTimer = 0; player.maxHp = 2e6; player.hp = 2e6; game.comboMult = 1; T.dx = 120; };
    T.spawn = (type, x) => { const m = spawnMonster(x || 900, 300, type, true); if (!m || m._suppressed) return null;
      m.evasion = 0; m.currentHp = m.maxHp = 5e8; m._bossIntroDone = true; m._stagger = 0; m._staggerCd = 1e12; m._dirOpenT = 0; m._dirRollT = 1e12; m._dirStanceT = 1e12; return m; };
    T.step = (m, n, cb) => { for (let i = 0; i < n; i++) { game.paused = false; game.time++; game.hitStop = 0; game.camera.x = Math.max(0, m.x - W_PLAY / 2);
      player.x = m.x + m.w / 2 + T.dx; player.y = m.y; player.vx = 0; player.vy = 0; if (player.hp < player.maxHp) player.hp = player.maxHp; updateMonsters(16); if (cb) cb(i); } };
    T.hit = (m) => { game.comboMult = 1; game.combo = 0; m.invulnerable = 0; const hp0 = m.currentHp; hitMonster(m, 5000, 'melee'); return Math.round(hp0 - m.currentHp); };
    T.run = (fn) => { try { return fn(T); } catch (e) { return { err: String(e && e.stack || e).slice(0, 400) }; } };
  });
  const ver = await page.evaluate(() => GAME_VERSION); console.log('build ' + ver);
  // ---- helper: run an in-page scenario as `T.run(fn)` -------------------------------------------------------------------------------
  const scen = (body) => page.evaluate(`(() => window.__bt.run((T) => { ${body} }))()`);

  // ===== boss-1: Taurus =====================================================================================================================
  const plantFresh = `T.prep(); const m = T.spawn('zodiac_taurus'); T.step(m, 90); const out = { ctl: T.hit(m) };
    m.patternState = 'plant'; m.patternTimer = 2000; m._plantAnnounced = true; m._lastPlantAt = game.time | 0; m.facing = 1; T.step(m, 4); out.planted = m._frontBlocked === true; out.frontHitPlanted = T.hit(m);`;
  const tSpent = await scen(plantFresh + ` m._zSpentMs = ZODIAC_SPENT_MS; T.step(m, 30); out.fb = m._frontBlocked; out.pa = m._plantAnnounced; out.hit = T.hit(m); return out;`);
  check(!tSpent.err && tSpent.ctl > 0 && tSpent.planted && tSpent.frontHitPlanted === 0, 'RIG: Taurus plants, blocks a front hit, and a normal hit lands', tSpent);
  check(!tSpent.err && tSpent.fb === false && tSpent.hit > 0, 'boss-1: SPENT clears Taurus\'s front block - a front hit lands during the breather', { fb: tSpent.fb, hit: tSpent.hit });
  const tStag = await scen(plantFresh + ` m._stagger = 1500; T.step(m, 4); out.fb = m._frontBlocked; out.pa = m._plantAnnounced; out.state = m.patternState; out.hit = T.hit(m); return out;`);
  check(!tStag.err && tStag.fb === false && tStag.pa === false && tStag.state === 'idle' && tStag.hit > 0, 'boss-1: a stagger mid-plant clears the front block and the plant banner latch', { fb: tStag.fb, pa: tStag.pa, state: tStag.state, hit: tStag.hit });
  const tPhase = await scen(plantFresh + ` m.currentHp = Math.floor(m.maxHp * 0.60); T.step(m, 6); out.fb = m._frontBlocked; out.pa = m._plantAnnounced; out.phase = m.phase; out.hit = T.hit(m); return out;`);
  check(!tPhase.err && tPhase.phase === 2 && tPhase.fb === false && tPhase.pa === false && tPhase.hit > 0, 'boss-1: crossing a phase mid-plant clears the front block and the banner latch (the next plant is announced)', { phase: tPhase.phase, fb: tPhase.fb, pa: tPhase.pa, hit: tPhase.hit });
  // ===== boss-1: Virgo / Gemini / Scorpio (+ a Pisces control: the scrub is sign-scoped) =====================================================
  const virgoFresh = `T.prep(); const m = T.spawn('zodiac_virgo'); T.step(m, 90); const out = {};
    m._virgoChannel = 1100; m._virgoChannelHp = m.currentHp; m._virgoChanDmg = 0; m._virgoChanHits = 0; T.step(m, 3); out.channeling = m._virgoChanneling;`;
  const vSpent = await scen(virgoFresh + ` m._zSpentMs = ZODIAC_SPENT_MS; T.step(m, 20); out.ch = m._virgoChanneling; out.t = m._virgoChannel; return out;`);
  check(!vSpent.err && vSpent.channeling === true && !vSpent.ch && !vSpent.t, 'boss-1: SPENT ends Virgo\'s ritual - no x0.4 damage reduction for the whole breather', vSpent);
  const vStag = await scen(virgoFresh + ` m._stagger = 1500; T.step(m, 4); out.ch = m._virgoChanneling; out.t = m._virgoChannel; return out;`);
  check(!vStag.err && vStag.channeling === true && !vStag.ch && !vStag.t, 'boss-1: a stagger breaks Virgo\'s ritual too', vStag);
  const gemFresh = `T.prep(); const m = T.spawn('zodiac_gemini'); T.step(m, 90); const out = { ctl: T.hit(m) };
    m._geminiLying = true; m._geminiLyingUntil = (game.time | 0) + 210; m._dreamPhase = true; out.lieHit = T.hit(m);`;
  const gSpent = await scen(gemFresh + ` m._zSpentMs = ZODIAC_SPENT_MS; T.step(m, 20); out.lying = m._geminiLying; out.dream = m._dreamPhase; out.hit = T.hit(m); return out;`);
  check(!gSpent.err && gSpent.ctl > 0 && gSpent.lieHit === 0, 'RIG: a lying Gemini rejects hits, a normal one takes them', { ctl: gSpent.ctl, lieHit: gSpent.lieHit });
  check(!gSpent.err && !gSpent.lying && !gSpent.dream && gSpent.hit > 0, 'boss-1: SPENT ends Gemini\'s lie - hits land, no DECEIVED poison', { lying: gSpent.lying, dream: gSpent.dream, hit: gSpent.hit });
  const gStag = await scen(gemFresh + ` m._stagger = 1500; T.step(m, 4); out.lying = m._geminiLying; out.hit = T.hit(m); return out;`);
  check(!gStag.err && !gStag.lying && gStag.hit > 0, 'boss-1: a stagger ends Gemini\'s lie', { lying: gStag.lying, hit: gStag.hit });
  const scoFresh = `T.prep(); const m = T.spawn('zodiac_scorpio'); T.step(m, 90); const out = { ctl: T.hit(m) };
    m.patternState = 'burrow'; m.patternTimer = 300; T.step(m, 5); out.burrowed = { inv: m._invulnBurrow, ng: m._noGravity }; out.gy = m._burrowGroundY; out.sunk = Math.round(m.y - m._burrowGroundY);`;
  const sSpent = await scen(scoFresh + ` out.under = T.hit(m); m._zSpentMs = ZODIAC_SPENT_MS; T.step(m, 30); out.inv = m._invulnBurrow; out.ng = m._noGravity; out.dream = m._dreamPhase;
    out.dy = Math.round(m.y - out.gy); out.hit = T.hit(m); return out;`);
  check(!sSpent.err && sSpent.ctl > 0 && sSpent.burrowed.inv && sSpent.burrowed.ng && sSpent.sunk > 20 && sSpent.under === 0, 'RIG: a burrowed Scorpio is immune, sunk, with physics off', { ctl: sSpent.ctl, b: sSpent.burrowed, sunk: sSpent.sunk, under: sSpent.under });
  check(!sSpent.err && !sSpent.inv && !sSpent.ng && !sSpent.dream && Math.abs(sSpent.dy) <= 8 && sSpent.hit > 0, 'boss-1: SPENT surfaces Scorpio - not immune, gravity back, up at the floor', { inv: sSpent.inv, ng: sSpent.ng, dy: sSpent.dy, hit: sSpent.hit });
  const sStag = await scen(scoFresh + ` m._stagger = 1500; T.step(m, 4); out.inv = m._invulnBurrow; out.ng = m._noGravity; out.dy = Math.round(m.y - out.gy); out.hit = T.hit(m); return out;`);
  check(!sStag.err && !sStag.inv && !sStag.ng && Math.abs(sStag.dy) <= 8 && sStag.hit > 0, 'boss-1: a stagger mid-burrow surfaces Scorpio too', { inv: sStag.inv, ng: sStag.ng, dy: sStag.dy, hit: sStag.hit });
  const pisces = await scen(`T.prep(); const m = T.spawn('zodiac_pisces'); T.step(m, 90); m._dreamPhase = true; m._stagger = 1500; T.step(m, 4); const a = m._dreamPhase;
    m._zSpentMs = ZODIAC_SPENT_MS; m._stagger = 0; T.step(m, 10); return { stag: a, spent: m._dreamPhase };`);
  check(!pisces.err && pisces.stag === true && pisces.spent === true, 'control: the scrub is sign-scoped - Pisces keeps her Dream Realm through a stagger and SPENT', pisces);

  // ===== sibling2A-2: SPENT starts no pillar and no charge ======================================================================================
  const gate = (type, field, setup) => scen(`const run = (spent) => { T.prep(); const m = T.spawn('${type}'); T.step(m, 90); T.dx = 200; ${setup}
      m._zSpentMs = spent ? 1e9 : 0; let seen = 0, pillars = 0; T.step(m, 70, () => { if (m.${field}) seen++; ${setup.includes('_columnCd') ? "pillars = game.projectiles.filter((p) => p && p.owner === 'enemy' && p.skill === 'column').length;" : ''} }); return { seen, pillars }; };
    return { spent: run(true), free: run(false) };`);
  const gTaurus = await gate('zodiac_taurus', '_braceDashing', 'm._bdCd = 0;');
  check(!gTaurus.err && gTaurus.free.seen > 0, 'RIG: a free Taurus starts its brace charge', gTaurus.free);
  check(!gTaurus.err && gTaurus.spent.seen === 0, 'sibling2A-2: a SPENT Taurus starts no brace charge', gTaurus.spent);
  const gVirgo = await gate('zodiac_virgo', '_columnFiring', 'm._columnCd = 0;');
  check(!gVirgo.err && gVirgo.free.seen > 0, 'RIG: a free Virgo starts a pillar', gVirgo.free);
  check(!gVirgo.err && gVirgo.spent.seen === 0 && gVirgo.spent.pillars === 0, 'sibling2A-2: a SPENT Virgo starts no pillar (none telegraphs, none lands)', gVirgo.spent);
  const flight = await scen(`T.prep(); const m = T.spawn('zodiac_taurus'); T.step(m, 90); T.dx = 200;
    m._columnFiring = true; m._columnT = 700; m._columnTargetX = player.x; m._columnLanes = [player.x];
    m._braceDashing = true; m._bdPhase = 'brace'; m._bdT = 800; m._bdDir = 1; m._bdCd = 0; m._columnCd = 0;
    player.invulnerable = 0; player._god = false; player.hp = player.maxHp; m._despMove = 'hp1'; m._despState = null;
    for (let a = 0; a < 3 && !(m._zSpentMs > 0); a++) { game.paused = false; player.invulnerable = 0; player._god = false; player.blockTimer = 0; player.hp = player.maxHp; _zodiacDesperationFire(m, _zodiacConfig(m)); }
    const out = { spent: Math.round(m._zSpentMs), col: m._columnFiring, brace: m._braceDashing, hp: player.hp, inv: player.invulnerable | 0, god: !!player._god, blk: player.blockTimer | 0, desp: m._despMove }; player.invulnerable = 9e9; player.hp = player.maxHp;
    let pillars = 0, bseen = 0; T.step(m, 90, () => { if (m._braceDashing) bseen++; pillars = game.projectiles.filter((p) => p && p.owner === 'enemy' && p.skill === 'column').length; });
    out.pillars = pillars; out.bseen = bseen; return out;`);
  check(!flight.err && flight.spent > 7000 && flight.hp === 1, 'RIG: HEAVENSPLIT lands (1 HP) and starts the SPENT window', flight);
  check(!flight.err && !flight.col && !flight.brace && flight.pillars === 0 && flight.bseen === 0, 'sibling2A-2: HEAVENSPLIT drops a pillar and a charge already telegraphing', flight);

  // ===== boss-2: a stunned / staggered trait boss stops sliding ====================================================================================
  const lego = (cc) => `T.prep(); const m = T.spawn('legosaurus'); T.step(m, 90); T.dx = 600;
    const dash = () => { m._braceDashing = true; m._bdPhase = 'dash'; m._bdDir = 1; m._bdT = 380; m._bdTravel = 0; m._bdVx = 22.8; m._bdCd = 7500; m.vx = 22.8; };
    const slide = (n) => { const x0 = m.x; let vmax = 0; T.step(m, n, () => { vmax = Math.max(vmax, Math.abs(m.vx)); }); return { dx: Math.round(Math.abs(m.x - x0)), vmax: Math.round(vmax * 10) / 10 }; };
    dash(); const free = slide(18);
    T.step(m, 40); dash(); ${cc}; const out = { free, held: slide(30), still: !!m._braceDashing }; return out;`;
  const lStun = await scen(lego('m.stunTimer = 900'));
  check(!lStun.err && lStun.free.dx > 250 && lStun.free.vmax > 20, 'RIG: a free Legosaurus dash covers ground at ~22 px a step', lStun.free);
  check(!lStun.err && lStun.held.dx < 120 && lStun.held.vmax < 12, 'boss-2: a STUNNED Legosaurus stops sliding at lunge speed (was ~680 px in 30 steps)', lStun.held);
  const lStag = await scen(lego('m._stagger = 1000'));
  check(!lStag.err && lStag.held.dx < 120 && lStag.held.vmax < 12 && lStag.still === false, 'boss-2: a STAGGERED Legosaurus stops sliding and drops the charge', { held: lStag.held, charging: lStag.still });
  const latch = await page.evaluate(() => ({ list: _LX_BOSS_CYCLE_LATCHES.includes('_braceDashing'), clears: (() => { const m = { _braceDashing: true, _hgCharging: true }; _lxBossCycleLatchClear(m); return !m._braceDashing && !m._hgCharging; })() }));
  check(latch.list && latch.clears && SRC.includes("'_bigMeleeFiring', '_columnFiring', '_hgCharging', '_braceDashing',"), '_braceDashing is in the cycle latch list, on the line combat_backlog_test pins (after _hgCharging)', latch);
  const gHg = await scen(`T.prep(); const m = T.spawn('legosaurus'); T.step(m, 90); T.dx = 600;
    const go = (stun) => { m._hgCharging = true; m._hgPhase = 'dash'; m._hgVx = 20; m.vx = 20; m._hgT = 300; m.stunTimer = stun; const x0 = m.x; T.step(m, 20); return Math.round(Math.abs(m.x - x0)); };
    const free = go(0); T.step(m, 40); m._hgCharging = false; m.stunTimer = 0; return { free, dx: go(900) };`);
  check(!gHg.err && gHg.free > 250, 'RIG: a free hourglass lunge covers ground (the unhalted lunge is unchanged)', gHg);
  check(!gHg.err && gHg.dx < 120, 'boss-2: the hourglass lunge override honours a stun as well', gHg);

  // ===== boss-4: Krook's rain beats are cleared at entry ============================================================================================
  const rain = await scen(`T.prep(); const m = T.spawn('kingKrook'); m._krookInit = true; T.step(m, 60);
    const startRain = () => { m.patternState = 'fireballRain'; m.patternTimer = 0; m._kAnnounced = false; m._kFired = false; };
    const balls = () => game.projectiles.filter((p) => p && p.owner === 'enemy' && p.skill === 'firebomb').length;
    const guard = (k) => { m._stagger = 0; m._staggerCd = 1e12; m._dirOpenT = 0; m._dirRollT = 1e12; m._dirStanceT = 1e12; };
    startRain(); let g = 0; while (m.patternTimer < 1720 && g++ < 400) { guard(); T.step(m, 1); }
    const keys1 = Object.keys(m).filter((k) => k.startsWith('_kFR_')).length;
    m._stagger = 1000; T.step(m, 3); const state = m.patternState; m._stagger = 0;      // the break, mid-rain
    const keys2 = Object.keys(m).filter((k) => k.startsWith('_kFR_')).length;
    game.projectiles.length = 0; startRain(); g = 0;
    while (m.patternState === 'fireballRain' && g++ < 600) { guard(); T.step(m, 1); }
    return { beatsFired: keys1, stateAfterBreak: state, keysAfterBreak: keys2, rain2Balls: balls(), ended: m.patternState };`);
  check(!rain.err && rain.beatsFired >= 1 && rain.stateAfterBreak === 'idle', 'RIG: a rain is broken after its first beats have fired', rain);
  check(!rain.err && rain.rain2Balls === 12, 'boss-4: the next Fireball Rain after a break throws all 12 fireballs (base: it skips every beat already fired)', { balls: rain.rain2Balls, ended: rain.ended });

  // ===== timers-1/2/7/8: the pause clock (the LIVE loop: a solo game paused for 120 sim steps, vs the same 120 steps unpaused) =========================
  const pz = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const steps = async (n) => { const t0 = game.time | 0, g = performance.now(); while ((game.time | 0) - t0 < n && performance.now() - g < 25000) await sleep(16); return (game.time | 0) - t0; };
    game.monsters.length = 0; game.projectiles.length = 0; game.hazards.length = 0; game.paused = false;
    window.__clr = setInterval(() => { game.monsters.length = 0; }, 100);
    player._god = true; player.invulnerable = 9e9; player.hitStun = 0; player.hp = player.maxHp = 99999; player.maxMp = 999; player.mp = 999;
    const PF = ['_holyReflectUntil', '_sleightNextAt'];
    const lane = () => ({ type: 'meteor_warn', x: 0, y: 0, w: 10, h: 10, life: 5400, maxLife: 5400, fireAt: 5400, owner: 'enemy', damage: 1, color: '#66aaff', _aquaFlood: true, _sourceLabel: 'a Tidal Lane' });
    const run = async (paused) => {
      await steps(10); const t = game.time | 0;
      for (const f of PF) player[f] = t + 600;
      game._mojimonQteCdT = t + 600; player._statusGraceUntil = { burn: t + 600 };
      player._ballistaChannel = { startedAt: t, endsAt: t + 480, lastFireAt: t, lastSpriteAt: t, mpDrainAccum: 0 }; player._castLockUntil = t + 480;
      const a = lane(), b = lane(); a._aquaElectrified = t + 600; a._aquaShockOf = t + 600; b._aquaElectrified = t + 600; game.hazards = [a, b];
      game.paused = paused; const n = await steps(60); const still = game.paused; game.paused = false;
      const now = game.time | 0, ch = player._ballistaChannel, r = { n, still, left: {} };
      for (const f of PF) r.left[f] = player[f] - now;
      r.left.qte = game._mojimonQteCdT - now; r.left.grace = player._statusGraceUntil.burn - now; r.left.aqua = a._aquaElectrified - now; r.left.aquaUnshocked = b._aquaElectrified - now;
      r.ch = ch ? ch.endsAt - now : null; r.lock = player._castLockUntil - now; r.latch = a._aquaShockOf === a._aquaElectrified; r.latchB = b._aquaShockOf === undefined;
      player._ballistaChannel = null; player._castLockUntil = 0; game.hazards = [];
      for (const f of PF) player[f] = 0; game._mojimonQteCdT = 0; player._statusGraceUntil = {};
      return r;
    };
    let paused = await run(true); for (let k = 0; k < 3 && !(paused.still && paused.n >= 50); k++) paused = await run(true);   // the 3 s stuck-pause watchdog is wall-clock: retry a pause it released early
    const live = await run(false); clearInterval(window.__clr);
    return { paused, live };
  });
  const P = pz.paused, L = pz.live, left = (o, k) => (o.left || {})[k];
  check(P.n >= 50 && P.still === true && L.n >= 50, 'RIG: the clock ran >= 50 steps behind a held pause (and the pause was not released early)', { paused: P.n, still: P.still, live: L.n });
  const held = ['_holyReflectUntil', '_sleightNextAt', 'qte', 'grace', 'aqua', 'aquaUnshocked'].filter((k) => left(P, k) < 600 - 15);
  check(held.length === 0, 'timers-2/-7/-8: Holy Shield\'s reflect, the Backstab sleight gate, the Mojimon QTE gate, the status grace and the electrified pool all hold behind a pause', held.map((k) => k + ':' + left(P, k)));
  const drained = ['_holyReflectUntil', '_sleightNextAt', 'qte', 'grace', 'aqua', 'aquaUnshocked'].filter((k) => left(L, k) > 600 - 40);
  check(drained.length === 0, 'CONTROL: unpaused, every one of them drains', drained.map((k) => k + ':' + left(L, k)));
  check(P.ch !== null && P.ch >= 480 - 15 && Math.abs(P.lock - P.ch) <= 2, 'timers-1: the Siege Volley channel and the cast lock hold TOGETHER behind a pause', { ch: P.ch, lock: P.lock });
  check(L.ch !== null && L.ch <= 480 - 40, 'CONTROL: unpaused, the channel drains', { ch: L.ch });
  check(P.latch === true && P.latchB === true, 'timers-7: the pool\'s once-per-electrify latch moves WITH the deadline (no second 35% shock on unpause); an unshocked pool stays unlatched', { latch: P.latch, unshocked: P.latchB });

  // ===== timers-9: a clock set back no longer freezes the two Date.now() throttles ==============================================================
  const clk = await page.evaluate(() => {
    const out = {}; const realPost = window._lxCloudPost, realSess = LXAuth.session;
    game._forcePhase = 22;
    _LX_DAYPH = { t: Date.now() + 3600000, phase: 'day', alpha: 0, style: '' }; out.rolledBack = _lxDayPhase().phase;                  // an hour in the future
    _LX_DAYPH = { t: Date.now() - 100, phase: 'day', alpha: 0, style: '' }; out.cached = _lxDayPhase().phase;                          // control: inside 2 s it stays cached
    _LX_DAYPH = { t: Date.now() - 5000, phase: 'day', alpha: 0, style: '' }; out.stale = _lxDayPhase().phase;                          // control: older than 2 s recomputes
    delete game._forcePhase; _LX_DAYPH = { t: 0, phase: 'day', alpha: 0, style: '' };
    let calls = 0; window._lxCloudPost = () => { calls++; }; LXAuth.session = () => ({ kind: 'cloud', token: 'x', name: 'n' });
    try {
      _lxCloudPushAt = Date.now() + 3600000; _lxCloudPushSave('{}', false); out.afterRollback = calls;
      _lxCloudPushAt = Date.now() - 1000; _lxCloudPushSave('{}', false); out.throttled = calls;
      _lxCloudPushAt = Date.now() - 20000; _lxCloudPushSave('{}', false); out.afterWindow = calls;
    } finally { window._lxCloudPost = realPost; LXAuth.session = realSess; _lxCloudPushAt = 0; }
    return out;
  });
  check(clk.rolledBack === 'night' && clk.cached === 'day' && clk.stale === 'night', 'timers-9: the day tint recomputes after a clock rollback (controls: cached inside 2 s, recomputed after)', clk);
  check(clk.afterRollback === 1 && clk.throttled === 1 && clk.afterWindow === 2, 'timers-9: the cloud push is not throttled by a future stamp (controls: a push 1 s ago still throttles, 20 s ago pushes)', clk);

  // ===== boss-7: the Scorpio death scrub finds Scorpio (runs last: a boss kill opens the reward flow) ================================================
  check(SRC.includes("if (m.zodiacSign === 'scorpio') {") && !SRC.includes("m.zodiacId === 'scorpio'"), 'boss-7: the death scrub tests the real field (zodiacSign), not a type / field that exist nowhere');
  const sco = await scen(`T.prep(); const m = T.spawn('zodiac_scorpio'); T.step(m, 30); const other = T.spawn('zodiac_leo', 1500); T.step(m, 5);
    const pool = () => game.hazards.filter((h) => h && (h.type === 'venom_pool' || h.type === 'venom_burst')).length;
    for (const type of ['venom_pool', 'venom_burst']) game.hazards.push({ type, x: m.x, y: m.y + m.h - 20, w: 120, h: 24, life: 300, maxLife: 300, owner: 'enemy', damage: 1 });
    const before = pool(); other.currentHp = other.maxHp; killMonster(m); const res = { before, after: pool(), otherAlive: game.monsters.includes(other) }; game.hazards.length = 0; game.monsters.length = 0; return res;`);
  check(!sco.err && sco.before === 2 && sco.otherAlive && sco.after === 0, 'boss-7: killing Scorpio sweeps her venom pools even while another boss is still up', sco);
  await page.evaluate(() => { try { closeAllModals(); } catch (e) {} game.paused = false; });

  // ===== FOOTER =====
  check(errs.length === 0, 'no page errors', errs.slice(0, 3).join(' | '));
} finally { await browser.close(); try { server.kill(); } catch (e) {} }
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
