// MOJIMON AUDIT — exercises the v0.29.434-445 companion system in the live
// game and reports defects. Read-only: it restores everything it touches.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
await page.goto('file:///' + path.join(ROOT, 'mojiworld_game.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof _mojimonEnsure === 'function', { timeout: 60000 });

const out = await page.evaluate(() => {
  const F = [];
  const bug = (sev, area, what, detail) => F.push({ sev, area, what, detail });
  const okAreas = [];
  const savedLevel = player.level, savedMon = JSON.parse(JSON.stringify(player.mojimon || {}));

  const reset = () => { player.mojimon = { roster: {}, cdUntil: 0, out: null }; };

  // ---- 1. upgrade entitlement -------------------------------------------
  reset();
  player.level = 50;                                   // 10 points
  _mojimonEnsure().roster.slime = { upg: { hp: 0, atk: 0, def: 0 }, at: Date.now() };
  const rec = player.mojimon.roster.slime;
  for (let i = 0; i < 30; i++) _mojimonUi.upg('slime', 'hp', 1);   // spam past the cap
  if (_mojimonSpent(rec) > _mojimonPoints()) bug('HIGH', 'upgrades', 'can overspend by clicking', `spent ${_mojimonSpent(rec)} > ${_mojimonPoints()} points`);
  else okAreas.push(`click-spam capped at ${_mojimonSpent(rec)}/${_mojimonPoints()}`);

  // delta > 1 in one call — the guard tests BEFORE adding
  rec.upg = { hp: 0, atk: 0, def: 0 };
  _mojimonUi.upg('slime', 'hp', 999);
  if (_mojimonSpent(rec) > _mojimonPoints()) bug('MED', 'upgrades', 'a single large delta overspends', `one call with delta=999 -> spent ${_mojimonSpent(rec)} of ${_mojimonPoints()}`);

  // arbitrary stat key
  rec.upg = { hp: 0, atk: 0, def: 0 };
  _mojimonUi.upg('slime', 'evasion', 1);
  if (rec.upg.evasion) bug('LOW', 'upgrades', 'accepts an unknown stat key', 'upg.evasion written; not read by _mojimonStatsFor but persists to save');

  // ---- 2. prestige interaction ------------------------------------------
  reset();
  player.level = 80;
  _mojimonEnsure().roster.slime = { upg: { hp: 10, atk: 6, def: 0 }, at: Date.now() };
  const before = _mojimonStatsFor('slime');
  player.level = 1;                                    // what offerPrestige() does
  const after = _mojimonStatsFor('slime');
  const r2 = player.mojimon.roster.slime;
  if (_mojimonSpent(r2) > _mojimonPoints()) {
    bug('HIGH', 'prestige', 'upgrades survive a prestige reset',
        `spent ${_mojimonSpent(r2)} vs entitlement ${_mojimonPoints()}; mon keeps +${(10 * 8)}% HP / +${6 * 5}% ATK it is no longer entitled to`);
    // and the respec trap
    _mojimonUi.upg('slime', 'hp', -1);
    const afterDec = r2.upg.hp | 0;
    _mojimonUi.upg('slime', 'hp', 1);
    if ((r2.upg.hp | 0) === afterDec) bug('HIGH', 'prestige', 'respec becomes one-way after prestige',
        'removing a point works but re-adding is blocked, so the documented "free respec" permanently destroys allocation');
  }

  // ---- 2b. prestige REGRESSION GUARD (v0.29.446) -------------------------
  // Full cycle: allocate at high level, prestige, re-level, re-allocate.
  reset();
  player.level = 80;
  _mojimonEnsure().roster.slime = { upg: { hp: 10, atk: 6, def: 0 }, at: Date.now() };
  player.level = 1;                                   // prestige
  _mojimonEnsure();                                   // the clamp runs here
  const rp = player.mojimon.roster.slime;
  if (_mojimonSpent(rp) !== 0) bug('HIGH', 'prestige', 'clamp did not trim to entitlement', `spent ${_mojimonSpent(rp)} at level 1`);
  else okAreas.push('prestige trims allocation to the new entitlement (0 at Lv1)');
  if (!player.mojimon.roster.slime) bug('HIGH', 'prestige', 'prestige destroyed the captured species', 'a 10,000-kill capture must survive');
  else okAreas.push('capture itself survives prestige (only the points reset)');
  player.level = 25;                                  // re-level: 5 points
  _mojimonEnsure();
  _mojimonUi.upg('slime', 'hp', 1);
  if ((rp.upg.hp | 0) !== 1) bug('HIGH', 'prestige', 'cannot re-allocate after prestige', 'the one-way respec trap is back');
  else okAreas.push('re-allocation works again after re-levelling');
  // evenness: trimming should not zero one stat while another survives intact
  reset(); player.level = 80;
  _mojimonEnsure().roster.slime = { upg: { hp: 12, atk: 4, def: 0 }, at: Date.now() };
  player.level = 25; _mojimonEnsure();                // 16 -> 5
  const ev = player.mojimon.roster.slime.upg;
  if ((ev.atk | 0) === 0 && (ev.hp | 0) > 0) bug('LOW', 'prestige', 'trim is lopsided', `hp ${ev.hp} atk ${ev.atk} — one stat wiped`);
  else okAreas.push(`trim degrades evenly (hp ${ev.hp}, atk ${ev.atk}, total ${_mojimonSpent(player.mojimon.roster.slime)}/5)`);

  // ---- 3. save persistence ----------------------------------------------
  reset();
  player.level = 50;
  player.mojimon.roster.slime = { upg: { hp: 3, atk: 0, def: 0 }, at: Date.now() };
  let saved = null;
  try {
    // saveState() is DEBOUNCED and _flushSaveStateNow() is gated on the
    // prologue flags + the class-select modal, which is open on a fresh boot.
    // Reading localStorage straight after saveState() therefore shows an empty
    // save and looks exactly like "mojimon is not persisted" — it was a false
    // HIGH the first time this ran. Clear the gates and flush synchronously.
    window._prologueActive = false; window._prologuePending = false;
    try { const cs = document.getElementById('class-select-modal'); if (cs) cs.style.display = 'none'; } catch (_) {}
    if (typeof _flushSaveStateNow === 'function') _flushSaveStateNow();
    else if (typeof saveState === 'function') saveState();
    const raw = localStorage.getItem(typeof SAVE_KEY !== 'undefined' ? SAVE_KEY : 'levelx_save_v1') || '';
    saved = /"mojimon"/.test(raw);
  } catch (e) { saved = 'err:' + e.message; }
  if (saved === false) bug('HIGH', 'save', 'mojimon roster is NOT written to the save', 'captures + upgrades lost on reload');
  else if (saved === true) okAreas.push('roster persists to save');

  // ---- 4. summon lifecycle ----------------------------------------------
  reset();
  player.level = 50;
  player.mojimon.roster.slime = { upg: { hp: 0, atk: 0, def: 0 }, at: Date.now() };
  player.mojimon.cdUntil = 0;
  let summonErr = null;
  try { _mojimonSummon('slime', {}); } catch (e) { summonErr = e.message; }
  if (summonErr) bug('HIGH', 'summon', 'summon throws', summonErr);
  const fielded = (game.minions || []).filter((m) => m && m.mojimon);
  if (!summonErr && fielded.length === 0) bug('HIGH', 'summon', 'summon produced no minion', 'game.minions has no mojimon entry');
  else if (fielded.length > 1) bug('MED', 'summon', 'summon produced duplicates', `${fielded.length} fielded`);
  else if (!summonErr) okAreas.push('summon fields exactly one companion');

  // double-summon while one is out
  if (!summonErr) {
    try { _mojimonSummon('slime', {}); } catch (e) {}
    const n2 = (game.minions || []).filter((m) => m && m.mojimon).length;
    if (n2 > 1) bug('MED', 'summon', 'can field two at once', `${n2} companions after a second summon with one already out`);
    else okAreas.push('second summon does not stack');
  }

  // ---- 5. stat sanity ----------------------------------------------------
  reset();
  player.level = 50;
  player.mojimon.roster.slime = { upg: { hp: 0, atk: 0, def: 0 }, at: Date.now() };
  const base = _mojimonStatsFor('slime');
  const hpMult = base.maxHp / Math.max(1, (typeof getMaxHp === 'function' ? getMaxHp() : 100));
  if (hpMult >= 9.5) okAreas.push(`companion HP is ${hpMult.toFixed(1)}x the player's (by design: it tanks)`);
  player.mojimon.roster.slime.upg = { hp: 0, atk: 0, def: 999 };
  const capped = _mojimonStatsFor('slime');
  if (capped.defRed > 0.6001) bug('HIGH', 'stats', 'DR cap breached', `defRed ${capped.defRed}`);
  else okAreas.push(`DR clamps at ${capped.defRed} even with absurd points`);

  // ---- 6. capture guards -------------------------------------------------
  reset();
  let capErr = null;
  try { _mojimonCapture(null); _mojimonCapture({}); _mojimonCapture({ type: '' }); } catch (e) { capErr = e.message; }
  if (capErr) bug('MED', 'capture', 'capture throws on a malformed monster', capErr);
  else okAreas.push('capture guards null / typeless input');

  player.level = savedLevel; player.mojimon = savedMon;
  return { F, okAreas };
});
await browser.close();

const order = { HIGH: 0, MED: 1, LOW: 2 };
out.F.sort((a, b) => order[a.sev] - order[b.sev]);
console.log('=== MOJIMON AUDIT ===\n');
if (!out.F.length) console.log('No defects found.\n');
for (const f of out.F) console.log(`[${f.sev}] ${f.area}: ${f.what}\n        ${f.detail}\n`);
console.log('--- verified working ---');
for (const a of out.okAreas) console.log('  ok  ' + a);
console.log(errs.length ? '\npage errors: ' + errs.slice(0, 3).join(' | ') : '\nno page errors');
console.log(`\n${out.F.length} finding(s)`);
