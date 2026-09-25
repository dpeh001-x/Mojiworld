// Live test: King Krook + Octobaby threat pass. Per user: "Audit krook, and octababy boss fights patterns,
// ensure they are AAA standard and pose a good challenge with occasional max % hp damage so players cant
// take their attacks forgranted", and "strengthen krook_ground shows an intermittent weak jump-slam with
// partial % Max HP damage".
//
// Graded in SIM STEPS, damage attributed per source against the LIVE max HP. Each check below was a
// measured failure on v0.30.988: the jump slam's landing never fired (the pattern timed out mid-air), a
// free opening due mid-leap cut the leap to 14-121 px, the Mega Fireball flew over every grounded player,
// the Meltdown landed 49% at any distance, and the Tidal Sweep rolled the generic 15%.
// Harness controls, each one a false reading it removes: stats SETTLE before HP is filled (getMaxHp rises
// a frame after a level change); arena hazards are off; evasion is pinned and set per case; Octobaby's arms
// are taken out of the fight (their orbit lands a hit mid-step whose i-frames read as a dodged Meltdown);
// the boss is frozen once the move under test is away.
//   node scripts/boss_threat_test.mjs [file.html] [port]
import { chromium } from 'playwright-core';
import { existsSync, readFileSync } from 'node:fs';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);
const FILE = process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const PORT_ARG = process.argv[3];
const net_ = await import('node:net');
const free = (p) => new Promise((r) => { const s = net_.createServer(); s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = PORT_ARG; for (let p = 18751; p <= 18999 && !PORT; p++) if (await free(p)) PORT = String(p);
const { spawn } = await import('node:child_process');
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });

