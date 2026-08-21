// No natural chests on maps that spawn no monsters.
//
// Per user, on a Zodiac Sanctum screenshot: "there should not be random chests
// spawning in maps with no monsters." The Sanctum is a room of twelve portals
// with `spawns: []` — not a town, not a boss arena — so it passed every gate
// that existed and drew a chest on the 15-minute restock.
//
// Driven against the live game rather than read off the source, and the chest
// roll is random (45% of eligible loads place none), so each map is loaded many
// times with its restock cooldown cleared between loads: "never" has to be
// shown, not sampled once.
//   node scripts/no_chests_without_mobs_test.mjs [port]
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
await page.waitForFunction(() => typeof loadMap === 'function' && typeof MAPS === 'object', { timeout: 120000 });

const r = await page.evaluate(() => {
  const out = {};
  const cs = document.getElementById('class-select-modal'); if (cs) cs.style.display = 'none';
  player.level = 99; game.paused = true;

  const hasMobs = (m) => Array.isArray(m && m.spawns)
    && m.spawns.some(sp => sp && sp.type && (sp.count == null || sp.count > 0));

  // Every spawn-less map in the game — the real blast radius, not a guess.
  out.mobless = Object.keys(MAPS).filter(id => !hasMobs(MAPS[id]));
  out.withMobs = Object.keys(MAPS).filter(id => hasMobs(MAPS[id])).length;

  // Load a map N times with the restock cooldown cleared, counting chests.
  const trial = (id, n) => {
    let chests = 0, cursed = 0, loads = 0;
    for (let i = 0; i < n; i++) {
      try {
        game._chestCooldown = {};                 // defeat the 15-min restock gate
        loadMap(id);
        loads++;
        chests += (game.chests || []).length;
        if (game._mapCursed) cursed++;
      } catch (e) { /* a map that refuses to load is not this test's business */ }
    }
    return { chests, cursed, loads };
  };

  // The reported map.
  out.zodiac = trial('zodiacHall', 40);
  // Every other spawn-less map, so the rule is shown to be general.
  out.moblessTotals = { chests: 0, loads: 0 };
  out.offenders = [];
  for (const id of out.mobless) {
    if (id === 'zodiacHall') continue;
    const t = trial(id, 6);
    out.moblessTotals.chests += t.chests; out.moblessTotals.loads += t.loads;
    if (t.chests > 0) out.offenders.push({ id, chests: t.chests });
  }

  // Control: a normal monster map must STILL get chests, or the fix is just a
  // switch that turns the feature off.
  out.control = trial('forest', 40);
  game.paused = false;
  return out;
});
await b.close(); try { srv.kill(); } catch (e) {}

console.log('spawn-less maps:', r.mobless.length, '| maps with mobs:', r.withMobs);
console.log('zodiacHall  :', JSON.stringify(r.zodiac));
console.log('other empty :', JSON.stringify(r.moblessTotals), '| offenders:', JSON.stringify(r.offenders));
console.log('control fore:', JSON.stringify(r.control));

ok('Zodiac Sanctum spawns no chests across 40 loads (the reported case)',
   r.zodiac.chests === 0 && r.zodiac.loads > 30, r.zodiac);
ok('...and never rolls the "stronger foes" curse either, having no foes',
   r.zodiac.cursed === 0, { cursed: r.zodiac.cursed });
ok('NO spawn-less map anywhere in the game spawns a chest',
   r.offenders.length === 0, { offenders: r.offenders.slice(0, 6) });
ok('the rule is general, not a one-map patch (several spawn-less maps exist)',
   r.mobless.length >= 3, { count: r.mobless.length, sample: r.mobless.slice(0, 8) });
ok('CONTROL: a normal monster map still spawns chests (feature not just disabled)',
   r.control.chests > 0, r.control);
ok('no page errors', errs.length === 0, errs.slice(0, 3));

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + '  ' + JSON.stringify(x.x)); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
