// Fireball must detonate where it looks like it detonates, and pay the same
// splash whichever way it goes off.
//
// Per user: "Hitbox of Mage's fireball is very inconsistent, please work on it."
// Two separate causes, both measured here against the live projectile loop:
// The fireball has TWO ways to detonate and they disagreed about damage: on
// impact everyone but the struck monster took 0.7x, but when it touched nothing
// and self-detonated at end of life, everyone took FULL. So missing hit the
// crowd harder than connecting, and which one you got came down to whether a
// 28x22 box happened to clip somebody. Same cast, two outcomes.
//   node scripts/fireball_hitbox_test.mjs [port]
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
await page.waitForFunction(() => typeof updateProjectiles === 'function' && typeof SKILL_FNS === 'object', null, { timeout: 120000 });

const r = await page.evaluate(() => {
  const out = {};
  game.paused = true;
  const cs = document.getElementById('class-select-modal'); if (cs) cs.style.display = 'none';
  player.cls = 'mage'; player.hp = getMaxHp(); player.mp = 9999;
  player.mods = player.mods || {}; player.mods.multishot = 0;
  player.equipment = {};

  const DMG = 1000;
  const mk = (x, y, w, h) => ({ type: 'dummy', label: 'dummy', x, y, w: w || 60, h: h || 60,
    hp: 1e9, maxHp: 1e9, currentHp: 1e9, atk: 1, def: 0, exp: 0, mojicoins: 0, speed: 0 });
  const shoot = (mobs, px, py) => {
    game.monsters.length = 0; for (const m of mobs) game.monsters.push(m);
    game.projectiles.length = 0;
    game.projectiles.push({ x: px, y: py, vx: 10, vy: 0, w: 28, h: 22, life: 25,
      damage: DMG, owner: 'player', skill: 'fire', explode: 180, selfExplode: true,
      gravity: 0, color: '#ff8822' });
    const before = mobs.map(m => m.currentHp);
    let detonatedFrame = null;
    for (let f = 0; f < 40; f++) {
      updateProjectiles(16);
      if (detonatedFrame === null && mobs.some((m, i) => m.currentHp < before[i])) detonatedFrame = f;
      if (!game.projectiles.length) break;
    }
    return { lost: mobs.map((m, i) => Math.round(before[i] - m.currentHp)), detonatedFrame };
  };

  // (1) TRIGGER — a monster the fireball visibly overlaps but that sits
  // outside the bare 28x22 box. Placed just above the flight line: the old
  // box reached y+22, the padded one reaches y+37, the sprite covers ~101px.
  {
    const target = mk(360, 250, 40, 40);           // spans y 250..290: clear of the bare box (300..322), clipping the padded one (285..337)
    const res = shoot([target], 300, 300);
    out.grazeLost = res.lost[0];
    out.grazeFrame = res.detonatedFrame;
  }

  // (2) DIRECT HIT + neighbour: the struck monster takes full, the neighbour
  // takes splash.
  {
    const primary = mk(360, 300, 40, 40);
    const neighbour = mk(430, 300, 40, 40);
    const res = shoot([primary, neighbour], 300, 300);
    out.directPrimary = res.lost[0];
    out.directNeighbour = res.lost[1];
  }

  // (3) NO contact at all — expires and self-detonates with both in radius.
  {
    const a = mk(600, 180, 40, 40);               // well off the flight line
    const b2 = mk(660, 180, 40, 40);
    const res = shoot([a, b2], 300, 300);
    out.missA = res.lost[0];
    out.missB = res.lost[1];
  }

  game.monsters.length = 0; game.projectiles.length = 0; game.paused = false;
  return out;
});
await b.close(); try { srv.kill(); } catch (e) {}

console.log('graze (visually engulfed):  lost', r.grazeLost, 'at frame', r.grazeFrame);
console.log('direct hit: primary', r.directPrimary, '| neighbour', r.directNeighbour);
console.log('clean miss: A', r.missA, '| B', r.missB);

const near = (a, b2, tol) => a > 0 && b2 > 0 && Math.abs(a / b2 - 1) < (tol || 0.35);
ok('a fireball that connects detonates promptly, not at the end of its flight',
   r.grazeLost > 0 && r.grazeFrame != null && r.grazeFrame < 12,
   { lost: r.grazeLost, frame: r.grazeFrame });
ok('a direct hit pays the struck monster MORE than splash (full vs 0.7x)',
   r.directPrimary > r.directNeighbour * 1.3, { primary: r.directPrimary, neighbour: r.directNeighbour });
ok('its neighbour takes splash, not full', r.directNeighbour > 0 && r.directNeighbour < r.directPrimary,
   { neighbour: r.directNeighbour, primary: r.directPrimary });
ok('a fireball that touches nothing pays the SAME splash — missing is no longer better',
   near(r.missA, r.directNeighbour), { miss: r.missA, impactSplash: r.directNeighbour });
ok('both monsters in a clean-miss blast take the same splash', near(r.missA, r.missB, 0.35),
   { a: r.missA, b: r.missB });
ok('no page errors', errs.length === 0, errs.slice(0, 3));

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + '  ' + JSON.stringify(x.x)); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
