// THE NPC DIALOG'S CUT-AND-TORN FRAME (v0.30.975).
//
// Per user, with a Persona 5 text box: "Could we have NPC dialogue borders and designs more stylish such
// as this" - "keep the NPC portrait bubble etc, just change the design and borders". The frame is now
// painted by two inert layers under the content: a torn gold plate and a 1 px gold outline in
// .dlg-skin's pseudo-elements, and the slanted glass ink box (.dlg-ink) with its corners cut. The name
// sits on a tilted cream banner; the answer chips lean 10 degrees with their labels upright; the round
// portrait medallion is unchanged.
//   static: the two layers are in the markup, the block is in the sheet, labels ride in .dlg-lbl spans
//   live:   the layers exist under the content with clip-paths; the card itself paints nothing; the
//           portrait is still a 72 px circle; the name banner is cream with ink text; every direct
//           answer button leans and its label leans back; the bank's own row keeps straight buttons;
//           the confirm card's Yes/No carry the span too; the perf-mode ground is on the ink layer
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/dialog_cut_frame_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11361';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const PAGE = path.resolve(SERVE_ROOT, cand || 'mojiworld_game.html');
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const src = readFileSync(PAGE, 'utf8');
check(/<div class="dlg-skin" aria-hidden="true"><\/div>\s*<div class="dlg-ink" aria-hidden="true"><\/div>/.test(src), 'static: the two paint layers are the first children of #dialog');
check(src.includes('CUT AND TORN') && /#dialog \.dlg-ink \{[\s\S]{0,900}clip-path: polygon\(28px 0/.test(src), 'static: the frame block is present and the ink box is cut');
check(/_lbl\.className = 'dlg-lbl';/.test(src) && (src.match(/_l\.className = 'dlg-lbl'/g) || []).length === 2, 'static: answer labels ride in .dlg-lbl spans (openNPC + the confirm card)');
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
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof openNPC === 'function', null, { timeout: 180000 });
  const r = await page.evaluate(async () => {
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { tutorial_intro: true, everdawn_welcome: true }); player._tutorialSeen = true;
    applyClass('warrior'); player.level = 60; player.talents = { warrior: 'x' }; player._tutorialSeen = true; player.mojicoins = 50000;
    try { closeAllModals(); } catch (e) {}
    loadMap('town', 300); await new Promise((r) => setTimeout(r, 1500)); try { closeAllModals(); } catch (e) {} game.paused = false;
    const milo = (game.npcs || []).find((n) => n && n.role === 'usher'); if (!milo) return { no: 'no Milo' };
    openNPC(milo); await new Promise((r) => setTimeout(r, 500));
    const dlg = document.getElementById('dialog');
    const skin = dlg.querySelector(':scope > .dlg-skin'), ink = dlg.querySelector(':scope > .dlg-ink');
    const first = dlg.firstElementChild && dlg.firstElementChild.className;
    const cd = getComputedStyle(dlg), ci = ink ? getComputedStyle(ink) : null, cb = skin ? getComputedStyle(skin, '::before') : null, ca = skin ? getComputedStyle(skin, '::after') : null;
    const card = { bg: cd.backgroundImage, border: cd.borderTopWidth, shadow: cd.boxShadow, radius: cd.borderTopLeftRadius };
    const layers = { first, inkClip: ci && ci.clipPath.slice(0, 40), inkBlur: ci && (ci.backdropFilter || ci.webkitBackdropFilter), inkZ: ci && ci.zIndex, plateClip: cb && cb.clipPath.slice(0, 30), plateBg: cb && cb.backgroundImage.slice(0, 30), outlineClip: ca && ca.clipPath.slice(0, 30) };
    const port = getComputedStyle(document.getElementById('dialog-portrait'));
    const portrait = { w: port.width, h: port.height, radius: port.borderTopLeftRadius, clip: port.clipPath };
    const cn = getComputedStyle(document.getElementById('dialog-name'));
    const name = { color: cn.color, fill: cn.webkitTextFillColor, bg: cn.backgroundImage.slice(0, 40), transform: cn.transform, clip: cn.clipPath.slice(0, 20), family: cn.fontFamily.slice(0, 20) };
    const btns = [...document.querySelectorAll('#dialog-options > button')];
    const chips = btns.map((b) => { const t = getComputedStyle(b).transform; const l = b.querySelector(':scope > .dlg-lbl'); return { lean: t, label: l ? getComputedStyle(l).transform : null, text: b.textContent.trim().slice(0, 20) }; });
    // the bank's self-rendered row keeps straight buttons
    closeDialog(); loadMap('everdawn_megamall', 300); await new Promise((r) => setTimeout(r, 1500)); try { closeAllModals(); } catch (e) {} game.paused = false;
    const felina = (game.npcs || []).find((n) => n && n.role === 'banker');
    let bank = null;
    if (felina) { openNPC(felina); await new Promise((r) => setTimeout(r, 400)); const nested = [...document.querySelectorAll('#dialog-options :not(button) button')]; bank = { nested: nested.length, straight: nested.every((b) => getComputedStyle(b).transform === 'none' || !/matrix\(1, 0, -0\.17/.test(getComputedStyle(b).transform)) }; closeDialog(); }
    // the confirm card
    _openConfirmDialog('A test', 'Body.', 'Go on', () => {}, 'Stay', closeDialog);
    await new Promise((r) => setTimeout(r, 200));
    const confirm = [...document.querySelectorAll('#dialog-options > button')].map((b) => ({ span: !!b.querySelector(':scope > .dlg-lbl'), text: b.textContent.trim() }));
    // perf mode ground on the ink layer
    document.documentElement.classList.add('lx-nobackdrop');
    const cin = getComputedStyle(ink); const nb = { blur: cin.backdropFilter || cin.webkitBackdropFilter, bg: cin.backgroundImage.slice(0, 50), cardBg: getComputedStyle(dlg).backgroundImage };
    document.documentElement.classList.remove('lx-nobackdrop'); closeDialog();
    return { card, layers, portrait, name, chips, bank, confirm, nb };
  });
  if (r.no) throw new Error(r.no);
  check(r.layers.first === 'dlg-skin' && /polygon/.test(r.layers.inkClip) && /blur\(16px\)/.test(r.layers.inkBlur) && r.layers.inkZ === '0', 'live: the ink layer is a clipped, blurred box under the content', J(r.layers));
  check(/polygon/.test(r.layers.plateClip) && /linear-gradient/.test(r.layers.plateBg) && /polygon/.test(r.layers.outlineClip), 'live: the torn plate and the gold outline are painted in the skin', J({ plate: r.layers.plateClip, outline: r.layers.outlineClip }));
  check(r.card.bg === 'none' && r.card.border === '0px' && r.card.shadow === 'none' && r.card.radius === '0px', 'live: the card itself paints nothing (no background, border, shadow or radius)', J(r.card));
  check(r.portrait.w === '72px' && r.portrait.h === '72px' && r.portrait.radius === '50%' && r.portrait.clip === 'none', 'live: the portrait bubble is unchanged - a 72 px circle', J(r.portrait));
  check(/rgb\(23, 16, 42\)/.test(r.name.fill) && /linear-gradient/.test(r.name.bg) && r.name.transform !== 'none' && /polygon/.test(r.name.clip) && /Cinzel/.test(r.name.family), 'live: the name is ink Cinzel on a tilted cream banner', J(r.name));
  check(r.chips.length >= 2 && r.chips.every((c) => /matrix\(1, 0, -0\.17/.test(c.lean) && c.label && /matrix\(1, 0, 0\.17/.test(c.label)), 'live: every answer chip leans 10 degrees and its label leans back upright', J(r.chips));
  check(r.bank && r.bank.nested >= 2 && r.bank.straight, "live: the bank's self-rendered row keeps straight buttons", J(r.bank));
  check(r.confirm.length === 2 && r.confirm.every((c) => c.span) && r.confirm[0].text === 'Go on', 'live: the confirm card wraps Yes/No in the label span too', J(r.confirm));
  check(/none|^$/.test(r.nb.blur) && /linear-gradient\(168deg, rgba\(17, 10, 32, 0\.96\)/.test(r.nb.bg) && r.nb.cardBg === 'none', 'live: perf mode strips the blur and the near-solid ground sits on the ink layer', J(r.nb));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 2)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 200)); }
await ctx.close(); await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
