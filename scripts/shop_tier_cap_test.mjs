// THE RACKS STOP AT TIER 6 (v0.30.966).
//
// Per user: players should not be able to buy T7 / T8 / T9 gear. The gear shop listed each class's
// T6-T10 endgame ladder behind level gates (50 / 60 / 70 / 80 / 90), so a Lv 90 hero could buy a T10
// for 9.5M. Endgame gear is earned - drops, or the bench up to T8 - never bought. One constant,
// SHOP_GEAR_TIER_MAX = 6, truncates the stock filter, and the buy handler refuses above it too.
//
// Checked at Lv 90 across all four classes, because the stock is per class: every listed tier must
// be <= 6, T6 must still be there (the cap must not eat the last legitimate tier), and a T8 row must
// not exist to click. Sell-back of a dropped T9 is untouched: the price ladder keeps its rows.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/shop_tier_cap_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11354';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const PAGE = path.resolve(SERVE_ROOT, cand || 'mojiworld_game.html');
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env, MOJI_GAME_FILE: PAGE } });
await new Promise((r) => setTimeout(r, 1800));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 760 } });
await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
const page = await ctx.newPage(); const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof openShop === 'function', null, { timeout: 180000 });
  const r = await page.evaluate(async () => {
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    applyClass('warrior'); loadMap('everdawn_megamall', 300); await new Promise((x) => setTimeout(x, 1800)); game.paused = false;
    const out = { byClass: {}, sellBack: null };
    for (const cls of ['warrior', 'rogue', 'mage', 'archer']) {
      player.cls = cls; player.level = 90; player.mojicoins = 999999999;
      try { closeAllModals(); } catch (e) {}
      openShop('weapon'); await new Promise((x) => setTimeout(x, 400));
      // read the tier tag each row prints, e.g. "(T7)" or "T8 ×3.50"
      const rows = [...document.querySelectorAll('#shop-list .shop-row, #shop-list > div, #shop-list button')];
      const txt = rows.map((e) => e.textContent || '').join('\n');
      const tiers = [...new Set([...txt.matchAll(/\bT(\d{1,2})\b/g)].map((m) => +m[1]))].sort((a, b) => a - b);
      out.byClass[cls] = { tiers, rows: rows.length, hasT8Buy: /T8/.test(txt) && /Buy/.test(txt) };
    }
    // a dropped T9 still has a resale value: the ladder keeps its rows even though the racks do not sell them
    const t9 = [].concat(ITEM_POOL.weapons || []).find((x) => x && x.tier === 9 && !x.setId);
    out.sellBack = t9 && typeof _lxGearMarketPrice === 'function' ? Math.round(_lxGearMarketPrice(t9) * 0.1) : null;
    out.cap = (typeof SHOP_GEAR_TIER_MAX !== 'undefined') ? SHOP_GEAR_TIER_MAX : null;
    try { closeAllModals(); } catch (e) {}
    return out;
  });
  const over = Object.entries(r.byClass).filter(([, v]) => v.tiers.some((t) => t > 6)).map(([c, v]) => c + ' ' + J(v.tiers.filter((t) => t > 6)));
  check(over.length === 0, 'at Lv 90 no class is offered anything above tier 6', over.length ? J(over) : J(Object.fromEntries(Object.entries(r.byClass).map(([c, v]) => [c, v.tiers]))));
  const noT6 = Object.entries(r.byClass).filter(([, v]) => !v.tiers.includes(6)).map(([c]) => c);
  check(noT6.length === 0, 'and tier 6 - the last tier on the racks - is still there for every class', noT6.length ? J(noT6) : 'all four');
  check(Object.values(r.byClass).every((v) => !v.hasT8Buy), 'there is no T8 row with a Buy button to click');
  check(r.cap === 6, 'the cap is one constant, SHOP_GEAR_TIER_MAX = 6', J(r.cap));
  check(r.sellBack > 0, 'a dropped T9 still sells back for something (the price ladder keeps its rows)', J(r.sellBack));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 2)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 200)); }
await ctx.close(); await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
