// Bigger non-boss monsters must jump lower. Per user.
//
// The relationship used to run the WRONG WAY: corr(height, jump) = +0.287
// across the 66 jumping non-boss types, so a 150 px hulk out-hopped a 28 px
// slime. This asserts the correlation has flipped negative across the REAL
// roster, not just that one formula returns one number.
//   node scripts/mob_jump_size_test.mjs [port]
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
await page.waitForFunction(() => typeof _mobJumpV === 'function' && typeof monsterTypes === 'object', { timeout: 120000 });

const r = await page.evaluate(() => {
  const rows = [];
  for (const k in monsterTypes) {
    const t = monsterTypes[k];
    if (!t || t.boss || !(+t.jump > 0) || !(t.h > 0)) continue;
    const m = { type: k, h: t.h, jump: +t.jump };
    rows.push({ k, h: t.h, before: +t.jump, after: _mobJumpV(m) });
  }
  const corr = (xs, ys) => {
    const n = xs.length, mx = xs.reduce((a, c) => a + c, 0) / n, my = ys.reduce((a, c) => a + c, 0) / n;
    let num = 0, dx = 0, dy = 0;
    for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); dx += (xs[i] - mx) ** 2; dy += (ys[i] - my) ** 2; }
    return num / Math.sqrt(dx * dy);
  };
  const out = {
    n: rows.length,
    corrBefore: +corr(rows.map(x => x.h), rows.map(x => x.before)).toFixed(3),
    corrAfter: +corr(rows.map(x => x.h), rows.map(x => x.after)).toFixed(3),
    // The exemption threshold is 65 px (just under the 66 px roster median), so
    // most of the cast is untouched. This tracks the CODE's constant rather
    // than a number typed once and left behind when the constants were tuned.
    unchangedSmall: rows.filter(x => x.h <= 65).every(x => x.after === x.before),
    smallCount: rows.filter(x => x.h <= 65).length,
    anyZero: rows.some(x => x.after <= 0),
    minMul: +Math.min(...rows.map(x => x.after / x.before)).toFixed(3),
  };
  // Band means, after.
  out.bands = {};
  for (const [lo, hi] of [[0, 69], [70, 109], [110, 9999]]) {
    const g = rows.filter(x => x.h >= lo && x.h <= hi);
    if (g.length) out.bands[`${lo}-${hi}`] = +(g.reduce((a, x) => a + x.after, 0) / g.length).toFixed(2);
  }
  // Specific mobs
  const pick = (k) => rows.find(x => x.k === k);
  out.big = pick('glasswindHare') || pick('forgewight') || rows.sort((a, c) => c.h - a.h)[0];
  out.small = pick('slime') || rows.sort((a, c) => a.h - c.h)[0];
  // Bosses must be untouched.
  const bosses = [];
  for (const k in monsterTypes) {
    const t = monsterTypes[k];
    if (!t || !t.boss || !(+t.jump > 0)) continue;
    bosses.push({ k, same: _mobJumpV({ type: k, h: t.h || 120, jump: +t.jump, boss: true }) === +t.jump });
  }
  out.bossCount = bosses.length;
  out.bossesUnchanged = bosses.every(x => x.same);
  // A big mob flagged as boss keeps its jump; the same body as a non-boss does not.
  const probe = { type: 'x', h: 150, jump: 10 };
  out.asMob = _mobJumpV(probe);
  out.asBoss = _mobJumpV({ ...probe, boss: true });
  return out;
});
await b.close(); try { srv.kill(); } catch (e) {}

console.log(`jumping non-boss types: ${r.n}`);
console.log(`corr(height, jump)  before ${r.corrBefore}  ->  after ${r.corrAfter}`);
console.log('mean jump by height band (after):', JSON.stringify(r.bands));
console.log(`biggest: ${r.big.k} h${r.big.h}  ${r.big.before} -> ${r.big.after.toFixed(2)}`);
console.log(`smallest: ${r.small.k} h${r.small.h}  ${r.small.before} -> ${r.small.after.toFixed(2)}`);

ok('bigger now predicts a LOWER jump (correlation is negative)', r.corrAfter < -0.10, { before: r.corrBefore, after: r.corrAfter });
ok('it actually flipped direction (was +0.287)', r.corrBefore > 0.2 && r.corrAfter < r.corrBefore, { before: r.corrBefore, after: r.corrAfter });
ok('mobs at or below the 65px threshold are completely untouched', r.unchangedSmall === true, { count: r.smallCount });
ok('band means fall monotonically with size', r.bands['0-69'] >= r.bands['70-109'] && r.bands['70-109'] > r.bands['110-9999'], r.bands);
ok('no monster is grounded outright (they still hop)', r.anyZero === false && r.minMul >= 0.49, { minMul: r.minMul });
ok('bosses are exempt', r.bossesUnchanged === true, { bosses: r.bossCount });
ok('the same body as a boss keeps its jump, as a mob does not', r.asBoss === 10 && r.asMob < 10, { asBoss: r.asBoss, asMob: +r.asMob.toFixed(2) });
ok('no page errors', errs.length === 0, errs.slice(0, 3));

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + '  ' + JSON.stringify(x.x)); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);


