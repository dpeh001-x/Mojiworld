// Level-gap DEF: a monster that outlevels you resists more of your damage.
// Per user: "make monsters with higher level have higher DEF such that low
// level players deal less damage, make it have some variation as well".
//
// This measures DAMAGE ACTUALLY DEALT through hitMonster, not the constants.
// The constants were never the risk â€” the risk is the term landing in the wrong
// place in a long multiplier stack, or the entry test skipping mobs whose base
// DEF is 0 (most low-tier types are DEF 1-4 and several have none).
//   node scripts/mob_level_def_test.mjs [port]
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
await page.waitForFunction(() => typeof hitMonster === 'function' && typeof _lvGapDefAdd === 'function', { timeout: 120000 });

const r = await page.evaluate(() => {
  const out = {};
  // A disposable target with a known base DEF; measure damage that lands.
  // 'nova' is MISS-EXEMPT but still runs the DEF curve, so it isolates the DEF
  // term. The game ALREADY has a level-gap MISS roll (_rollHitVsLevelGap), and
  // an ordinary skill measured here reports whiffs as if they were mitigation â€”
  // the first version of this test read 0 damage at a 5-level gap and called it
  // a DEF effect. Combined throughput is measured separately below.
  const probe = (mobLevel, playerLevel, opts = {}) => {
    player.level = playerLevel;
    const m = {
      type: 'slime', level: mobLevel, def: opts.def == null ? 20 : opts.def,
      currentHp: 1e9, maxHp: 1e9, hp: 1e9, x: 0, y: 0, w: 40, h: 40, facing: 1,
      isBoss: !!opts.isBoss, boss: !!opts.isBoss, _defVar: opts.varFix,
    };
    const before = m.currentHp;
    hitMonster(m, 10000, false, opts.skill || 'nova');
    return before - m.currentHp;
  };
  // Average throughput INCLUDING the pre-existing miss roll, so the combined
  // player experience is on the record next to the DEF term alone.
  const throughput = (mobLevel, playerLevel) => {
    let tot = 0;
    for (let i = 0; i < 400; i++) tot += probe(mobLevel, playerLevel, { skill: 'melee', varFix: 1 });
    return Math.round(tot / 400);
  };
  out.thruAt = throughput(30, 30);
  out.thru20 = throughput(50, 30);
  // Fix variance to 1.0 where we want a clean read of the level term.
  out.atLevel   = probe(30, 30, { varFix: 1 });
  out.gap5      = probe(35, 30, { varFix: 1 });
  out.gap20     = probe(50, 30, { varFix: 1 });
  out.gap40     = probe(70, 30, { varFix: 1 });
  out.gap60     = probe(90, 30, { varFix: 1 });   // beyond the 40-level cap
  out.over      = probe(20, 30, { varFix: 1 });   // player OUTLEVELS the mob
  out.zeroDef   = probe(50, 30, { def: 0, varFix: 1 });   // base DEF 0 + big gap
  out.zeroDefAt = probe(30, 30, { def: 0, varFix: 1 });   // base DEF 0, no gap
  out.bossGap20 = probe(50, 30, { isBoss: true, varFix: 1 });

  // Variance: many fresh mobs at identical level/def must NOT all match.
  const seen = [];
  for (let i = 0; i < 40; i++) seen.push(probe(50, 30, { varFix: undefined }));
  out.varDistinct = new Set(seen).size;
  out.varMin = Math.min(...seen); out.varMax = Math.max(...seen);

  // A single mob must keep ONE roll across hits, not re-roll per hit.
  player.level = 30;
  const stable = { type: 'slime', level: 50, def: 20, currentHp: 1e9, maxHp: 1e9, hp: 1e9,
    x: 0, y: 0, w: 40, h: 40, facing: 1 };
  // Read the STORED roll, not the damage: damage also moves with the combo
  // multiplier, so inferring "one roll per mob" from damage numbers was wrong â€”
  // the first version of this check failed on combo drift and blamed _defVar.
  const rolls = [];
  for (let i = 0; i < 12; i++) { hitMonster(stable, 10000, false, 'nova'); rolls.push(stable._defVar); }
  out.sameMobDistinct = new Set(rolls).size;
  out.sameMobRoll = stable._defVar;

  // How punishing is the PRE-EXISTING miss roll on its own? Reported so the
  // combined difficulty is attributable rather than guessed at.
  out.hitPct = {};
  for (const g of [0, 5, 10, 20, 40]) {
    out.hitPct[g] = (typeof _hitRateVsLevelGap === 'function') ? Math.round(_hitRateVsLevelGap(g)) : null;
  }
  return out;
});
await b.close(); try { srv.kill(); } catch (e) {}

const pct = (v) => (v / 10000 * 100).toFixed(1) + '%';
console.log('DEF term alone â€” damage of 10000 that lands (mob DEF 20, player Lv 30):');
for (const k of ['over', 'atLevel', 'gap5', 'gap20', 'gap40', 'gap60'])
  console.log(`  ${k.padEnd(9)} ${String(r[k]).padStart(6)}  ${pct(r[k])}`);
console.log('\ncombined with the PRE-EXISTING level-gap miss roll (400-hit average):');
console.log(`  at level  ${String(r.thruAt).padStart(6)}  ${pct(r.thruAt)}`);
console.log(`  gap 20    ${String(r.thru20).padStart(6)}  ${pct(r.thru20)}   <- what a player actually feels`);

ok('at-level combat is UNCHANGED (gap 0 adds nothing)', r.atLevel === r.over, { atLevel: r.atLevel, playerOverlevelled: r.over });
ok('a 5-level gap already bites', r.gap5 < r.atLevel * 0.92, { atLevel: r.atLevel, gap5: r.gap5 });
ok('DEF rises monotonically with the gap', r.gap5 > r.gap20 && r.gap20 > r.gap40, { gap5: r.gap5, gap20: r.gap20, gap40: r.gap40 });
ok('a 20-level gap roughly halves your damage', r.gap20 < r.atLevel * 0.60 && r.gap20 > r.atLevel * 0.35, { ratio: (r.gap20 / r.atLevel).toFixed(2) });
ok('the gap is CAPPED â€” 60 levels is no worse than 40', r.gap60 === r.gap40, { gap40: r.gap40, gap60: r.gap60 });
ok('it still leaves a winnable fight (never below 25%)', r.gap40 > r.atLevel * 0.25, { ratio: (r.gap40 / r.atLevel).toFixed(2) });
ok('a 0-DEF mob still gets gated when it outlevels you', r.zeroDef < r.zeroDefAt * 0.75, { zeroDefGap: r.zeroDef, zeroDefAtLevel: r.zeroDefAt });
ok('bosses get a REDUCED share (they already ramp offensively)', r.bossGap20 > r.gap20, { boss: r.bossGap20, normal: r.gap20 });
ok('VARIATION: identical mobs do not all take identical damage', r.varDistinct >= 8, { distinctValues: r.varDistinct, min: r.varMin, max: r.varMax });
ok('variation stays within a sane band (~+/-15%)', (r.varMax - r.varMin) / r.varMax < 0.35, { min: r.varMin, max: r.varMax });
ok('ONE mob keeps ONE DEF roll across hits (not random per swing)', r.sameMobDistinct === 1, { distinctRolls: r.sameMobDistinct, roll: r.sameMobRoll });
console.log('\npre-existing level-gap HIT chance (not part of this change): ' + JSON.stringify(r.hitPct));
ok('no page errors', errs.length === 0, errs.slice(0, 3));

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + '  ' + JSON.stringify(x.x)); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);