async function PROBE(file) {
  const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/${file}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof bossAI === 'function' && typeof updateMonsters === 'function', null, { timeout: 120000 });
  await page.waitForLoadState('load', { timeout: 120000 }).catch(() => {});
  const r = await page.evaluate(async () => {
    const raf = () => new Promise(res => requestAnimationFrame(res));
    const R = { ver: GAME_VERSION };
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player._storyBeatsSeen = new Proxy({}, { get: () => true });
    window.updateMapEvents = () => {};                         // no arena hazards
    let EVA = 0; const _ge = window.getEvasion; window.getEvasion = function () {
      if (player._dashEvadeUntil && (game.time | 0) < player._dashEvadeUntil) return _ge.apply(this, arguments);
      return EVA; };
    let steps = 0; const _up = window.updateMonsters;
    window.updateMonsters = function () { const x = _up.apply(this, arguments); steps++; return x; };
    let REC = null, lastHp = null;
    const tick = () => { if (game.hazards) game.hazards.length = 0; if (!REC) return; const h = player.hp;
      if (lastHp != null && h < lastHp - 0.5) { const s = String(player._lastDamageSource || '?'); const mh = getMaxHp();
        REC[s] = +((REC[s] || 0) + 100 * (lastHp - h) / mh).toFixed(1); } lastHp = h; };
    const waitSteps = async (n, each) => { const s0 = steps; let g = 0, ls = steps;
      while (steps - s0 < n && g++ < 30000) { await raf(); if (steps !== ls) { ls = steps; tick(); if (each && each()) break; } } return steps - s0; };
    const rec = () => { REC = {}; lastHp = player.hp; return REC; };
    const setLv = async (lv) => { player.cls = 'archer'; player.level = lv; player._god = false; player.blockTimer = 0; player._aegis = false;
      player.invulnerable = 0; player.hitStun = 0; player.stunTimer = 0; player._dashEvadeUntil = 0;
      await waitSteps(4); player.maxHp = getMaxHp(); player.hp = player.maxHp; player.invulnerable = 0; };
    const enter = async (id) => { loadMap(id); await waitSteps(30); game.paused = false; await waitSteps(20); game.paused = false; };

    // ───────────────── KING KROOK ─────────────────
    await enter('krookThrone');
    const k = game.monsters.find(m => m && m.type === 'kingKrook');
    const G = game.mapData.platforms.find(p => p.type === 'ground').y;
    const krookAt = (x) => { k.x = x; k.y = G - k.h; k.vx = 0; k.vy = 0; k.onGround = true; k._stagger = 0; k._dirOpenT = 0; k._break = 0; k._dirGuardT = 0; k._dirGhostT = 0; k._dirStanceT = 1e12;
      k.facing = 1; k._bossFaceHoldT = 999; k._dirRollT = 999999; game.projectiles.length = 0; };
    const slam = async (o) => {
      krookAt(400); if (o.rollPreset) k._dirRollT = o.rollPreset; player.x = o.px; player.y = (o.py || G) - player.h; player.vx = 0; player.vy = 0;
      await setLv(o.lv || 60); if (o.safe) player.invulnerable = 9e9;
      k.patternState = 'jumpSlam'; k.patternTimer = 0; k._kFired = false; k._kJumped = false; k._kJumpAir = false;
      let peak = G, air = false, took = null, landStep = null, waves = 0, cancel = null, opened = null, froze = false, jumped = false; const s0 = steps; const src = rec();
      await waitSteps(260, () => {
        const f = k.y + k.h; if (f < peak) peak = f;
        if (k.vy < -1 && took == null) { took = steps - s0; if (o.rollAtTakeoff) { k._dirRollT = 1; k._dirGuardT = 0; k._dirGhostT = 0; } }
        if (!k.onGround) air = true; if (air && k.onGround && landStep == null) landStep = steps - s0;
        const ws = game.projectiles.filter(p => p && p.owner === 'enemy' && (p._krookSlam || p.skill === 'shock'));
        waves = Math.max(waves, ws.length);
        if (opened == null && k._dirOpenT > 0) opened = steps - s0;
        if (cancel == null && k.patternState !== 'jumpSlam') cancel = { at: steps - s0, byOpening: k._dirOpenT > 0 };
        if (ws.length && !froze && !o.rollAtTakeoff) { froze = true; k._stagger = 1e9; }          // nothing after the slam
        if (o.jumpIt && !jumped && player.onGround) for (const w of ws) { const gap = player.x - (w.x + w.w); if (w.vx > 0 && gap > 0 && gap < 7.5 * 11) { game.keys[' '] = true; jumped = steps; break; } }
        if (o.jumpIt && jumped && steps - jumped > 30) game.keys[' '] = false;
        game.projectiles = game.projectiles.filter(p => p && (p._krookSlam || p.skill === 'shock'));
        return landStep != null && steps - s0 > landStep + 75;
      });
      game.keys[' '] = false; REC = null; k._stagger = 0;
      return { feetBefore: null, rose: Math.round(G - peak), took, landStep, waves, cancel, openedAt: opened, src };
    };
    R.krook = {
      clean: [await slam({ px: 1050, safe: true }), await slam({ px: 1050, safe: true }), await slam({ px: 1050, safe: true })],
      hitLv50: await slam({ px: 1000, lv: 50 }), hitLv90: await slam({ px: 1000, lv: 90 }),
      jumpIt: await slam({ px: 1000, lv: 90, jumpIt: true }),
      onLedge: await (async () => { const L = game.mapData.platforms.filter(q => q.type !== 'ground' && q.x > 800).sort((a, b) => a.y - b.y).pop(); return slam({ px: L.x + L.w / 2 - 14, py: L.y, lv: 90 }); })(),
      rollAtTakeoff: await slam({ px: 1050, safe: true, rollAtTakeoff: true }),
      rollPreset: await (async () => { const r = await slam({ px: 1050, safe: true, rollPreset: 520 }); return r; })(),
    };
    const mega = async (lv, eva) => {
      krookAt(300); player.x = 900; player.y = G - player.h; player.vx = 0; player.vy = 0; await setLv(lv); EVA = eva || 0;
      k.patternState = 'megaFireball'; k.patternTimer = 0; k._kFired = false; k._megaAnnounced = false; let froze = false; const src = rec();
      await waitSteps(420, () => { if (k._kFired && !froze) { froze = true; k._stagger = 1e9; }
        game.projectiles = game.projectiles.filter(p => p && p.skill === 'firebomb' && p.w > 200); player.x = 900; player.vx = 0; return false; });
      REC = null; EVA = 0; k._stagger = 0; return src;
    };
    R.krook.megaLv50 = await mega(50); R.krook.megaLv90 = await mega(90); R.krook.megaLv90eva90 = await mega(90, 0.9);

    // ───────────────── OCTOBABY ─────────────────
    await enter('octopusGrotto');
    const o = game.monsters.find(m => m && m.type === 'octobaby');
    const GO = 480;
    // the arms OUT of the fight, not merely moved: their orbit pulls them back onto the player DURING the
    // step, before any per-step cleanup runs, and one hit grants 1 s of i-frames that read as a dodged Meltdown.
    const calm = () => { game.projectiles = (game.projectiles || []).filter(p => p && p.skill === 'tidalSweep');
      game.monsters = game.monsters.filter(m => !(m && /^octoLeg/.test(m.type)));
      o._legRefs = []; o._octoBroken = true; o._octoBreakT = 0; o._octoRegrowT = 1e12;
      o._headMissileAt = 1e12; o._bubbleBeats = [true, true, true, true]; o._octoMoodT = 0; };
    const settle = async () => { calm(); player.x = 150; player.y = GO - player.h; await waitSteps(12, () => { calm(); return false; }); };
    const melt = async (dx, lv, run) => {
      await settle(); o._crazyActive = false; o._crazyT = 999999; o._octoEvt = 0;
      const cx = o.x + o.w / 2; player.x = cx + dx - player.w / 2; player.y = GO - player.h; player.vx = 0; player.vy = 0;
      await setLv(lv); calm(); player.x = cx + dx - player.w / 2; player.y = GO - player.h; player.invulnerable = 0; player.hp = getMaxHp();
      o._crazyT = 1;
      const s0 = steps; let tele = null; const src = rec();
      await waitSteps(420, () => { calm(); if (!run) { player.x = o.x + o.w / 2 + dx - player.w / 2; player.vx = 0; } else { player.x = Math.min(game.mapData.worldWidth - player.w - 8, player.x + getSpeed()); }   /* a player RUNNING away at their own run speed: headless key input is focus-flaky, so the run is applied directly */
        if (tele == null && o._crazyPhase === 'unleash') tele = steps - s0; return tele != null && steps - s0 > tele + 8; });
      REC = null; o._crazyT = 999999;
      return { dx, ranTo: Math.round(player.x + player.w / 2 - cx), teleSteps: tele, src };
    };
    R.octo = { meltEdge: await melt(190, 60), meltFar: await melt(520, 60), meltRun: await melt(170, 60, true) };
    const sweep = async (lv, eva) => {
      await settle(); o._crazyT = 999999; o._crazyActive = false; o._enraged = true; o._octoEvt = 0; o._octoSweepWarn = 0; o._octoSweepT = 1;
      player.x = o.x + o.w / 2 + 380; player.y = GO - player.h; player.vx = 0; player.vy = 0; await setLv(lv); EVA = eva || 0;
      const src = rec();
      await waitSteps(300, () => { calm(); player.x = o.x + o.w / 2 + 380; player.vx = 0; return false; });
      REC = null; EVA = 0; o._octoSweepT = 999999; return src;
    };
    R.octo.sweepLv50 = await sweep(50); R.octo.sweepLv90 = await sweep(90); R.octo.sweepLv90eva90 = await sweep(90, 0.9);
    window.updateMonsters = _up; window.getEvasion = _ge;
    return R;
  });
  r.errs = errs.slice(0, 3);
  return r;
}
const R = await PROBE(FILE);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const K = R.krook, O = R.octo, pct = (src, key) => (src && src[key]) || 0, near = (v, want) => Math.abs(v - want) <= 1;
const SLAM = "King Krook's jump slam";
ok('no page errors', (R.errs || []).length === 0, R.errs);
// ── King Krook: the jump slam ─────────────────────────────────────────────────
ok('JUMP SLAM: every leap is full height (>= 180 px)', K.clean.every(c => c.rose >= 180), K.clean.map(c => c.rose));
ok('JUMP SLAM: every landing sends two shockwaves', K.clean.every(c => c.waves === 2), K.clean.map(c => c.waves));
ok('JUMP SLAM: the move lasts until he is DOWN (it ends after the landing, not mid-air)',
  K.clean.every(c => c.landStep != null && c.cancel && c.cancel.at >= c.landStep), K.clean.map(c => [c.landStep, c.cancel && c.cancel.at]));
