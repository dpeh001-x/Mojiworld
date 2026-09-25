// THE ITEM TABS, INK AND POP (v0.30.1073).
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
    const read = (t) => { const cs = getComputedStyle(t); return { txt: t.textContent.trim(), active: t.classList.contains('active'), border: cs.borderTopWidth + ' ' + cs.borderTopColor, radius: cs.borderTopLeftRadius, shadow: cs.boxShadow, font: cs.fontFamily.slice(0, 8) + ' ' + cs.fontWeight + ' ' + cs.fontSize, upper: cs.textTransform, bg: cs.backgroundImage.slice(0, 90), color: cs.color, transform: cs.transform }; };
    const t0 = tabs.map(read);
    const rowCs = getComputedStyle(row); const gap = parseFloat(rowCs.columnGap || rowCs.gap); const rule = rowCs.borderBottomWidth;
    // click Use: the live chip moves
    tabs[1].click(); await new Promise((r) => setTimeout(r, 250)); document.documentElement.classList.remove('lx-nobackdrop'); void document.body.offsetWidth;
    const t1 = [...row.querySelectorAll('.inv-tab')].map(read);
    const uTop = document.querySelector('#u-tabs .inv-tab'); const uRead = uTop ? (() => { const cs = getComputedStyle(uTop); return { border: cs.borderTopWidth + ' ' + cs.borderTopColor, upper: cs.textTransform }; })() : null;
    const box = tabs[2].getBoundingClientRect();
    return { n: tabs.length, t0, t1, gap, rule, uRead, hoverAt: { x: box.left + box.width / 2, y: box.top + box.height / 2 } };
  });
  const idle = r.t0.find((t) => !t.active), live = r.t0.find((t) => t.active);
  check(r.n === 3 && idle && live && live.txt.includes('Equip'), 'ROW: three chips, Equip live to start', J(r.t0.map((t) => t.txt + (t.active ? '*' : ''))));
  check(idle.border === '3px rgb(12, 11, 16)' && idle.radius === '8px' && /rgb\(12, 11, 16\) 4px 4px 0px/.test(idle.shadow) && /inset/.test(idle.shadow) && /^Nunito/.test(idle.font) && /800 15px/.test(idle.font) && idle.upper === 'uppercase', 'CHIP: 3px ink border, paper keyline and a 4px ink offset, Nunito 800 15px in caps', J(idle));
  check(live.border === '3px rgb(12, 11, 16)' && /rgb\(255, 228, 92\)/.test(live.bg) && live.color === 'rgb(12, 11, 16)' && /rgb\(12, 11, 16\) 5px 5px 0px/.test(live.shadow) && /rgba\(255, 228, 92/.test(live.shadow) && live.transform !== 'none', 'LIVE: the selected chip is yellow with ink lettering, a 5px offset, a yellow glow, lifted and tilted', J(live));
  check(r.t1.filter((t) => t.active).length === 1 && r.t1[1].active && /rgb\(255, 228, 92\)/.test(r.t1[1].bg) && !r.t1[0].active && !/rgb\(255, 228, 92\)/.test(r.t1[0].bg), 'SWITCH: clicking Use moves the yellow chip to Use and Equip goes back to ink', J(r.t1.map((t) => t.txt + (t.active ? '*' : ''))));
  check(r.gap >= 8 && r.rule === '0px', 'ROW: the chips sit 10px apart and the old rule under the row is gone', J({ gap: r.gap, rule: r.rule }));
  await page.mouse.move(r.hoverAt.x, r.hoverAt.y); await page.waitForTimeout(250);
  const hov = await page.evaluate(() => { document.documentElement.classList.remove('lx-nobackdrop'); void document.body.offsetWidth; const t = document.querySelectorAll('#inv-tabs .inv-tab')[2]; const cs = getComputedStyle(t); return { shadow: cs.boxShadow, transform: cs.transform, color: cs.color }; });
  check(/rgb\(12, 11, 16\) 6px 6px 0px/.test(hov.shadow) && hov.transform !== 'none', 'HOVER: an idle chip lifts onto a 6px offset', J(hov));
  check(!r.uRead || (r.uRead.border !== '3px rgb(12, 11, 16)' && r.uRead.upper !== 'uppercase'), 'SCOPE: the U panel\'s top tabs share the class but keep their own look', J(r.uRead));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 2)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 200)); }
await ctx.close(); await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
