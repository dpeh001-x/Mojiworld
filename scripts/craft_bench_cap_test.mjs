// THE BLACKSMITH CRAFTING BENCH: ONE NAME, T5-T8, PRICES THAT MEAN SOMETHING (v0.30.961).
//
// Per user. (1) Brok, Furnax and Barnaby all open the same modal, and it was titled "Brok's" whoever you
// spoke to. (2) Crafting hands you the EXACT piece you want, and its coin price was ~10% of what the
// racks charge for a random one; at six figures of shards it was not a decision. The bench now goes to
// T8 (was T6), T9 and T10 are never forgeable, and the ladder is 8k/250k, 14k/500k, 25k/1M, 45k/2M.
//
// The T9/T10 half is checked two ways: the rendered list carries no such row, AND the craft action
// refuses a hand-built T9 entry - the old _craftCostFor fell back to the T5 price for any tier it did
// not know, which is exactly the hole a stray row would have slipped through.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/craft_bench_cap_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11352';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const PAGE = path.resolve(SERVE_ROOT, cand || 'mojiworld_game.html');
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env, MOJI_GAME_FILE: PAGE } });
await new Promise((r) => setTimeout(r, 1800));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const LADDER = { 5: [8000, 250000], 6: [14000, 500000], 7: [25000, 1000000], 8: [45000, 2000000] };
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 760 } });
await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
const page = await ctx.newPage(); const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof openCraftingModal === 'function', null, { timeout: 180000 });
  const r = await page.evaluate(async (LADDER) => {
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    applyClass('warrior'); player.level = 90; player.setshards = 10000000; player.mojicoins = 999999999;
    loadMap('everdawn_megamall', 300); await new Promise((x) => setTimeout(x, 1800)); game.paused = false;
    openCraftingModal(); await new Promise((x) => setTimeout(x, 500));
    const out = {};
    out.title = (document.querySelector('#craft-modal h2') || {}).textContent || '';
    out.header = (document.getElementById('craft-price-line') || {}).textContent || '';
    // what the bench lists, by tier
    const all = (typeof _allCraftables === 'function') ? _allCraftables() : [];
    out.tiers = [...new Set(all.map((e) => e.item.tier))].sort((a, b) => a - b);
    out.slots = [...new Set(all.map((e) => e.slot))].sort();
    out.count = all.length;
    // the price of each tier, as the row will charge it
    out.prices = {}; for (const t of out.tiers) { const e = all.find((x) => x.item.tier === t); const c = _craftCostFor(e.item); out.prices[t] = c ? [c.shards, c.coins] : null; }
    // what the rows actually print for a T8
    const rowTxt = [...document.querySelectorAll('#craft-list button, #craft-list .craft-row, #craft-list *')].map((e) => e.textContent || '').join(' ');
    out.rowMentionsT8 = /45,000|45000/.test(rowTxt) && /2,000,000|2000000/.test(rowTxt);
    // a forged T8 really costs the ladder
    const t8 = all.find((x) => x.item.tier === 8);
    const s0 = player.setshards, c0 = player.mojicoins, n0 = player.inventory.length;
    if (t8 && typeof _craftSetPiece === 'function') _craftSetPiece(t8);
    out.t8 = { shards: s0 - player.setshards, coins: c0 - player.mojicoins, gained: player.inventory.length - n0 };
    // and a T9 / T10 refuse even when handed to the action directly
    const pool = [].concat(ITEM_POOL.weapons || [], ITEM_POOL.armors || []);
    out.forced = {};
    for (const t of [9, 10]) {
      const it = pool.find((x) => x && x.tier === t);
      const s1 = player.setshards, c1 = player.mojicoins, n1 = player.inventory.length;
      if (it && typeof _craftSetPiece === 'function') { try { _craftSetPiece({ item: it, slot: 'weapon' }); } catch (e) {} }
      out.forced[t] = { found: !!it, cost: (typeof _craftCostFor === 'function') ? _craftCostFor(it) : 'n/a', spent: (s1 - player.setshards) + (c1 - player.mojicoins), gained: player.inventory.length - n1 };
    }
    try { closeAllModals(); } catch (e) {}
    return out;
  }, LADDER);
  check(/^🔧 Blacksmith Crafting Bench 🔧$/.test(r.title.trim()), 'the bench is titled for the trade, not one smith', J(r.title));
  check(J(r.tiers) === J([5, 6, 7, 8]), 'it lists tiers 5, 6, 7 and 8 - and nothing above', J(r.tiers));
  check(J(r.slots) === J(['armor', 'weapon']), 'weapons and armor only, still', J(r.slots));
  const wrong = Object.entries(LADDER).filter(([t, [sh, co]]) => !r.prices[t] || r.prices[t][0] !== sh || r.prices[t][1] !== co).map(([t]) => 'T' + t + ' ' + J(r.prices[t]));
  check(wrong.length === 0, 'the ladder is 8k/250k · 14k/500k · 25k/1M · 45k/2M', wrong.length ? J(wrong) : J(r.prices));
  check(r.t8.shards === 45000 && r.t8.coins === 2000000 && r.t8.gained === 1, 'forging a T8 charges exactly that and hands over one piece', J(r.t8));
  check(r.forced[9].found && r.forced[10].found, 'T9 and T10 gear exists to be refused', J({ t9: r.forced[9].found, t10: r.forced[10].found }));
  check(r.forced[9].cost === null && r.forced[10].cost === null, 'and has no craft price at all (no fallback to T5)', J({ t9: r.forced[9].cost, t10: r.forced[10].cost }));
  check(r.forced[9].spent === 0 && r.forced[9].gained === 0 && r.forced[10].spent === 0 && r.forced[10].gained === 0, 'a T9 / T10 handed straight to the craft action is refused, nothing spent, nothing made', J(r.forced));
  check(/tier 8/.test(r.header) && /8,000/.test(r.header) && /2,000,000/.test(r.header) && /9.10 cannot be forged/.test(r.header), 'the header quotes the live ladder, not a hard-coded 200 + 50,000', J(r.header).slice(0, 160));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 2)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 200)); }
await ctx.close(); await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
