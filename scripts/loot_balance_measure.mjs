// Measure the real loot economy by calling the SHIPPED roll functions, not by
// reading the weight tables. Reports, per source:
//   • how often a kill/chest yields equipment at all
//   • the rarity split of what it yields
// Run: node scripts/loot_balance_measure.mjs [file.html] [trials]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const URL = 'file:///' + path.join(ROOT, process.argv[2] || 'mojiworld_game.html').split(path.sep).join('/');
const N = Number(process.argv[3] || 200000);
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage();
await p.goto(URL + '?dev=1', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => typeof rollItemDrop === 'function' && typeof ITEM_POOL !== 'undefined', { timeout: 60000 });
await p.evaluate(() => {
  const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
  window._lxBootGateDone = true;
  const c = document.querySelector('#class-select-modal .cls-card');
  if (c && !player.cls) { try { c.click(); } catch (e) {} }
  const g = document.getElementById('class-select-modal'); if (g) g.style.display = 'none';
  game.paused = true;
});

const r = await p.evaluate((N) => {
  const out = { dropRates: {}, rarity: {}, chest: {} };

  // ---- 1. drop CHANCE per kill, straight from the shipped expression -------
  // Mirrored rather than invoked because the roll lives inside killMonster;
  // the constants are read from the live source so this cannot drift silently.
  const src = [...document.querySelectorAll('script')].map((s) => s.textContent).join('\n');
  const m = src.match(/const dropChance = \(tier === 2 \? ([\d.]+) : tier === 1 \? ([\d.]+) : ([\d.]+)\) \* \(1 \+ luck\) \* ([\d.]+)/);
  out.dropExpr = m ? { boss: +m[1], elite: +m[2], normal: +m[3], global: +m[4] } : null;
  if (m) {
    out.dropRates = {
      normalPct: +(m[3] * m[4] * 100).toFixed(3),
      elitePct: +(m[2] * m[4] * 100).toFixed(3),
      bossPct: +(m[1] * m[4] * 100).toFixed(3),
    };
  }

  // ---- 2. rarity split of what a drop actually is --------------------------
  const tally = (tier, lvl, n) => {
    const c = { common: 0, rare: 0, epic: 0, legendary: 0, none: 0 };
    for (let i = 0; i < n; i++) {
      const it = rollItemDrop(tier, lvl);
      if (!it) { c.none++; continue; }
      c[it.rarity] = (c[it.rarity] || 0) + 1;
    }
    const tot = n - c.none || 1;
    return {
      pct: {
        common: +(100 * c.common / tot).toFixed(1),
        rare: +(100 * c.rare / tot).toFixed(1),
        epic: +(100 * c.epic / tot).toFixed(1),
        legendary: +(100 * c.legendary / tot).toFixed(1),
      },
      betterThanCommonPct: +(100 * (c.rare + c.epic + c.legendary) / tot).toFixed(1),
    };
  };
  const per = Math.max(2000, Math.floor(N / 6));
  out.rarity = {
    'normal Lv10': tally(0, 10, per),
    'normal Lv25': tally(0, 25, per),
    'normal Lv40': tally(0, 40, per),
    'normal Lv60': tally(0, 60, per),
    'elite Lv40': tally(1, 40, per),
    'boss Lv60': tally(2, 60, per),
  };

  // ---- 3. chests: do they always give gear, and of what rarity? ------------
  const cm = src.match(/const rewards = \{[\s\S]{0,900}?\n  \};/);
  out.chestTableFound = !!cm;
  const gearChance = src.match(/_chestGearChance\s*=\s*\{[^}]*\}/);
  out.chestGearChance = gearChance ? gearChance[0].replace(/\s+/g, ' ') : 'none — every chest gives gear';
  const rar = {};
  for (const t of ['wood', 'silver', 'gold']) {
    const rx = new RegExp(t + ":\\s*\\{[^}]*rarity:\\s*\\[([^\\]]*)\\]");
    const mm = cm && cm[0].match(rx);
    if (!mm) continue;
    const arr = mm[1].split(',').map((s) => s.trim().replace(/['"]/g, ''));
    const c = {};
    for (const x of arr) c[x] = (c[x] || 0) + 1;
    rar[t] = { n: arr.length, split: Object.fromEntries(Object.entries(c).map(([k, v]) => [k, +(100 * v / arr.length).toFixed(0) + '%'])) };
  }
  out.chest = rar;
  return out;
}, N);
await b.close();

console.log('DROP CHANCE PER KILL (pre-luck)');
console.log('  normal', r.dropRates.normalPct + '%', ' elite', r.dropRates.elitePct + '%', ' boss', r.dropRates.bossPct + '%');
console.log('  expression constants:', JSON.stringify(r.dropExpr));
console.log('\nRARITY OF A DROP (% of items that drop)');
for (const [k, v] of Object.entries(r.rarity)) {
  console.log('  ' + k.padEnd(13), JSON.stringify(v.pct).padEnd(56), 'better-than-common ' + v.betterThanCommonPct + '%');
}
console.log('\nCHESTS');
console.log('  gear chance:', r.chestGearChance);
for (const [k, v] of Object.entries(r.chest)) console.log('  ' + k.padEnd(8), JSON.stringify(v.split));
