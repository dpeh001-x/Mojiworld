// Boons must be a treat from ordinary mobs, not a byproduct of grinding.
//
// Per user: "Reduce the drop rates of boon significantly from non boss mobs: i
// also hit the max boon quantity by just fighting ordinary mobs." The bag caps
// at BOON_INVENTORY_CAP = 50, and the only non-boss source is the roll at the
// end of killMonster — a flat rate per kill, no luck scaling.
//
// Measured by driving the REAL killMonster over tens of thousands of kills and
// counting orbs that actually spawn, rather than reading the constant back.
//   node scripts/boon_drop_rate_test.mjs [port]
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
await page.waitForFunction(() => typeof killMonster === 'function' && typeof spawnMonster === 'function',
  null, { timeout: 120000 });

const r = await page.evaluate(() => {
  const out = {};
  game.paused = true;
  const cs = document.getElementById('class-select-modal'); if (cs) cs.style.display = 'none';
  player.cls = 'warrior'; player.level = 40; player.hp = getMaxHp();   // past the Lv20 gate
  out.cap = (typeof BOON_INVENTORY_CAP === 'number') ? BOON_INVENTORY_CAP : null;

  // Count orbs spawned, not boons banked: applyPowerupOrb only runs on pickup,
  // and one orb is one boon at 'common' rarity (stacks are 2-3 only for
  // epic/legendary orbs, which this path never spawns).
  // SAMPLE SIZE IS LOAD-BEARING. These are Bernoulli trials, so a small N makes
  // the checks themselves a coin flip: at the 0.10% elite rate an N of 80,000
  // expects 80 orbs with sigma ~8.9, which is wide enough that "elite beats a
  // normal mob" can invert on a bad roll. N = 400,000 puts expected counts at
  // 200 / 400 with sigma 14 / 20, so every threshold below sits 4+ sigma clear
  // of its true value and the suite does not flake.
  const N = 400000;
  const run = (variant) => {
    game.powerupOrbs = [];
    let orbs = 0;
    for (let i = 0; i < N; i++) {
      game.monsters.length = 0; game.drops.length = 0;
      game.particles.length = 0; game.damageNumbers.length = 0;
      const m = spawnMonster(600, 300, 'snail', false, false);
      if (!m) return null;
      // spawnMonster RETURNS the mob but does not register it, and killMonster
      // bails on `game.monsters.indexOf(m) < 0` as its second statement. Without
      // this push the harness measures nothing at all: 80,000 kills produced 0
      // orbs on a 0.5% rate, and even Math.random pinned to 0 produced none.
      game.monsters.push(m);
      if (variant === 'elite') m.isElite = true;
      m.currentHp = 0;
      try { killMonster(m); } catch (e) {}
      orbs += game.powerupOrbs.length;
      game.powerupOrbs.length = 0;
    }
    return { orbs, kills: N, pct: +(orbs / N * 100).toFixed(4), oneIn: orbs ? Math.round(N / orbs) : null };
  };
  out.normal = run('normal');
  out.elite  = run('elite');

  game.monsters.length = 0; game.drops.length = 0; game.powerupOrbs = []; game.paused = false;
  return out;
});
await b.close(); try { srv.kill(); } catch (e) {}

console.log('boon bag cap:', r.cap);
console.log('ordinary mob:', JSON.stringify(r.normal));
console.log('elite/elder :', JSON.stringify(r.elite));

const n = r.normal || {}, e = r.elite || {};
// Filling a 50-slot bag should be the work of a very long haul, not a session.
const killsToFill = n.orbs ? Math.round(r.cap / (n.orbs / n.kills)) : Infinity;
console.log('kills of ordinary mobs to fill the bag from scratch:', killsToFill.toLocaleString());

ok('ordinary mobs drop boons at or below 0.07% per kill (target 0.05%)',
   n.pct != null && n.pct <= 0.07, { pct: n.pct, oneIn: n.oneIn });
ok('...which is at least a 5x cut from the old 0.5%',
   n.pct != null && n.pct <= 0.1, { pct: n.pct });
ok('filling the 50-slot bag on ordinary mobs takes 50,000+ kills',
   killsToFill >= 50000, { killsToFill });
ok('an elite is still worth more than a snail (tier ordering restored)',
   e.pct != null && n.pct != null && e.pct > n.pct, { elite: e.pct, normal: n.pct });
ok('elites did not go up — they are at or below 0.13% (target 0.10%)',
   e.pct != null && e.pct <= 0.13, { pct: e.pct, oneIn: e.oneIn });
ok('boons still drop at all — this is a trickle, not a removal',
   n.orbs > 0 && e.orbs > 0, { normal: n.orbs, elite: e.orbs });
ok('no page errors', errs.length === 0, errs.slice(0, 3));

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + '  ' + JSON.stringify(x.x)); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
