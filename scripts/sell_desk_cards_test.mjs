// THE SELL DESK AS THE FORGE'S GRID OF CARDS (v0.30.1001).
//
// Per user, after the forge grid: "do the same for the sell tab, compact boxes too". Reads the live desk
// with eight catalogue pieces in the bag:
//   - the sell tab marks the card .sell-desk and lays the rows out as a CSS grid of boxes; the toolbar and
//     the sticky SELL footer span the whole grid
//   - a box is a column with a 2px black line, an ink offset and a rarity strip; the piece sits on a 56 px
//     coaster at 20% white with a black ring; the tick box sits in the corner
//   - the comic plate (panel_p5_shop) is the modal's background, as before the ink pass
//   - clicking a box toggles it for the sale (yellow line, ticked corner, the footer counts it); clicking
//     again clears it; SELL with one box picked pays out and the piece leaves the bag
//   - the weapon and potion tabs do not wear the class
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/sell_desk_cards_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11368';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const PAGE = path.resolve(SERVE_ROOT, cand || 'mojiworld_game.html');
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const src = readFileSync(PAGE, 'utf8');
check(/classList\.toggle\('sell-desk', type === 'sell'\)/.test(src) && src.includes('THE SELL DESK, THE SAME GRID OF CARDS'), 'static: the sell tab marks .sell-desk and the block is in the sheet');
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
    applyClass('warrior'); player.level = 60; player.talents = { warrior: 'x' }; player._tutorialSeen = true; player.mojicoins = 1000;
    // eight catalogue pieces, none legendary / starred / equipped, so a sale needs no confirm
    const pool = [].concat(ITEM_POOL.weapons, ITEM_POOL.armors).filter((it) => !it.setId && it.rarity !== 'legendary' && it.rarity !== 'god');
    player.inventory.length = 0; for (let i = 0; i < 8 && i < pool.length; i++) player.inventory.push({ ...pool[i] });
    game._sellSelection = new Set();
    try { closeAllModals(); } catch (e) {}
    loadMap('town', 300); await new Promise((r) => setTimeout(r, 1500)); try { closeAllModals(); } catch (e) {} game.paused = false;
    openShop('sell'); await new Promise((r) => setTimeout(r, 500));
    try { await Promise.all([document.fonts.load('800 15px Nunito'), document.fonts.load('600 26px Fredoka')]); } catch (e) {}
    const modal = document.querySelector('#shop-modal .modal'), list = document.getElementById('shop-list');
    const cards = [...list.querySelectorAll('.sell-row')];
    // the perf governor flips html.lx-nobackdrop under load (it strips every box-shadow): the read is synchronous
    for (const c of cards) c.style.transition = 'none';
    document.documentElement.classList.remove('lx-nobackdrop'); void document.body.offsetWidth;
    const cols = new Set(cards.map((c) => Math.round(c.getBoundingClientRect().left))).size;
    const rowsY = new Set(cards.map((c) => Math.round(c.getBoundingClientRect().top))).size;
    const c0 = cards[0], cc = getComputedStyle(c0), ic = getComputedStyle(c0.querySelector('.sell-icon')), ck = getComputedStyle(c0.querySelector('.sell-check'));
    const cw = c0.getBoundingClientRect().width, tb = list.querySelector('.sell-toolbar').getBoundingClientRect().width, ft = list.querySelector('.sell-footer').getBoundingClientRect().width;
    return { desk: modal.classList.contains('sell-desk'), display: getComputedStyle(list).display, n: cards.length, cols, rowsY, inv: player.inventory.length,
      card: { flexDir: cc.flexDirection, border: cc.borderTopWidth + ' ' + cc.borderTopColor, shadow: cc.boxShadow.slice(0, 80), font: cc.fontFamily.slice(0, 10), h: Math.round(c0.getBoundingClientRect().height), cursor: cc.cursor },
      span: { card: Math.round(cw), toolbar: Math.round(tb), footer: Math.round(ft) },
      coaster: { w: ic.width, radius: ic.borderTopLeftRadius, bg: ic.backgroundColor, border: ic.borderTopWidth + ' ' + ic.borderTopColor },
      icon: (() => { const cell = c0.querySelector('.sell-icon'), im = cell.querySelector('img'), sp = cell.querySelector('span'); const el = im || sp; if (!el) return null; const cs = getComputedStyle(el); return { kind: im ? 'img' : 'span', w: cs.width, font: cs.fontSize, shadows: (cs.filter.match(/drop-shadow/g) || []).length, ink: /rgb\(12, 11, 16\)/.test(cs.filter), over: Math.round(el.getBoundingClientRect().height - cell.getBoundingClientRect().height) }; })(),
      tick: { pos: ck.position, top: ck.top, left: ck.left, bg: ck.backgroundColor },
      tints: cards.map((c) => { const cls = (c.className.match(/cls-(\w+)/) || [])[1] || null; const cs = getComputedStyle(c.querySelector('.sell-icon')); return { cls, bg: cs.backgroundImage.slice(0, 70), shadow: cs.boxShadow.slice(0, 90) }; }),
      plate: getComputedStyle(modal).backgroundImage.includes('panel_p5_shop'),
      confirmDisabled: document.getElementById('sell-confirm-btn').disabled };
  });
  check(r.desk && r.display === 'grid' && r.cols >= 3 && r.rowsY >= 2 && r.n === 8 && r.inv === 8, 'GRID: the sell tab is a grid of boxes, three or more across', J({ display: r.display, cols: r.cols, rows: r.rowsY, n: r.n }));
  check(r.span.toolbar >= r.span.card * 2.5 && r.span.footer >= r.span.card * 2.5, 'SPAN: the toolbar and the SELL footer stretch across the grid', J(r.span));
  check(r.card.flexDir === 'column' && r.card.border === '2px rgb(12, 11, 16)' && /rgb\(12, 11, 16\) 4px 4px 0px/.test(r.card.shadow) && /inset/.test(r.card.shadow) && /^Nunito/.test(r.card.font) && r.card.h <= 340 && r.card.cursor === 'pointer', 'BOX: a column with a 2px black line, an ink offset and a rarity strip, in Nunito, compact (under 340 device px with the 88 px sprite)', J(r.card));
  check(r.coaster.w === '64px' && r.coaster.radius === '50%' && r.coaster.bg === 'rgba(255, 255, 255, 0.2)' && r.coaster.border === '2px rgb(12, 11, 16)', 'COASTER: 64 px, 20% white, a 2px black ring', J(r.coaster));
  check(r.icon && ((r.icon.kind === 'img' && r.icon.w === '88px' && r.icon.shadows >= 4 && r.icon.ink && r.icon.over > 8) || (r.icon.kind === 'span' && r.icon.font === '52px' && r.icon.shadows >= 1)), 'ICON: the piece drawn at 88 px, overflowing the 64 px coaster, with an ink outline of drop-shadows (or its glyph at 52 px while the sprite decodes)', J(r.icon));
  const TINT = { warrior: '255, 90, 90', rogue: '198, 138, 255', archer: '126, 231, 135', mage: '106, 166, 255', hp: '255, 90, 90', mp: '106, 166, 255', full: '255, 209, 102', cure: '126, 231, 135' };
  const tinted = (o, k) => !!k && new RegExp('rgba\\(' + TINT[k] + ', 0.48\\)').test(o.bg) && new RegExp('rgba\\(' + TINT[k] + ', 0.55\\)').test(o.shadow);
  check(r.tints.some((t) => t.cls) && r.tints.every((t) => t.cls ? tinted(t, t.cls) : (t.bg === 'none' && t.shadow === 'none')), 'CLASS TINT: a class piece\'s coaster is washed and glows in its class colour; a class-less piece keeps the plain 20% white', J(r.tints.map((t) => t.cls || 'any')));
  check(r.tick.pos === 'absolute' && r.tick.top === '8px' && r.tick.left === '8px' && r.tick.bg === 'rgba(255, 255, 255, 0.2)', 'TICK: the check box sits in the corner of the box', J(r.tick));
  check(r.plate, 'PLATE: the comic plate (panel_p5_shop) is the desk background');
  check(r.confirmDisabled, 'FOOTER: SELL is disabled with nothing picked');
  // click a box: picked (yellow line, tick, counted); click again: cleared
  const pick = await page.evaluate(async () => {
    const c = document.querySelectorAll('#shop-list .sell-row')[1]; c.querySelector('.sell-check').style.transition = 'none'; c.click(); await new Promise((r) => setTimeout(r, 200));
    const on = { sel: c.classList.contains('selected'), border: getComputedStyle(c).borderTopColor, tickBg: getComputedStyle(c.querySelector('.sell-check')).backgroundColor, tick: getComputedStyle(c.querySelector('.sell-check'), '::after').content, size: game._sellSelection.size, btn: document.getElementById('sell-confirm-btn').textContent, dis: document.getElementById('sell-confirm-btn').disabled };
    c.click(); await new Promise((r) => setTimeout(r, 200));
    const off = { sel: c.classList.contains('selected'), border: getComputedStyle(c).borderTopColor, size: game._sellSelection.size, dis: document.getElementById('sell-confirm-btn').disabled };
    return { on, off };
  });
  check(pick.on.sel && pick.on.border === 'rgb(255, 228, 92)' && pick.on.tickBg === 'rgb(255, 228, 92)' && /2713|\u2713/.test(pick.on.tick) && pick.on.size === 1 && /Sell 1 for \d+/.test(pick.on.btn) && !pick.on.dis, 'PICK: clicking a box picks it - yellow line, ticked corner, the footer counts it', J(pick.on));
  check(!pick.off.sel && pick.off.border === 'rgb(12, 11, 16)' && pick.off.size === 0 && pick.off.dis, 'PICK: clicking it again clears it', J(pick.off));
  // sell one: pick box 0 and press SELL
  const sale = await page.evaluate(async () => {
    const c = document.querySelectorAll('#shop-list .sell-row')[0]; const name = c.querySelector('.sell-name b').textContent.trim();
    const pay = parseInt(c.querySelector('.sell-value').textContent, 10), coins = player.mojicoins, inv = player.inventory.length;
    c.click(); await new Promise((r) => setTimeout(r, 150)); document.getElementById('sell-confirm-btn').click(); await new Promise((r) => setTimeout(r, 500));
    return { name, pay, coins: [coins, player.mojicoins], inv: [inv, player.inventory.length], desk: document.querySelector('#shop-modal .modal').classList.contains('sell-desk'), grid: getComputedStyle(document.getElementById('shop-list')).display };
  });
  check(sale.coins[1] === sale.coins[0] + sale.pay && sale.inv[1] === sale.inv[0] - 1 && sale.desk && sale.grid === 'grid', `SALE: SELL with ${sale.name} picked paid ${sale.pay} and the piece left the bag; the desk re-renders as a grid`, J(sale));
  const others = await page.evaluate(async () => {
    closeAllModals(); openShop('weapon'); await new Promise((r) => setTimeout(r, 300)); const m = document.querySelector('#shop-modal .modal');
    const w = { desk: m.classList.contains('sell-desk'), forge: m.classList.contains('gear-forge') };
    closeAllModals(); openShop('potion'); await new Promise((r) => setTimeout(r, 300));
    const p = { desk: m.classList.contains('sell-desk'), forge: m.classList.contains('gear-forge'), stall: m.classList.contains('potion-stall') }; closeAllModals(); return { w, p };
  });
  check(!others.w.desk && others.w.forge && !others.p.desk && !others.p.forge && others.p.stall, 'the weapon and potion tabs do not wear the desk class', J(others));
  // v0.30.1016 - a tall window: the game box (.game-wrapper, 960x560 CSS px scaled) is letterboxed, and the card must stay inside it
  await page.setViewportSize({ width: 1280, height: 1200 }); await page.waitForTimeout(700);
  const tall = await page.evaluate(async (tab) => {
    const pool = [].concat(ITEM_POOL.weapons, ITEM_POOL.armors).filter((it) => !it.setId); player.inventory.length = 0; for (let i = 0; i < 16 && i < pool.length; i++) player.inventory.push({ ...pool[i] }); game._sellSelection = new Set();
    try { closeAllModals(); } catch (e) {} openShop(tab); await new Promise((r) => setTimeout(r, 500));
    const R = (el) => el.getBoundingClientRect(); const w = R(document.querySelector('.game-wrapper')), m = R(document.querySelector('#shop-modal .modal'));
    const close = R(document.querySelector('#shop-modal .close-btn')), title = R(document.getElementById('shop-title'));
    return { win: innerHeight, wrapper: [Math.round(w.top), Math.round(w.bottom)], modal: [Math.round(m.top), Math.round(m.bottom)], closeTop: Math.round(close.top), titleTop: Math.round(title.top), listMax: getComputedStyle(document.getElementById('shop-list')).maxHeight };
  }, 'sell');
  check(tall.modal[0] >= tall.wrapper[0] && tall.modal[1] <= tall.wrapper[1] && tall.closeTop >= tall.wrapper[0] && tall.titleTop >= tall.wrapper[0], 'TALL WINDOW: on 1280 x 1200 the card, its title and its close button stay inside the letterboxed game box', J(tall));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 2)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 200)); }
await ctx.close(); await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
