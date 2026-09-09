// The Sovereign's Spire-Step and the expedition mob curve (v0.30.457). Per user: "make tower
// sovereign exp rewards 2.5x better, make towersovereign able to teleport horizontally but not jump
// at all" and "Increase the expedition monsters stats and HP more, but give EXP that is commensurate
// to those stats".
//
// The movement claims are measured by WATCHING a live Sovereign and reading the step counter the
// boss keeps — not by reading the constants back. Sampling positions alone cannot count steps: the
// cadence is in GAME FRAMES and headless runs well under 60 fps, so a wall-clock window sees fewer.
// The step rate is deliberately below the raw cadence because the Crown Regalia shield is up ~49% of
// the fight and the step stands down while it holds, so roughly half the opportunities are declined.
//   node scripts/sovereign_step_test.mjs      MOJI_GAME_FILE / MOJI_SERVE_ROOT / PORT override
// Negative control v0.30.456: exp 28000, jump 13, and x only ever changes by a walking stride.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 10321); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof monsterTypes === 'object' && typeof _lxStatToLevel === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(6000);
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
    try { _cineScoreStop(1, false); } catch (e) {}
    const o = { ver: GAME_VERSION };
    const S = monsterTypes.towerSovereign;
    o.sov = { exp: S.exp, jump: S.jump, hp: S.hp, atk: S.atk, def: S.def };
    o.mobMul = (typeof LX_EXPEDITION_MOB_MUL !== 'undefined') ? LX_EXPEDITION_MOB_MUL : null;
    // v0.30.471 — read the dials themselves. The old form asserted the literal 1.75 for both HP
    // and ATK and went red the moment v0.30.467 moved ATK to 2.05; a ratio checked against its
    // own constant states the invariant (the scaler applies what it is given) without pinning a
    // tuning value that is meant to move.
    o.muls = {
      hp:  (typeof LX_EXPEDITION_MOB_HP_MUL  !== 'undefined') ? LX_EXPEDITION_MOB_HP_MUL  : null,
      atk: (typeof LX_EXPEDITION_MOB_STAT_MUL !== 'undefined') ? LX_EXPEDITION_MOB_STAT_MUL : null,
      def: (typeof LX_EXPEDITION_MOB_DEF_MUL !== 'undefined') ? LX_EXPEDITION_MOB_DEF_MUL : null,
      exp: (typeof LX_EXPEDITION_MOB_EXP_MUL !== 'undefined') ? LX_EXPEDITION_MOB_EXP_MUL : null,
    };
    // ---- the expedition mob curve, measured through the real scaler against the real field baseline
    loadMap('tower_b3', 300); await sleep(800);
    game.expedition = { active: true, floor: 3, snapshot: null };
    player.level = 70; player.invulnerable = 9e9;
    const lv = _lxScaledMobLevel(player.level);
    const base = _lxFieldBaseline(lv);
    const probe = { level: 20, isBoss: false };
    _expeditionScaleMob(probe, player.level);
    o.mob = { lv, fieldHp: base.hp, fieldExp: base.exp, towerHp: probe.maxHp, towerExp: probe.exp, towerAtk: probe.atk, towerDef: probe.def,
      hpRatio: +(probe.maxHp / base.hp).toFixed(3), expRatio: +(probe.exp / base.exp).toFixed(3), atkRatio: +(probe.atk / base.atk).toFixed(3),
      defRatio: +(probe.def / (base.atk * 0.35)).toFixed(3) };
    // ---- WATCH a live Sovereign move
    loadMap('tower_b10', 300); await sleep(1000);
    game.expedition = { active: true, floor: 10, snapshot: null };
    game.monsters.length = 0;
    const b = spawnMonster(400, 300, 'towerSovereign', true);
    if (!b) return Object.assign(o, { err: 'no sovereign' });
    b._expeditionFinalBoss = true;
    b.currentHp = b.maxHp = 900000;          // survive the watch
    player.invulnerable = 9e9; player._god = true;
    o.spawned = { jump: b.jump, hp: b.maxHp };
    // let it FALL to the floor and settle first — it spawns in the air, and sampling through the
    // drop would read as "it left the ground" when all it did was land.
    await sleep(1500);
    const groundY = b.y;
    // Kite: keep the player far away and swap sides, so there is always a gap worth stepping across
    // and we see whether it can do this repeatedly rather than once.
    const samples = [];
    const t0 = performance.now();
    const f0 = (game.time | 0);
    await new Promise((done) => {
      (function watch() {
        const el = performance.now() - t0;
        player.x = (Math.floor(el / 2200) % 2 === 0) ? 1800 : 220;   // flip ends every 2.2 s
        player.y = groundY;
        player.invulnerable = 9e9;
        samples.push({ x: b.x, y: b.y, vy: b.vy || 0, onG: !!b.onGround });
        // `game.time` is a FRAME counter, and headless runs well under 60 fps — so wait on GAME
        // frames, not on the wall clock, or the cadence looks slower than it is in a real session.
        if ((game.time | 0) - f0 > 1400 || el > 90000 || b.currentHp <= 0) return done();
        requestAnimationFrame(watch);
      })();
    });
    // biggest single-frame horizontal move, and what y did across it
    let bigJump = 0, bigDy = 0, walkMax = 0, teleports = 0;
    for (let i = 1; i < samples.length; i++) {
      const dx = Math.abs(samples[i].x - samples[i - 1].x);
      const dy = Math.abs(samples[i].y - samples[i - 1].y);
      if (dx > 60) { teleports++; if (dx > bigJump) { bigJump = dx; bigDy = dy; } }
      else if (dx > walkMax) walkMax = dx;
    }
    const ys = samples.map((s) => s.y);
    o.watch = { frames: samples.length, teleports, biggestStep: Math.round(bigJump), dyAcrossStep: Math.round(bigDy),
      walkMaxPerFrame: +walkMax.toFixed(2),
      yMin: Math.round(Math.min(...ys)), yMax: Math.round(Math.max(...ys)),
      yRange: Math.round(Math.max(...ys) - Math.min(...ys)),
      everNegVy: samples.some((s) => s.vy < -1),
      gameFrames: (game.time | 0) - f0, stepCount: b._sovStepCount | 0, lastStep: b._sovStepLast | 0 };
    game.monsters.length = 0; player._god = false;
    return o;
  });
  if (r.err) throw new Error(r.err);
  console.log(`build ${r.ver}  sovereign exp ${r.sov.exp} jump ${r.sov.jump}  mob x${r.mobMul}`);
  ok('the Sovereign pays 2.5x — 28,000 -> 70,000 EXP', r.sov.exp === 70000, `${r.sov.exp}`);
  ok('the Sovereign cannot jump at all (jump: 0 on the type AND on the spawned boss)', r.sov.jump === 0 && r.spawned.jump === 0,
    `type ${r.sov.jump}, spawned ${r.spawned.jump}`);
  ok('...and watched live for 20s it never leaves the ground', r.watch.yRange <= 2 && !r.watch.everNegVy,
    `y range ${r.watch.yRange}px, ever launched ${r.watch.everNegVy}`);
  ok('it DOES teleport horizontally, repeatedly, and never further than one 420px stride', r.watch.stepCount >= 3 && r.watch.biggestStep > 200 && r.watch.biggestStep <= 425,
    `${r.watch.stepCount} steps over ${r.watch.gameFrames} game frames, biggest observed ${r.watch.biggestStep}px vs walk ${r.watch.walkMaxPerFrame}px/frame`);
  ok('the teleport is HORIZONTAL — y does not move across the step', r.watch.dyAcrossStep === 0, `dy ${r.watch.dyAcrossStep}px`);
  ok('the scaler applies each expedition dial it is handed — HP, ATK and DEF against a field monster of the same level',
    Math.abs(r.mob.hpRatio - r.muls.hp) < 0.02 && Math.abs(r.mob.atkRatio - r.muls.atk) < 0.02 && Math.abs(r.mob.defRatio - r.muls.def) < 0.02,
    `HP x${r.mob.hpRatio}/${r.muls.hp}, ATK x${r.mob.atkRatio}/${r.muls.atk}, DEF x${r.mob.defRatio}/${r.muls.def} (Lv ${r.mob.lv}: ${r.mob.fieldHp} -> ${r.mob.towerHp})`);
  ok('a tower mob hits harder than it is tough — the trade v0.30.471 made', r.mob.atkRatio > r.mob.hpRatio,
    `ATK x${r.mob.atkRatio} vs HP x${r.mob.hpRatio}`);
  ok('EXP is paid on its own dial, not swept along by the HP one', Math.abs(r.mob.expRatio - r.muls.exp) < 0.02,
    `EXP x${r.mob.expRatio}/${r.muls.exp} (${r.mob.fieldExp} -> ${r.mob.towerExp})`);
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { fail++; console.log('FAIL harness: ' + (e && e.message)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
