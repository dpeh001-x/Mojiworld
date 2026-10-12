// RELEASE 12e (bug hunt round 12) stays fixed:
//   1 a sale the purse (1e12 ceiling) cannot take whole is refused - Brok's desk, the Wisp's market and the quick-sell (which
//     refuses before it asks); nothing leaves the bag for less than its quoted price; with room the sale pays the quote
//   2 Select all / Commons only / the tier picker never tick a price-less item (Zodiac Sigil, recipe scroll); the summary and
//     the quick-sell confirm count only what sells; a click on a sigil row does not select it
//   3 L opens the Compendium ON TOP of nothing: an open Quest Journal / World Map / MojiDex book / Keys panel closes first;
//     L again closes the Compendium; the U panel's Compendium button still opens it
//   4 the desktop Touch controls choice survives a reload; turning it on saves Force Desktop off (store + switch); turning Force
//     Desktop on clears the choice; a phone with real touch is unchanged
//   node scripts/release12e_test.mjs        MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 11985), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
const URL = `http://localhost:${PORT}/${FILE}?dev=1`;
const boot = async (page) => {
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof loadMap === 'function' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
  await page.evaluate(async () => {
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    player._tutorialSeen = true; window._prologueAfterCreation = false;
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    if (!player.cls) applyClass('warrior'); player.level = Math.max(player.level || 1, 60); player._gravitosCineSeen = true; player.invulnerable = 1e12; player._god = true;
    player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true;
    window.__toasts = []; const st = window.showToast; window.showToast = function (m) { window.__toasts.push(String(m)); return st.apply(this, arguments); };
    window.__gear = (n) => { const out = []; for (let i = 0; i < n; i++) { const cat = ['weapons', 'armors', 'accessories'][i % 3], want = 2 + (i % 4), pool = ITEM_POOL[cat].filter((x) => typeof x.price === 'number' && isFinite(x.price)); const base = pool.find((x) => (x.tier | 0) === want) || pool[i % pool.length]; out.push({ ...base, slot: _catToSlot(cat), rarity: i % 2 ? 'rare' : 'common', stars: 0 }); } return out; };
    window.__sigil = () => ({ name: 'Aries Sigil', icon: '*', type: 'etc', zodiacSigil: 'aries', rarity: 'epic', desc: 'Zodiac Sigil (aries).' });
    window.__scroll = () => ({ name: 'Recipe Scroll', icon: '*', type: 'etc', rarity: 'common', desc: 'A recipe.' });
    window.__vis = (id) => { const e = document.getElementById(id); return !!e && e.style.display !== 'none' && getComputedStyle(e).display !== 'none' && e.getClientRects().length > 0; };
    window.__bag = (items) => { closeAllModals(); player.equipped = {}; player.inventory = items; game._sellSelection = new Set(); game._sellPayout = 1; game.expedition = game.expedition || {}; game.expedition.active = false; window.__toasts.length = 0; };
    loadMap('forest', 300); await new Promise((r) => setTimeout(r, 1200)); game.paused = false;
  });
};
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await boot(page);
  // ---- 1. the purse ceiling
  let r = await page.evaluate(async () => {
    const out = {};
    for (const payout of [1, 0.9]) {
      __bag(__gear(3)); openShop('sell', payout < 1 ? { payout } : undefined);
      document.getElementById('sell-all').click();
      const q = [...game._sellSelection].reduce((t, i) => t + _sellPriceOf(player.inventory[i]), 0);
      player.mojicoins = 1e12 - Math.floor(q / 2);
      const c0 = player.mojicoins; document.getElementById('sell-confirm-btn').click(); await new Promise((r) => setTimeout(r, 300));
      out[payout] = { q, left: player.inventory.length, paid: player.mojicoins - c0, toast: __toasts.some((t) => /purse is full/i.test(t)) };
    }
    return out;
  });
  ok('1. at the coin ceiling Brok\'s desk refuses the sale (nothing leaves the bag, "purse is full")', r[1].q > 0 && r[1].left === 3 && r[1].paid === 0 && r[1].toast, r[1]);
  ok('1. ...and so does the Wisp\'s market desk', r[0.9].q > 0 && r[0.9].left === 3 && r[0.9].paid === 0 && r[0.9].toast, r[0.9]);
  r = await page.evaluate(async () => {
    __bag(__gear(3)); openShop('sell');
    const q = player.inventory.reduce((t, it) => t + _sellPriceOf(it), 0); player.mojicoins = 1e12 - Math.floor(q / 2);
    const c0 = player.mojicoins; sellByTierNow(9); await new Promise((r) => setTimeout(r, 300));
    const asked = __vis('confirm-modal');
    if (asked) { document.getElementById('confirm-yes').click(); await new Promise((r) => setTimeout(r, 300)); }
    return { q, asked, left: player.inventory.length, paid: player.mojicoins - c0, toast: __toasts.some((t) => /purse is full/i.test(t)) };
  });
  ok('1. the quick-sell refuses before it asks and takes nothing', !r.asked && r.left === 3 && r.paid === 0 && r.toast, r);
  r = await page.evaluate(async () => {
    __bag(__gear(3)); openShop('sell'); document.getElementById('sell-all').click();
    const q = [...game._sellSelection].reduce((t, i) => t + _sellPriceOf(player.inventory[i]), 0);
    player.mojicoins = 1e12 - q; const c0 = player.mojicoins; document.getElementById('sell-confirm-btn').click(); await new Promise((r) => setTimeout(r, 300));
    return { q, left: player.inventory.length, paid: player.mojicoins - c0, wallet: player.mojicoins };
  });
  ok('1. with exactly enough room the sale goes through and pays the quote (wallet lands on the ceiling)', r.left === 0 && r.paid === r.q && r.wallet === 1e12, r);
  // ---- 2. price-less items are never ticked
  r = await page.evaluate(async () => {
    __bag([...__gear(2), __sigil(), __scroll()]); player.mojicoins = 1000; openShop('sell');
    document.getElementById('sell-all').click();
    const all = { size: game._sellSelection.size, sum: document.getElementById('sell-summary').textContent, sigilSel: document.querySelectorAll('#shop-list .sell-row')[2].classList.contains('selected') };
    document.getElementById('sell-clear').click(); document.getElementById('sell-common').click();
    const common = [...game._sellSelection].map((i) => player.inventory[i].name);
    document.getElementById('sell-clear').click();
    const tier = selectSellByTier(9); openShop('sell'); const tierSize = game._sellSelection.size;
    document.getElementById('sell-clear').click();
    document.querySelectorAll('#shop-list .sell-row')[2].click();
    const click = { size: game._sellSelection.size, sel: document.querySelectorAll('#shop-list .sell-row')[2].classList.contains('selected') };
    sellByTierNow(9); await new Promise((r) => setTimeout(r, 300));
    const body = (document.getElementById('confirm-body') || {}).textContent || '';
    if (__vis('confirm-modal')) { document.getElementById('confirm-no').click(); await new Promise((r) => setTimeout(r, 300)); }
    return { all, common, gearCommon: player.inventory.filter((it) => (it.rarity || 'common') === 'common' && typeof it.price === 'number').map((it) => it.name), tier, tierSize, click, body, left: player.inventory.length };
  });
  ok('2. Select all ticks only the 2 sellable pieces ("2 items"), the sigil row is not highlighted', r.all.size === 2 && /^2 items/.test(r.all.sum) && !r.all.sigilSel, r.all);
  ok('2. Commons only leaves the common recipe scroll out', r.common.length === r.gearCommon.length && !r.common.includes('Recipe Scroll'), r);
  ok('2. the tier picker selects 2 (not the sigil or the scroll)', r.tier === 2 && r.tierSize === 2, r);
  ok('2. a click on the sigil row does not select it', r.click.size === 0 && !r.click.sel, r.click);
  ok('2. the quick-sell confirm counts 2 items', /Sell 2 unequipped items/.test(r.body) && r.left === 4, r.body);
  // ---- 3. L on top of an open panel
  const L = {};
  for (const [name, open, id] of [['quest', 'toggleQuestJournal', 'quest-modal'], ['map', 'toggleWorldMap', 'worldmap-modal'], ['book', 'toggleLoreMap', 'lore-modal'], ['keys', 'toggleKeybindModal', 'keybind-modal']]) {
    await page.evaluate((open) => { closeAllModals(); game.paused = false; window[open](); }, open); await page.waitForTimeout(500);
    const before = await page.evaluate((id) => __vis(id), id);
    await page.keyboard.press('l'); await page.waitForTimeout(500);
    L[name] = await page.evaluate((id) => {
      const m = document.querySelector('#mojidex-modal .modal') || document.getElementById('mojidex-modal'), b = m.getBoundingClientRect();
      const top = document.elementFromPoint(b.left + b.width / 2, b.top + Math.min(b.height / 2, 120));
      return { dex: __vis('mojidex-modal'), other: __vis(id), onTop: !!top && !!top.closest('#mojidex-modal'), paused: game.paused };
    }, id);
    L[name].before = before;
    await page.keyboard.press('l'); await page.waitForTimeout(400);
    L[name].after = await page.evaluate(() => __vis('mojidex-modal'));
  }
  ok('3. L over the Quest Journal / World Map / MojiDex book / Keys panel closes it and shows the Compendium on top', Object.values(L).every((v) => v.before && v.dex && !v.other && v.onTop && v.paused), L);
  ok('3. L again closes the Compendium', Object.values(L).every((v) => !v.after), L);
  await page.evaluate(() => { closeAllModals(); game.paused = false; }); await page.keyboard.press('u'); await page.waitForTimeout(600);
  r = await page.evaluate(async () => { const u = __vis('attributes-modal'); const b = document.querySelector('#u-jump-row .u-jump[data-ujump="mojidex"]'); if (b) b.click(); await new Promise((r) => setTimeout(r, 400)); const o = { u, btn: !!b, dex: __vis('mojidex-modal'), uAfter: __vis('attributes-modal') }; closeAllModals(); return o; });
  ok('3. the U panel\'s Compendium button still opens it (and the U panel closes)', r.u && r.btn && r.dex && !r.uAfter, r);
  await ctx.close();
  // ---- 4. the touch-controls choice
  const tctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  const tp = await tctx.newPage(); tp.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await boot(tp);
  const body = () => tp.evaluate(() => ({ fmc: document.body.classList.contains('force-mobile-ctrl'), fd: document.body.classList.contains('force-desktop'), fdesk: !!_lxGetSettings().fdesk, sw: document.getElementById('set-fdesk').classList.contains('on'), deck: __vis('mobile-deck') }));
  await tp.evaluate(() => { document.getElementById('set-fdesk').classList.add('on'); applySettingsLive(); });
  const t0 = await body();
  await tp.evaluate(() => _lxToggleMobileMode()); await tp.waitForTimeout(400);
  const t1 = await body();
  await tp.evaluate(() => applySettingsLive()); await tp.waitForTimeout(300);
  const t1b = await body();
  ok('4. turning touch on saves Force Desktop off and clears the switch; a later settings apply keeps the deck', t0.fd && t0.fdesk && t1.fmc && !t1.fd && !t1.fdesk && !t1.sw && t1b.fmc && !t1b.fd, { t0, t1, t1b });
  await boot(tp); await tp.waitForTimeout(1500);
  const t2 = await body();
  ok('4. after a reload the touch controls are still on (deck shown, no force-desktop)', t2.fmc && !t2.fd && t2.deck && !t2.fdesk, t2);
  await tp.evaluate(() => { document.getElementById('set-fdesk').classList.add('on'); applySettingsLive(); }); await tp.waitForTimeout(300);
  const t3 = await body(); const key3 = await tp.evaluate(() => localStorage.getItem('mojiworld_touch_on'));
  await boot(tp); await tp.waitForTimeout(1500);
  const t4 = await body();
  ok('4. turning Force Desktop on clears the touch choice, and it stays cleared after a reload', !t3.fmc && t3.fd && key3 === null && !t4.fmc && t4.fd, { t3, key3, t4 });
  await tctx.close();
  const pctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36' });
  await pctx.addInitScript(() => { try { localStorage.setItem('mojiworld_touch_on', '1'); } catch (e) {} });
  const pp = await pctx.newPage(); pp.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await boot(pp); await pp.waitForTimeout(1500);
  const ph = await pp.evaluate(() => ({ fmc: document.body.classList.contains('force-mobile-ctrl'), fd: document.body.classList.contains('force-desktop'), css: !!document.getElementById('force-mobile-css'), deck: __vis('mobile-deck') }));
  ok('4. a phone with real touch is unchanged (no forced desktop touch mode, its own deck shows)', !ph.fmc && !ph.fd && !ph.css && ph.deck, ph);
  await pctx.close();
  ok('no page errors', errs.length === 0, errs);
} catch (e) { fail++; console.log('FAIL harness: ' + (e && e.stack || e)); }
finally { await browser.close(); server.kill(); }
console.log(`\n${fail ? 'FAIL' : 'PASS'}(${fail}) - ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
