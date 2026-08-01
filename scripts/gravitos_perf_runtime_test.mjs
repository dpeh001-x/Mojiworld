// v0.29.391 — runtime proof that the hazard-pressure FX tier engages for a
// single-boss bullet-hell (Gravitos P3) and stays OFF during normal play.
//
//   node serve.js 8791 && node scripts/gravitos_perf_runtime_test.mjs 8791
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const PORT = process.argv[2] || '8791';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--disable-gpu', '--mute-audio'] });
const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });

// `game` is a top-level const (a lexical global, NOT window.game), so every
// probe has to go through eval with bare identifiers.
await page.waitForFunction(() => { try { return !!eval('game') && !!eval('game').monsters; } catch { return false; } }, null, { timeout: 120000 });

// Drive _perfVeryLowFx directly with synthetic world states. The frame cache is
// keyed on game.time, so it is cleared between trials.
const probe = await page.evaluate(() => {
  const g = eval('game'), P = eval('LX_PERF');
  const veryLow = eval('_perfVeryLowFx');
  const savedMon = g.monsters, savedProj = g.projectiles;
  const savedLow = P.lowFx, savedVery = P.veryLowFx;
  P.lowFx = false; P.veryLowFx = false;

  const trial = (bosses, mobs, projectiles) => {
    g.monsters = [];
    for (let i = 0; i < bosses; i++) g.monsters.push({ isBoss: true,  currentHp: 100 });
    for (let i = 0; i < mobs;   i++) g.monsters.push({ isBoss: false, currentHp: 100 });
    g.projectiles = new Array(projectiles).fill(0).map(() => ({ x: 0, y: 0 }));
    g._lowFxCache = null;          // invalidate the per-frame cache
    return veryLow();
  };

  const out = {
    // The case the whole change exists for: ONE boss, empty arena, 40 hazards.
    gravitosP3:      trial(1, 0, 40),
    gravitosP3Heavy: trial(1, 0, 55),
    // Just under the bar — P1/P2 Gravitos should stay on the richer FX path.
    gravitosP1:      trial(1, 0, 12),
    gravitosEdge39:  trial(1, 0, 39),
    // Normal play: no boss, so a heavy player build must NOT trip the tier.
    noBossManyProj:  trial(0, 3, 60),
    // Pre-existing triggers must still work.
    twoBosses:       trial(2, 0, 0),
    denseSwarm:      trial(0, 30, 0),
    quietField:      trial(0, 4, 5),
  };
  g.monsters = savedMon; g.projectiles = savedProj;
  P.lowFx = savedLow; P.veryLowFx = savedVery; g._lowFxCache = null;
  return out;
});

ok('Gravitos P3 (1 boss, 40 hazards) engages the very-low-FX tier', probe.gravitosP3 === true, probe.gravitosP3);
ok('a heavier P3 frame (55 hazards) stays engaged', probe.gravitosP3Heavy === true, probe.gravitosP3Heavy);
ok('Gravitos P1 (1 boss, 12 hazards) keeps full FX', probe.gravitosP1 === false, probe.gravitosP1);
ok('one hazard below the bar (39) keeps full FX', probe.gravitosEdge39 === false, probe.gravitosEdge39);
ok('no boss + 60 player projectiles does NOT trip the tier', probe.noBossManyProj === false, probe.noBossManyProj);
ok('pre-existing trigger: 2 bosses still engages', probe.twoBosses === true, probe.twoBosses);
ok('pre-existing trigger: 30-mob swarm still engages', probe.denseSwarm === true, probe.denseSwarm);
ok('a quiet field stays on full FX', probe.quietField === false, probe.quietField);

// The Gravitos damage band must still escalate across phases. _gravHeavyBand
// returns a descriptor ({floor, cap, mul, ref}), not a scalar — compare the
// multiplier and reference damage, which are what actually scale the hit.
const phases = await page.evaluate(() => {
  const band = eval('_gravHeavyBand');
  const b = p => { const x = band(p, 'skill'); return { mul: x.mul, ref: x.ref, cap: x.cap }; };
  return { p1: b(1), p2: b(2), p3: b(3) };
});
ok('damage band multiplier escalates P1 < P2 < P3',
   phases.p1.mul < phases.p2.mul && phases.p2.mul < phases.p3.mul,
   { p1: phases.p1.mul, p2: phases.p2.mul, p3: phases.p3.mul });
ok('damage band reference escalates P1 < P2 < P3',
   phases.p1.ref < phases.p2.ref && phases.p2.ref < phases.p3.ref,
   { p1: phases.p1.ref, p2: phases.p2.ref, p3: phases.p3.ref });
ok('phase 2 sits roughly halfway to phase 3 (the band was already correct — '
   + 'the bug was pattern DENSITY, not per-hit damage)',
   Math.abs(phases.p2.mul / phases.p3.mul - 0.5) < 0.05,
   { ratio: +(phases.p2.mul / phases.p3.mul).toFixed(3) });

ok('no page errors during the probe', errs.length === 0, errs.slice(0, 3));
await b.close();

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + (x.x != null ? '  ' + JSON.stringify(x.x) : '')); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
