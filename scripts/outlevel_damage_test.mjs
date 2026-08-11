// OUTLEVEL FALLOFF - does out-levelling a monster protect you?
// =============================================================================
// Calls the live _diffDmg (the choke point nearly every player-damage path
// routes through) with a controlled player level and attacker level, so the
// numbers are the game's, not a model of it.
//   1. FALLOFF    more player levels over the attacker => less damage taken
//   2. UNCHANGED  at-or-above-level monsters hit exactly as hard as before
//   3. BOUNDED    monotonic, floored, never zero
//   4. SCOPED     the untrustworthy-level fallback path is untouched
// Run: node scripts/outlevel_damage_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 9118;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
const FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
await page.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(10000);

const R = await page.evaluate(() => {
  const res = [];
  const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra) });
  for (const id of ['class-select-modal','advancement-modal','tutorial-modal','loading-overlay']) {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
  }
  loadMap('forest');
  // Sterile conditions: no difficulty scaling, no curse hex, no Glass Skin
  // edict, and no Second Skin charge (it returns 0 and would mask everything).
  game._diffDmgMul = 1;
  game._curseHex = null;
  player.mods = player.mods || {}; player.mods.skinCd = 0;
  player._skinReadyAt = 1e9;
  player.hp = 999999; player.maxHp = 999999;
  // DEF now participates in the outlevel term, so the sections below are only
  // a "no DEF" control if DEF is actually zero. A freshly loaded player has
  // some, and the buffs scale getDef() on top. Section 6 varies it deliberately.
  player.baseDef = 0; player.mods.def = 0;
  player.buffs = player.buffs || {};
  player.buffs.warCry = 0; player.buffs.guardian = 0; player.buffs.holyShield = 0;

  const hit = (playerLv, mobLv) => { player.level = playerLv; return _diffDmg(1000, mobLv); };

  // -- 1. FALLOFF ----------------------------------------------------------
  const MOB = 10;
  const curve = [10, 20, 30, 50, 70, 100].map(lv => [lv, hit(lv, MOB)]);
  const strictlyDown = curve.every((p, i) => i === 0 || p[1] < curve[i - 1][1]);
  ok('damage from a Lv 10 mob falls as the player levels',
     strictlyDown, curve.map(p => `Lv${p[0]}:${p[1]}`).join('  '));

  const lo = hit(10, MOB), hi = hit(100, MOB);
  ok('a Lv 100 player takes far less from a Lv 10 mob than a Lv 10 player does',
     hi < lo * 0.25, `${lo} -> ${hi} (${(hi / lo).toFixed(3)}x)`);

  // -- 2. AT-OR-ABOVE LEVEL IS UNTOUCHED -----------------------------------
  // Baseline was 1.3x at gap 0 and this deliberately preserves it, so an
  // even fight is numerically identical to before the change.
  ok('a same-level monster still hits for the 1.3x baseline', hit(40, 40) === 1300, `${hit(40, 40)} (expect 1300)`);
  ok('an OVER-level monster still hits for the 1.3x baseline', hit(20, 60) === 1300, `${hit(20, 60)} (expect 1300)`);

  // -- 3. BOUNDED ----------------------------------------------------------
  ok('a huge level gap never reaches zero damage', hit(999, 1) > 0, `${hit(999, 1)}`);
  ok('the floor holds at an extreme gap', hit(999, 1) >= Math.round(1000 * 0.15), `${hit(999, 1)} >= 150`);
  // monotonic across the whole span, not just the sampled points
  let mono = true, prev = Infinity;
  for (let lv = 10; lv <= 200; lv += 5) { const v = hit(lv, MOB); if (v > prev) mono = false; prev = v; }
  ok('the curve is monotonic across Lv 10-200', mono);

  // -- 4. SCOPE: the no-attacker-level path is NOT re-tuned ----------------
  // Those call sites fall back to mapData.levelReq, which a map-authoring
  // sweep forces to 1, so it cannot be trusted to mean "low level zone".
  player.level = 100;
  const noSrc = _diffDmg(1000);
  const withSrc = _diffDmg(1000, 10);
  ok('the untrustworthy-level fallback path still uses the old curve',
     noSrc > withSrc * 3, `no-srcLv ${noSrc} vs srcLv ${withSrc}`);

  // -- 5. difficulty multiplier still applies ------------------------------
  game._diffDmgMul = 2;
  const dbl = hit(100, MOB);
  game._diffDmgMul = 1;
  const single = hit(100, MOB);
  ok('the difficulty multiplier still scales the result', Math.abs(dbl - single * 2) <= 1,
     `x1 ${single} vs x2 ${dbl}`);

  // -- 6. DEF deepens the falloff, and halves its floor --------------------
  // getDef() reads baseDef + mods.def + equipment and is scaled by War Cry /
  // Guardian, so zero the buffs or the "no DEF" control is not one.
  player.buffs = player.buffs || {};
  player.buffs.warCry = 0; player.buffs.guardian = 0; player.buffs.holyShield = 0;
  const setDef = (d) => { player.baseDef = 0; player.mods.def = d; };
  const atDef = (d, playerLv, mobLv) => { setDef(d); return hit(playerLv, mobLv); };

  // The absorb curve caps at 90% around 4500 DEF; 20000 is comfortably there.
  const TANK = 20000;
  ok('DEF reaches the absorb cap at the tank test value',
     (setDef(TANK), Math.abs(_defAbsorbMul() - 0.10) < 0.02), `absorbMul ${(setDef(TANK), _defAbsorbMul().toFixed(3))}`);

  // An even fight must be untouched by DEF here, or DEF would be double-dipping
  // on content that is supposed to stay dangerous.
  ok('a same-level monster is unaffected by DEF in this term',
     atDef(0, 40, 40) === 1300 && atDef(TANK, 40, 40) === 1300,
     `noDef ${atDef(0, 40, 40)}, tank ${atDef(TANK, 40, 40)}`);
  ok('an over-level monster is unaffected by DEF in this term',
     atDef(TANK, 20, 60) === 1300, `${atDef(TANK, 20, 60)}`);

  // Out-levelled monsters: a tank takes meaningfully less than a glass build.
  const glass90 = atDef(0, 100, 10), tank90 = atDef(TANK, 100, 10);
  ok('a tank takes about half a glass build\'s damage from an out-levelled mob',
     tank90 < glass90 * 0.6 && tank90 > 0, `glass ${glass90} -> tank ${tank90} (${(tank90 / glass90).toFixed(3)}x)`);

  // The floor itself: 15% with no DEF, 7.5% at the cap. Reached with an
  // extreme gap so the floor is what binds rather than the curve.
  const flGlass = atDef(0, 999, 1), flTank = atDef(TANK, 999, 1);
  ok('the floor is 15% of the hit with no DEF', flGlass === 150, `${flGlass} (expect 150)`);
  ok('the floor halves to 7.5% at the DEF cap', flTank === 75, `${flTank} (expect 75)`);

  // Monotonic in DEF — no rung where investing more DEF hurts.
  let defMono = true, prevD = Infinity;
  for (const d of [0, 100, 250, 500, 1000, 2000, 4500, 9000, 20000]) {
    const v = atDef(d, 100, 10); if (v > prevD) defMono = false; prevD = v;
  }
  ok('damage falls monotonically as DEF rises', defMono);
  setDef(0); player.level = 100;

  return res;
});

let pass = 0, failed = 0;
for (const r of R) { if (r.pass) { pass++; console.log(`  PASS  ${r.n}` + (r.extra ? `  (${r.extra})` : '')); }
  else { failed++; console.log(`  FAIL  ${r.n}  ${r.extra}`); } }
console.log(`${pass} passed, ${failed} failed`);
console.log('pageerrors:', errs.length, errs.slice(0, 5));
await browser.close(); server.kill();
process.exit(failed || errs.length ? 1 : 0);
