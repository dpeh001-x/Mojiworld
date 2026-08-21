// Brok sells only gear for your class, and the T5 forge costs 50,000 coins.
// Per user: "Brok should sell equipments only relating to the class of the
// player T2-T4 / T5 forge should require 50000 mojicoin."
//
// Assertions read the RENDERED shop rows (openShop drives the real stock
// function) - not a recomputation from the catalog, which would be true on
// any build and prove nothing.
// Run: node scripts/brok_class_shop_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 9234;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra) });

const out = await page.evaluate(async () => {
  const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade');
  for (const id of ['class-select-modal', 'advancement-modal', 'tutorial-modal'])
    { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  game.paused = false;

  // Every catalog item name, tagged, so the rendered rack can be classified.
  const GEN = [], BY_CLS = { warrior: [], rogue: [], mage: [], archer: [] };
  for (const cat of ['weapons', 'armors', 'accessories']) {
    for (const it of ITEM_POOL[cat]) {
      if (it.setId) continue;
      if (!it.cls || it.cls === 'any') { if ((it.tier | 0) >= 2) GEN.push(it.name); }
      else if (BY_CLS[it.cls]) BY_CLS[it.cls].push(it.name);
    }
  }
  const rackText = () => {
    const m = document.getElementById('shop-modal');
    return m ? (m.textContent || '').replace(/\s+/g, ' ') : '';
  };
  const r = { racks: {}, GENcount: GEN.length };
  for (const cls of ['warrior', 'rogue', 'mage', 'archer']) {
    for (const lv of [10, 90]) {
      player.cls = cls; player.level = lv; player.mojicoins = 9e9;
      try { openShop('weapon'); } catch (e) { r.err = String(e).slice(0, 140); }
      await new Promise(x => setTimeout(x, 220));
      const txt = rackText();
      const genericShown = GEN.filter(n => txt.includes(n));
      const foreignShown = Object.keys(BY_CLS).filter(c => c !== cls)
        .flatMap(c => BY_CLS[c]).filter(n => txt.includes(n));
      const mineShown = BY_CLS[cls].filter(n => txt.includes(n));
      r.racks[cls + '@' + lv] = { generic: genericShown, foreign: foreignShown, mine: mineShown.length };
    }
  }
  try { closeAllModals(); } catch (e) {}
  const forge = {
    shards: (typeof CRAFT_COST_SHARDS !== 'undefined') ? CRAFT_COST_SHARDS : null,
    coins: (typeof CRAFT_COST_MOJICOINS !== 'undefined') ? CRAFT_COST_MOJICOINS : null,
  };
  const cm = document.getElementById('craft-modal');
  forge.blurb = cm ? (cm.textContent || '').replace(/\s+/g, ' ').slice(0, 300) : null;
  return { ...r, forge };
});

ok('the shop rendered for every class', !out.err, out.err || '');
const anyGeneric = Object.entries(out.racks).filter(([, v]) => v.generic.length);
ok('no class-agnostic gear appears on any rack',
   anyGeneric.length === 0,
   anyGeneric.length ? anyGeneric.map(([k, v]) => `${k}: ${v.generic.join('/')}`).join('  ') : `checked ${out.GENcount} generic items against 8 racks`);
const anyForeign = Object.entries(out.racks).filter(([, v]) => v.foreign.length);
ok('no other class\'s gear appears on any rack', anyForeign.length === 0,
   anyForeign.length ? anyForeign.map(([k, v]) => `${k}: ${v.foreign.slice(0, 3).join('/')}`).join('  ') : '');
const thin = Object.entries(out.racks).filter(([, v]) => v.mine < 6);
ok('every class still gets a full rack of its own gear', thin.length === 0,
   thin.length ? thin.map(([k, v]) => `${k}: only ${v.mine}`).join('  ') : 'lowest rack: ' + Math.min(...Object.values(out.racks).map(v => v.mine)) + ' items');
const lv90 = out.racks['warrior@90'], lv10 = out.racks['warrior@10'];
ok('a Lv 90 rack is richer than a Lv 10 rack (endgame gates intact)',
   lv90 && lv10 && lv90.mine > lv10.mine, `Lv10 ${lv10 && lv10.mine} vs Lv90 ${lv90 && lv90.mine}`);

ok('the T5 forge costs 50,000 mojicoins', out.forge.coins === 50000, `CRAFT_COST_MOJICOINS = ${out.forge.coins}`);
ok('the shard cost is unchanged at 200', out.forge.shards === 200, `CRAFT_COST_SHARDS = ${out.forge.shards}`);
ok('the forge blurb quotes the real cost, not a stale one',
   !!(out.forge.blurb && out.forge.blurb.includes('50,000') && !out.forge.blurb.includes('3,000')),
   out.forge.blurb ? out.forge.blurb.slice(0, 170) : 'no blurb');

let pass = 0, failed = 0;
for (const r of res) { if (r.pass) { pass++; console.log(`  PASS  ${r.n}` + (r.extra ? `  (${r.extra})` : '')); }
  else { failed++; console.log(`  FAIL  ${r.n}  ${r.extra}`); } }
console.log(`${pass} passed, ${failed} failed`);
await browser.close(); server.kill();
process.exit(failed ? 1 : 0);
