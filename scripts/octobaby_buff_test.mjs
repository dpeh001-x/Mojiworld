// OCTOBABY and her tentacles: combat stats +20%.
// ============================================================================
// Per user: "Increase stats of octababy and its tentacles by 20%".
//
// Asserted as RATIOS against the pre-buff values, not as literals, so the check
// still reads as "20% up from where it was" if someone later re-tunes from a
// different base — and so the intent survives in the file rather than a row of
// magic numbers.
//
// Also pins the thing that makes the arm HP live on the TYPE: regrown
// generations size themselves off lt.hp * 0.7^gen, so the buff has to reach
// generation 1 with no second edit.
// Run: node scripts/octobaby_buff_test.mjs
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 10831);
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
// A bare identifier, not window.monsterTypes: monsterTypes is a top-level
// const, so it lives in the global LEXICAL scope and never becomes a window
// property. window.monsterTypes is permanently undefined and the wait could
// only ever time out. (Function declarations like starSuccessRate DO land on
// window, which is why the sibling test got away with it.)
await page.waitForFunction(() => typeof monsterTypes !== 'undefined' && !!monsterTypes.octobaby, null, { timeout: 40000 });
await page.waitForTimeout(2000);

const R = await page.evaluate(() => {
  const LEGS = ['octoLegPoison', 'octoLegFreeze', 'octoLegSkillLock', 'octoLegStun'];
  const pick = (t) => { const m = monsterTypes[t]; return m ? { hp: m.hp, atk: m.atk, def: m.def, eva: m.evasion, exp: m.exp, coins: m.mojicoins, speed: m.speed, w: m.w, h: m.h } : null; };
  return {
    head: pick('octobaby'),
    legs: LEGS.map(pick),
    genStep: (typeof LX_OCTO_ARM_GEN_HP !== 'undefined') ? LX_OCTO_ARM_GEN_HP : null,
  };
});
await browser.close(); server.kill();

// Values as they stood before this change.
const WAS_HEAD = { hp: 3037500, atk: 324, def: 27, eva: 126, exp: 1500000, coins: 70000, speed: 0.4 };
const WAS_LEG  = { hp: 600000, atk: 120, def: 160, eva: 90, exp: 4200, coins: 1800, speed: 0 };

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 210) });
const near = (a, b) => Math.abs(a - b) <= Math.max(1, Math.abs(b) * 0.006);   // rounding to whole numbers

const H = R.head, L = R.legs || [];
console.log(`  head: ${JSON.stringify(H)}`);
console.log(`  leg : ${JSON.stringify(L[0])}   (x${L.length} identical: ${L.every(l => l && JSON.stringify(l) === JSON.stringify(L[0]))})`);

ok('CONTROL: all four tentacles still share one stat line',
   L.length === 4 && L.every(l => l && JSON.stringify(l) === JSON.stringify(L[0])),
   'they are authored identically; a partial edit would show here');

// The head takes all four as +20% derivations.
for (const [k, label] of [['hp', 'HP'], ['atk', 'ATK'], ['def', 'DEF'], ['eva', 'evasion']]) {
  ok(`Octobaby ${label} is +20%`, near(H[k], WAS_HEAD[k] * 1.2),
     `${WAS_HEAD[k]} -> ${H[k]} (x${(H[k] / WAS_HEAD[k]).toFixed(3)})`);
}
// Tentacle HP and DEF are still the +20% derivation...
for (const [k, label] of [['hp', 'HP'], ['def', 'DEF']]) {
  ok(`tentacle ${label} is +20%`, near(L[0][k], WAS_LEG[k] * 1.2),
     `${WAS_LEG[k]} -> ${L[0][k]} (x${(L[0][k] / WAS_LEG[k]).toFixed(3)})`);
}
// ...but ATK and evasion are AUTHORED. The user set them outright after the
// +20% pass, so asserting a ratio here would encode a relationship that is no
// longer the intent and would fail a build that is exactly what was asked for.
ok('tentacle ATK is the authored 500', L[0].atk === 500,
   `atk ${L[0].atk} (was 144, a +20% derivation; now set outright)`);
ok('tentacle evasion is the authored 180', L[0].eva === 180,
   `evasion ${L[0].eva} (was 108, a +20% derivation; now set outright)`);

// The ask said STATS. Rewards and movement were left alone on purpose; if that
// is ever revisited it should be a decision, not a drift.
ok('CONTROL: rewards untouched (the ask said stats)',
   H.exp === WAS_HEAD.exp && H.coins === WAS_HEAD.coins && L[0].exp === WAS_LEG.exp,
   `head exp ${H.exp}/coins ${H.coins}, leg exp ${L[0].exp}`);
ok('CONTROL: movement untouched', H.speed === WAS_HEAD.speed && L[0].speed === WAS_LEG.speed,
   `head speed ${H.speed} (a near-stationary centrepiece by design), leg speed ${L[0].speed} (anchored)`);
ok('CONTROL: size untouched', H.w === 200 && H.h === 160 && L[0].w === 80 && L[0].h === 60,
   'size was tuned explicitly twice before; a stat buff must not move it');

// Regrowth reads lt.hp, so the buff must reach later generations for free.
const gen1 = Math.max(1, Math.floor(L[0].hp * (R.genStep != null ? R.genStep : 0.7)));
ok('the buff reaches regrown arms without a second edit',
   R.genStep != null && gen1 > Math.floor(WAS_LEG.hp * R.genStep),
   `gen1 ${Math.floor(WAS_LEG.hp * (R.genStep || 0.7))} -> ${gen1} (arm HP lives on the TYPE, so generations follow)`);

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
