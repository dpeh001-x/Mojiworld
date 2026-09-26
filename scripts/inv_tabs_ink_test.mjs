// THE ITEM TABS, INK AND POP (v0.30.1073; more pop - Fredoka, rings, halftone - v0.30.1078; the live tab cleaned to a rounded chip with a corner sparkle v0.30.1080; bigger icons v0.30.1088; sticker-cut, no coaster v0.30.1099; halftone thinned and masked in left to right, the sparkle one SVG pseudo v0.30.1102).
//
// Per user, with a screenshot of the inventory's Equip / Use / Etc row: "these buttons in the items UI can be more pop
// designed, more cool and aesthetic". Reads the live Inventory window:
//   - the three chips: 3px ink border, paper keyline + 4px ink offset, Nunito 800 caps, radius 8
//   - the live tab: yellow fill, ink lettering, lifted and tilted a degree, a glow; clicking another tab moves it
//   - hovering an idle chip lifts it onto a 6px offset
//   - the row: gap widened, the old rule under it gone
//   - the U panel's top tabs share the class and are untouched (no ink border there)
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/inv_tabs_ink_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11379';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const PAGE = path.resolve(SERVE_ROOT, cand || 'mojiworld_game.html');
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const src = readFileSync(PAGE, 'utf8');
check(src.includes('THE ITEM TABS, INK AND POP') && /#inv-tabs \.inv-tab, #u-inv-tabs \.inv-tab \{/.test(src), 'static: the block is in the sheet, scoped to the two item-tab rows');
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
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof renderInventory === 'function', null, { timeout: 180000 });
  const r = await page.evaluate(async () => {
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { tutorial_intro: true, everdawn_welcome: true }); player._tutorialSeen = true;
    applyClass('warrior'); player.level = 60; player.talents = { warrior: 'x' }; player._tutorialSeen = true;
    try { closeAllModals(); } catch (e) {}
    loadMap('town', 300); await new Promise((r) => setTimeout(r, 1500)); try { closeAllModals(); } catch (e) {} game.paused = false;
    // open the Inventory window
    game._invTab = 'equip';
    if (typeof openInventory === 'function') openInventory(); else { renderInventory(''); document.getElementById('inventory-modal').style.display = 'flex'; }
    await new Promise((r) => setTimeout(r, 500));
    try { await Promise.all([document.fonts.load('800 15px Nunito')]); } catch (e) {}
    const row = document.getElementById('inv-tabs'), tabs = [...row.querySelectorAll('.inv-tab')];
    for (const t of tabs) t.style.transition = 'none';
    document.documentElement.classList.remove('lx-nobackdrop'); void document.body.offsetWidth;
    const read = (t) => { const cs = getComputedStyle(t), b4 = getComputedStyle(t, '::before'), af = getComputedStyle(t, '::after'); return { txt: t.textContent.trim(), active: t.classList.contains('active'), border: cs.borderTopWidth + ' ' + cs.borderTopColor, radius: cs.borderTopLeftRadius, shadow: cs.boxShadow, font: cs.fontFamily.slice(0, 8) + ' ' + cs.fontWeight + ' ' + cs.fontSize, upper: cs.textTransform, bg: cs.backgroundImage.slice(0, 90), bgSize: cs.backgroundSize, color: cs.color, transform: cs.transform, dots: { content: b4.content, bg: b4.backgroundImage.slice(0, 60), size: b4.backgroundSize, mask: String(b4.webkitMaskImage || b4.maskImage || '').slice(0, 140), z: b4.zIndex }, sparkle: { bg: af.backgroundImage.slice(0, 40), w: af.width, z: af.zIndex } }; };
    const t0 = tabs.map(read);
    const rowCs = getComputedStyle(row); const gap = parseFloat(rowCs.columnGap || rowCs.gap); const rule = rowCs.borderBottomWidth;
    // click Use: the live chip moves
    tabs[1].click(); await new Promise((r) => setTimeout(r, 250)); document.documentElement.classList.remove('lx-nobackdrop'); void document.body.offsetWidth;
    const t1 = [...row.querySelectorAll('.inv-tab')].map(read);
    const uTop = document.querySelector('#u-tabs .inv-tab'); const uRead = uTop ? (() => { const cs = getComputedStyle(uTop); return { border: cs.borderTopWidth + ' ' + cs.borderTopColor, upper: cs.textTransform }; })() : null;
    const box = tabs[2].getBoundingClientRect();
    // the icons: the emoji atlas pass makes them .lx-emo tiles; read the tile's size against the tab's font and its coaster
    const icons = [...row.querySelectorAll('.inv-tab')].map((t) => { const e = t.querySelector('.lx-emo'); if (!e) return null; const cs = getComputedStyle(e), b4 = getComputedStyle(e, '::before'); const tb = getComputedStyle(t); return { px: parseFloat(cs.fontSize), tabPx: parseFloat(tb.fontSize), tile: Math.round(e.getBoundingClientRect().width), filter: cs.filter, before: b4.content, tabH: Math.round(t.getBoundingClientRect().height) }; });
    return { n: tabs.length, t0, t1, gap, rule, uRead, icons, hoverAt: { x: box.left + box.width / 2, y: box.top + box.height / 2 } };
  });
  const idle = r.t0.find((t) => !t.active), live = r.t0.find((t) => t.active);
  check(r.n === 3 && idle && live && live.txt.includes('Equip'), 'ROW: three chips, Equip live to start', J(r.t0.map((t) => t.txt + (t.active ? '*' : ''))));
  check(idle.border === '3px rgb(12, 11, 16)' && idle.radius === '10px' && /rgb\(244, 241, 234\) 0px 0px 0px 2px/.test(idle.shadow) && /rgb\(12, 11, 16\) 0px 0px 0px 4px/.test(idle.shadow) && /rgb\(12, 11, 16\) 5px 5px 0px 2px/.test(idle.shadow) && /^Fredoka/.test(idle.font) && /600 17px/.test(idle.font) && idle.upper === 'uppercase' && !/radial-gradient/.test(idle.bg) && idle.dots.content === '""' && /radial-gradient\(rgba\(255, 255, 255, 0\.09\)/.test(idle.dots.bg) && idle.dots.size === '6px 6px' && /^linear-gradient\(90deg, rgba\(0, 0, 0, 0\) 0%/.test(idle.dots.mask) && idle.dots.z === '-1', 'CHIP: 3px ink border, a paper ring then an ink ring outside it, a 5px offset, Fredoka 600 17px caps; the Ben-Day dots on a ::before overlay, thinner, masked in from left to right', J(idle));
  check(live.border === '3px rgb(12, 11, 16)' && live.radius === '10px' && /rgb\(244, 241, 234\) 0px 0px 0px 2px/.test(live.shadow) && /rgb\(12, 11, 16\) 6px 6px 0px 2px/.test(live.shadow) && /rgba\(255, 228, 92/.test(live.shadow) && !/radial-gradient/.test(live.bg) && /radial-gradient\(rgba\(12, 11, 16, 0\.12\)/.test(live.dots.bg) && live.dots.size === '5px 5px' && /^linear-gradient\(90deg, rgba\(0, 0, 0, 0\) 0%/.test(live.dots.mask) && live.color === 'rgb(12, 11, 16)' && live.transform !== 'none' && live.sparkle.bg.startsWith('url("data:image/svg+xml') && live.sparkle.w === '30px' && live.sparkle.z === '3', 'LIVE: the selected tab is a rounded yellow chip - rings, a 6px offset, halftone, a glow, ink lettering, tilted - with the ink-and-yellow sparkle at its corner as one SVG pseudo; the ink dots on the masked overlay', J(live));
  check(r.t1.filter((t) => t.active).length === 1 && r.t1[1].active && r.t1[1].sparkle.bg.startsWith('url("data:image/svg+xml') && !r.t1[0].active && !r.t1[0].sparkle.bg.startsWith('url('), 'SWITCH: clicking Use moves the yellow chip and its sparkle to Use; Equip goes back to an ink chip', J(r.t1.map((t) => t.txt + (t.active ? '*' : ''))));
  check(r.icons.every((i) => i) && r.icons.every((i) => i.px >= i.tabPx * 1.5 && i.tile >= 26 && (i.before === 'none' || i.before === 'normal') && (i.filter.match(/rgb\(244, 241, 234\)/g) || []).length >= 4 && (i.filter.match(/rgb\(12, 11, 16\)/g) || []).length >= 5 && /rgb\(12, 11, 16\) 2px 2px 0px/.test(i.filter)), 'ICONS: each tab\'s emoji tile is 1.65x the tab\'s font (26+ px), no coaster, sticker-cut: a paper border, an ink line and a hard offset in the filter', J(r.icons));
  check(r.gap >= 14 && r.rule === '0px', 'ROW: the chips sit 18px apart (room for the rings and the burst) and the old rule under the row is gone', J({ gap: r.gap, rule: r.rule }));
  await page.mouse.move(r.hoverAt.x, r.hoverAt.y); await page.waitForTimeout(250);
  const hov = await page.evaluate(() => { document.documentElement.classList.remove('lx-nobackdrop'); void document.body.offsetWidth; const t = document.querySelectorAll('#inv-tabs .inv-tab')[2]; const cs = getComputedStyle(t); return { shadow: cs.boxShadow, transform: cs.transform, color: cs.color }; });
  check(/rgb\(12, 11, 16\) 7px 7px 0px 2px/.test(hov.shadow) && hov.transform !== 'none', 'HOVER: an idle chip lifts onto a 7px offset', J(hov));
  check(!r.uRead || (r.uRead.border !== '3px rgb(12, 11, 16)' && r.uRead.upper !== 'uppercase'), 'SCOPE: the U panel\'s top tabs share the class but keep their own look', J(r.uRead));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 2)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 200)); }
await ctx.close(); await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
