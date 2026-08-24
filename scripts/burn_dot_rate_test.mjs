// BURN / DOT — ticks at the documented rate, and cannot delete a mob in a tick.
// ============================================================================
// Per user: "look into burn or DOT damage, as of now its quite overpowered,
// anything that takes damage from burn dies insanely fast compared to anything
// that doesnt".
//
// It was not a tuning problem, it was a UNIT bug. The gate read
//
//     if (m.animTimer % 120 < dt)
//
// with comments saying "burn tick rate 30 frames -> 60 frames (1 s)" and
// "60 -> 120 frames (2 s)". animTimer does not count frames: `m.animTimer += dt`
// with dt = _LX_SIM_STEP_MS (16.667), so it accumulates MILLISECONDS and "% 120"
// meant every 120 ms, not every 2 s.
//
// The per-tick damage had also been DOUBLED on purpose, to compensate for a rate
// the author believed had halved -- so the error compounds. Intended DPS is
// burnDmg/second; actual was ~16.7x that. Measured before the fix: a 2956 HP mob
// died to burn alone in 13.5 s at 28 a tick, about 105 ticks, one every ~129 ms.
//
// The cadence is now 800ms by request, and per-tick damage and the cap are both
// DERIVED from it, so the rate is a presentation knob: moving it changes how
// often numbers fly off a burning mob and nothing about how fast it dies. That
// property is precisely what was missing before -- the previous author changed
// the rate and hand-compensated the damage, and the two drifted apart.
//
// This measures the INTERVAL between real HP drops rather than reading the
// constant, because the constant was never the thing that was wrong -- the code
// read it in the wrong unit.
// Run: node scripts/burn_dot_rate_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 9953);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`,
  { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'BurnRate');
await page.evaluate(() => {
  const m = document.getElementById('class-select-modal');
  for (const el of m.querySelectorAll('button,div,li')) {
    if (el.children.length > 3) continue;
    if (getComputedStyle(el).display === 'none') continue;
    if (/^\s*warrior\s*$/i.test((el.textContent || '').trim())) { el.click(); return; }
  }
});
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);
await page.evaluate(() => { player.level = 99; player._god = true; loadMap('forest', 300); });
await page.waitForTimeout(4000);

const R = await page.evaluate(async () => {
  game.paused = false;
  for (let i = 0; i < 12; i++) { const r = (typeof _lxPadModalRoot === 'function') && _lxPadModalRoot(); if (!r) break; r.style.display = 'none'; }
  const out = {
    tickMs: (typeof LX_BURN_TICK_MS !== 'undefined') ? LX_BURN_TICK_MS : null,
    dpsPct: (typeof LX_BURN_MAXHP_PCT_PER_SEC !== 'undefined') ? LX_BURN_MAXHP_PCT_PER_SEC : null,
    dpsMul: (typeof LX_BURN_DPS_MUL !== 'undefined') ? LX_BURN_DPS_MUL : null,
  };

  // Watch a burning mob's HP and time the gaps between drops.
  const run = async (burnDmg, ms) => {
    game.monsters.length = 0;
    const m = spawnMonster(player.x + 320, player.y, 'horny', false);
    if (!m) return null;
    m.atk = 0; m.aggroTarget = null;
    m.maxHp = 200000; m.currentHp = 200000;      // big enough not to die mid-measure
    const gaps = [], hits = [], vis = [];
    let last = m.currentHp, lastT = performance.now(), started = false;
    const t0 = performance.now();
    while (performance.now() - t0 < ms) {
      m.burnTimer = 999999; m.burnDmg = burnDmg;
      m.aggroTarget = null; player.hp = getMaxHp(); player.invulnerable = 400;
      await new Promise(r => requestAnimationFrame(r));
      if (m.currentHp < last) {
        const dn = game.damageNumbers[game.damageNumbers.length - 1];
        if (dn) vis.push({ y: Math.round(dn.y - m.y), size: dn.size });
        const now = performance.now();
        hits.push(Math.round(last - m.currentHp));
        if (started) gaps.push(now - lastT);
        started = true; lastT = now; last = m.currentHp;
      }
    }
    gaps.sort((a, b) => a - b);
    return {
      maxHp: m.maxHp,
      ticks: hits.length,
      medianGap: gaps.length ? Math.round(gaps[gaps.length >> 1]) : null,
      tickDmg: hits.length ? hits[hits.length >> 1] : null,
      maxTick: hits.length ? Math.max(...hits) : null,
      visYs: [...new Set(vis.map(v => v.y))].length,
      visSizes: [...new Set(vis.map(v => v.size))].length,
    };
  };

  // A modest burn: the cap must NOT bind, so the interval is measured cleanly.
  out.normal = await run(50, 9000);
  // An absurd burn, far above any cap: proves the ceiling holds.
  out.huge = await run(999999, 7000);

  return out;
});
await browser.close(); server.kill();

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 200) });
const N = R.normal, H = R.huge;

console.log(`  LX_BURN_TICK_MS ${R.tickMs}   dps mul ${R.dpsMul}   ceiling ${R.dpsPct != null ? (R.dpsPct * 100) + '% of maxHp per SECOND' : 'none'}`);
console.log(`  normal burn (burnDmg 50): ${N && N.ticks} ticks, median gap ${N && N.medianGap}ms, tick ${N && N.tickDmg}`);
console.log(`  absurd burn (burnDmg 999999): ${H && H.ticks} ticks, biggest tick ${H && H.maxTick} of ${H && H.maxHp} maxHp`);

ok('the tick interval is the configured cadence, not 120ms',
   !!(N && N.medianGap && R.tickMs && Math.abs(N.medianGap - R.tickMs) <= 150),
   `measured ${N && N.medianGap}ms against ${R.tickMs}ms configured (was ~117ms whatever the constant said)`);
ok('consecutive ticks LADDER instead of stacking on one spot',
   !!(N && N.visYs >= 3),
   `${N && N.visYs} distinct y offsets and ${N && N.visSizes} distinct sizes across the burn`);
ok('CONTROL: burn still actually damages the target',
   !!(N && N.ticks >= 2 && N.tickDmg > 0),
   `${N && N.ticks} ticks of ${N && N.tickDmg} over 9s — nerfed, not disabled`);
const perTickCap = (R.dpsPct && R.tickMs) ? Math.floor(200000 * R.dpsPct * (R.tickMs / 1000)) : null;
ok('a single tick cannot exceed the per-second max-HP budget',
   !!(H && H.maxTick && perTickCap && H.maxTick <= perTickCap + 1),
   `biggest tick ${H && H.maxTick} vs cap ${perTickCap} (${R.dpsPct * 100}%/s over a ${R.tickMs}ms tick)`);
ok('...so an absurd burnDmg can no longer delete a mob outright',
   !!(H && H.maxTick && H.maxTick < H.maxHp * 0.5),
   `burnDmg 999999 removed ${H && H.maxTick} of ${H && H.maxHp} in its biggest tick`);
ok('a kill by burn alone takes a sane number of seconds',
   !!(R.dpsPct && 1 / R.dpsPct >= 25),
   `at the ceiling that is ${R.dpsPct ? (1 / R.dpsPct).toFixed(0) : '?'}s of pure burn, independent of the ${R.tickMs}ms cadence`);

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
