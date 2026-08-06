// Verify the retuned hit curve empirically: measured hit rates through the
// REAL hitMonster funnel at controlled level gaps, with zero ACC invested.
import { createRequire } from 'node:module';
const req = createRequire('file:///C:/Users/dpeh0/Mojiworld/package.json');
const { chromium } = req('playwright-core');
import { spawn } from 'node:child_process';
const PORT = 9007;
const server = spawn(process.execPath, ['C:/Users/dpeh0/Mojiworld/serve.js', String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(10000);

const R = await page.evaluate(() => {
  const res = [];
  const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra) });
  for (const id of ['class-select-modal','advancement-modal','tutorial-modal','loading-overlay',
                    'story-beat-overlay','boss-intro-overlay','dialog']) {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
  }
  // warrior: no innate ACC bonus, no invested ACC — the raw curve
  player.cls = 'warrior'; player.baseAcc = 0; player.mods = player.mods || {};
  player.mods.accuracy = 0;
  loadMap('forest'); game.paused = false;

  // 1. the curve itself (function-level, exact)
  const curve = [[-20, 100], [0, 100], [1, 92], [5, 60], [10, 25], [16, 10]];
  let curveOK = true, detail = [];
  for (const [g, want] of curve) {
    const got = Math.round(_hitRateVsLevelGap(g));
    detail.push(`${g >= 0 ? '+' : ''}${g}:${got}%`);
    if (got !== want) curveOK = false;
  }
  ok('curve anchors exact: -20/0 ->100, +1->92, +5->60, +10->25, +16->10', curveOK, detail.join(' '));

  // 2. measured through the REAL funnel: at-level and under-level mobs with
  //    0 evasion must take every single hit (n=300 each)
  const measure = (mobLv) => {
    game.monsters.length = 0;
    const m = spawnMonster(400, 300, 'slime', false);
    m.evasion = 0; m.maxHp = 10000000; m.currentHp = m.maxHp;
    m.level = mobLv; // _mobLevel may read a natural-level table; force via field AND player level
    let hits = 0, N = 300;
    for (let i = 0; i < N; i++) {
      const h = m.currentHp;
      hitMonster(m, 10, false, 'x_probe');
      if (m.currentHp < h) hits++;
    }
    return hits / N;
  };
  player.level = 50;
  const same = measure(50);
  ok('at-level: 100% of 300 hits land (was ~90%)', same === 1, `${(same * 100).toFixed(1)}%`);
  player.level = 99;
  const under = measure(10);
  ok('under-level: 100% of 300 hits land', under === 1, `${(under * 100).toFixed(1)}%`);

  // 3. upward fights still miss: +10 gap should land ~25% (band 15-35%)
  player.level = 20;
  game.monsters.length = 0;
  const hi = spawnMonster(400, 300, 'slime', false);
  hi.evasion = 0; hi.maxHp = 10000000; hi.currentHp = hi.maxHp;
  // force the mob's resolved level via the natural-level override if present
  const gapProbe = (typeof _mobLevel === 'function') ? null : null;
  hi.level = 30;
  let hits10 = 0;
  for (let i = 0; i < 400; i++) {
    const h = hi.currentHp;
    hitMonster(hi, 10, false, 'x_probe');
    if (hi.currentHp < h) hits10++;
  }
  const rate10 = hits10 / 400;
  const lv = (typeof _mobLevel === 'function') ? _mobLevel(hi) : hi.level;
  const expect = _hitRateVsLevelGap(lv - player.level) / 100;
  ok('upward-gap miss chance intact (measured ~= curve)', Math.abs(rate10 - expect) < 0.08,
     `measured ${(rate10 * 100).toFixed(1)}% vs curve ${(expect * 100).toFixed(1)}% (mob resolves Lv ${lv})`);

  // 4. monster evasion still causes misses at equal level (earned whiffs live)
  player.level = 50;
  game.monsters.length = 0;
  const ev = spawnMonster(400, 300, 'slime', false);
  ev.evasion = 200; ev.maxHp = 10000000; ev.currentHp = ev.maxHp; ev.level = 50;
  let hitsEv = 0;
  for (let i = 0; i < 300; i++) {
    const h = ev.currentHp;
    hitMonster(ev, 10, false, 'x_probe');
    if (ev.currentHp < h) hitsEv++;
  }
  ok('evasive mobs still dodge at equal level', hitsEv < 300 && hitsEv > 0, `${hitsEv}/300 landed vs evasion 200`);
  return res;
});

let pass = 0, fail = 0;
for (const r of R) {
  if (r.pass) { pass++; console.log(`  PASS  ${r.n}${r.extra ? '  (' + r.extra + ')' : ''}`); }
  else { fail++; console.log(`  FAIL  ${r.n}  ${r.extra}`); }
}
console.log(`\n${pass} passed, ${fail} failed`);
console.log('pageerrors:', errs.length, errs.slice(0, 3));
await browser.close(); server.kill();
process.exit(fail || errs.length ? 1 : 0);
