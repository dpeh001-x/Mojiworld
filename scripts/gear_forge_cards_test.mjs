// THE BLACKSMITH FORGE AS A GRID OF CARDS (v0.30.997; v0.30.1001 - the comic plate back, 2px black outlines, the coaster at 20% white).
//
// Per user, after the stall: "do the same for the weapon shop, the items can be made into compact boxes
// with easy mouseover to click and buy". Reads the live forge:
//   - the gear tab marks the card .gear-forge and lays the rows out as a CSS grid of boxes (3+ columns
//     at 1280 wide), each an ink box with a 2px black line, a rarity strip and a 20%-white coaster with a black
//     ring, over the comic plate (panel_p5_shop) the shop always had
//   - a box's Buy is hidden at rest (affordable or not) and shows on hover; the price yields to it
//   - clicking the box itself buys: the piece lands in the inventory and the coins drop by its price
//   - a box you cannot afford does nothing on click and carries the "Need N more" tooltip
//   - the tier-multiplier asides are hidden from the stats line; the potion stall and the sell desk are
//     untouched
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/gear_forge_cards_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11366';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const PAGE = path.resolve(SERVE_ROOT, cand || 'mojiworld_game.html');
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const src = readFileSync(PAGE, 'utf8');
check(/classList\.toggle\('gear-forge', type === 'weapon'\)/.test(src) && src.includes('THE BLACKSMITH FORGE, A GRID OF CARDS'), 'static: the weapon tab marks .gear-forge and the block is in the sheet');
check(/d\.addEventListener\('click', \(e\) => \{ if \(btn\.disabled \|\| e\.target === btn \|\| btn\.contains\(e\.target\)\) return; btn\.click\(\); \}\);/.test(src), 'static: makeShopRow forwards a click on the card to its Buy');
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env, MOJI_GAME_FILE: PAGE } });
await new Promise((r) => setTimeout(r, 1800));
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
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { tutorial_intro: true, everdawn_welcome: true }); player._tutorialSeen = true;
    applyClass('warrior'); player.level = 60; player.talents = { warrior: 'x' }; player._tutorialSeen = true; player.mojicoins = 200000;   // the T2 pieces cost ~15k; T6 far more
    try { closeAllModals(); } catch (e) {}
    loadMap('town', 300); await new Promise((r) => setTimeout(r, 1500)); try { closeAllModals(); } catch (e) {} game.paused = false;
    document.documentElement.classList.remove('lx-nobackdrop');
    openShop('weapon'); await new Promise((r) => setTimeout(r, 500));
    try { await Promise.all([document.fonts.load('800 15px Nunito'), document.fonts.load('600 26px Fredoka')]); } catch (e) {}
    // the perf governor flips html.lx-nobackdrop on its own under load (it strips every box-shadow): clear it right
    // before reading and wait out the boxes' 140 ms shadow transition
    const modal = document.querySelector('#shop-modal .modal'), list = document.getElementById('shop-list');
    const cards = [...list.querySelectorAll('.shop-item')];
    // ...and it can re-flip inside any wait, so the read is SYNCHRONOUS: transitions off on the box, class off, reflow, read
    for (const c of cards) c.style.transition = 'none';
    document.documentElement.classList.remove('lx-nobackdrop'); void document.body.offsetWidth;
    const cols = new Set(cards.map((c) => Math.round(c.getBoundingClientRect().left))).size;
    const rowsY = new Set(cards.map((c) => Math.round(c.getBoundingClientRect().top))).size;
    const c0 = cards[0], cc = getComputedStyle(c0), coaster = getComputedStyle(c0.querySelector(':scope > div:first-child'));
    const btn0 = c0.querySelector('button'), cb0 = getComputedStyle(btn0);
    const asides = c0.querySelectorAll('.name > div:last-child span[style*="opacity:0.6"]');
    const asideHidden = [...asides].every((s) => getComputedStyle(s).display === 'none');
    // the cheapest card: make it affordable and the second unaffordable
    const prices = cards.map((c) => parseInt((c.querySelector('.price') || {}).textContent || '0', 10));
    return { forge: modal.classList.contains('gear-forge'), display: getComputedStyle(list).display, n: cards.length, cols, rowsY,
      card: { flexDir: cc.flexDirection, border: cc.borderTopWidth + ' ' + cc.borderTopColor, shadow: cc.boxShadow.slice(0, 80), font: cc.fontFamily.slice(0, 10), h: Math.round(c0.getBoundingClientRect().height), cursor: cc.cursor },
      coaster: { w: coaster.width, radius: coaster.borderTopLeftRadius, bg: coaster.backgroundColor, border: coaster.borderTopWidth + ' ' + coaster.borderTopColor },
      plate: getComputedStyle(modal).backgroundImage.includes('panel_p5_shop'),
      buyAtRest: { opacity: cb0.opacity, pos: cb0.position, pe: cb0.pointerEvents, bg: cb0.backgroundColor, disabled: btn0.disabled },
      asides: asides.length, asideHidden, prices: prices.slice(0, 3), coins: player.mojicoins };
  });
  check(r.forge && r.display === 'grid' && r.cols >= 3 && r.rowsY >= 2 && r.n >= 6, 'GRID: the gear tab is a grid of boxes, three or more across', J({ display: r.display, cols: r.cols, rows: r.rowsY, n: r.n }));
  check(r.card.flexDir === 'column' && r.card.border === '2px rgb(12, 11, 16)' && /rgb\(12, 11, 16\) 4px 4px 0px/.test(r.card.shadow) && /inset/.test(r.card.shadow) && /^Nunito/.test(r.card.font) && r.card.h <= 300, 'BOX: a column with a 2px black line, an ink offset and a rarity strip, in Nunito, compact (under 300 device px; the old row alone was ~160)', J(r.card));
  check(r.coaster.w === '56px' && r.coaster.radius === '50%' && r.coaster.bg === 'rgba(255, 255, 255, 0.2)' && r.coaster.border === '2px rgb(12, 11, 16)', 'BOX: the piece on a 56 px coaster at 20% white with a 2px black ring', J(r.coaster));
  check(r.plate, 'PLATE: the comic plate (panel_p5_shop) is the forge background, as before');
  check(r.buyAtRest.opacity === '0' && r.buyAtRest.pos === 'absolute' && r.buyAtRest.pe === 'none', 'BUY: hidden at rest, positioned over the price', J(r.buyAtRest));
  check(r.asides >= 1 && r.asideHidden, 'STATS: the tier-multiplier asides are hidden from the line', J({ asides: r.asides, hidden: r.asideHidden }));
  // hover the first affordable card: Buy shows, the price yields; then click the CARD (not the button) and the purchase lands
  const buy = await page.evaluate(async () => {
    const cards = [...document.querySelectorAll('#shop-list .shop-item')];
    const idx = cards.findIndex((c) => !c.querySelector('button').disabled); if (idx < 0) return { no: 'nothing affordable' };
    const price = parseInt(cards[idx].querySelector('.price').textContent, 10);
    const r = cards[idx].getBoundingClientRect();
    return { idx, price, x: r.left + 20, y: r.top + 20, coins: player.mojicoins, inv: (player.inventory || []).filter(Boolean).length, name: cards[idx].querySelector('.name b').textContent };
  });
  if (buy.no) throw new Error(buy.no);
  await page.mouse.move(buy.x, buy.y); await page.waitForTimeout(300);
  const hovered = await page.evaluate((idx) => { const c = document.querySelectorAll('#shop-list .shop-item')[idx]; const b = getComputedStyle(c.querySelector('button')), p = getComputedStyle(c.querySelector('.price')); return { buyOpacity: b.opacity, buyBg: b.backgroundColor, priceOpacity: p.opacity, cursor: getComputedStyle(c).cursor }; }, buy.idx);
  check(hovered.buyOpacity === '1' && /rgb\(255, 228, 92\)/.test(hovered.buyBg) && hovered.priceOpacity === '0' && hovered.cursor === 'pointer', 'HOVER: Buy rises in yellow over the price, the box shows a pointer', J(hovered));
  await page.mouse.click(buy.x, buy.y); await page.waitForTimeout(500);
  const after = await page.evaluate(() => ({ coins: player.mojicoins, inv: (player.inventory || []).filter(Boolean).length, open: document.getElementById('shop-modal').style.display }));
  check(after.coins === buy.coins - buy.price && after.inv === buy.inv + 1, `CLICK: clicking the box itself bought ${buy.name} - coins down by ${buy.price}, one more item held`, J({ before: buy.coins, after: after.coins, inv: [buy.inv, after.inv] }));
  // a box you cannot afford: click does nothing, tooltip explains
  const poor = await page.evaluate(async () => {
    player.mojicoins = 100; openShop('weapon'); await new Promise((r) => setTimeout(r, 400));
    const c = document.querySelectorAll('#shop-list .shop-item')[0]; const b = c.querySelector('button');
    const inv0 = (player.inventory || []).filter(Boolean).length; c.click(); await new Promise((r) => setTimeout(r, 200));
    return { disabled: b.disabled, tip: c.title, invSame: (player.inventory || []).filter(Boolean).length === inv0, coins: player.mojicoins };
  });
  check(poor.disabled && /Need \d+ more Mojicoins/.test(poor.tip) && poor.invSame && poor.coins === 100, 'CANNOT AFFORD: the box does nothing on click and says how much is missing', J(poor));
  // the other tabs
  const others = await page.evaluate(async () => {
    closeAllModals(); openShop('potion'); await new Promise((r) => setTimeout(r, 300));
    const m = document.querySelector('#shop-modal .modal'); const potion = { forge: m.classList.contains('gear-forge'), stall: m.classList.contains('potion-stall'), display: getComputedStyle(document.getElementById('shop-list')).display };
    closeAllModals(); return { potion };
  });
  check(!others.potion.forge && others.potion.stall && others.potion.display !== 'grid', 'the potion stall keeps its own rows (no grid, no forge class)', J(others));
  // v0.30.1016 - a tall window: the game box (.game-wrapper, 960x560 CSS px scaled) is letterboxed, and the card must stay inside it
  await page.setViewportSize({ width: 1280, height: 1200 }); await page.waitForTimeout(700);
  const tall = await page.evaluate(async (tab) => {
    player.mojicoins = 200000;
    try { closeAllModals(); } catch (e) {} openShop(tab); await new Promise((r) => setTimeout(r, 500));
    const R = (el) => el.getBoundingClientRect(); const w = R(document.querySelector('.game-wrapper')), m = R(document.querySelector('#shop-modal .modal'));
    const close = R(document.querySelector('#shop-modal .close-btn')), title = R(document.getElementById('shop-title'));
    return { win: innerHeight, wrapper: [Math.round(w.top), Math.round(w.bottom)], modal: [Math.round(m.top), Math.round(m.bottom)], closeTop: Math.round(close.top), titleTop: Math.round(title.top), listMax: getComputedStyle(document.getElementById('shop-list')).maxHeight };
  }, 'weapon');
  check(tall.modal[0] >= tall.wrapper[0] && tall.modal[1] <= tall.wrapper[1] && tall.closeTop >= tall.wrapper[0] && tall.titleTop >= tall.wrapper[0], 'TALL WINDOW: on 1280 x 1200 the card, its title and its close button stay inside the letterboxed game box', J(tall));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 2)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 200)); }
await ctx.close(); await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
