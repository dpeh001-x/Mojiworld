// Stray-mob detector (BUG11). The two things that matter, in order:
//   1. it stays SILENT on a normal map — a detector that cries wolf gets
//      ignored, and every legitimate off-table mob (allies, summons, boss
//      adds, co-op mirrors) must be treated as legitimate;
//   2. it FIRES on a real stray, with enough context to identify the source.
// Run: node scripts/stray_mob_detector_test.mjs [file.html]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const URL = 'file:///' + path.join(ROOT, process.argv[2] || 'mojiworld_game.html').split(path.sep).join('/');
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const warns = [];
page.on('console', (m) => { if (m.text().includes('[stray mob]')) warns.push(m.text()); });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
let bad = 0;
const check = (ok, label, detail) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail !== undefined ? '  — ' + JSON.stringify(detail) : ''}`); if (!ok) bad++; };

await page.goto(URL + '?dev=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof _lxMobStrayCheck === 'function' && typeof loadMap === 'function', { timeout: 60000 });
await page.evaluate(() => {
  const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
  window._lxBootGateDone = true;
  const c = document.querySelector('#class-select-modal .cls-card');
  if (c && !player.cls) { try { c.click(); } catch (e) {} }
  const g = document.getElementById('class-select-modal'); if (g) g.style.display = 'none';
  game.paused = false; player.level = 18; player._god = true;
  try { loadMap('blockland_dunes'); } catch (_e) {}
});
await page.waitForTimeout(9000);

// ---- 1. quiet on a normal map --------------------------------------------
const clean = await page.evaluate(() => ({
  map: game.currentMap,
  mobs: (game.monsters || []).filter((m) => m && !m.dead).length,
  strays: (game._mobStrays || []).length,
}));
console.log(`clean map: ${clean.map}, ${clean.mobs} mobs alive`);
check(clean.mobs > 3, 'the map actually populated (otherwise silence proves nothing)', clean);
check(clean.strays === 0, 'no stray reported on a normal map', clean);
check(warns.length === 0, 'and nothing logged', warns);

// ---- 2. legitimate off-table mobs must NOT be reported --------------------
const legit = await page.evaluate(async () => {
  const mk = (flags) => {
    const m = { type: 'mushroom', level: 9, x: 500, y: 400, dead: false, ...flags };
    game.monsters.push(m);
    return m;
  };
  const made = [mk({ ally: true }), mk({ isSummon: true }), mk({ _coopMirror: true }), mk({ boss: true }), mk({ _summonedBy: 'blockEle' })];
  game._mobStrays = []; _LX_STRAY.seen = Object.create(null); _LX_STRAY.at = 0;
  _lxMobStrayCheck();
  const n = (game._mobStrays || []).length;
  for (const m of made) game.monsters.splice(game.monsters.indexOf(m), 1);
  return { reported: n };
});
check(legit.reported === 0, 'allies / summons / mirrors / bosses / adds are not flagged', legit);

// ---- 3. a real stray IS reported, with usable context ---------------------
const stray = await page.evaluate(() => {
  const m = { type: 'mushroom', level: 9, x: 1090, y: 650, dead: false, aggro: true };
  game.monsters.push(m);
  game._mobStrays = []; _LX_STRAY.seen = Object.create(null); _LX_STRAY.at = 0;
  _lxMobStrayCheck();
  const rec = (game._mobStrays || [])[0] || null;
  game.monsters.splice(game.monsters.indexOf(m), 1);
  return rec;
});
console.log(`reported: ${JSON.stringify(stray)}`);
check(!!stray, 'an unexplained off-table mob IS reported', stray);
if (stray) {
  check(stray.type === 'mushroom' && stray.level === 9, 'it names the type and level', stray);
  check(stray.map === 'blockland_dunes', 'and the map', stray.map);
  check(Array.isArray(stray.declared) && stray.declared.includes('blockEle'), 'and what the map DID declare', stray.declared);
  check(Object.prototype.hasOwnProperty.call(stray, 'netConnected'), 'and whether co-op was live (the leading suspect)', stray);
}
check(warns.length >= 1, 'it logs to the console for a tester to copy', warns.slice(0, 2));

// ---- 4. it does not spam ---------------------------------------------------
const spam = await page.evaluate(() => {
  const m = { type: 'mushroom', level: 9, x: 500, y: 400, dead: false };
  game.monsters.push(m);
  _LX_STRAY.at = 0; _lxMobStrayCheck();
  _LX_STRAY.at = 0; _lxMobStrayCheck();
  _LX_STRAY.at = 0; _lxMobStrayCheck();
  const n = (game._mobStrays || []).length;
  game.monsters.splice(game.monsters.indexOf(m), 1);
  return n;
});
check(spam === 1, 'the same map+type is reported once, not every tick', spam);

check(errs.length === 0, 'no page errors', errs);
console.log(bad ? `\n${bad} FAILED` : '\nall green');
await browser.close();
process.exit(bad ? 1 : 0);
