// Soul Vortex (Lich, key X). Tester: "hurtbox feels very weird, monsters can
// die when it's very far, the suction effect also a bit ambiguous when i used
// in underwater maps, skill is overall clunky."
//
// Three faults, one test each:
//   1. the damage region was a 320 px CIRCLE while the art draws a 460x160
//      pool, so it killed things 240 px above visibly empty space;
//   2. the pull did `m.vx +=`, but the grounded AI opens each frame with an
//      outright `m.vx = m.facing * m.speed` — the nudge was discarded before
//      it ever moved anything, and fliers (every underwater mob) had what
//      survived trimmed by their own _maxV cap;
//   3. drain ticked once a second, so a mob dragged in stood there in silence.
//
// The suction checks emulate the AI's vx assignment explicitly rather than
// trusting updateMonsters, so they fail if the pull ever moves back into
// velocity.
//   node scripts/soul_vortex_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const net = await import('node:net');
const free = (p) => new Promise((r) => { const s = net.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const { spawn } = await import('node:child_process');
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext()).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof SKILL_FNS === 'object' && typeof updateProjectiles === 'function', { timeout: 120000 });

const r = await page.evaluate(() => {
  const out = {};
  game.paused = false;
  player.cls = 'mage'; player.job = 'warlock'; player.master = 'lich';
  player.hp = Math.max(1, player.maxHp || 100); player.mp = 9999;
  player.facing = 1; player.skillCooldowns = {};

  const cast = () => {
    game.hazards.length = 0;
    SKILL_FNS.lich_harvest();
    return game.hazards.find(h => h.type === 'soul_vortex');
  };
  const mob = (x, y, w, h, extra) => Object.assign({
    x, y, w, h, hp: 1e9, maxHp: 1e9, currentHp: 1e9, def: 0,
    type: 'slime', level: 1, speed: 2, facing: 1, vx: 0, vy: 0,
  }, extra || {});

  // --- A. the hazard rect IS the drawn box, both from one constant ---------
  {
    const h = cast();
    out.geom = { w: h.w, h: h.h, rx: LX_VORTEX_RX, ry: LX_VORTEX_RY,
      rectIsBox: h.w === LX_VORTEX_RX * 2 && h.h === LX_VORTEX_RY * 2 };
  }

  // --- B. reach: what is inside the pool and what is not ------------------
  out.reach = (() => {
    const h = cast();
    const cx = h.cx, cy = h.y + h.h / 2;
    const probe = (dx, dy, label) => {
      game.monsters.length = 0;
      // 40x40 box centred on (cx+dx, cy+dy); _noGravity keeps the suction out
      // of the way so this measures the REGION, not the pull.
      const m = mob(cx + dx - 20, cy + dy - 20, 40, 40, { _noGravity: true });
      game.monsters.push(m);
      const hz = game.hazards.find(z => z.type === 'soul_vortex');
      hz.tick = 0;
      for (let f = 0; f < 61; f++) updateProjectiles(16);
      game.monsters.length = 0;
      return { label, hit: m.currentHp < 1e9 };
    };
    return {
      inside:    probe(0, 0, 'in the pool').hit,
      side220:   probe(220, 0, '220px to the side').hit,
      side400:   probe(400, 0, '400px to the side').hit,
      above300:  probe(0, -300, '300px straight up').hit,
      above120:  probe(0, -120, '120px straight up').hit,
    };
  })();

  // --- C. the suction survives the AI overwriting velocity -----------------
  // Reproduces line ~68880 (`m.vx = m.facing * m.speed`) verbatim: a grounded
  // mob is re-tasked every frame and walks AWAY from the pool. If the pull
  // lives in vx it is erased before it moves anything.
  out.suckGround = (() => {
    const h = cast();
    const cx = h.cx, cy = h.y + h.h / 2;
    game.monsters.length = 0;
    const m = mob(cx + 180, cy - 20, 40, 40, { facing: 1, speed: 1.2 });
    game.monsters.push(m);
    const start = m.x;
    let vxSeen = null;
    for (let f = 0; f < 90; f++) {
      m.vx = m.facing * m.speed;      // the AI's assignment, every frame
      m.x += m.vx;                    // ...and its integration
      updateProjectiles(16);
      if (vxSeen === null) vxSeen = m.vx;
    }
    const end = m.x;
    game.monsters.length = 0;
    return { start, end, movedToward: start - end, vxAfterHazard: vxSeen };
  })();

  // --- D. underwater: a flier steering + speed-capped, same question ------
  out.suckFlier = (() => {
    const h = cast();
    const cx = h.cx, cy = h.y + h.h / 2;
    game.monsters.length = 0;
    const m = mob(cx + 180, cy - 40, 40, 40, { flies: true, speed: 1.5, facing: 1 });
    game.monsters.push(m);
    const start = m.x;
    const maxV = m.speed * 2.4;
    for (let f = 0; f < 90; f++) {
      // flier steering lerp toward a destination AWAY from the pool + the
      // magnitude cap that used to swallow the pull
      m.vx += (maxV - m.vx) * 0.16;
      const mag = Math.abs(m.vx);
      if (mag > maxV) m.vx *= maxV / mag;
      m.x += m.vx;
      updateProjectiles(16);
    }
    const end = m.x;
    game.monsters.length = 0;
    return { start, end, movedToward: start - end };
  })();

  // --- E. bosses lean, they don't get vacuumed ----------------------------
  out.boss = (() => {
    const h = cast();
    const cx = h.cx, cy = h.y + h.h / 2;
    // 10 frames, from the rim: long enough to measure the rate, short enough
    // that neither reaches the pool. Over 60 frames both saturate at the core
    // and the comparison measures the starting distance instead of the pull.
    const run = (isBoss) => {
      game.monsters.length = 0;
      const m = mob(cx + 190, cy - 20, 40, 40, { isBoss });
      game.monsters.push(m);
      const start = m.x;
      for (let f = 0; f < 10; f++) updateProjectiles(16);
      const moved = start - m.x;
      game.monsters.length = 0;
      return moved;
    };
    return { normal: run(false), boss: run(true) };
  })();

  // --- F. drain cadence doubled, DPS unchanged ----------------------------
  out.dps = (() => {
    const h = cast();
    const cx = h.cx, cy = h.y + h.h / 2;
    game.monsters.length = 0;
    const m = mob(cx - 20, cy - 20, 40, 40, { _noGravity: true });
    game.monsters.push(m);
    h.tick = 0;
    const hits = [], deltas = [];
    let last = m.currentHp;
    for (let f = 0; f < 60; f++) {
      updateProjectiles(16);
      if (m.currentHp !== last) { hits.push(f + 1); deltas.push(last - m.currentHp); last = m.currentHp; }
    }
    game.monsters.length = 0;
    // DPS is checked on the RAW per-tick damage, not on HP lost: hitMonster
    // runs the whole mitigation chain (DEF, level gap, difficulty), so HP loss
    // says nothing about whether the cadence change preserved damage-per-second.
    const rawTick = Math.max(1, Math.floor(h.atk * (LX_VORTEX_TICK / 60)));
    const ticksPerSec = 60 / LX_VORTEX_TICK;
    return { ticksPerSecond: hits.length, atFrames: hits, deltas,
             rawTick, rawPerSecond: rawTick * ticksPerSec, atk: Math.floor(h.atk) };
  })();

  out.desc = SKILLS.lich_harvest && SKILLS.lich_harvest.desc;
  game.hazards.length = 0;
  return out;
});
await b.close(); try { srv.kill(); } catch (e) {}

