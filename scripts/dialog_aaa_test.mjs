// THE NPC DIALOG'S AAA PASS: TYPE, GLASS, DELIVERY (v0.30.973).
//
// Per user, with the sage's card: "the aesthetics in terms of the font, the translucency, the delivery
// needs to be much better - AAA standard". This pins each of the three:
//   TYPE      the speech resolves to Alegreya (500 / 500 italic / 700 all loaded), 18.5 px; the name is Cinzel
//   GLASS     the panel blurs what is behind it (18 px; 16 on the v0.30.975 ink layer) and the shard texture is gone; the perf mode
//             (html.lx-nobackdrop) gets its near-solid ground back so the type keeps its contrast
//   DELIVERY  a punctuated line takes measurably longer than a plain one of the same length (the
//             cadence breathes at , . ! ?), the caret is gone, the answers rise 45 ms apart, and the
//             skip / close paths still finish the reveal cleanly (.typing off, timer null)
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/dialog_aaa_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11360';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const PAGE = path.resolve(SERVE_ROOT, cand || 'mojiworld_game.html');
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const src = readFileSync(PAGE, 'utf8');
check(['alegreya-500-normal-latin', 'alegreya-500-italic-latin', 'alegreya-700-normal-latin'].every((f) => src.includes(`assets/fonts/${f}.woff2`)), 'static: the three Alegreya cuts are declared');
check(['alegreya-500-normal-latin', 'alegreya-500-italic-latin', 'alegreya-700-normal-latin'].every((f) => existsSync(path.join(SERVE_ROOT, 'assets', 'fonts', f + '.woff2'))), 'static: and the files ship beside the others');
check(src.includes('THE NPC DIALOG, AAA PASS') && /backdrop-filter: blur\(18px\) saturate\(1\.35\) brightness\(0\.92\);/.test(src), 'static: the glass block is present');
check(/const _twDelay = \(t\) => \{/.test(src) && /dlg\._twTimer = setTimeout\(_twTick, SPEED_MS\);/.test(src), 'static: the paced typewriter replaces the fixed interval');
check(/b\.style\.animationDelay = \(Math\.min\(8, optDiv\.childElementCount\) \* 45\) \+ 'ms';/.test(src), 'static: answers are staggered');
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
    applyClass('warrior'); player.level = 60; player.talents = { warrior: 'x' }; player._tutorialSeen = true;
    try { closeAllModals(); } catch (e) {}
    loadMap('town', 300); await new Promise((r) => setTimeout(r, 1500)); try { closeAllModals(); } catch (e) {} game.paused = false;
    const milo = (game.npcs || []).find((n) => n && n.role === 'usher'); if (!milo) return { no: 'no Milo' };
    openNPC(milo);
    await document.fonts.ready;
    await new Promise((r) => setTimeout(r, 400));
    const dlg = document.getElementById('dialog'), txt = document.getElementById('dialog-text'), name = document.getElementById('dialog-name');
    const cs = getComputedStyle(txt), cd = getComputedStyle(dlg), cn = getComputedStyle(name);
    try { await Promise.all([document.fonts.load('500 18px Alegreya'), document.fonts.load('700 18px Alegreya'), document.fonts.load('italic 500 18px Alegreya')]); } catch (e) {}
    const fonts = { body500: document.fonts.check('500 18px Alegreya'), body700: document.fonts.check('700 18px Alegreya'), italic: document.fonts.check('italic 500 18px Alegreya') };
    const type = { family: cs.fontFamily, size: cs.fontSize, lineHeight: cs.lineHeight, nameFamily: cn.fontFamily };
    // v0.30.975 moved the glass onto the .dlg-ink paint layer (the cut frame); read it from there when present
    const inkEl = dlg.querySelector(':scope > .dlg-ink'); const gs = inkEl ? getComputedStyle(inkEl) : cd;
    const glass = { backdrop: gs.backdropFilter || gs.webkitBackdropFilter, texture: /npc_dialog_bg/.test(cd.backgroundImage + gs.backgroundImage), maxWidth: cd.maxWidth };
    const caret = txt.querySelector('.typewriter-caret'); const caretShown = caret ? getComputedStyle(caret).display !== 'none' : false;
    const delays = [...document.querySelectorAll('#dialog-options button')].map((b) => b.style.animationDelay);
    // delivery: two lines of equal length, one punctuated
    const time = (text) => new Promise((res) => { const t0 = performance.now(); _runDialogTypewriter(text); const iv = setInterval(() => { if (!dlg.classList.contains('typing')) { clearInterval(iv); res(Math.round(performance.now() - t0)); } }, 10); });
    const plain = await time('aaaa bbbb cccc dddd eeee ffff gggg hhhh');   // 39 chars, no punctuation
    const punct = await time('aaa, bbb. ccc! ddd? eee, fff. ggg! hhh.');  // 39 chars, eight stops
    // skip: finishes at once, .typing off, timer null
    _runDialogTypewriter('The quick brown fox jumps over the lazy dog, twice. Then it rests!');
    await new Promise((r) => setTimeout(r, 60));
    const midway = dlg.classList.contains('typing');
    dlg._twSkip();
    const afterSkip = { typing: dlg.classList.contains('typing'), timer: dlg._twTimer, text: txt.textContent.length };
    // close mid-reveal clears the timer
    _runDialogTypewriter('One more line, cut off before it finishes speaking.');
    await new Promise((r) => setTimeout(r, 60));
    closeDialog();
    const afterClose = { typing: dlg.classList.contains('typing'), timer: dlg._twTimer, display: dlg.style.display };
    // perf mode ground
    openNPC(milo); await new Promise((r) => setTimeout(r, 200));
    document.documentElement.classList.add('lx-nobackdrop');
    const cdn = getComputedStyle(inkEl || dlg); const nb = { backdrop: cdn.backdropFilter || cdn.webkitBackdropFilter, bg: cdn.backgroundImage.slice(0, 60) };
    document.documentElement.classList.remove('lx-nobackdrop'); closeDialog();
    return { fonts, type, glass, caretShown, delays, plain, punct, midway, afterSkip, afterClose, nb };
  });
  if (r.no) throw new Error(r.no);
  check(r.fonts.body500 && r.fonts.body700 && r.fonts.italic, 'TYPE: Alegreya 500, 700 and italic all load', J(r.fonts));
  // v0.30.979 - the round hand: Nunito speech at 17.5 px, Fredoka name; Alegreya and Cinzel stay in the stacks as fallbacks
  check(/^Nunito, Alegreya/.test(r.type.family) && r.type.size === '17.5px', 'TYPE: the speech is set in Nunito at 17.5 px (Alegreya the fallback)', J(r.type));
  check(/^Fredoka/.test(r.type.nameFamily) && /Cinzel/.test(r.type.nameFamily), 'TYPE: the name is Fredoka (Cinzel the fallback)', r.type.nameFamily.slice(0, 40));
  check(/blur\(1[468]px\)/.test(r.glass.backdrop) && !r.glass.texture, 'GLASS: a 14-18 px blur behind the panel and no shard texture', J(r.glass));   // v0.30.977 ink blurs 14 px
  check(/none|^$/.test(r.nb.backdrop) && /linear-gradient/.test(r.nb.bg), 'GLASS: perf mode strips the blur and keeps a near-solid ground', J(r.nb));
  check(!r.caretShown, 'DELIVERY: no block caret', 'shown ' + r.caretShown);
  check(r.delays.length >= 2 && r.delays[0] === '0ms' && r.delays[1] === '45ms', 'DELIVERY: answers rise 45 ms apart', J(r.delays));
  check(r.punct - r.plain >= 700, 'DELIVERY: eight stops in a 39-char line cost at least 700 ms more than none (the cadence breathes)', `plain ${r.plain} ms, punctuated ${r.punct} ms`);
  check(r.midway && !r.afterSkip.typing && r.afterSkip.timer === null && r.afterSkip.text > 60, 'DELIVERY: a skip finishes the reveal at once (.typing off, timer cleared, full text)', J(r.afterSkip));
  check(!r.afterClose.typing && r.afterClose.timer === null && r.afterClose.display === 'none', 'DELIVERY: closing mid-reveal clears the timer', J(r.afterClose));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 2)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 200)); }
await ctx.close(); await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
