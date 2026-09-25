// THE TAXI MAP FILLS THE WINDOW (v0.30.1075).
//
// Per user: "for taxi uncle map (functional area of the map), make it bigger to utilise more of the space, its taking
// only a small portion". The modal is bound by the 560 px game box and the SVG map is height-bound inside it; the old
// header took about a third of the modal. Reads the live Taxi Service window with a few maps visited:
//   - the map (the svg) stands at least 80% of the modal's height and 85% of its inner width
//   - the header (title to map) is at most 16% of the modal
//   - the brief is one or two lines and carries the coins; the quote is still there
//   - the whole modal sits inside the overlay (no clipping)
//   - v0.30.1073 fails the two share checks (map ~68%, header ~30%)
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/taxi_map_fit_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11380';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const PAGE = path.resolve(SERVE_ROOT, cand || 'mojiworld_game.html');
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const src = readFileSync(PAGE, 'utf8');
check(src.includes('THE TAXI MAP FILLS THE WINDOW') && src.includes('id="taxi-brief"') && src.includes('id="taxi-lumens"'), 'static: the block is in the sheet, the brief line and the coins span are in the markup');
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
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof openTaxi === 'function', null, { timeout: 180000 });
  const r = await page.evaluate(async () => {
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { tutorial_intro: true, everdawn_welcome: true }); player._tutorialSeen = true;
    applyClass('warrior'); player.level = 60; player.talents = { warrior: 'x' }; player.mojicoins = 12345;
    try { closeAllModals(); } catch (e) {}
    loadMap('town', 300); await new Promise((r) => setTimeout(r, 1500)); try { closeAllModals(); } catch (e) {} game.paused = false;
    // a handful of visited maps so the taxi shows the map rather than the "explore first" note
    game.visitedMaps = game.visitedMaps || {}; let n = 0; for (const k of Object.keys(MAPS)) { const m = MAPS[k]; if (m && !m.isBossArena) { game.visitedMaps[k] = true; if (++n >= 6) break; } }
    openTaxi(); await new Promise((r) => setTimeout(r, 900));
    const ov = document.getElementById('taxi-modal'), md = ov.querySelector('.modal'), grid = document.getElementById('taxi-grid'), svg = grid && grid.querySelector('svg');
    if (!svg) return { noSvg: true, gridText: grid && grid.textContent.slice(0, 80), display: ov.style.display };
    const R = (el) => { const b = el.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), left: Math.round(b.left), right: Math.round(b.right), w: Math.round(b.width), h: Math.round(b.height) }; };
    const o = R(ov), m = R(md), g = R(grid), sv = R(svg);
    const pad = parseFloat(getComputedStyle(md).paddingLeft) * (m.w / md.offsetWidth);
    const brief = document.getElementById('taxi-brief'), quote = document.getElementById('taxi-quote');
    return { overlay: o, modal: m, grid: g, svg: sv, innerW: m.w - 2 * pad, headerH: g.top - m.top,
      brief: brief ? { h: R(brief).h, lineH: parseFloat(getComputedStyle(brief).lineHeight) * (m.w / md.offsetWidth), text: brief.textContent.replace(/\s+/g, ' ').trim().slice(0, 140) } : null,
      quote: quote ? quote.textContent.trim().slice(0, 60) : null, coins: (document.getElementById('taxi-lumens') || {}).textContent };
  });
  if (r.noSvg) throw new Error('no taxi map rendered: ' + J(r));
  const mapShare = r.svg.h / r.modal.h, headerShare = r.headerH / r.modal.h, widthShare = r.svg.w / r.innerW;
  check(mapShare >= 0.80, `MAP: the map stands ${(mapShare * 100).toFixed(0)}% of the modal's height (at least 80%; v0.30.1073 gave ~68%)`, J({ svg: r.svg, modal: r.modal }));
  check(widthShare >= 0.85, `MAP: and ${(widthShare * 100).toFixed(0)}% of its inner width (at least 85%)`, J({ svgW: r.svg.w, innerW: Math.round(r.innerW) }));
  check(headerShare <= 0.16, `HEADER: title to map is ${(headerShare * 100).toFixed(0)}% of the modal (at most 16%; was ~30%)`, J({ headerH: r.headerH, modalH: r.modal.h }));
  check(r.brief && r.brief.h <= r.brief.lineH * 2.2 && /Click a node/.test(r.brief.text) && /Mojicoins/.test(r.brief.text) && r.coins === '12345', 'BRIEF: one short line (two at most) with the instructions and the coins', J(r.brief));
  check(r.quote && /dutifully/.test(r.quote), 'QUOTE: the Taxi Uncle still gets his line', J(r.quote));
  check(r.modal.top >= r.overlay.top && r.modal.bottom <= r.overlay.bottom + 1 && r.svg.bottom <= r.modal.bottom, 'FIT: the modal sits inside the overlay and the map inside the modal', J({ overlay: r.overlay, modal: r.modal }));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 2)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 200)); }
await ctx.close(); await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
