// THE NPC DIALOG, POP ART: THE SPEAKER STANDS AT THE SIDE (v0.30.976).
//
// Per user, with a reference box: "The design can still be much better improved such as a pop art design
// style with the character portrait at the side". A speaker with art in NPC_SPRITE_FILES now stands as a
// 300 px figure at the left of the box (sticker outline, feet on the card's floor); the box is an octagon
// with a 3 px cream stroke and a hard gold offset; the name is a flat ink-outlined tag straddling the
// box's top edge; a halftone screen fades in from the bottom-right. Art-less speakers and the confirm
// card keep the v0.30.975 medallion frame, and under 900 px the figure gives way to the medallion.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/dialog_figure_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11362';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const PAGE = path.resolve(SERVE_ROOT, cand || 'mojiworld_game.html');
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const src = readFileSync(PAGE, 'utf8');
check(src.includes('POP ART, THE SPEAKER AT THE SIDE') && /#dialog\.dlg-figure \{ padding: 30px 40px 32px 262px; min-height: 250px; \}/.test(src), 'static: the figure layout block is present');
check(/_dlgEl\.classList\.toggle\('dlg-figure', !!fname\);/.test(src) && /dlg\.classList\.remove\('dlg-figure'\);\s+\/\/ v0\.30\.\d+ the glyph card keeps the medallion frame/.test(src), 'static: the setter toggles the class on art, the confirm card clears it');
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env, MOJI_GAME_FILE: PAGE } });
await new Promise((r) => setTimeout(r, 1800));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 760 } });
await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
const page = await ctx.newPage(); const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
const readCard = () => page.evaluate(() => {
  const dlg = document.getElementById('dialog'), port = document.getElementById('dialog-portrait'), name = document.getElementById('dialog-name');
  const cp = getComputedStyle(port), cn = getComputedStyle(name), ink = getComputedStyle(dlg.querySelector(':scope > .dlg-ink')), half = getComputedStyle(dlg.querySelector(':scope > .dlg-ink'), '::before'), hdr = getComputedStyle(dlg.querySelector('.dialog-header'));
  return { figure: dlg.classList.contains('dlg-figure'), padL: getComputedStyle(dlg).paddingLeft,
    port: { w: cp.width, radius: cp.borderTopLeftRadius, pos: cp.position, size: port.style.backgroundSize, bpos: port.style.backgroundPosition, filter: cp.filter.slice(0, 40), img: (port.style.backgroundImage || '').slice(0, 30), sheen: /radial-gradient/.test(port.style.backgroundImage || '') },
    tag: { border: cn.borderTopWidth + ' ' + cn.borderTopColor, shadow: cn.boxShadow, transform: cn.transform, clip: cn.clipPath, bg: cn.backgroundImage.slice(0, 30) },
    inkLeft: ink.left, inkClip: ink.clipPath.split(',').length, halftone: half.content !== 'none' && /radial-gradient/.test(half.backgroundImage), hdrPos: hdr.position, hdrPointer: hdr.pointerEvents };
});
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof openNPC === 'function', null, { timeout: 180000 });
  const setup = await page.evaluate(async () => {
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { tutorial_intro: true, everdawn_welcome: true }); player._tutorialSeen = true;
    applyClass('warrior'); player.level = 60; player.talents = { warrior: 'x' }; player._tutorialSeen = true;
    try { closeAllModals(); } catch (e) {}
    loadMap('town', 300); await new Promise((r) => setTimeout(r, 1500)); try { closeAllModals(); } catch (e) {} game.paused = false;
    const npcs = (game.npcs || []).filter((n) => n && n.name);
    const withArt = npcs.find((n) => n.role === 'usher' && NPC_SPRITE_FILES[n.name]);
    const artless = npcs.find((n) => !NPC_SPRITE_FILES[n.name] && n.role !== 'amnesiac');
    window.__withArt = withArt; window.__artless = artless;
    return { withArt: withArt && withArt.name, artless: artless && artless.name };
  });
  check(!!setup.withArt, 'town has a speaker with art (Milo)', J(setup));
  await page.evaluate(async () => { openNPC(window.__withArt); await new Promise((r) => setTimeout(r, 400)); });
  const a = await readCard();
  check(a.figure && a.padL === '262px', 'a speaker with art: the card takes the figure layout (class + 262 px stage)', J({ figure: a.figure, padL: a.padL }));
  // v0.30.979 - the sticker edge is a 1.6 px black line (#0c0b10)
  check(a.port.pos === 'absolute' && a.port.w === '300px' && a.port.radius === '0px' && a.port.size === 'contain' && a.port.bpos === 'center bottom' && !a.port.sheen && /drop-shadow\(rgb\(12, 11, 16\) 1\.6px/.test(a.port.filter), 'the figure: 300 px, square, the art alone fitted whole with feet down, a 1.6 px black line', J(a.port));
  // v0.30.977 ink and paper: the tag's line and offset are black (#0c0b10), the offset 5 px, and it tilts a degree and a half
  check(/2px rgb\((12, 11, 16|23, 16, 42)\)/.test(a.tag.border) && /[45]px [45]px 0px/.test(a.tag.shadow) && a.tag.clip === 'none', 'the name tag: flat, 2 px ink outline, hard offset shadow, no slant', J(a.tag));
  check(a.inkLeft === '240px' && a.inkClip === 8 && a.halftone, 'the ink box: moved right of the stage, an octagon, halftone screen in the corner', J({ inkLeft: a.inkLeft, points: a.inkClip, halftone: a.halftone }));
  check(a.hdrPos === 'absolute' && a.hdrPointer === 'none', 'the header is a click-through overlay so the figure can stand on the floor and the tag on the edge', J({ pos: a.hdrPos, pointer: a.hdrPointer }));
  // the answers still work through the overlay
  const clicked = await page.evaluate(async () => { const b = [...document.querySelectorAll('#dialog-options > button')].find((x) => /Leave/.test(x.textContent)); const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await page.mouse.click(clicked.x, clicked.y); await page.waitForTimeout(200);
  check(await page.evaluate(() => document.getElementById('dialog').style.display === 'none'), 'clicking Leave through the overlay closes the card (pointer-events pass through)');
  // art-less speaker: the medallion frame
  if (setup.artless) {
    await page.evaluate(async () => { openNPC(window.__artless); await new Promise((r) => setTimeout(r, 400)); });
    const b = await readCard();
    check(!b.figure && b.port.w === '72px' && b.port.radius === '50%', `an art-less speaker (${setup.artless}) keeps the medallion frame`, J({ figure: b.figure, w: b.port.w, radius: b.port.radius }));
    await page.evaluate(() => closeDialog());
  } else console.log('SKIP no art-less speaker in town');
  // the confirm card
  await page.evaluate(async () => { _openConfirmDialog('A test', 'Body.', 'Go on', () => {}, 'Stay', closeDialog); await new Promise((r) => setTimeout(r, 200)); });
  const c = await readCard();
  check(!c.figure && c.port.w === '72px' && c.port.radius === '50%', 'the confirm card keeps the medallion frame with its glyph', J({ figure: c.figure, w: c.port.w }));
  await page.evaluate(() => closeDialog());
  // and back to a speaker with art: the glyph card's inline styles must not leak into the figure
  await page.evaluate(async () => { openNPC(window.__withArt); await new Promise((r) => setTimeout(r, 400)); });
  const d = await page.evaluate(() => { const p = document.getElementById('dialog-portrait'); return { text: p.textContent, fontSize: p.style.fontSize, display: p.style.display, figure: document.getElementById('dialog').classList.contains('dlg-figure') }; });
  check(d.figure && d.text === '' && d.fontSize === '' && d.display === '', 'after a confirm card, the next speaker with art gets a clean figure (no glyph, no inline leftovers)', J(d));
  // under 900 px the stage is dropped
  await page.setViewportSize({ width: 840, height: 700 }); await page.waitForTimeout(300);
  const n = await readCard();
  check(n.figure && n.padL === '44px' && n.port.w === '72px' && n.port.radius === '50%' && n.port.pos === 'relative', 'under 900 px the figure gives way to the medallion frame', J({ padL: n.padL, w: n.port.w, pos: n.port.pos }));
  await page.setViewportSize({ width: 1280, height: 760 });
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 2)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 200)); }
await ctx.close(); await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
