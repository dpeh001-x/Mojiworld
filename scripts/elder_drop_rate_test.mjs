// Elders roll for their bonus piece instead of always dropping one, per user:
// "Elders should not guarantee drop, it should only have a droprate of 1%".
//
// The old code called rollItemDrop(1, ...) with no chance gate, and that
// function has no `return null` path, so an Elder kill ALWAYS produced a piece.
// That is the one claim here worth measuring behaviourally rather than reading:
// "always" versus "1%" separates with overwhelming confidence after a few dozen
// kills, so this drives real killMonster() calls and counts what hits the floor.
// Run: node scripts/elder_drop_rate_test.mjs [file.html]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const URL = 'file:///' + path.join(ROOT, args[0] || 'mojiworld_game.html').split(path.sep).join('/');
const browser = await chromium.launch({ channel: 'chrome', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
let bad = 0;
const check = (ok, label, detail) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail !== undefined ? '  — ' + JSON.stringify(detail) : ''}`); if (!ok) bad++; };

const KILLS = 150;

await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof killMonster === 'function' && typeof loadMap === 'function', { timeout: 90000 });
const r = await page.evaluate((KILLS) => {
  const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
  window._lxBootGateDone = true;
  const c = document.querySelector('#class-select-modal .cls-card');
  if (c && !player.cls) { try { c.click(); } catch (e) {} }
  const g = document.getElementById('class-select-modal'); if (g) g.style.display = 'none';
  player.level = 60;
  loadMap('magmaFoundry2');   // a real Elder-bearing map (11 Smithgolems)
  const out = {};
  out.rateConst = (typeof LX_ELDER_DROP_RATE === 'number') ? LX_ELDER_DROP_RATE : null;

  // Kill N Elders through the real handler and count the items that land.
  const run = (flag) => {
    let items = 0;
    for (let i = 0; i < KILLS; i++) {
      game.drops = [];
      let m = null;
      try { m = spawnMonster(600, 300, 'smithgolem'); } catch (e) {}
      if (!m) return null;
      m.isMiniBoss = (flag === 'elder');
      m.isElite = (flag === 'elite');
      m.isBoss = false;
      m.currentHp = 0;
      try { killMonster(m); } catch (e) {}
      items += (game.drops || []).filter((d) => d && d.type === 'item').length;
      game.monsters = [];
    }
    return items;
  };
  out.elderItems = run('elder');
  out.normalItems = run('normal');
  out.kills = KILLS;
  return out;
}, KILLS);
await browser.close();

const pct = (n) => n == null ? null : +(100 * n / KILLS).toFixed(1);
console.log(`  ${KILLS} Elder kills -> ${r.elderItems} items (${pct(r.elderItems)}% per kill)`);
console.log(`  ${KILLS} normal kills -> ${r.normalItems} items (${pct(r.normalItems)}% per kill)`);
console.log(`  LX_ELDER_DROP_RATE = ${r.rateConst}`);

check(r.elderItems != null, 'the Elder kill path ran', r.elderItems);
check(r.rateConst === 0.01, 'the Elder bonus rate is 1%', r.rateConst);
// The load-bearing one. At the old behaviour this is KILLS (150/150).
check(r.elderItems < KILLS * 0.15,
      'an Elder kill no longer guarantees a piece (was 100% of kills)',
      { items: r.elderItems, of: KILLS });
// ...but the tier is not dead either: at 1% + the 0.30% main roll, 150 kills
// should still land in single digits rather than exactly zero every run.
check(r.elderItems <= KILLS * 0.08, 'and lands near the 1% it was set to', pct(r.elderItems));
check(r.normalItems < KILLS * 0.05, 'normal kills stay the rare trickle they were', r.normalItems);
check(errs.length === 0, 'no page errors', [...new Set(errs)].slice(0, 3));
console.log(bad ? `\n${bad} FAILED` : '\nall green');
process.exit(bad ? 1 : 0);