ok('a wave takes 25% of max HP at Lv 50', near(pct(K.hitLv50.src, SLAM), 25), K.hitLv50.src);
ok('...and the same 25% at Lv 90 (no out-level falloff)', near(pct(K.hitLv90.src, SLAM), 25), K.hitLv90.src);
ok('a held jump clears the wave', pct(K.jumpIt.src, SLAM) === 0, K.jumpIt.src);
ok('a player on a raised ledge is above the wave', pct(K.onLedge.src, SLAM) === 0, K.onLedge.src);
ok('an opening due AT TAKE-OFF no longer cuts the leap (was 14 px)', K.rollAtTakeoff.rose >= 180 && K.rollAtTakeoff.waves === 2,
  { rose: K.rollAtTakeoff.rose, waves: K.rollAtTakeoff.waves });
ok('an opening due MID-LEAP no longer cuts it either (was 121 px)', K.rollPreset.rose >= 180 && K.rollPreset.waves === 2,
  { rose: K.rollPreset.rose, waves: K.rollPreset.waves });
ok('...the opening is deferred, not discarded: it opens once the slam is over',
  K.rollAtTakeoff.openedAt != null && K.rollAtTakeoff.cancel && K.rollAtTakeoff.openedAt >= K.rollAtTakeoff.cancel.at,
  { openedAt: K.rollAtTakeoff.openedAt, slamEnded: K.rollAtTakeoff.cancel && K.rollAtTakeoff.cancel.at });
