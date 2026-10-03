// GUARD for the gear-power baseline behind the damage anchor (v0.29.483).
// =============================================================================
// _refHpAtLv models an at-level GEARED character through _GEAR_ALLOWANCE_TABLE.
//   1. NEUTRALITY - mob touch / heavy bands must not move with that table. The
//      live _dmgBandPct still divides the allowance back out (its v0.29.483
//      neutrality factor; the band re-solve that was to delete it never
//      shipped), so _refHpAtLv x band equals the flat-1.5 anchor x band. Boss
//      ranged bands DO read the table, through _refBarAtLv.
//   2. DRIFT - the shop gear ladder, measured live with gen_gear_allowance.mjs's
//      own measureGearLadder, must match scripts/gear_allowance.json: the HP
//      allowance, the geared DEF, and the damage-taken multiplier the live
//      _defAbsorbMul gives that DEF at that level. A gear, tier-ladder or
//      absorb-curve retune trips it; if the retune is meant, re-run
//      node scripts/gen_gear_allowance.mjs and commit the json with it.
//   3. INFO, never fails (per user, 2026-10-03) - how far the game's baked
//      _GEAR_ALLOWANCE_TABLE sits from the live ladder. Baked on v0.29.483 and
//      stale since at least v0.30.430; re-baking it moves boss ranged damage,
//      so it is a balance call, not this test's.
// History: 65fd3b2a (2026-08-12) swept unshipped work into this file - a
// "neutrality factor is gone" check and a DEF check against _defKAtLv /
// _DEF_K_TABLE, neither of which was ever in the game - so from then on it
// threw before its first check. The absorb K now comes from _defAbsorbMul.
// Run: node scripts/gear_allowance_test.mjs   (alone, not beside other browser tests)
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootGame, measureGearLadder } from './gen_gear_allowance.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DRIFT_TOLERANCE = 0.12;   // 12% - trips on a real gear retune, not on noise
const BASE = JSON.parse(readFileSync(path.join(ROOT, 'scripts', 'gear_allowance.json'), 'utf8'));

const { page, errs, close } = await bootGame(9022);
let LIVE, R;
try {
  LIVE = await page.evaluate(measureGearLadder);
  R = await page.evaluate((rows) => {
    const res = [];
    const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra) });
    ok('_refGearAllowance exists', typeof _refGearAllowance === 'function');
    ok('_GEAR_ALLOWANCE_TABLE shares the band grid',
       _GEAR_ALLOWANCE_TABLE.length === _DMG_BAND_TABLE.length &&
       _GEAR_ALLOWANCE_TABLE.every((r, i) => r[0] === _DMG_BAND_TABLE[i][0]),
       _GEAR_ALLOWANCE_TABLE.map(r => r[0]).join(','));
    ok('_refLoAtLv still uses the flat constant (boss caps untouched)',
       _refLoAtLv(50) === Math.round((63 + 15.7 * 50) * _REF_GEAR_ALLOWANCE), _refLoAtLv(50));

    // -- 1. NEUTRALITY: the allowance cancels out of every mob touch / heavy band --
    const bandAt = (lv) => {
      const T = _DMG_BAND_TABLE, L = Math.max(1, Math.min(100, lv | 0));
      for (let i = 0; i < T.length - 1; i++) {
        const a = T[i], b = T[i + 1];
        if (L >= a[0] && L <= b[0]) return a[1] + (b[1] - a[1]) * ((L - a[0]) / (b[0] - a[0]));
      }
      return T[T.length - 1][1];
    };
    let worst = 0, worstAt = '';
    for (const cls of ['warrior', 'archer', 'rogue', 'mage']) {
      player.cls = cls;
      for (let lv = 1; lv <= 110; lv++) {
        const flat = Math.round((104 + 23.6 * lv) * _REF_GEAR_ALLOWANCE * _classHpRef()) * bandAt(lv) * _BAND_TOUCH_RATIO;
        const live = _refHpAtLv(lv) * _dmgBandPct(lv).tFloor;
        const d = Math.abs(live - flat);
        if (d > worst) { worst = d; worstAt = `${cls} Lv${lv}: ${flat.toFixed(2)} vs ${live.toFixed(2)}`; }
      }
    }
    // only the two Math.round calls can differ, and they move the product by under 1 HP
    ok('mob touch/heavy bands ignore _GEAR_ALLOWANCE_TABLE (anchor x band = flat-1.5 anchor x band, 4 classes x Lv 1-110, < 1 HP)',
       worst < 1, `max ${worst.toFixed(3)} HP  ${worstAt}`);
    {
      player.cls = 'mage';
      let mono = true, worstStep = '', prev = 0;
      for (let lv = 1; lv <= 100; lv++) {
        const prod = _refHpAtLv(lv) * _dmgBandPct(lv).tFloor;
        if (prod < prev * 0.999) { mono = false; worstStep = `Lv${lv}: ${prev.toFixed(1)} -> ${prod.toFixed(1)}`; break; }
        prev = prod;
      }
      ok('raw touch anchor is monotonic in level', mono, worstStep || `Lv100 anchor ${prev.toFixed(1)}`);
    }
    // inputs for the INFO lines: the game's own table, and its anchor against the measured mage bar
    player.cls = 'mage';
    const mage = rows.filter(r => [20, 50, 80].includes(r.lv)).map(r => ({ lv: r.lv, x: r.per.mage.hp / _refHpAtLv(r.lv) }));
    return { res, table: _GEAR_ALLOWANCE_TABLE.map(r => r.slice()), mage };
  }, LIVE.rows);
} finally { await close(); }

