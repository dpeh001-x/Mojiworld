// PER-EQUIPMENT LIFESTEAL BAND — every piece pays between 0.5% and 3.5%.
// ============================================================================
// Per user: "Equipments lifesteal is way too high, for each equipment max will
// be at 3.5% hard cap, starting lifesteal will be at 0.5%, ensure this applies
// throughout if an equipment gives lifesteal".
//
// The authored rolls were never the problem — the richest item in ITEM_POOL
// prints 1.5%. What is too high is what a piece PAYS: base + Vampirism affix,
// x star, x the marginal tier curve, x class affinity, and Transcendence can
// bake all of that back into the base and let it star up again from there.
// Each mechanic is defensible alone; they compose, and nothing bounded the
// product. So the band is asserted on the EFFECTIVE contribution — what
// getEquipBonus('lifesteal') hands the heal — not on the printed roll.
//
// Sibling of equip_crit_cap_test.mjs, which pins the per-item crit cap this is
// modelled on, and of lifesteal_cap_test.mjs, which pins the separate 10%
// shared per-hit ledger. This one is per PIECE; that one is per HIT.
// Run: node scripts/equip_lifesteal_cap_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 9903);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
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
await page.fill('#hero-name-input', 'LsCap');
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
await page.evaluate(() => { player.level = 99; loadMap('forest', 300); });
await page.waitForTimeout(3500);

const R = await page.evaluate(() => {
  const out = {};
  out.min = (typeof LX_EQUIP_LS_MIN_PER_ITEM !== 'undefined') ? LX_EQUIP_LS_MIN_PER_ITEM : null;
  out.cap = (typeof LX_EQUIP_LS_CAP_PER_ITEM !== 'undefined') ? LX_EQUIP_LS_CAP_PER_ITEM : null;

  // Class-neutral ('any') so the +20%/-25% class-affinity multiplier is not
  // silently part of what is being measured, except where it IS the subject.
  const mk = (lifesteal, extra) => Object.assign({ name: 'T', slot: 'weapon', cls: 'any', lifesteal }, extra || {});
  const equip = (w, a, c) => {
    player.equipped = { weapon: w || null, armor: a || null, accessory: c || null };
    player._equipBonusCache = null;              // the cache is lazy; force a rebuild
    return getEquipBonus('lifesteal');
  };

  out.noLifesteal    = equip(mk(0, { atk: 50 }));           // the floor must not INVENT lifesteal
  out.absurdClamped  = equip(mk(0.5));                      // a 50% roll -> the cap
  out.tinyFloored    = equip(mk(0.0001));                   // a rounding-error roll -> the floor
  out.midPassthrough = equip(mk(0.02));                     // inside the band -> untouched
  // The real inflation path: star x tier on a rich base. Two fixtures, because
  // they are two different claims. The percent family takes only 35% of the
  // star curve and a marginal tier curve, so the richest AUTHORED roll forged
  // to the hilt lands UNDER the cap and the clamp must leave it alone. A base
  // twice that — reachable through Transcendence, or through a future item —
  // is what the ceiling is actually for.
  out.forgedUnderCap = equip(mk(0.015, { stars: 10, tier: 10 }));
  out.forgedOverCap  = equip(mk(0.030, { stars: 10, tier: 10 }));
  // Class-mismatched gear (x0.75) still pays the floor, not a fraction of it.
  const _cls = player.cls;
  player.cls = 'warrior';
  out.mismatchFloored = equip(mk(0.006, { cls: 'rogue' }));
  player.cls = _cls;
  // Per ITEM, not per build: three capped pieces pay three caps.
  out.threeSlots = equip(mk(0.5), mk(0.5, { slot: 'armor' }), mk(0.5, { slot: 'accessory' }));

  // The real endgame pieces, as the pool authors them, fully forged.
  const pool = (typeof ITEM_POOL !== 'undefined' && ITEM_POOL) || {};
  const rich = []
    .concat(pool.weapons || [], pool.armor || [], pool.accessories || [])
    .filter((it) => it && it.lifesteal > 0)
    .sort((a, b) => b.lifesteal - a.lifesteal);
  out.richestPrinted = rich.length ? rich[0].lifesteal : null;
  out.poolFloor = rich.length ? Math.min.apply(null, rich.map((it) => it.lifesteal)) : null;
  if (rich.length) {
    const forged = Object.assign({}, rich[0], { stars: 10 });
    out.realForged = equip(forged);
    // Transcendence bakes star scaling into the BASE and re-stars from there.
    const baked = Object.assign({}, rich[0], { lifesteal: rich[0].lifesteal * 6, stars: 10, transcended: true });
    out.realTranscended = equip(baked);
  }

  // What the UI advertises has to be what the pipeline pays.
  if (typeof itemStatString === 'function' && rich.length) {
    const shown = (it) => {
      const s = itemStatString(Object.assign({}, it), false) || '';
      const m = s.match(/([\d.]+)%\s*Lifesteal/);
      return m ? Number(m[1]) : null;
    };
    out.shownRichest = shown(rich[0]);
    out.shownAbsurd = shown(Object.assign({}, rich[0], { lifesteal: 0.5 }));
    out.shownTiny = shown(Object.assign({}, rich[0], { lifesteal: 0.0002 }));
  }

  player.equipped = { weapon: null, armor: null, accessory: null };
  player._equipBonusCache = null;
  return out;
});
await browser.close(); server.kill();

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 180) });
const MIN = 0.005, CAP = 0.035;
const pc = (v) => (v === null || v === undefined ? 'n/a' : (v * 100).toFixed(2) + '%');

