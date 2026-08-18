// Double Shot: at most +1 projectile, and that projectile deals 50%.
//
// Per user: "Double shot boon should only +1 projectile maximum as it is too
// overpowered, the +1 projectile should be 50% the damage of the main
// projectile."
//
// The subtlety: the UNIVERSAL duplicator always halved its echoes — the real
// imbalance was the self-handled skills (Charged Shot, Multi Shot, the dagger
// fan, the volleys), which added the boon's arrow at FULL damage. Charged
// Shot's pair was a second full 3.5x arrow. So this drives the live skills and
// measures the actual damage ratios, not the mod value.
//   node scripts/double_shot_cap_test.mjs [port]
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
await page.waitForFunction(() => typeof SKILL_FNS === 'object' && typeof _applyEquippedBoons === 'function', null, { timeout: 120000 });

const r = await page.evaluate(async () => {
  const out = {};
  game.paused = true;
  const cs = document.getElementById('class-select-modal'); if (cs) cs.style.display = 'none';
  player.cls = 'archer'; player.job = 'sniper';
  player.hp = getMaxHp(); player.mp = 9999;
  player.equipment = {};                       // no gear multishot muddying counts
  player.tree = player.tree || {}; player.tree.rapidFire = false;

  // --- the roll can no longer exceed +1 -----------------------------------
  const def = (typeof POWERUPS !== 'undefined') && POWERUPS.find(p => p && p.id === 'multi');
  out.rollMax = def ? def.max : null;

  // --- the cap: even legacy roll-2 boons and stacking clamp to +1 ---------
  const savedBoons = player.boons, savedEq = player.boonsEquipped;
  player.boons = [{ id: 'multi', roll: 2 }, { id: 'multi', roll: 2 }];
  player.boonsEquipped = [0, 1];
  _applyEquippedBoons();
  out.cappedMods = player.mods.multishot;
  player.boons = savedBoons; player.boonsEquipped = savedEq;

  // helper: fire a skill, collect its projectiles by skill tag
  const fire = (fn, tag, ms) => {
    player.mods.multishot = ms;
    player.skillCooldowns = {}; player.mp = 9999;
    game.projectiles.length = 0;
    SKILL_FNS[fn]();
    // let the universal duplicator pass over what was pushed
    updateProjectiles(16);
    const ps = game.projectiles.filter(p => p && p.owner === 'player' && (!tag || p.skill === tag));
    return ps.map(p => Math.round(p.damage));
  };

  // --- Charged Shot: the worst offender -----------------------------------
  out.chargedWith = fire('chargedShot', 'charged', 1).sort((a, b2) => b2 - a);
  out.chargedWithout = fire('chargedShot', 'charged', 0);

  // --- Multi Shot: boon arrow at half, authored three at full -------------
  out.multiWith = fire('multiShot', 'arrow', 1).sort((a, b2) => b2 - a);
  out.multiWithout = fire('multiShot', 'arrow', 0);

  // --- the universal duplicator: unchanged 50% echoes ---------------------
  player.mods.multishot = 1;
  game.projectiles.length = 0;
  game.projectiles.push({ x: 100, y: 100, vx: 6, vy: 0, w: 10, h: 6, life: 40,
    damage: 100, owner: 'player', skill: 'probe' });
  updateProjectiles(16);
  const probes = game.projectiles.filter(p => p && p.skill === 'probe');
  out.universal = { count: probes.length, dmgs: probes.map(p => Math.round(p.damage)).sort((a, b2) => b2 - a) };

  player.mods.multishot = 0;
  game.projectiles.length = 0; game.paused = false;
  return out;
});
await b.close(); try { srv.kill(); } catch (e) {}

console.log('roll max:', r.rollMax, '| capped mods from 2x legacy roll-2:', r.cappedMods);
console.log('charged with/without boon:', JSON.stringify(r.chargedWith), JSON.stringify(r.chargedWithout));
console.log('multi   with/without boon:', JSON.stringify(r.multiWith), JSON.stringify(r.multiWithout));
console.log('universal:', JSON.stringify(r.universal));

const half = (a, b2) => Math.abs(a / b2 - 0.5) < 0.02;
ok('the boon can no longer roll +2 (max is 1)', r.rollMax === 1, { rollMax: r.rollMax });
ok('the cap clamps to +1 even against legacy roll-2 boons', r.cappedMods === 1, { mods: r.cappedMods });
ok('Charged Shot fires exactly ONE extra arrow with the boon',
   r.chargedWith.length === 2 && r.chargedWithout.length === 1,
   { with: r.chargedWith.length, without: r.chargedWithout.length });
ok('...and that arrow deals 50% of the main one (was a second FULL 3.5x arrow)',
   r.chargedWith.length === 2 && half(r.chargedWith[1], r.chargedWith[0]), { dmgs: r.chargedWith });
ok('Multi Shot fires exactly one extra arrow with the boon',
   r.multiWith.length === 4 && r.multiWithout.length === 3,
   { with: r.multiWith.length, without: r.multiWithout.length });
ok('...at 50% of an authored arrow',
   r.multiWith.length === 4 && half(r.multiWith[3], r.multiWith[0]), { dmgs: r.multiWith });
ok('the universal duplicator adds exactly one 50% echo',
   r.universal.count === 2 && r.universal.dmgs[0] === 100 && r.universal.dmgs[1] === 50, r.universal);
ok('no page errors', errs.length === 0, errs.slice(0, 3));

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + '  ' + JSON.stringify(x.x)); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
