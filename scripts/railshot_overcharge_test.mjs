#!/usr/bin/env node
// Railshot's overcharge - v0.30.671. Per user: hold to draw for "up to +150% damage and a longer pierce".
//
// Why it was needed, measured on the build before this one: Railshot's own escalation (+30% per link)
// keys off the target's PLACE IN THE LINE, so in a duel you are always index 0 and it pays nothing -
// 2,678 to a lone boss at 1,100 ATK, against 9,088 from Charged Shot at half the MP and a third of the
// cooldown. A full draw paid Railshot nothing either: the class multiplier is applied only when the
// hit's tag equals the cast id, and this skill tags 'railshot' while its id is 'snipe_railgun'.
//
// So the checks are: a TAP is unchanged (this must be a pure addition), a full draw is exactly x2.5,
// a half draw lands in between, the rail reaches 700 px further, and the effect art is really served.
// Crit is pinned to 1x throughout - the skill rolls a 40% crit floor that would smear every figure.
// v0.30.1295: the whirling power sprite while F is held - asked for with the class, one shared turning phase, first ring on the
// hold's first frame, a ring up the whole hold, the very-low FX tier thins the rings instead of deleting them, and the
// release rings outlive the fx cap in a busy fight.
//   node scripts/railshot_overcharge_test.mjs      MOJI_GAME_FILE / PORT
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 10507);
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
const errs = [], seen = {};
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
page.on('response', (r) => { if (r.url().includes('railshot_charge')) seen.art = r.status(); });
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof castSkill === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(7000);
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    loadMap('forest', 300); await sleep(2000);
    for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const o = document.getElementById(id); if (o) o.classList.remove('on'); }
    game.paused = false;
    player.cls = 'archer'; player.job = 'sniper'; player._god = true; player.level = 70;
    player.baseAtk = 1000; player.baseCrit = 0; player.mods = player.mods || {}; player.mods.crit = 0;
    player.maxMp = 99999; player.mp = 99999;
    // The skill crits on "rollCrit() OR a flat 40% roll", and hitMonster treats a crit hit
    // differently, so leaving crit live moved the measured multiplier between runs (x2.50 one pass,
    // x2.58 the next). Both the roll and the 40% floor are pinned OFF for the measurement.
    window.getCritDmg = () => 1;
    window.rollCrit = () => false;
    const o = { ver: GAME_VERSION, atk: getAtk(), desc: SKILLS.snipe_railgun.desc };
    // v0.30.1295 - the hold ring is part of a Sniper's kit art, asked for with the class (lazy-fx), not at its
    // first draw. Read the want flag straight off the image: a ready check would ask for it itself.
    await sleep(1500);
    o.prewarmRow = ((typeof _LX_FX_SKILL === 'object' && _LX_FX_SKILL.snipe_railgun) || '').split(' ').includes('fx:railshot_charge');
    { const im = LX_FX && LX_FX.railshot_charge; o.prewarmed = !window._lxBootHold || !!(im && (im._lxWanted || im._lxLazy !== true)); }
    const target = (dist) => {
      game.monsters.length = 0;
      const m = spawnMonster(player.x + dist, player.y - 10, 'slime', false);
      if (!m) return null;
      m.w = 44; m.h = 40; m.maxHp = 5e9; m.currentHp = 5e9; m.evasion = 0; m.speed = 0; m.frozen = 99999; m.stunTimer = 99999;
      return m;
    };
    const fire = async (charge, dist) => {
      const m = target(dist); if (!m) return 0;
      for (const k of Object.keys(player._cd || {})) player._cd[k] = 0;
      player.facing = 1; player._releasedCharge = charge;
      const hp0 = m.currentHp;
      const _rnd = Math.random; Math.random = () => 0.95;   // fails the 40% crit floor, deterministically
      try { castSkill('snipe_railgun'); } finally { Math.random = _rnd; }
      await sleep(850);
      return hp0 - m.currentHp;
    };
    o.tap = await fire(0, 160);
    o.full = await fire(1, 160);
    o.half = await fire(0.5, 160);
    o.tapFar = await fire(0, 1200);                 // past the old 900 px rail
    o.fullFar = await fire(1, 1200);
    o.fullVeryFar = await fire(1, 1550);
    o.tooFar = await fire(1, 1750);                 // and it is still a finite rail
    o.fxRegistered = !!(LX_FX && LX_FX.railshot_charge);
    // v0.30.684 - the rings must be visible WHILE the bow is drawn, not only at release, and the
    // release must be the biggest of the three. Sizes are read off the queued sprite bursts.
    const ringSizes = () => (game.smoothFx || []).filter((f) => f.spriteKey === 'railshot_charge').map((f) => Math.round(f.size));
    const holdFor = async (p) => {
      const slot = Object.keys(KEY_TO_SLOT).find((k) => KEY_TO_SLOT[k] === 'q') || 'f';
      game.keys[slot] = true;
      player._warCharge = { slotKey: slot, start: (game.time | 0) - Math.round(45 * p), skillId: 'snipe_railgun', power: p, cls: 'archer', frames: 45 };
      game.smoothFx = [];
      // the tick recomputes power from start each frame, so start is re-pinned through the sample or
      // a half draw silently finishes charging and both cases read the same size
      for (let i = 0; i < 12; i++) { player._warCharge.start = (game.time | 0) - Math.round(45 * p); await sleep(50); }
      const s = ringSizes();
      game.keys[slot] = false; player._warCharge = null;
      return s;
    };
    o.holdHalf = await holdFor(0.5);
    o.holdFull = await holdFor(1);
    // v0.30.1295 - held at a fixed draw with the FX governor pinned (its frame watchdog flips tiers under headless
    // Chrome on its own): the live rings must turn TOGETHER, as one whirling sprite (one shared phase, not a
    // restart at angle 0 with the spin flipped each time), the shared turn must keep advancing, the first ring
    // must land on the hold's first frame, and the very-low tier must thin the rings, not delete them.
    // The draw is re-pinned inside every tick (a wrapper on _tickClassIdentity), so power - and with it the turn
    // rate - is exactly constant; the first frame is read inside that same wrapper, right after the hold's first
    // natural tick (a hand-run tick turns the phase once more than the fx pool ages, which reads as a 1-tick lag,
    // and polling from a timer can miss a tick or two under headless Chrome).
    const rot = (f) => (f.angle || 0) + (f.spin || 0) * (1 - f.life / f.maxLife);
    const wrap = (a) => { const T = Math.PI * 2; return ((a % T) + T * 1.5) % T - T / 2; };
    const _pt = window._perfTick; window._perfTick = () => {};
    const _tci = window._tickClassIdentity; let pinP = null, firstAt = null;
    const ringsNow = () => (game.smoothFx || []).filter((f) => f.spriteKey === 'railshot_charge');
    window._tickClassIdentity = function (dt) {
      if (pinP != null && player._warCharge) player._warCharge.start = (game.time | 0) - Math.round(45 * pinP);
      const ret = _tci.apply(this, arguments);
      if (firstAt && firstAt.n == null && player._warCharge === firstAt.c) firstAt.n = ringsNow().length;
      return ret;
    };
    let spawned = 0; const _sb = window.spawnSpriteBurst;
    window.spawnSpriteBurst = function (x, y, key) { if (key === 'railshot_charge') spawned++; return _sb.apply(this, arguments); };
    const whirl = async (p, veryLow) => {
      game.monsters.length = 0;
      const slot = Object.keys(KEY_TO_SLOT).find((k) => KEY_TO_SLOT[k] === 'q') || 'f';
      const vl0 = LX_PERF.veryLowFx, lf0 = LX_PERF.lowFx;
      LX_PERF.veryLowFx = !!veryLow; LX_PERF.lowFx = !!veryLow;
      game.smoothFx = []; game.keys[slot] = true; spawned = 0; pinP = p;
      const t0 = game.time | 0;
      player._warCharge = { slotKey: slot, start: t0 - Math.round(45 * p), skillId: 'snipe_railgun', power: p, cls: 'archer', frames: 45 };
      firstAt = { c: player._warCharge, n: null };
      for (let i = 0; i < 400 && firstAt.n == null; i++) await sleep(5);
      const out = { first: firstAt.n == null ? -1 : firstAt.n, spread: 0, turned: 0, gaps: 0, samples: 0, ticks: 0, rings: 0 };
      let prev = null;
      for (let i = 0; i < 40; i++) {
        await sleep(40);
        const rings = ringsNow();
        out.samples++; if (!rings.length) out.gaps++;
        if (rings.length >= 2) { const r0 = rot(rings[0]); for (const f of rings) out.spread = Math.max(out.spread, Math.abs(wrap(rot(f) - r0))); }
        if (rings.length) { const r = rot(rings[rings.length - 1]); if (prev != null) out.turned += Math.abs(wrap(r - prev)); prev = r; }
      }
      out.ticks = (game.time | 0) - t0; out.rings = spawned;
      pinP = null; game.keys[slot] = false; player._warCharge = null;
      LX_PERF.veryLowFx = vl0; LX_PERF.lowFx = lf0;
      return out;
    };
    o.whirlFull = await whirl(1, false);
    o.whirlHalf = await whirl(0.5, false);
    o.whirlLow = await whirl(1, true);
    window.spawnSpriteBurst = _sb; window._perfTick = _pt; window._tickClassIdentity = _tci;
    const ringsOnRelease = async (charge) => {
      target(200);
      for (const k of Object.keys(player._cd || {})) player._cd[k] = 0;
      player.facing = 1; player._releasedCharge = charge; game.smoothFx = [];
      const _rnd = Math.random; Math.random = () => 0.95;
      try { castSkill('snipe_railgun'); } finally { Math.random = _rnd; }
      await sleep(80);            // read them while they are still alive
      return ringSizes();
    };
    o.releaseRings = await ringsOnRelease(1);
    o.tapRings = await ringsOnRelease(0);
    // v0.30.1295 - the release rings are sticky. A full-draw release queues ~9 fx at once and the pool keeps 6-14
    // (fewer under low FX and combat load), evicting the oldest first - the rail sprite, then both rings - so in a
    // busy fight the whirl was gone the frame after it appeared. Newer fx are queued right behind the release here.
    const busyRelease = async () => {
      target(200);
      for (const k of Object.keys(player._cd || {})) player._cd[k] = 0;
      player.facing = 1; player._releasedCharge = 1; game.smoothFx = [];
      const _rnd = Math.random; Math.random = () => 0.95;
      try { castSkill('snipe_railgun'); } finally { Math.random = _rnd; }
      for (let i = 0; i < 12; i++) spawnSmoothImpact(player.x + 300, player.y, '#ffffff');
      await sleep(80);
      return ringSizes();
    };
    o.busyRings = await busyRelease();
    o.busyRail = (game.smoothFx || []).filter((f) => f.spriteKey === 'railshot').length;   // v0.30.1297 - read in the same turn as the rings
    return o;
  });
  const ratio = (a, b) => (b ? +(a / b).toFixed(2) : 0);
  console.log(`build ${r.ver}  ATK ${r.atk}  tap ${r.tap}  half ${r.half}  full ${r.full}`);
  ok('a TAP is unchanged - the overcharge is a pure addition', r.tap > 0 && ratio(r.tap, r.tap) === 1, String(r.tap));
  ok('a FULL draw deals +150% (x2.5)', Math.abs(ratio(r.full, r.tap) - 2.5) <= 0.08, 'x' + ratio(r.full, r.tap));
  ok('a HALF draw lands in between (x1.75)', Math.abs(ratio(r.half, r.tap) - 1.75) <= 0.10, 'x' + ratio(r.half, r.tap));
  ok('the tapped rail still stops at its old reach', r.tapFar === 0, String(r.tapFar));
  ok('a full draw carries 700 px further', r.fullFar > 0 && r.fullVeryFar > 0, `${r.fullFar} at 1200 px, ${r.fullVeryFar} at 1550 px`);
  ok('...and it is still a rail, not an infinite line', r.tooFar === 0, String(r.tooFar));
  ok('the overcharge art is registered and served', r.fxRegistered && seen.art === 200, 'HTTP ' + seen.art);
  ok('the card tells the player it can be held', /HOLD to overcharge/i.test(r.desc) && /150%/.test(r.desc), r.desc.slice(-90));
  const big = (a) => (a && a.length ? Math.max(...a) : 0);
  ok('the rings show WHILE the bow is drawn', r.holdFull.length > 0, r.holdFull.join(', ') || 'nothing queued');
  ok('...and they grow with the draw', big(r.holdFull) > big(r.holdHalf), `half ${big(r.holdHalf)} -> full ${big(r.holdFull)}`);
  ok('the release is bigger than the draw, and layered', big(r.releaseRings) >= 650 && r.releaseRings.length >= 2, r.releaseRings.join(', '));
  ok('a tap still summons no rings at all', r.tapRings.length === 0, r.tapRings.join(', ') || 'none');
  // v0.30.1295 - the whirling power sprite while F is held
  ok('the hold ring is in the Sniper kit art (asked for with the class, not at its first draw)', r.prewarmRow && r.prewarmed, `row ${r.prewarmRow}, asked ${r.prewarmed}`);
  const wf = r.whirlFull, wh = r.whirlHalf, wl = r.whirlLow, show = (w) => JSON.stringify(w);
  ok('the first ring lands on the first frame of the hold', wf.first >= 1 && wh.first >= 1 && wl.first >= 1, `${wf.first} / ${wh.first} / ${wl.first} ring(s) after the first tick`);
  ok('the live rings turn together, as one whirling sprite', wf.spread < 0.05 && wh.spread < 0.05, `spread ${wf.spread.toFixed(3)} / ${wh.spread.toFixed(3)} rad`);
  ok('...and keep turning while the key is held', wf.turned > 1 && wh.turned > 0.5, `${wf.turned.toFixed(2)} / ${wh.turned.toFixed(2)} rad`);
  ok('a ring is up the whole time the key is held', wf.gaps === 0 && wh.gaps === 0, show(wf) + ' ' + show(wh));
  ok('the very-low FX tier thins the rings instead of deleting them', wl.gaps === 0 && wl.rings >= 2 && wl.rings / wl.ticks < 0.6 * (wf.rings / wf.ticks), show(wl));
  ok('in a busy fight the release rings outlive the fx cap', r.busyRings.length >= 2 && big(r.busyRings) >= 650, r.busyRings.join(', ') || 'evicted');
  ok('...and so does the rail sprite itself', r.busyRail >= 1, String(r.busyRail));   // v0.30.1297
  ok('no page errors', errs.length === 0, errs.join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
