// SEND TO MARKET (per user: "Build Send to market now"). The Postal Wisp opens the sell desk from anywhere (P, or her in town), paying
// LX_MARKET_PAYOUT (90%) of what Brok's desk pays - a courier's 10% cut. Brok's resale rule (GEAR_SELLBACK_PCT 10% of market price) is
// untouched, and his desk must never inherit the cut. The tower is out of reach, like the daily parcel and held parcels.
//   node scripts/postal_market_test.mjs      (PORT / MOJI_SERVE_ROOT / MOJI_GAME_FILE override the served build)
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 13881), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT }); await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] }); const page = await browser.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
let pass = 0, fail = 0; const ok = (n, c, note) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : '   ' + JSON.stringify(note))); };
try {
  await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof loadMap === 'function' && typeof _lxSellPayout === 'function', null, { timeout: 180000 }); await page.waitForTimeout(4000);
  await page.evaluate(async () => {
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player.level = 60; player.cls = player.cls || 'warrior'; player.invulnerable = 9e9; player._gravitosCineSeen = true; player._tutorialSeen = true;
    player._storyBeatsSeen = new Proxy({}, { get: () => true, set: () => true });
    loadMap('forest', 300); await new Promise((r) => setTimeout(r, 1500)); game.paused = false;
    setInterval(() => { game.monsters.length = 0; game.paused = false; }, 150);
    window.__toasts = []; const st = window.showToast; window.showToast = function (m) { window.__toasts.push(String(m)); return st.apply(this, arguments); };
    window.__wait = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < (ms || 4000)) { if (fn()) return true; await new Promise((r) => setTimeout(r, 80)); } return !!fn(); };
    window.__typed = () => __wait(() => !document.getElementById('dialog').classList.contains('typing'), 25000);
    window.__gear = (n) => { const out = []; for (let i = 0; i < n; i++) { const cat = ['weapons', 'armors', 'accessories'][i % 3], want = 2 + (i % 4), pool = ITEM_POOL[cat].filter((x) => typeof x.price === 'number' && isFinite(x.price)); const base = pool.find((x, j) => (x.tier | 0) === want && j >= i) || pool.find((x) => (x.tier | 0) === want) || pool[i % pool.length]; out.push({ ...base, slot: _catToSlot(cat), rarity: i % 2 ? 'rare' : 'common', stars: 0 }); } return out; };
    window.__shopOpen = () => document.getElementById('shop-modal').style.display === 'flex';
    window.__rows = () => [...document.querySelectorAll('#shop-list .sell-row .sell-value')].map((e) => parseInt(e.textContent, 10));
    window.__close = () => { document.getElementById('shop-modal').style.display = 'none'; };
  });
  const setBag = (n) => page.evaluate((n) => { game.expedition = game.expedition || {}; game.expedition.active = false; __close(); player.equipped = player.equipped || {}; player.inventory = __gear(n); game._sellSelection = new Set(); game._sellPayout = 1; window.__toasts.length = 0; return player.inventory.length; }, n);
  const pins = await page.evaluate(() => ({ pct: GEAR_SELLBACK_PCT, cut: LX_MARKET_PAYOUT, brokOnly: _lxSellPayout() }));
  ok('Brok\'s resale stays the user\'s 10% of market price and the Wisp\'s cut is 90% of that', pins.pct === 0.10 && pins.cut === 0.9 && pins.brokOnly === 1, pins);
  // 1. the menu
  await setBag(6);
  let r = await page.evaluate(async () => { openPostalWisp(); await new Promise((r) => setTimeout(r, 300)); await __typed(); const opt = [...document.querySelectorAll('#dialog-options button')].find((b) => /Send to market/.test(b.textContent));
    return { opt: opt ? opt.textContent.trim() : null, greet: /90% of what Brok pays/.test(document.getElementById('dialog-text').textContent) }; });
  ok('P opens the Wisp with "Send to market (90% of Brok\'s price)" and her greeting says so', !!r.opt && /90% of Brok's price/.test(r.opt) && r.greet, r);
  // 2. her desk prices every piece at exactly 90% of Brok's
  r = await page.evaluate(async () => { const exp = player.inventory.map((it) => Math.floor(_lxGearMarketPrice(it) * GEAR_SELLBACK_PCT * 0.9)), brok = player.inventory.map((it) => Math.floor(_lxGearMarketPrice(it) * GEAR_SELLBACK_PCT));
    [...document.querySelectorAll('#dialog-options button')].find((b) => /Send to market/.test(b.textContent)).click(); await __wait(() => __shopOpen()); await new Promise((r) => setTimeout(r, 200));
    return { open: __shopOpen(), title: document.getElementById('shop-title').textContent, rows: __rows(), exp, brok, dlg: document.getElementById('dialog').style.display }; });
  ok('the desk opens (the dialog closes) and is titled "Send to Market"', r.open && /Send to Market/.test(r.title) && r.dlg !== 'block', r);
  ok('every row is exactly floor(market x 10% x 90%) and none is above what Brok pays', r.rows.join() === r.exp.join() && r.rows.every((v, i) => v <= r.brok[i]) && r.rows.some((v, i) => v < r.brok[i]), r);
  // 3. a re-render keeps the cut; selling pays exactly what the summary says
  r = await page.evaluate(async () => { openShop('sell'); const kept = /Send to Market/.test(document.getElementById('shop-title').textContent);
    const rows = [...document.querySelectorAll('#shop-list .sell-row')]; rows[0].click(); rows[1].click(); const sel = [...game._sellSelection].map((i) => player.inventory[i]); const total = sel.reduce((t, it) => t + _sellPriceOf(it), 0);
    const sum = document.getElementById('sell-summary').textContent, c0 = player.mojicoins, n0 = player.inventory.length; document.getElementById('sell-confirm-btn').click(); await new Promise((r) => setTimeout(r, 400));
    return { kept, total, sum, paid: player.mojicoins - c0, gone: n0 - player.inventory.length, toast: __toasts.filter((t) => /The Wisp sold/.test(t)) }; });
  ok('opening the desk again while it is up keeps the courier\'s cut', r.kept, r);
  ok('selling 2 pays exactly the summary\'s total and the pieces leave the bag', r.gone === 2 && r.paid === r.total && r.total > 0 && new RegExp('2 items.*' + r.total).test(r.sum), r);
  ok('and the toast says the Wisp sold them', r.toast.length === 1 && new RegExp('sold 2 items for ' + r.total).test(r.toast[0]), r.toast);
  // 4. Brok's desk, opened afterwards, pays in full
  r = await page.evaluate(() => { __close(); openShop('sell'); const rows = __rows(), exp = player.inventory.map((it) => Math.floor(_lxGearMarketPrice(it) * GEAR_SELLBACK_PCT)); return { title: document.getElementById('shop-title').textContent, rows, exp, payout: _lxSellPayout() }; });
  ok('Brok\'s desk, opened after hers, pays in full (no inherited cut) under his own title', r.payout === 1 && r.rows.join() === r.exp.join() && /Blacksmith Forge/.test(r.title), r);
  // 5. equipped gear is left alone; the tier quick-select totals at her price
  r = await page.evaluate(async () => { __close(); player.inventory = __gear(6); const worn = player.inventory[0]; player.equipped = { weapon: worn }; game._sellSelection = new Set(); openShop('sell', { payout: LX_MARKET_PAYOUT });
    const n = selectSellByTier(9), sel = [...game._sellSelection].map((i) => player.inventory[i]); const total = sel.reduce((t, it) => t + _sellPriceOf(it), 0);
    return { n, hasWorn: sel.includes(worn), total, exp: sel.reduce((t, it) => t + Math.floor(_lxGearMarketPrice(it) * 0.1 * 0.9), 0), stillWorn: player.equipped.weapon === worn }; });
  ok('"sell by tier" leaves the worn piece out and totals at her price', r.n === 5 && !r.hasWorn && r.total === r.exp && r.stillWorn, r);
  // 6. the tower is out of reach
  r = await page.evaluate(async () => { __close(); player.inventory = __gear(3); game.expedition = game.expedition || {}; game.expedition.active = true; window.__toasts.length = 0; openPostalWisp(); await new Promise((r) => setTimeout(r, 300)); await __typed();
    [...document.querySelectorAll('#dialog-options button')].find((b) => /Send to market/.test(b.textContent)).click(); await new Promise((r) => setTimeout(r, 300)); const o = { open: __shopOpen(), said: __toasts.some((t) => /cannot reach the tower/.test(t)) }; game.expedition.active = false; return o; });
  ok('inside an expedition she refuses (the tower is out of reach) and no desk opens', !r.open && r.said, r);
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} catch (e) { fail++; console.log('FAIL harness: ' + (e && e.message)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