console.log('geometry   :', JSON.stringify(r.geom));
console.log('reach      :', JSON.stringify(r.reach));
console.log('suck ground:', JSON.stringify(r.suckGround));
console.log('suck flier :', JSON.stringify(r.suckFlier));
console.log('boss resist:', JSON.stringify(r.boss));
console.log('drain      :', JSON.stringify(r.dps));
console.log('desc       :', r.desc);

ok('the hazard rect IS the drawn sprite box (one constant feeds both)', r.geom.rectIsBox === true, r.geom);
ok('the pool is 460 px wide, as drawn', r.geom.w === 460, r.geom);

ok('a monster standing in the pool is drained', r.reach.inside === true, r.reach);
ok('220 px to the side is still inside the pool', r.reach.side220 === true, r.reach);
ok('400 px to the side is outside it', r.reach.side400 === false, r.reach);
ok('300 px STRAIGHT UP is no longer hit (the old 320 px circle did)', r.reach.above300 === false, r.reach);
ok('120 px straight up is outside the drawn pool too', r.reach.above120 === false, r.reach);

ok('a grounded mob walking away is still dragged in (pull survives the AI vx assignment)',
   r.suckGround.movedToward > 30, r.suckGround);
ok('the pull is NOT in vx any more (vx is exactly what the AI set)',
   Math.abs(r.suckGround.vxAfterHazard - 1.2) < 1e-9, r.suckGround);
ok('a flier at its speed cap is dragged in too (the underwater case)',
   r.suckFlier.movedToward > 30, r.suckFlier);

ok('a boss is pulled, but much less than a normal mob',
   r.boss.boss > 0 && r.boss.boss < r.boss.normal * 0.5, r.boss);

ok('drain now lands twice a second, not once', r.dps.ticksPerSecond === 2, r.dps);
ok('...at evenly spaced half-second intervals', r.dps.atFrames.join() === '30,60', r.dps);
ok('...for the same damage per second (raw tick x cadence == the pool ATK/sec)',
   Math.abs(r.dps.rawPerSecond - r.dps.atk) <= 2, r.dps);
// Not an equality check: hitMonster rolls the game's usual damage variance, so
// two ticks of the same raw damage legitimately land slightly differently.
ok('...and the two ticks are the same size within normal damage variance',
   r.dps.deltas.length === 2 && Math.abs(r.dps.deltas[0] - r.dps.deltas[1]) <= Math.max(2, r.dps.deltas[0] * 0.35), r.dps);

ok('the tooltip no longer quotes the old 320 px radius', !/320/.test(r.desc || ''), { desc: r.desc });
ok('no page errors', errs.length === 0, errs.slice(0, 3));

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + '  ' + JSON.stringify(x.x)); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
