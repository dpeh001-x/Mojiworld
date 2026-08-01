// v0.29.400 — the per-class hit spark must actually appear in real combat.
// It was gated behind _perfLowFx(), which engages whenever ANY boss is alive
// or >14 mobs are up, so it was suppressed through every boss fight.
//
//   node serve.js 8794 && node scripts/class_hit_fx_test.mjs 8794
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const PORT = process.argv[2] || '8794';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--disable-gpu', '--mute-audio'] });
const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => { try { return typeof eval('hitMonster') === 'function' && !!eval('game'); } catch { return false; } }, null, { timeout: 120000 });

const out = await page.evaluate(() => {
  const g = eval('game'), P = eval('LX_PERF'), hit = eval('hitMonster');
  const saved = { mon: g.monsters, proj: g.projectiles, low: P.lowFx, very: P.veryLowFx, cls: eval('player').cls };
  const pl = eval('player');
  // Spy on the sprite-burst spawner to see whether the class spark is emitted.
  const savedBurst = eval('spawnSpriteBurst');
  let keys = [];
  try { eval('spawnSpriteBurst = function (x, y, key) { keys.push(key); }'); }
  catch (e) { return { err: 'spy failed: ' + e }; }

  const mk = () => ({ x: 100, y: 100, w: 40, h: 40, hp: 1e9, currentHp: 1e9, maxHp: 1e9,
                      def: 0, level: 10, type: 'slime', name: 'T' });

  // Drive one landed hit under a given world state and report the spark keys.
  const trial = (bosses, mobs, skill, forceVeryLow) => {
    g.monsters = [];
    const target = mk();
    for (let i = 0; i < bosses; i++) g.monsters.push(Object.assign(mk(), { isBoss: true }));
    for (let i = 0; i < mobs; i++) g.monsters.push(mk());
    g.monsters.push(target);
    g.projectiles = [];
    g._lowFxCache = null;
    g._lastClassHitFxFrame = -1;
    P.lowFx = false; P.veryLowFx = !!forceVeryLow;
    keys = [];
    // Retry: hitMonster rolls an accuracy check, so a single call can miss.
    for (let i = 0; i < 40 && !keys.length; i++) {
      g._lastClassHitFxFrame = -1;
      g._lowFxCache = null;
      try { hit(target, 100, false, skill); } catch (e) { return 'ERR ' + e; }
    }
    return keys.slice();
  };

  pl.cls = 'warrior';
  const res = {
    // The case the user reported: fighting a boss.
    bossFight:      trial(1, 0, 'groundSlam', false),
    // Dense pull (>14 mobs) — the other lowFx trigger.
    densePull:      trial(0, 20, 'groundSlam', false),
    // Quiet field — worked before and must still work.
    quietField:     trial(0, 2, 'groundSlam', false),
    // Deepest tier must STILL suppress it.
    veryLowFx:      trial(1, 0, 'groundSlam', true),
    // Basic attacks must still not emit the spark.
    basicAttack:    trial(0, 2, 'slash', false),
    // Once per frame only, even across many hits in the same frame.
  };
  // Coalescing: many hits inside ONE frame must emit at most one spark.
  g.monsters = []; const t2 = mk(); g.monsters.push(t2);
  g._lowFxCache = null; P.lowFx = false; P.veryLowFx = false;
  g._lastClassHitFxFrame = -1; keys = [];
  for (let i = 0; i < 30; i++) { try { hit(t2, 100, false, 'groundSlam'); } catch (e) {} }
  res.sameFrameSparks = keys.length;

  // Per-class keys.
  const perClass = {};
  for (const c of ['warrior', 'rogue', 'mage', 'archer']) {
    pl.cls = c;
    perClass[c] = trial(1, 0, 'groundSlam', false);
  }
  res.perClass = perClass;

  // CONTROL: force the lowFx tier ON explicitly. Under the old gate this was
  // the exact condition that suppressed the spark, so a spark here proves the
  // gate genuinely moved off lowFx rather than the trial states being wrong.
  pl.cls = 'warrior';
  g.monsters = []; const t3 = mk(); g.monsters.push(t3);
  g._lowFxCache = null; P.lowFx = true; P.veryLowFx = false;
  keys = [];
  for (let i = 0; i < 40 && !keys.length; i++) {
    g._lastClassHitFxFrame = -1;
    try { hit(t3, 100, false, 'groundSlam'); } catch (e) {}
  }
  res.forcedLowFx = keys.slice();

  try { eval('spawnSpriteBurst = savedBurst'); } catch (e) {}
  g.monsters = saved.mon; g.projectiles = saved.proj;
  P.lowFx = saved.low; P.veryLowFx = saved.very; pl.cls = saved.cls; g._lowFxCache = null;
  return res;
});

ok('spy installed', !out.err, out.err);
const isHit = a => Array.isArray(a) && a.some(k => typeof k === 'string' && k.indexOf('hit_') === 0);
ok('BOSS FIGHT now shows the class hit spark (this was the reported bug)',
   isHit(out.bossFight), out.bossFight);
ok('DENSE PULL (>14 mobs) now shows it too', isHit(out.densePull), out.densePull);
ok('quiet field still shows it (no regression)', isHit(out.quietField), out.quietField);
ok('the deepest FX tier STILL suppresses it', Array.isArray(out.veryLowFx) && out.veryLowFx.length === 0, out.veryLowFx);
ok('basic attacks still emit no class spark', Array.isArray(out.basicAttack) && out.basicAttack.length === 0, out.basicAttack);
ok('still coalesced to ONE spark per frame across 30 hits', out.sameFrameSparks === 1, { sparks: out.sameFrameSparks });
for (const c of ['warrior', 'rogue', 'mage', 'archer'])
  ok(`${c} emits its own hit key`, isHit(out.perClass[c]) && out.perClass[c][0].indexOf('hit_' + c) === 0, out.perClass[c]);

ok('CONTROL: with LX_PERF.lowFx forced ON the spark still fires — the gate really did move off lowFx',
   isHit(out.forcedLowFx), out.forcedLowFx);
ok('no page errors', errs.length === 0, errs.slice(0, 3));
await b.close();

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + (x.x != null ? '  ' + JSON.stringify(x.x) : '')); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
