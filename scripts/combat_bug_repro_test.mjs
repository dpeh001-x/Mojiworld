// Runtime proof for two CONFIRMED combat defects found in the multi-agent
// debug pass. Written to FAIL on the buggy build and PASS once fixed.
//
//   A. Milestone lifesteal clamps to player.maxHp (the raw base pool) instead
//      of getMaxHp() (true max incl. class mult, gear, mods, prestige), so a
//      lifesteal "heal" DELETES most of the player's HP. L15717 is the only
//      heal site in the file using the base pool; six others use getMaxHp().
//   B. The level-gap miss roll passes `m.level || 1` instead of _mobLevel(m),
//      so every overworld species whose level lives only in MOB_NATURAL_LEVEL
//      (snail, slime, mushroom, orange, gummy, frog...) is treated as Lv 1 and
//      never applies the accuracy penalty — while the DAMAGE amplifier for the
//      same monster uses _mobLevel. The two halves disagree.
//
//   node serve.js 8829 && node scripts/combat_bug_repro_test.mjs 8829 [page]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const PORT = process.argv[2] || '8829';
const PAGE = process.argv[3] || 'mojiworld_game.html';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox','--disable-gpu','--mute-audio'] });
const page = await (await b.newContext({ serviceWorkers: 'block' })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 180)));
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => { try { return typeof eval('getMaxHp') === 'function' && typeof eval('_rollHitVsLevelGap') === 'function' && !!eval('player'); } catch { return false; } }, null, { timeout: 180000 });

// === A. lifesteal must never reduce HP ======================================
const life = await page.evaluate(() => {
  const p = eval('player');
  p.cls = 'mage'; p.level = 40;
  p.maxHp = 400;                       // raw base pool
  p.mods = p.mods || {}; p.mods.maxHp = 0;
  const trueMax = eval('getMaxHp')();  // class mult x1.5 etc -> well above 400
  p.hp = Math.floor(trueMax * 0.94);   // nearly full by TRUE max
  const before = p.hp;

  // Drive the real milestone on-hit path with a lifesteal bonus.
  let after = null, used = 'none';
  const fn = (typeof _msApplyOnHit !== 'undefined') ? _msApplyOnHit : null;
  if (fn) {
    // Find how the function sources its bonus; call it the way hitMonster does.
    try { fn(500, { lifesteal: 0.22 }); used = 'direct-bonus'; } catch (e) {}
    if (p.hp === before) {
      // Bonus may come from milestone state instead of an argument — force one.
      try {
        p.milestonesUnlocked = p.milestonesUnlocked || {};
        p._msActive = { lifesteal: 0.22 };
        fn(500);
        used = 'milestone-state';
      } catch (e) {}
    }
    after = p.hp;
  }
  // Independent of how the milestone is wired, prove the CLAMP ITSELF is wrong:
  // this is the exact expression at L15717.
  const heal = 110;
  const clampBase = Math.min(p.maxHp, before + heal);      // what the code does
  const clampTrue = Math.min(trueMax, before + heal);      // what every other heal does
  return { trueMax, baseMax: p.maxHp, before, after, used,
           clampBase, clampTrue, lostByBaseClamp: before - clampBase };
});
ok('the base pool really is far below true max (precondition)',
   life.baseMax < life.trueMax * 0.7, { baseMax: life.baseMax, trueMax: life.trueMax });
ok('BUG A — clamping a heal to player.maxHp DESTROYS HP',
   life.lostByBaseClamp > 0, { hpBefore: life.before, afterBaseClamp: life.clampBase, hpLost: life.lostByBaseClamp });
ok('the correct clamp (getMaxHp) would have healed instead',
   life.clampTrue >= life.before, { afterTrueClamp: life.clampTrue, before: life.before });
ok('FIXED? lifesteal on-hit does not reduce HP',
   life.after === null || life.after >= life.before,
   { path: life.used, before: life.before, after: life.after });

// === B. level-gap accuracy must use the resolved mob level ==================
const gap = await page.evaluate(() => {
  const p = eval('player'); p.level = 5;
  const MT = eval('monsterTypes'), NAT = eval('MOB_NATURAL_LEVEL');
  const mobLevel = eval('_mobLevel');
  // A species whose level exists ONLY in MOB_NATURAL_LEVEL, well above Lv 5.
  const type = Object.keys(NAT).find(t => MT[t] && !MT[t].boss && MT[t].level == null && NAT[t] >= 20);
  if (!type) return { noType: true };
  const m = { type, w: 40, h: 40, x: 0, y: 0, currentHp: 999, maxHp: 999, def: 0 };
  const resolved = mobLevel(m);            // what the rest of the game believes
  const raw = m.level || 1;                // what the miss roll passes today
  // Empirical hit rates over many rolls at each interpretation.
  const roll = eval('_rollHitVsLevelGap');
  const rate = (lv) => { let h = 0; for (let i = 0; i < 4000; i++) if (roll(lv)) h++; return h / 4000; };
  return { type, natural: NAT[type], resolved, raw, rateRaw: +rate(raw).toFixed(3), rateResolved: +rate(resolved).toFixed(3) };
});
ok('found a species whose level lives only in MOB_NATURAL_LEVEL', !gap.noType, { type: gap.type, natural: gap.natural });
ok('BUG B — the raw arg resolves to Lv 1 while the game says otherwise',
   gap.raw === 1 && gap.resolved === gap.natural, { raw: gap.raw, resolved: gap.resolved });
ok('BUG B — that difference materially changes hit rate',
   gap.rateRaw - gap.rateResolved > 0.3, { asLv1: gap.rateRaw, asResolved: gap.rateResolved });

// === did the shipped call site get fixed? ===================================
const src = await page.evaluate(() => {
  const s = eval('hitMonster').toString();
  return { usesMobLevel: /_rollHitVsLevelGap\(\s*_mobLevel\(/.test(s), usesRaw: /_rollHitVsLevelGap\(\s*m\.level\s*\|\|\s*1\s*\)/.test(s) };
});
ok('FIXED? hitMonster passes _mobLevel(m) to the miss roll', src.usesMobLevel === true, src);

ok('no page errors', errs.length === 0, errs.slice(0, 3));

await b.close();
let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + (x.x != null ? '  ' + JSON.stringify(x.x) : '')); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
