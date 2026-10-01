// pop-deck (per user: "look for instances with generic designs like such to beautify", then "The directional arrow pad and
// guard can be more pop design", "and the jump as well", "can change the icons for better effect", "The directional
// buttons jump and block could use much more improvement and a common coloured theme", then "its a little too much ...
// less bright, perhaps black yellow with some little pink"). On an emulated touch phone in landscape:
//   1. every touch control keeps its size (the pass changes looks, never layout)
//   2. dimmed (per user: "dim the buttons (by make more transluscent) so as to not block the main screen"): every control
//      rests at 82% and a pressed one at full; the menu row, potions, talk and skills stay see-through (thin fills) under a
//      paper keyline; HP / MP / talk keep their meaning
//      colours and the basic attack its butter ring
//   3. the D-pad keys, jump and guard share ONE theme: a black keycap, a butter keyline, a berry slab; the arrows and the
//      jump's double chevron are butter SVG glyphs (the old gold arrow / cloud art gone); the guard keeps its per-class
//      die-cut icon (per user, v0.30.895); the D-pad sits on a round disc with a hub
//   4. a pressed direction goes butter and its glyph turns ink
//   5. no page errors
// The build before fails 2-4.   node scripts/pop_deck_test.mjs      PORT / MOJI_GAME_FILE override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11885), FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
const env = { ...process.env }; if (FILE !== 'mojiworld_game.html') env.MOJI_GAME_FILE = FILE; else delete env.MOJI_GAME_FILE;   // served AT /mojiworld_game.html
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x).slice(0, 300) + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36';
const errs = [];
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 932, height: 430 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: UA });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && document.getElementById('lo-menu'), null, { timeout: 180000 }); await page.waitForTimeout(2500);
  const L = await page.evaluate(async () => {
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player._storyBeatsSeen = { tutorial_intro: true, everdawn_welcome: true }; player._tutorialSeen = true; applyClass('warrior'); try { closeAllModals(); } catch (e) {}
    loadMap('town', 600); await new Promise((r) => setTimeout(r, 2000)); window.dispatchEvent(new Event('resize')); await new Promise((r) => setTimeout(r, 1000));
    const g = (s) => document.querySelector('#mobile-deck ' + s) || document.querySelector(s), cs = (e) => e && getComputedStyle(e);
    const alpha = (c) => { const m = String(c).match(/rgba?\(([^)]+)\)/); return m ? +(m[1].split(',')[3] ?? 1) : 1; };
    const sizes = {}, see = {}, ring = {};
    for (const s of ['.mc-menu', '.mc-dpad .mc-up', '.mc-hp', '.mc-mp', '.mc-talk', '.mc-block', '.mc-jump', '.mc-basic', '.mc-skill']) { const e = g(s); if (!e) continue; sizes[s] = e.offsetWidth + 'x' + e.offsetHeight; if (/dpad|block|jump/.test(s)) continue; see[s] = alpha(cs(e).backgroundColor); ring[s] = cs(e).borderTopColor; }
    const trio = ['.mc-dpad .mc-up', '.mc-jump', '.mc-block'].map((s) => { const c = cs(g(s)); return { s, img: c.backgroundImage, bd: c.borderTopColor, bw: c.borderTopWidth, sh: c.boxShadow }; });
    const up = g('.mc-dpad .mc-up'), arrow = g('.mc-dpad .mc-up .mc-arrow'), ji = g('.mc-jump .ui-ico'), bi = g('.mc-block > img'), pad = g('.mc-dpad');
    const glyph = { arrow: cs(arrow).backgroundImage, jump: cs(ji).backgroundImage, icon: bi && bi.getAttribute('src'), iconShown: !!bi && cs(bi).display !== 'none',
      disc: getComputedStyle(pad, '::before').borderTopLeftRadius, hub: getComputedStyle(pad, '::after').content };
    const rest = {}; for (const s of ['.mc-menu', '.mc-hp', '.mc-talk', '.mc-dpad .mc-up', '.mc-jump', '.mc-block', '.mc-basic']) { const e = g(s); if (e) rest[s] = +cs(e).opacity; }
    up.classList.add('mc-active'); await new Promise((r) => setTimeout(r, 300));   // the opacity eases in over .12 s
    const pressed = { img: cs(up).backgroundImage, arrow: cs(arrow).backgroundImage, op: +cs(up).opacity }; up.classList.remove('mc-active');
    glyph.rest = rest;
    return { sizes, see, ring, trio, glyph, pressed, hp: cs(g('.mc-hp')).backgroundColor, mp: cs(g('.mc-mp')).backgroundColor, talk: cs(g('.mc-talk')).backgroundColor, basic: cs(g('.mc-basic')).borderTopColor };
  });
  const WANT = { '.mc-menu': '46x46', '.mc-dpad .mc-up': '56x56', '.mc-hp': '52x52', '.mc-mp': '52x52', '.mc-talk': '52x52', '.mc-block': '54x54', '.mc-jump': '60x60', '.mc-basic': '86x86', '.mc-skill': '46x46' };
  ok('1. every touch control keeps its size (the restyle is looks only)', Object.entries(WANT).every(([s, v]) => L.sizes[s] === v), L.sizes);
  ok('2. dimmed (per user): every control rests at 82% so the world shows through, and a pressed one comes back to full', Object.values(L.glyph.rest).length >= 6 && Object.values(L.glyph.rest).every((o) => Math.abs(o - 0.82) < 0.02) && L.pressed.op === 1, { rest: L.glyph.rest, pressed: L.pressed.op });
  ok('2. the menu row, potions, talk and skills stay see-through (thin fills) and wear the paper keyline', Object.values(L.see).every((a) => a > 0.15 && a < 0.5) && Object.values(L.ring).every((c) => /244, 241, 234/.test(c) || /^rgb\(255, 224, 122\)$/.test(c)), { see: L.see, ring: L.ring });
  ok('2. HP / MP / talk keep their meaning colours and the basic attack its butter ring', /255, 45, 149/.test(L.hp) && /64, 128, 255/.test(L.mp) && /52, 196, 134/.test(L.talk) && /^rgb\(255, 224, 122\)$/.test(L.basic), { hp: L.hp, mp: L.mp, talk: L.talk, basic: L.basic });
  ok('3. the D-pad keys, jump and guard share one black keycap with a butter keyline on a berry slab', L.trio.every((t) => /linear-gradient/.test(t.img) && /24, 20, 30/.test(t.img) && /^rgb\(255, 224, 122\)$/.test(t.bd) && parseFloat(t.bw) >= 2 && /217, 70, 127/.test(t.sh)), L.trio);
  ok('3. the arrows and the jump chevron are butter SVG glyphs; the guard keeps its per-class icon; the pad sits on a disc with a hub', /data:image\/svg\+xml/.test(L.glyph.arrow) && /ffe07a/.test(L.glyph.arrow) && /data:image\/svg\+xml/.test(L.glyph.jump) && /block_warrior\.webp$/.test(L.glyph.icon || '') && L.glyph.iconShown && L.glyph.disc === '50%' && L.glyph.hub !== 'none', L.glyph);
  ok('4. a pressed direction goes butter and its glyph turns ink', /255, 224, 122/.test(L.pressed.img) && /0b0a0e' stroke/.test(L.pressed.arrow), L.pressed);
  // jump, further (per user: "the jump button can be further improved and shifted to the right slightly")
  const J = await page.evaluate(() => getComputedStyle(document.querySelector('#mobile-deck .mc-jump'), '::after').content);
  ok('4. jump wears a JUMP label under its chevrons', /JUMP/.test(J), J);
  await page.setViewportSize({ width: 842, height: 325 }); await page.evaluate(() => window.dispatchEvent(new Event('resize'))); await page.waitForTimeout(1500);
  const O = await page.evaluate(() => { const rb = (e) => e && e.getBoundingClientRect(); const j = rb(document.querySelector('#mobile-deck .mc-jump')), bar = rb(document.getElementById('skill-bar'));
    const hit = (a, b) => !!(a && b && b.width && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom);
    const skills = [...document.querySelectorAll('#mobile-deck .mc-skill, #mobile-deck .mc-basic')].filter((e) => hit(j, rb(e))).map((e) => e.dataset.mkey);
    return { jump: [j.left, j.top, j.right, j.bottom].map(Math.round), bar: bar && [bar.left, bar.top, bar.right, bar.bottom].map(Math.round), onBar: hit(j, bar), skills }; });
  ok('4. at the user\'s phone (842 x 325) the jump sits clear of the skill bar and of every skill button', !O.onBar && O.skills.length === 0, O);
  ok('5. no page errors', errs.length === 0, errs.slice(0, 3));
} catch (e) { ok('harness: ' + String(e.message).slice(0, 200), false); }
await browser.close(); server.kill();
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) - ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
