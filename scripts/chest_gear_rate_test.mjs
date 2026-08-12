// Chests: how often does opening one actually hand you equipment?
//
// Measured by CALLING openChest, not by reading the table — the gear path runs
// through a rarity roll, a tier cap and an inventory-capacity branch, and only
// the real function exercises all three. Inventory growth is the signal.
// Run: node scripts/chest_gear_rate_test.mjs [file.html] [trialsPerTier]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const URL = 'file:///' + path.join(ROOT, process.argv[2] || 'mojiworld_game.html').split(path.sep).join('/');
const N = Number(process.argv[3] || 4000);
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
let bad = 0;
const check = (ok, label, detail) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail !== undefined ? '  — ' + JSON.stringify(detail) : ''}`); if (!ok) bad++; };

await page.goto(URL + '?dev=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof openChest === 'function' && typeof MAPS !== 'undefined', { timeout: 60000 });
await page.evaluate(() => {
  const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
  window._lxBootGateDone = true;
  const c = document.querySelector('#class-select-modal .cls-card');
  if (c && !player.cls) { try { c.click(); } catch (e) {} }
  const g = document.getElementById('class-select-modal'); if (g) g.style.display = 'none';
  game.paused = true;
  try { loadMap('town'); } catch (_e) {}
});
await page.waitForTimeout(6000);

const r = await page.evaluate((N) => {
  const out = {};
  const quiet = window.showToast; window.showToast = () => {};
  const quietAudio = (typeof audio !== 'undefined' && audio) ? audio.play : null;
  if (quietAudio) audio.play = () => {};
  for (const tier of ['wood', 'silver', 'gold']) {
    let gear = 0, rarities = {};
    for (let i = 0; i < N; i++) {
      player.inventory.length = 0;
      game.drops.length = 0;
      game.particles.length = 0;
      const before = player.inventory.length;
      try { openChest({ x: 400, y: 400, w: 24, h: 24, tier, opened: false }); } catch (_e) {}
      const got = player.inventory.length - before + game.drops.filter((d) => d && d.type === 'item').length;
      if (got > 0) {
        gear++;
        const it = player.inventory[0] || (game.drops.find((d) => d && d.type === 'item') || {}).item;
        if (it && it.rarity) rarities[it.rarity] = (rarities[it.rarity] || 0) + 1;
      }
    }
    out[tier] = {
      gearPct: +(100 * gear / N).toFixed(1),
      rarity: Object.fromEntries(Object.entries(rarities).map(([k, v]) => [k, +(100 * v / (gear || 1)).toFixed(1)])),
    };
  }
  window.showToast = quiet;
  if (quietAudio) audio.play = quietAudio;
  player.inventory.length = 0;
  return out;
}, N);
await browser.close();

for (const [t, v] of Object.entries(r)) {
  console.log(`  ${t.padEnd(7)} gear on ${String(v.gearPct).padStart(5)}% of opens   rarity ${JSON.stringify(v.rarity)}`);
}
// Targets set by the change: wood 60%, silver 75%, gold 100%. Bands are wide
// enough to absorb sampling noise but tight enough that a reverted constant
// (back to 100% everywhere) fails.
check(Math.abs(r.wood.gearPct - 60) <= 4, 'wood chests give gear ~60% of the time', r.wood.gearPct);
check(Math.abs(r.silver.gearPct - 75) <= 4, 'silver chests ~75%', r.silver.gearPct);
check(r.gold.gearPct >= 99, 'gold chests stay guaranteed', r.gold.gearPct);
check(r.wood.gearPct < 90 && r.silver.gearPct < 90, 'chests no longer ALWAYS give gear (the point of the change)', r);
check(errs.length === 0, 'no page errors', errs);
console.log(bad ? `\n${bad} FAILED` : '\nall green');
process.exit(bad ? 1 : 0);