ok('the band is two named constants: 0.5% floor, 3.5% cap',
  R.min === MIN && R.cap === CAP, `min ${pc(R.min)}, cap ${pc(R.cap)}`);
ok('a piece with no lifesteal still gives none — the floor cannot invent it',
  R.noLifesteal === 0, 'atk-only item gives ' + pc(R.noLifesteal));
ok('an absurd roll is clamped to the 3.5% cap',
  Math.abs(R.absurdClamped - CAP) < 1e-9, 'a 50% roll pays ' + pc(R.absurdClamped));
ok('a value inside the band passes through untouched',
  Math.abs(R.midPassthrough - 0.02) < 1e-9, '2% pays ' + pc(R.midPassthrough));
ok('a rounding-error roll is lifted to the 0.5% floor',
  Math.abs(R.tinyFloored - MIN) < 1e-9, '0.01% roll pays ' + pc(R.tinyFloored));
ok('star x tier scaling cannot carry a piece past the cap',
  Math.abs(R.forgedOverCap - CAP) < 1e-9,
  `a 3% base at star 10 / tier 10 pays ${pc(R.forgedOverCap)}`);
ok('...and a piece that scales to UNDER the cap is left alone — a ceiling, not a target',
  R.forgedUnderCap < CAP - 1e-9 && R.forgedUnderCap > 0.015,
  `the richest authored roll (1.5%) forged to star 10 / tier 10 pays ${pc(R.forgedUnderCap)}, untouched`);
ok('class-mismatched gear (x0.75) still pays the floor',
  Math.abs(R.mismatchFloored - MIN) < 1e-9, 'rogue item on a warrior pays ' + pc(R.mismatchFloored));
ok('the band is PER PIECE, so three lifesteal slots pay 3x the cap',
  Math.abs(R.threeSlots - CAP * 3) < 1e-9,
  `three capped slots pay ${pc(R.threeSlots)} (the combined RATE is governed separately, per hit, at 10%)`);
ok('every authored roll in the pool starts at 0.5% or above',
  R.poolFloor === null || R.poolFloor >= MIN - 1e-9,
  `cheapest printed roll ${pc(R.poolFloor)}, richest ${pc(R.richestPrinted)}`);
ok('the richest real item, fully forged, lands inside the band',
  R.realForged === undefined || (R.realForged >= MIN - 1e-9 && R.realForged <= CAP + 1e-9),
  `${pc(R.richestPrinted)} printed pays ${pc(R.realForged)} at star 10`);
ok('a Transcendence-baked base cannot escape the band either',
  R.realTranscended === undefined || R.realTranscended <= CAP + 1e-9,
  'a 6x baked base at star 10 pays ' + pc(R.realTranscended));
ok('the tooltip advertises a number inside the band',
  R.shownAbsurd === null || (R.shownAbsurd <= CAP * 100 + 0.05 && R.shownTiny >= MIN * 100 - 0.05),
  `a 50% roll shows ${R.shownAbsurd}%, a 0.02% roll shows ${R.shownTiny}%, the richest shows ${R.shownRichest}%`);

let fail = 0;
for (const r of res) { if (!r.pass) fail++; console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.n + (r.extra ? '  — ' + r.extra : '')); }
console.log(`\n${res.length - fail}/${res.length} checks passed`);
process.exit(fail ? 1 : 0);