const res = R.res, info = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra) });

// -- 2. DRIFT: the live ladder against the committed baseline --------------------
const grid = (rows) => rows.map(r => r.lv).join(',');
ok('gear_allowance.json covers the band grid', grid(BASE.rows) === grid(LIVE.rows),
   `json ${grid(BASE.rows)} vs live ${grid(LIVE.rows)}`);
const drift = (key, label) => {
  let max = 0, at = '';
  for (const b of BASE.rows) {
    const l = LIVE.rows.find(r => r.lv === b.lv);
    // a row or key missing on either side is drift too (a NaN compare would pass silently)
    const d = (l && Number.isFinite(l[key]) && Number.isFinite(b[key]))
      ? Math.abs(l[key] - b[key]) / Math.max(1e-6, Math.abs(b[key])) : Infinity;
    if (d >= max) { max = d; at = `Lv ${b.lv}: json ${b[key]} vs live ${l ? l[key] : 'missing'}`; }
  }
  ok(`${label} matches gear_allowance.json (<${DRIFT_TOLERANCE * 100}%)`, max < DRIFT_TOLERANCE,
     `max drift ${(max * 100).toFixed(1)}%  ${at}`);
};
drift('allowance', 'geared HP allowance');
drift('defMean', 'geared DEF');
drift('absorbMul', 'damage-taken multiplier through the live _defAbsorbMul');

// -- 3. INFO: the game's baked table against the live ladder (never fails) -------
const pct = (v) => `${v >= 0 ? '+' : ''}${Math.round(v * 100)}%`;
info.push('_GEAR_ALLOWANCE_TABLE (baked v0.29.483), live ladder vs baked: ' +
  R.table.map(([lv, baked]) => {
    const l = LIVE.rows.find(r => r.lv === lv);
    return `Lv${lv} ${l ? pct(l.allowance / baked - 1) : '?'}`;
  }).join(' ') + ' - boss ranged bands read it (_refBarAtLv); a re-bake is a balance call');
info.push('anchor vs a measured geared mage bar: ' + R.mage.map(m => `Lv${m.lv} ${m.x.toFixed(2)}x`).join(' ') +
  ' (v0.29.483 aimed for 0.75-1.35x)');
info.push('live absorb K from _defAbsorbMul: ' + LIVE.rows.map(r => `Lv${r.lv} ${r.absorbK}`).join(' ') +
  `; a geared at-level character takes x${LIVE.rows[0].absorbMul.toFixed(2)} (Lv ${LIVE.rows[0].lv})` +
  ` .. x${LIVE.rows[LIVE.rows.length - 1].absorbMul.toFixed(2)} (Lv ${LIVE.rows[LIVE.rows.length - 1].lv})`);

let pass = 0, fail = 0;
for (const r of res) {
  if (r.pass) { pass++; console.log(`  PASS  ${r.n}${r.extra ? '  (' + r.extra + ')' : ''}`); }
  else { fail++; console.log(`  FAIL  ${r.n}  ${r.extra}`); }
}
for (const s of info) console.log(`  INFO  ${s}`);
if (res.some(r => !r.pass && r.n.includes('gear_allowance.json'))) {
  console.log(`\n  The live gear ladder moved since gear_allowance.json was measured (${BASE.ver || 'an unversioned build'}).` +
              '\n  If that retune is meant: node scripts/gen_gear_allowance.mjs, then commit scripts/gear_allowance.json with it.');
}
console.log(`\n${pass} passed, ${fail} failed  (live ${LIVE.ver}, baseline ${BASE.ver || 'unversioned'})`);
console.log('pageerrors:', errs.length, errs.slice(0, 4));
process.exit(fail || errs.length ? 1 : 0);