// ── King Krook: the Mega Fireball ─────────────────────────────────────────────
ok('MEGA FIREBALL: it reaches a grounded player (it used to fly over the floor)', pct(K.megaLv50, 'a Mega Fireball') > 0, K.megaLv50);
ok('MEGA FIREBALL: 40% of max HP at Lv 50', near(pct(K.megaLv50, 'a Mega Fireball'), 40), K.megaLv50);
ok('MEGA FIREBALL: 40% at Lv 90', near(pct(K.megaLv90, 'a Mega Fireball'), 40), K.megaLv90);
ok('MEGA FIREBALL: passive evasion cannot roll it away (90% evasion)', near(pct(K.megaLv90eva90, 'a Mega Fireball'), 40), K.megaLv90eva90);
// ── Octobaby ──────────────────────────────────────────────────────────────────
const MELT = 'Octobaby Eight-Mood Meltdown';
ok('MELTDOWN: inside its reach it still takes 49%', near(pct(O.meltEdge.src, MELT), 49), O.meltEdge.src);
ok('MELTDOWN: outside its reach (520 px) it takes nothing', pct(O.meltFar.src, MELT) === 0, O.meltFar.src);
ok('MELTDOWN: a player running from the head at run speed escapes it', pct(O.meltRun.src, MELT) === 0 && O.meltRun.ranTo > 440, { ranTo: O.meltRun.ranTo, src: O.meltRun.src });
ok('MELTDOWN: the windup is unchanged (~2.3 s)', Math.abs((O.meltEdge.teleSteps || 0) - 139) <= 6, O.meltEdge.teleSteps);
ok('TIDAL SWEEP: 25% of max HP at Lv 50 and Lv 90', near(pct(O.sweepLv50, 'the Tidal Sweep'), 25) && near(pct(O.sweepLv90, 'the Tidal Sweep'), 25), [O.sweepLv50, O.sweepLv90]);
ok('TIDAL SWEEP: passive evasion cannot roll it away (90% evasion)', near(pct(O.sweepLv90eva90, 'the Tidal Sweep'), 25), O.sweepLv90eva90);
// ── wiring ────────────────────────────────────────────────────────────────────
const src = readFileSync(FILE, 'utf8');
ok('co-op: guests keep the must-dodge rule on mirrored shots', src.includes("'pierce', '_noEvasion'];"), '');
ok('the slam waves draw as a ground shockwave sized to their hitbox (not the old purple swirl)',
  src.includes("skill: 'smash', _srcType: m.type,") && src.includes("_krookSlam: true,"), '');
ok("the Meltdown's reach is drawn every frame of its windup", src.includes('function _lxDrawMeltRing() {')
  && src.includes("if (typeof _lxDrawMeltRing === 'function') _lxDrawMeltRing();"), '');
ok('co-op: an older build in the room still takes the flat 49% Meltdown', src.includes("kind === 'obMelt' ? 0.49 : 0;"), '');
for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter(q => q.pass).length}/${results.length} checks passed`);
await b.close(); srv.kill();
process.exit(results.every(q => q.pass) ? 0 : 1);
