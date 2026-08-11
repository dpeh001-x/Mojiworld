// Armour archetypes: block-land and bone monsters resist far more; underwater
// monsters far less. Per user. Measures damage that LANDS on real monster types
// through hitMonster, not the multiplier table — a table can be right while the
// term lands in the wrong place in the stack.
//   node scripts/mob_armor_class_test.mjs [port]
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
await page.waitForFunction(() => typeof hitMonster === 'function' && typeof _mobArmorClass === 'function', { timeout: 120000 });

const r = await page.evaluate(() => {
  const out = { cls: {}, dmg: {}, spread: {} };
  // Damage landing on a REAL type, at its own level so the gap term is 0 and
  // only the archetype is under test. 'nova' is miss-exempt but DEF-applied.
  const hitOn = (type, fixVar) => {
    const t = monsterTypes[type] || {};
    const lv = (typeof MOB_NATURAL_LEVEL !== 'undefined' && MOB_NATURAL_LEVEL[type]) || t.level || 30;
    player.level = lv;
    const m = { type, level: lv, def: t.def | 0, currentHp: 1e9, maxHp: 1e9, hp: 1e9,
      x: 0, y: 0, w: 40, h: 40, facing: 1, _defVar: fixVar };
    const before = m.currentHp;
    hitMonster(m, 10000, false, 'nova');
    return before - m.currentHp;
  };
  const PROBE = ['blockTigreal', 'blockPopo', 'tombKeeper', 'skeleton', 'boneGolem',
                 'jellyfish', 'clownfish', 'seahorse', 'tidepoolTurtle', 'bonebosn', 'snail'];
  for (const t of PROBE) {
    if (!monsterTypes[t]) continue;
    out.cls[t] = _mobArmorClass({ type: t });
    out.dmg[t] = hitOn(t, 1);
  }
  // Spread width per archetype: 200 fresh mobs each, measure the roll range.
  for (const t of ['blockTigreal', 'tombKeeper', 'jellyfish']) {
    if (!monsterTypes[t]) continue;
    const rolls = [];
    for (let i = 0; i < 200; i++) { const mm = { type: t }; _mobDefVar(mm); rolls.push(mm._defVar); }
    out.spread[t] = { min: +Math.min(...rolls).toFixed(3), max: +Math.max(...rolls).toFixed(3) };
  }
  return out;
});
await b.close(); try { srv.kill(); } catch (e) {}

console.log('armour class and damage landing (each mob at ITS OWN level, so gap = 0):');
for (const t in r.dmg) console.log(`  ${t.padEnd(16)} class ${String(r.cls[t]).padStart(5)}   damage ${String(r.dmg[t]).padStart(6)}`);
console.log('\nvariance width by archetype:', JSON.stringify(r.spread));

ok('block-land is hard armour (class >= 2)', r.cls.blockTigreal >= 2 && r.cls.blockPopo >= 2, { blockTigreal: r.cls.blockTigreal });
ok('bone/undead is hard armour (class >= 1.9)', r.cls.tombKeeper >= 1.9 && r.cls.skeleton >= 1.9 && r.cls.boneGolem >= 1.9,
   { tombKeeper: r.cls.tombKeeper, skeleton: r.cls.skeleton, boneGolem: r.cls.boneGolem });
ok('underwater is soft (class < 0.8)', r.cls.jellyfish < 0.8 && r.cls.clownfish < 0.8 && r.cls.seahorse < 0.8,
   { jellyfish: r.cls.jellyfish, clownfish: r.cls.clownfish });
ok('a SHELLED sea creature is an exception, not soft', r.cls.tidepoolTurtle > 1.4, { tidepoolTurtle: r.cls.tidepoolTurtle });
ok('a skeleton crew underwater counts as BONE, not marine', r.cls.bonebosn > 1.4, { bonebosn: r.cls.bonebosn });
ok('unclassified monsters are untouched (class 1)', r.cls.snail === 1, { snail: r.cls.snail });
ok('block-land actually takes less damage than a same-level soft mob',
   r.dmg.blockTigreal < r.dmg.jellyfish, { block: r.dmg.blockTigreal, jelly: r.dmg.jellyfish });
ok('bone actually takes less damage than soft', r.dmg.tombKeeper < r.dmg.clownfish, { bone: r.dmg.tombKeeper, soft: r.dmg.clownfish });
// Variance widths
const w = (o) => o ? +(o.max - o.min).toFixed(2) : null;
ok('block-land varies LEAST (stamped from one mould)', w(r.spread.blockTigreal) < w(r.spread.tombKeeper),
   { block: w(r.spread.blockTigreal), bone: w(r.spread.tombKeeper) });
ok('marine varies MOST', w(r.spread.jellyfish) > w(r.spread.tombKeeper),
   { marine: w(r.spread.jellyfish), bone: w(r.spread.tombKeeper) });
ok('every archetype still varies at all', w(r.spread.blockTigreal) > 0.05, { block: w(r.spread.blockTigreal) });
ok('no page errors', errs.length === 0, errs.slice(0, 3));

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + '  ' + JSON.stringify(x.x)); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
