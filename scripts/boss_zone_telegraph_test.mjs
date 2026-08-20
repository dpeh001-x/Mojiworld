// The zone a boss is about to hit must be drawn, and the drawn zone must BE the
// damage zone.
//
// Per user: "There are some boss fights that involved marking the area or zone
// they attack that players have to evade, worth looking into it and
// implementing in a AAA game style."
//
// The meteor already had the full treatment (ground rune, pulse, falling rock).
// columnStrike — a full-height pillar used by 8 bosses and the zodiac column
// movesets — telegraphed with a loose particle sprinkle, and bigMelee
// (swing/smash) with embers at the boss's hands. The kill rectangle itself was
// never on screen.
//
// The honesty check is the core of this suite: the telegraph is triggered
// through the REAL updateMonsters, the zone is read from _lxAttackZones, the
// windup is ticked to completion, and the enemy projectile that actually
// spawns is compared rect-for-rect against the zone that was drawn.
//   node scripts/boss_zone_telegraph_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const net_ = await import('node:net');
const free = (p) => new Promise((r) => { const s = net_.createServer();
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
await page.waitForFunction(() => typeof updateMonsters === 'function' && typeof _lxAttackZones !== 'undefined' || typeof updateMonsters === 'function',
  null, { timeout: 120000 });

const r = await page.evaluate(() => {
  const out = { hasFn: typeof _lxAttackZones === 'function' };
  const cs2 = document.getElementById('class-select-modal'); if (cs2) cs2.style.display = 'none';
  player.cls = 'warrior'; player.level = 60; player.hp = getMaxHp();
  // Boot parks the session on the VOID map, where non-boss AI is suppressed
  // outright — the Blight Elder's cooldown never even ticked there while the
  // two bosses (exempt) fired fine. Zones are combat furniture; measure them
  // on a combat map. Story beats are pre-marked so the arrival card does not
  // pause the sim (the steam suite's pattern).
  window._prologueActive = false;
  if (typeof STORY_BEATS === 'object') { player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k in STORY_BEATS) player._storyBeatsSeen[k] = true; }
  try { loadMap('glasswindSteppe'); } catch (e) {}
  game.paused = false;

  const mk = (key, px) => {
    const t = monsterTypes[key] || {};
    player.x = px; player.y = 400;
    const m = Object.assign({}, t, {
      type: key, name: t.name || key, w: t.w, h: t.h,
      x: 800, y: 400 - (t.h - 60), vx: 0, vy: 0, onGround: true,
      maxHp: 1000000, currentHp: 1000000,
      isBoss: !!t.boss, boss: !!t.boss, level: t.level || 50, def: 0, evasion: 0,
      exp: 0, mojicoins: 0, traits: t.traits, aggroTarget: player, facing: -1,
      _bigMeleeCd: 0, _columnCd: 0, shootTimer: 99999,
    });
    // updateMonsters skips expensive AI for faraway NON-bosses, and "far" is
    // measured from the CAMERA, which boot leaves nowhere near x=800 — the
    // Blight Elder idled in the cheap tier while the two bosses (exempt from
    // the skip) fired fine. In real play a smash happens on camera by
    // definition; park the camera on the fight.
    game.camera.x = 400; game.camera.y = 0;
    game.monsters.length = 0; game.monsters.push(m);
    game.projectiles.length = 0;
    return m;
  };
  const zones = () => (typeof _lxAttackZones === 'function') ? _lxAttackZones() : [];
  const tickUntil = (pred, cap) => {
    for (let i = 0; i < (cap || 200); i++) {
      try { updateMonsters(16); } catch (e) {}
      if (pred()) return i;
    }
    return -1;
  };
  const enemyProj = (skill) => game.projectiles.find(p => p.owner === 'enemy' && p.skill === skill);

  // (0) quiet map -> no zones
  mk('snail', 700); out.quiet = zones().length;

  // (1) COLUMN — Legosaurus. Zone appears the moment the boss commits, the
  // inner fill advances, and the pillar that fires matches the zone.
  {
    const m = mk('legosaurus', 700);
    const started = tickUntil(() => m._columnFiring === true, 40);
    const z0 = zones().find(z => z.kind === 'column');
    let z1 = null;
    for (let i = 0; i < 6; i++) { try { updateMonsters(16); } catch (e) {} }
    z1 = zones().find(z => z.kind === 'column');
    const fired = tickUntil(() => !!enemyProj('column'), 80);
    const p = enemyProj('column');
    out.column = { started, hasZone: !!z0,
      prog0: z0 ? +z0.prog.toFixed(3) : null, prog1: z1 ? +z1.prog.toFixed(3) : null,
      zone: z0 ? { x: Math.round(z0.x), w: Math.round(z0.w) } : null,
      proj: p ? { x: Math.round(p.x), w: Math.round(p.w) } : null,
      fired: fired >= 0,
      zoneGone: zones().every(z => z.kind !== 'column') };
  }

  // (2) SWING — Barnaby, facing the player on his left.
  {
    const m = mk('young_confused_barnaby', 790);
    const started = tickUntil(() => m._bigMeleeFiring === true, 40);
    const z0 = zones().find(z => z.kind === 'swing');
    const zoneAtFire = () => zones().find(z => z.kind === 'swing');
    let zLast = z0;
    const fired = tickUntil(() => { const z = zoneAtFire(); if (z) zLast = z; return !!enemyProj('swing'); }, 80);
    const p = enemyProj('swing');
    out.swing = { started, hasZone: !!z0, fired: fired >= 0,
      zone: zLast ? { x: Math.round(zLast.x), y: Math.round(zLast.y), w: Math.round(zLast.w), h: Math.round(zLast.h) } : null,
      proj: p ? { x: Math.round(p.x), y: Math.round(p.y), w: Math.round(p.w), h: Math.round(p.h) } : null };
  }

  // (3) SMASH — Blight Elder's ground shock (non-boss heavy, same trait path).
  {
    const m = mk('blightElder', 790);
    const started = tickUntil(() => m._bigMeleeFiring === true, 40);
    const z0 = zones().find(z => z.kind === 'smash');
    let zLast = z0;
    const fired = tickUntil(() => { const z = zones().find(zz => zz.kind === 'smash'); if (z) zLast = z; return !!enemyProj('smash'); }, 80);
    const p = enemyProj('smash');
    out.smash = { started, hasZone: !!z0, fired: fired >= 0,
      zone: zLast ? { x: Math.round(zLast.x), y: Math.round(zLast.y), w: Math.round(zLast.w), h: Math.round(zLast.h) } : null,
      proj: p ? { x: Math.round(p.x), y: Math.round(p.y), w: Math.round(p.w), h: Math.round(p.h) } : null };
  }

  // (4) DASH — Legosaurus's brace-dash. Contact damage, not a projectile, so
  // the honesty check is different: the lane is drawn during the brace (the
  // direction is locked there), vanishes at launch, and the body's REAL sweep
  // across the map must stay inside the lane it promised and fill most of it —
  // an under-drawn lane lies about safety, an over-drawn one cries wolf.
  {
    const m = mk('legosaurus', 700);
    m._bigMeleeCd = 99999; m._columnCd = 99999; m._bdCd = 0;
    const started = tickUntil(() => m._braceDashing === true, 60);
    const z0 = zones().find(z => z.kind === 'dash');
    let zLast = z0;
    tickUntil(() => { const z = zones().find(zz => zz.kind === 'dash'); if (z) zLast = z; return m._bdPhase === 'dash'; }, 90);
    const zoneGoneAtLaunch = zones().every(z => z.kind !== 'dash');
    let minX = m.x, maxX = m.x + m.w;
    tickUntil(() => { minX = Math.min(minX, m.x); maxX = Math.max(maxX, m.x + m.w); return m._braceDashing === false; }, 90);
    out.dash = { started, hasZone: !!z0,
      prog0: z0 ? +z0.prog.toFixed(3) : null, progEnd: zLast ? +zLast.prog.toFixed(3) : null,
      zoneGoneAtLaunch,
      zone: zLast ? { x: Math.round(zLast.x), w: Math.round(zLast.w) } : null,
      swept: { min: Math.round(minX), max: Math.round(maxX) } };
  }

  game.monsters.length = 0; game.projectiles.length = 0;
  return out;
});
await b.close(); try { srv.kill(); } catch (e) {}

console.log('helper present:', r.hasFn, '| quiet map zones:', r.quiet);
console.log('column:', JSON.stringify(r.column));
console.log('swing :', JSON.stringify(r.swing));
console.log('smash :', JSON.stringify(r.smash));

const rectEq = (a, b2, tol) => a && b2 && Math.abs(a.x - b2.x) <= (tol || 2) && Math.abs(a.w - b2.w) <= (tol || 2)
  && (a.y == null || b2.y == null || Math.abs(a.y - b2.y) <= (tol || 2))
  && (a.h == null || b2.h == null || Math.abs(a.h - b2.h) <= (tol || 2));

ok('the zone helper ships', r.hasFn === true, {});
ok('a quiet map marks nothing', r.quiet === 0, { zones: r.quiet });
ok('the pillar zone appears the moment the boss commits',
   r.column && r.column.hasZone === true, r.column);
ok('its fill advances while the windup runs — "when it is full, it hits"',
   r.column && r.column.prog0 != null && r.column.prog1 > r.column.prog0,
   { prog0: r.column && r.column.prog0, prog1: r.column && r.column.prog1 });
ok('the pillar that fires is EXACTLY the zone that was drawn',
   r.column && r.column.fired && rectEq(r.column.zone, r.column.proj),
   { zone: r.column && r.column.zone, proj: r.column && r.column.proj });
ok('the zone leaves the screen once the strike fires',
   r.column && r.column.zoneGone === true, {});
ok('the swing zone appears on commit', r.swing && r.swing.hasZone === true, r.swing);
ok('the swing that fires matches the drawn zone, all four edges',
   r.swing && r.swing.fired && rectEq(r.swing.zone, r.swing.proj),
   { zone: r.swing && r.swing.zone, proj: r.swing && r.swing.proj });
ok('the smash zone appears on commit', r.smash && r.smash.hasZone === true, r.smash);
ok('the ground shock that fires matches the drawn zone',
   r.smash && r.smash.fired && rectEq(r.smash.zone, r.smash.proj),
   { zone: r.smash && r.smash.zone, proj: r.smash && r.smash.proj });
const dz = r.dash || {};
console.log('dash  :', JSON.stringify(dz));
ok('the dash lane appears during the brace', dz.hasZone === true, dz);
ok('its fill advances across the brace', dz.prog0 != null && dz.progEnd > dz.prog0,
   { prog0: dz.prog0, progEnd: dz.progEnd });
ok('the lane vanishes the instant the dash launches', dz.zoneGoneAtLaunch === true, {});
ok('the real sweep stays INSIDE the lane it promised',
   dz.zone && dz.swept && dz.swept.min >= dz.zone.x - 6 && dz.swept.max <= dz.zone.x + dz.zone.w + 6,
   { zone: dz.zone, swept: dz.swept });
ok('...and fills most of it — the lane does not cry wolf',
   dz.zone && dz.swept && (dz.swept.max - dz.swept.min) >= dz.zone.w * 0.8,
   { laneW: dz.zone && dz.zone.w, sweptW: dz.swept && (dz.swept.max - dz.swept.min) });
ok('no page errors', errs.length === 0, errs.slice(0, 3));

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + '  ' + JSON.stringify(x.x)); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
