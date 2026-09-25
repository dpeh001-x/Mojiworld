// THE POTION STALL: INK ROWS ON THE COMIC PLATE, NO TOP STRIP, EIGHT ROWS WITHOUT A SCROLL (v0.30.990, reworked v0.30.1003; the awning went through v0.30.1009 and v0.30.1011 and came off in v0.30.1015).
//
// v0.30.990 per user: "the potion shop modal can be also bigger bolder similar to the new NPC revamp ... mainly work on
// the font, layout and buttons, the small medium and large can take up much smaller space". v0.30.1003 per user: "Same
// idea goes for the potion stall, use the previous background, white circle translucent, try to compact, make the top
// pink white a bold pop unique design, make it easy to click and buy quantity without having to scroll down too much".
// Reads the live stall:
//   - the comic plate (panel_p5_shop) and the standard frame are back behind Nunito rows and a Fredoka sign
//   - there is no top strip: the awning / bunting ::before and the alembic ::after are both display none (v0.30.1015,
//     per user: "remove the top portion"); the card's top padding is the forge's and the close button sits at the top
//   - each potion row is ONE LINE (no wrap) with a 2px black line and a hard offset; the potion at 22 px on a 32 px
//     coaster at 20% white with a black ring; and ALL EIGHT rows fit the list with no scroll at 1280 x 760
//   - the steppers are chips with black lines, MAX and Buy are yellow, disabled Buy is muted, the quantity field is
//     paper with ink numerals
//   - the block sits AFTER the stall's older rules in the sheet (it lost every tie when it sat before them)
//   - the gear tab wears its own class, not the stall's
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/potion_stall_ink_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11365';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const PAGE = path.resolve(SERVE_ROOT, cand || 'mojiworld_game.html');
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const src = readFileSync(PAGE, 'utf8');
const iBlock = src.indexOf('THE POTION STALL, INK AND PAPER'), iOld = src.indexOf('button[id^="pot-buy"] {\n    background: linear-gradient(180deg, #82d684');
check(iBlock > 0 && iOld > 0 && iBlock > iOld, 'static: the stall block sits after the older stall rules in the sheet', `block ${iBlock}, old green rule ${iOld}`);
check(src.includes("itemIconHtml(p, 22) : p.icon"), 'static: the potion icon renders at 22 px for the 32 px coaster');
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
    applyClass('warrior'); player.level = 60; player.talents = { warrior: 'x' }; player._tutorialSeen = true; player.mojicoins = 50000;
    try { closeAllModals(); } catch (e) {}
    loadMap('town', 300); await new Promise((r) => setTimeout(r, 1500)); try { closeAllModals(); } catch (e) {} game.paused = false;
    openShop('potion'); await new Promise((r) => setTimeout(r, 500));
    // measure with the real faces in: the fallback glyphs are wider and wrap a description onto an extra line
    try { await Promise.all([document.fonts.load('600 13px Nunito'), document.fonts.load('800 13px Nunito'), document.fonts.load('600 26px Fredoka')]); } catch (e) {}
    await new Promise((r) => setTimeout(r, 150));
    const modal = document.querySelector('#shop-modal .modal'); const cm = getComputedStyle(modal), aw = getComputedStyle(modal, '::before'), sg = getComputedStyle(modal, '::after');
    const tile = '';
    const title = getComputedStyle(document.getElementById('shop-title')); const list = document.getElementById('shop-list');
    const rows = [...list.querySelectorAll('.shop-item')];
    const first = rows[0];
    const inp = first.querySelector('input[id^="pot-qty"]'); inp.value = 3; inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true })); await new Promise((r) => setTimeout(r, 400));
    // the perf governor flips html.lx-nobackdrop under load (it strips every box-shadow); the read is synchronous, transitions off
    for (const el of rows) el.style.transition = 'none';
    // ...and on the Buy buttons and steppers: getComputedStyle is what STARTS their 120 ms background transition when the
    // main thread has not flushed style since the input event, and then reports the start value (the muted colour) - seen
    // twice on v0.30.1011 while the same steps in a probe read yellow
    for (const el of rows) el.querySelectorAll('button, input').forEach((b) => { b.style.transition = 'none'; });
    void document.body.offsetWidth;
    document.documentElement.classList.remove('lx-nobackdrop'); void document.body.offsetWidth;
    const cr = getComputedStyle(first);
    const buy = first.querySelector('button[id^="pot-buy"]'), buy2 = rows[1].querySelector('button[id^="pot-buy"]');
    const cb = getComputedStyle(buy), cb2 = getComputedStyle(buy2), ci = getComputedStyle(inp), cs = getComputedStyle(first.querySelector('.pot-step')), cmax = getComputedStyle(first.querySelector('.pot-step[data-step="max"]'));
    const coasterEl = first.querySelector(':scope > div:first-child'), coaster = getComputedStyle(coasterEl); const icon = coasterEl.querySelector('img');
    // heights come back in device pixels (the UI is scaled by a transform); measure against the coaster, which is 32 CSS px
    const heights = rows.map((el) => Math.round(el.getBoundingClientRect().height));
    const coasterH = coasterEl.getBoundingClientRect().height;
    const rr = first.getBoundingClientRect(), br = buy.getBoundingClientRect(), pr = coasterEl.getBoundingClientRect();
    const out = { stall: modal.classList.contains('potion-stall'),
      card: { font: cm.fontFamily.slice(0, 20), border: cm.borderTopWidth + ' ' + cm.borderTopColor, plate: /panel_p5_shop/.test(cm.backgroundImage), paperKeyline: /rgb\(244, 241, 234\) 0px 0px 0px 2px/.test(cm.boxShadow), width: Math.round(modal.getBoundingClientRect().width) },
      top: { before: aw.display, after: sg.display, padTop: cm.paddingTop, closeTop: getComputedStyle(modal.querySelector('.close-btn')).top, titleTop: Math.round(document.getElementById('shop-title').getBoundingClientRect().top - modal.getBoundingClientRect().top) },
      title: { font: title.fontFamily.slice(0, 16), fill: title.webkitTextFillColor, shadow: title.textShadow.slice(0, 40) },
      row: { n: rows.length, wrap: cr.flexWrap, border: cr.borderTopWidth + ' ' + cr.borderTopColor, shadow: cr.boxShadow, heights, coasterH: Math.round(coasterH), oneLine: Math.abs((br.top + br.height / 2) - (pr.top + pr.height / 2)) < 12, buyInsideRow: br.right <= rr.right + 1,
        scroll: { sh: list.scrollHeight, ch: list.clientHeight, mTop: Math.round(modal.getBoundingClientRect().top), mBottom: Math.round(modal.getBoundingClientRect().bottom), vh: innerHeight } },
      coaster: { w: coaster.width, radius: coaster.borderTopLeftRadius, bg: coaster.backgroundColor, border: coaster.borderTopWidth + ' ' + coaster.borderTopColor, shadow: coaster.boxShadow, icon: icon ? icon.getAttribute('width') || icon.style.width || icon.width : null },
      step: { bg: cs.backgroundColor, border: cs.borderTopWidth + ' ' + cs.borderTopColor, font: cs.fontFamily.slice(0, 8) + ' ' + cs.fontWeight + ' ' + cs.fontSize, maxBg: cmax.backgroundColor },
      input: { bg: ci.backgroundColor, color: ci.color, border: ci.borderTopWidth, font: ci.fontWeight + ' ' + ci.fontSize },
      buy: { on: cb.backgroundColor, onColor: cb.color, offBg: cb2.backgroundColor, offColor: cb2.color, disabled2: buy2.disabled, label: buy.textContent.trim() } };
    closeAllModals();
    openShop('weapon'); await new Promise((r) => setTimeout(r, 400));
    const gm = document.querySelector('#shop-modal .modal'); out.gear = { stall: gm.classList.contains('potion-stall'), forge: gm.classList.contains('gear-forge') };
    closeAllModals();
    return out;
  });
  check(r.stall && /^Nunito/.test(r.card.font) && r.card.plate && !r.card.paperKeyline && r.card.border !== '3px rgb(12, 11, 16)', 'CARD: Nunito body on the comic plate (panel_p5_shop) with the standard frame - the ink plate and paper keyline are gone', J(r.card));
  check(r.top.before === 'none' && r.top.after === 'none' && r.top.padTop === '26px' && r.top.closeTop === '14px' && r.top.titleTop < 60, 'TOP: no strip - the awning / bunting and the sign are both off, the card starts at its title with the forge\'s padding, the close button at the top', J(r.top));
  check(/^Fredoka/.test(r.title.font) && /rgb\(255, 255, 255\)/.test(r.title.fill) && /rgb\(12, 11, 16\) 3px 3px 0px/.test(r.title.shadow), 'SIGN: Fredoka in white with a hard ink offset', J(r.title));
  const _hs = [...r.row.heights].sort((a, b) => a - b), _med = _hs[Math.floor(_hs.length / 2)];
  check(r.row.n === 8 && r.row.wrap === 'nowrap' && r.row.oneLine && r.row.buyInsideRow && _med <= r.row.coasterH * 1.5 && _hs[_hs.length - 1] <= r.row.coasterH * 2.0, 'ROWS: eight, one line each - Buy level with the coaster, inside the row; a typical row under 1.5 coasters tall', J({ wrap: r.row.wrap, oneLine: r.row.oneLine, heights: r.row.heights, coaster: r.row.coasterH }));
  check(r.row.scroll.sh <= r.row.scroll.ch + 2, 'ROWS: all eight fit the list with no scroll at 1280 x 760 (the old stall showed four)', J(r.row.scroll));
  check(r.row.scroll.mTop >= 0 && r.row.scroll.mBottom <= r.row.scroll.vh, 'FIT: the whole stall, title to last row, sits inside a 1280 x 760 window (the UI is CSS-zoomed; the list is bounded by the window, not by vh alone)', J(r.row.scroll));
  check(r.row.border === '2px rgb(12, 11, 16)' && /rgb\(12, 11, 16\) 4px 4px 0px/.test(r.row.shadow), 'ROWS: a 2px black line and a hard ink offset', J({ border: r.row.border, shadow: r.row.shadow }));
  // the icon's <img> is swapped in as the sprite decodes; when it is there it is 28 px (the static check pins the size either way)
  check(r.coaster.w === '32px' && r.coaster.radius === '50%' && r.coaster.bg === 'rgba(255, 255, 255, 0.2)' && r.coaster.border === '2px rgb(12, 11, 16)' && r.coaster.shadow === 'none' && (r.coaster.icon == null || String(r.coaster.icon).replace('px', '') === '22'), 'COASTER: a 32 px disc at 20% white with a 2px black ring, no offset, the potion at 22 px on it', J(r.coaster));
  check(/rgba\(255, 255, 255, 0.14\)/.test(r.step.bg) && r.step.border === '2px rgb(12, 11, 16)' && /Nunito,?\s+800 11px/.test(r.step.font) && /rgb\(255, 228, 92\)/.test(r.step.maxBg), 'STEPPERS: translucent chips with black lines in Nunito 800; MAX is yellow', J(r.step));
  check(/rgb\(247, 245, 239\)/.test(r.input.bg) && /rgb\(12, 11, 16\)/.test(r.input.color) && r.input.border === '2px' && /800 13px/.test(r.input.font), 'QUANTITY: paper field, ink numerals', J(r.input));
  check(/rgb\(255, 228, 92\)/.test(r.buy.on) && /rgb\(12, 11, 16\)/.test(r.buy.onColor) && r.buy.disabled2 && /rgba\(60, 58, 68/.test(r.buy.offBg) && r.buy.label === 'Buy 3', 'BUY: yellow with ink lettering when it can buy, muted when it cannot', J(r.buy));
  check(!r.gear.stall && r.gear.forge, 'the gear tab wears its own class, not the stall\'s', J(r.gear));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 2)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 200)); }
await ctx.close(); await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
