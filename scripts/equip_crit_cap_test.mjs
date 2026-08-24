// EQUIPMENT CRIT CAP — no single item may pay more than the cap.
// ============================================================================
// Per user: "for crit chance per equipment cap it at 25% maximum".
//
// The game already had this mechanic at 20 ("Cap any single item's effective
// crit contribution"); this raises it to 25 and pins the behaviour down.
//
// The cap applies to the EFFECTIVE contribution -- base x star x tier x class
// affinity -- not to the number printed on the item, so the interesting cases
// are the ones where scaling would otherwise carry a modest roll past the
// ceiling. Everything below reads getEquipBonus('crit'), the function the
// damage pipeline actually calls, with real items in real slots.
// Run: node scripts/equip_crit_cap_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 9901);
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
await page.fill('#hero-name-input', 'CritCap');
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
  out.cap = (typeof LX_EQUIP_CRIT_CAP_PER_ITEM !== 'undefined') ? LX_EQUIP_CRIT_CAP_PER_ITEM : null;

  // Class-neutral items ('any'), so the +20%/-25% class-affinity multiplier is
  // not silently part of what is being measured.
  const mk = (crit, extra) => Object.assign({ name: 'T', slot: 'weapon', cls: 'any', crit }, extra || {});
  const equip = (w, a, c) => {
    player.equipped = { weapon: w || null, armor: a || null, accessory: c || null };
    player._equipBonusCache = null;              // the cache is lazy; force a rebuild
    return getEquipBonus('crit');
  };

  // crit is a FLAT tier-scaled stat, so a printed roll is multiplied by
  // star x tier BEFORE the cap applies. Derive that multiplier from the game
  // rather than modelling it here: at tier 1 it is already x2, which means the
  // item that first reaches the 25 cap only PRINTS about 12.5.
  out.mult = starMult({}) * _tierMul(undefined);
  out.underCapPassesThrough = equip(mk(9));                       // 9 x mult, still under
  // Literal 25, not out.cap: on a build without the constant, mk(null) rolls a
  // null crit and the failure message reads "clamped to 0", which describes the
  // fixture rather than the build under test.
  out.atCap = equip(mk(25));
  out.hugeRollClamped = equip(mk(999));                           // absurd roll -> cap
  out.starScaledClamped = equip(mk(20, { star: 5, tier: 5 }));    // scaling would exceed -> cap
  // Three slots each clamped independently: the cap is PER ITEM, not a total.
  out.threeSlots = equip(mk(999), mk(999, { slot: 'armor' }), mk(999, { slot: 'accessory' }));
  // ...and a mixed set still sums the small one in full.
  out.mixed = equip(mk(999), mk(4, { slot: 'armor' }), null);

  // What the player actually ends up with, through the real getCrit().
  player.equipped = { weapon: mk(999), armor: mk(999, { slot: 'armor' }), accessory: mk(999, { slot: 'accessory' }) };
  player._equipBonusCache = null;
  const _mods = player.mods.crit; player.mods.crit = 0;
  const _cls = player.cls;
  player.cls = 'warrior'; out.critWarrior = getCrit();
  player.cls = 'rogue';   out.critRogue = getCrit();
  player.cls = _cls; player.mods.crit = _mods;
  player.equipped = { weapon: null, armor: null, accessory: null };
  player._equipBonusCache = null;
  out.baseCrit = player.baseCrit || 5;
  return out;
});
await browser.close(); server.kill();

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 170) });
const CAP = 25;

ok('the cap is a named constant set to 25', R.cap === CAP, 'LX_EQUIP_CRIT_CAP_PER_ITEM = ' + R.cap);
ok('a roll under the cap is scaled but not clamped',
   Math.abs(R.underCapPassesThrough - 9 * R.mult) < 0.001 && R.underCapPassesThrough < CAP,
   `an item printing 9 gives ${R.underCapPassesThrough} (x${R.mult} star/tier), still under the ${CAP} cap`);
ok('the cap is on the EFFECTIVE contribution, not the printed roll',
   Math.abs(R.atCap - CAP) < 0.001,
   `an item printing ${CAP} is clamped to ${R.atCap}; the roll that first reaches the cap only prints ~${(CAP / R.mult).toFixed(1)}`);
ok('an absurd roll is clamped to the cap', Math.abs(R.hugeRollClamped - CAP) < 0.001,
   'item rolling 999 gives ' + R.hugeRollClamped);
ok('star/tier scaling cannot carry an item past the cap',
   Math.abs(R.starScaledClamped - CAP) < 0.001,
   'crit 20 at star 5 / tier 5 gives ' + R.starScaledClamped + ' (uncapped it would exceed 25)');
ok('the cap is PER ITEM, so three slots give 3x it', Math.abs(R.threeSlots - CAP * 3) < 0.001,
   'three capped slots give ' + R.threeSlots + ' (expected ' + CAP * 3 + ')');
ok('a small roll still contributes in full alongside a capped one',
   Math.abs(R.mixed - (CAP + 4 * R.mult)) < 0.001,
   `capped ${CAP} + (4 printed x ${R.mult}) gives ${R.mixed}`);
// The consequence, stated as a number rather than left implicit.
ok('full crit gear lands where the cap implies', Math.abs(R.critWarrior - (CAP * 3 + R.baseCrit)) < 1.5,
   `warrior ${R.critWarrior}% (= 3x${CAP} gear + ${R.baseCrit} base), rogue ${R.critRogue}% (x1.2)`);
ok('and getCrit still clamps at 100', R.critRogue <= 100, 'rogue ' + R.critRogue + '%');

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
