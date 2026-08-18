// A Magic Bolt that has visually faded must not damage.
//
// Per user: "when mage's projectile fades away but somehow can still damage an
// enemy if it connects, please ensure proper hitbox distance and make sure it
// does not damage after fading."
//
// Measured by walking a real bolt down its life and, at each step, parking a
// dummy exactly on it — so "can this hurt me right now" is answered by the live
// collision path, not by reading the constant.
//   node scripts/magic_bolt_fade_test.mjs [port]
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

  const MAXLIFE = 55;
  // Drop a dummy right on top of a bolt held at a given life and see whether
  // the real collision path damages it.
  const probe = (life) => {
    game.monsters.length = 0; game.projectiles.length = 0;
    const m = { type: 'dummy', label: 'dummy', x: 400, y: 300, w: 80, h: 80,
      hp: 1e9, maxHp: 1e9, currentHp: 1e9, atk: 1, def: 0, exp: 0, mojicoins: 0, speed: 0 };
    game.monsters.push(m);
    game.projectiles.push({ x: 420, y: 330, vx: 0, vy: 0, w: 20, h: 14,
      life, maxLife: MAXLIFE, damage: 1000, owner: 'player', skill: 'bolt' });
    const before = m.currentHp;
    updateProjectiles(16);
    return m.currentHp < before;
  };

  // The alpha the RENDERER would use at the same life, from the shipped fn.
  const alphaAt = (life) => {
    if (typeof _boltAlpha !== 'function') return null;
    return +_boltAlpha({ life, maxLife: MAXLIFE }).toFixed(3);
  };

  out.samples = [];
  for (const life of [55, 45, 38, 30, 20, 12, 8, 6, 4, 2, 1]) {
    out.samples.push({ life, alpha: alphaAt(life), damages: probe(life) });
  }
  out.hasFn = typeof _boltAlpha === 'function';

  // A solid bolt must still hit for the bulk of its flight — this is a
  // visual-honesty fix, not a range deletion.
  const solid = out.samples.filter(s => s.life >= 20);
  out.solidAllHit = solid.every(s => s.damages === true);
  // Anything the player can barely see must not hit.
  const ghost = out.samples.filter(s => s.alpha != null && s.alpha < 0.35);
  out.ghostAllMiss = ghost.length > 0 && ghost.every(s => s.damages === false);
  out.ghostLives = ghost.map(s => s.life);

  game.monsters.length = 0; game.projectiles.length = 0; game.paused = false;
  return out;
});
await b.close(); try { srv.kill(); } catch (e) {}

console.log('shared alpha fn present:', r.hasFn);
for (const s of r.samples) console.log(`  life ${String(s.life).padStart(2)}  alpha ${String(s.alpha).padEnd(5)}  damages: ${s.damages}`);

ok('the fade curve is a shared function (draw and hit test cannot drift)', r.hasFn === true, {});
ok('a bolt at full life damages', r.samples[0].damages === true, r.samples[0]);
ok('the bolt stays SOLID and damaging through the bulk of its flight',
   r.solidAllHit === true, { solid: r.samples.filter(s => s.life >= 20) });
ok('a bolt that has faded past visibility does NOT damage — the reported bug',
   r.ghostAllMiss === true, { fadedLives: r.ghostLives });
ok('the very last frames are harmless (it is smoke by then)',
   r.samples[r.samples.length - 1].damages === false, r.samples[r.samples.length - 1]);
ok('the dissolve is a short tail, not most of the flight',
   r.ghostLives.length > 0 && Math.max(...r.ghostLives) <= 8,
   { firstHarmlessLife: r.ghostLives.length ? Math.max(...r.ghostLives) : null });
ok('no page errors', errs.length === 0, errs.slice(0, 3));

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + '  ' + JSON.stringify(x.x)); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
