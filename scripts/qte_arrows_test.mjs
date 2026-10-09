// QTE ARROWS (v0.30.1695, per user: "The skill celestial lock does not show the directions for players to click").
// The shackle chips held the arrows as text; LEFT and RIGHT are emoji (Extended_Pictographic), so the page's emoji pass
// swapped them for atlas tiles - and where a tile did not paint, the player saw blank chips. Pinned here:
//   1. every chip holds exactly one SVG arrow and no emoji tile, for all four directions
//   2. each arrow points its own way (rotation) and is drawn at a readable size in a visible colour
//   3. the current key stands out (lit, breathing) from the upcoming ones, which are no longer the old near-invisible #6f6394;
//      a finished key turns emerald
//   4. the card, beautified in its own style (per user "make the original more beautify, pop does not fit"): every theme titles
//      the painted plate in its original font (per user "The previous font looks better") between two SVG ornaments in its
//      colour, the hint keeps that font, and no emoji
//      tile is left anywhere in the card
//   5. pressing the sequence in order marks each chip done and breaks the lock; a wrong key resets to the first chip; no errors
//   node scripts/qte_arrows_test.mjs        MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 11923), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
try {
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof _qteShackleStart === 'function' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), out = {};
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    if (!player.cls) applyClass('warrior');
    player._tutorialSeen = true; player.invulnerable = 1e9; player._god = false;
    await sleep(2500);
    let k = 0; const rolls = [0.1, 0.3, 0.6, 0.9], oR = Math.random; Math.random = () => (k < rolls.length ? rolls[k++] : oR());
    try { _qteShackleStart({ type: 'zodiac_scorpio', zodiacSign: 'scorpio', boss: true }); } finally { Math.random = oR; }   // LEFT UP DOWN RIGHT
    await sleep(700);   // past the emoji MutationObserver
    const chips = [...document.querySelectorAll('#lx-qte .lxq-chip')];
    const read = (c) => { const s = c.querySelectorAll('svg.lxq-arw'), p = s[0] && s[0].querySelector('path'), r = s[0] ? s[0].getBoundingClientRect() : null, cs = getComputedStyle(c);
      return { dir: c.dataset.direction, svgs: s.length, emo: c.querySelectorAll('.lx-emo').length, rot: s[0] ? s[0].style.transform : '', w: r ? Math.round(r.width) : 0, h: r ? Math.round(r.height) : 0,
        fill: p ? getComputedStyle(p).fill : '', stops: s[0] ? [...s[0].querySelectorAll('stop')].map((q) => getComputedStyle(q).stopColor) : [],
        gradOwn: !!(s[0] && p && s[0].querySelector('linearGradient') && getComputedStyle(p).fill.includes('#' + s[0].querySelector('linearGradient').id)), color: cs.color, cur: c.classList.contains('cur'), cls: c.className, border: cs.borderTopColor, anim: cs.animationName, bg: cs.backgroundImage }; };
    out.seq = _QTE.seq.slice();
    out.chips = chips.map(read);
        const hex = (h) => { const n = parseInt(h.slice(1), 16); return 'rgb(' + (n >> 16) + ', ' + ((n >> 8) & 255) + ', ' + (n & 255) + ')'; };
    out.themes = Object.keys(_QTE_THEMES).map((t) => { const th = _QTE_THEMES[t]; _qteApplyTheme(th);
      const ttl = document.querySelector('#lx-qte .lxq-head .lxq-ttl'), orns = [...document.querySelectorAll('#lx-qte .lxq-head .lxq-orn')];
      return { t, label: ttl ? ttl.textContent : null, want: th.label, font: ttl ? getComputedStyle(ttl).fontFamily : '', orns: orns.length, ornSvg: orns.every((o) => !!o.querySelector('svg')),
        ornColor: orns.map((o) => getComputedStyle(o).color), border: hex(th.border), plate: getComputedStyle(_QTE.card, '::before').backgroundImage.includes('qte_holy_bg'),
        emo: document.querySelectorAll('#lx-qte .lx-emo').length }; });
    { const cs = getComputedStyle(_QTE.card), pl = getComputedStyle(_QTE.card, '::before');
      out.glass = { cardBg: cs.backgroundImage, blur: cs.backdropFilter || cs.webkitBackdropFilter || '', plateOpacity: +pl.opacity, plateZ: pl.zIndex, iso: cs.isolation }; }
    out.rim = getComputedStyle(chips[1]).backgroundImage;   // an upcoming key: its rim is the last (border-box) layer
    { const sub = getComputedStyle(document.querySelector('#lx-qte .lxq-sub')); out.hint = { font: sub.fontFamily, style: sub.fontStyle }; }
    _qteApplyTheme(_QTE.theme);
    // the sequence in order breaks the lock; a wrong key first resets to chip 1
    _qtePress(_QTE.seq[0]); out.done = read(chips[0]);
    const wrong = ['arrowleft', 'arrowup', 'arrowdown', 'arrowright'].find((q) => q !== _QTE.seq[1]); _qtePress(wrong);
    out.reset = { idx: _QTE.idx, cur0: chips[0].classList.contains('cur'), ok0: chips[0].classList.contains('ok') };
    const okSeen = [];
    for (let i = 0; i < _QTE.seq.length; i++) { _qtePress(_QTE.seq[i]); okSeen.push(chips[i].classList.contains('ok')); }
    out.okSeen = okSeen; out.broke = !_QTE.active;
    return out;
  });
  const C = R.chips, want = { left: 'rotate(270deg)', up: 'rotate(0deg)', down: 'rotate(180deg)', right: 'rotate(90deg)' };
  ok('1. the forced sequence is LEFT UP DOWN RIGHT', R.seq.join() === 'arrowleft,arrowup,arrowdown,arrowright', R.seq);
  ok('1. every chip holds exactly one SVG arrow and no emoji tile', C.length === 4 && C.every((c) => c.svgs === 1 && c.emo === 0), C.map((c) => [c.dir, c.svgs, c.emo]));
  ok('2. each arrow points its own way', C.every((c) => c.rot === want[c.dir]), C.map((c) => [c.dir, c.rot]));
  ok('2. ...at a readable size', C.every((c) => c.w >= 22 && c.h >= 22), C.map((c) => [c.w, c.h]));
  ok('2. ...filled by its own gradient, white at the tip into the key colour (the stops follow currentColor)', C.every((c) => c.gradOwn && c.stops.length === 3 && c.stops[0] === 'rgb(255, 255, 255)' && c.stops[1] === c.color && c.stops[2] === c.color), C.map((c) => [c.fill, c.stops]));
  ok('2. ...and no two arrows share a gradient id', new Set(C.map((c) => c.fill)).size === C.length, C.map((c) => c.fill));
  const cur = C.find((c) => c.cur), up = C.filter((c) => !c.cur);
  ok('3. the current key is lit and breathing, its keycap and arrow apart from the upcoming ones', cur && /^lxqBreathe/.test(cur.anim) && up.every((c) => c.color !== cur.color && c.bg !== cur.bg), { cur: cur && [cur.color, cur.anim], upcoming: up.map((c) => c.color) });
  ok('3. upcoming arrows are brighter than the old near-invisible #6f6394', up.every((c) => c.color !== 'rgb(111, 99, 148)'), up.map((c) => c.color));
  ok('3. every key is a gilded keycap (a metallic gold rim)', /rgb\(214, 174, 85\)/.test(R.rim) && /rgb\(125, 91, 31\)/.test(R.rim), R.rim.slice(-140));
  ok('3. a finished key turns emerald, rim kept', /rgb\(88, 196, 130\)/.test(R.done.bg) && /rgb\(214, 174, 85\)/.test(R.done.bg) && R.done.cls === 'lxq-chip ok', [R.done.cls, R.done.anim]);
  ok('4. the backdrop is translucent over a frosted blur (per user "the backdrop a little more translucent")', R.glass.cardBg === 'none' && /blur/.test(R.glass.blur) && R.glass.plateOpacity > 0.5 && R.glass.plateOpacity < 0.9 && R.glass.plateZ === '-1' && R.glass.iso === 'isolate', R.glass);
  const T = R.themes;
  ok('4. every theme titles the painted plate with its own label, in the original card font (per user: "The previous font looks better")', T.length >= 6 && T.every((x) => x.label === x.want && /Trebuchet/.test(x.font) && x.plate), T.map((x) => [x.t, x.label, x.font.split(',')[0], x.plate]));
  ok('4. ...between two SVG ornaments in the theme colour', T.every((x) => x.orns === 2 && x.ornSvg && x.ornColor.every((c) => c === x.border)), T.map((x) => [x.t, x.orns, x.ornColor[0], x.border]));
  ok('4. the hint keeps the original font too', /Trebuchet/.test(R.hint.font) && R.hint.style === 'normal', R.hint);
  ok('4. no emoji tile anywhere in the card, in any theme', T.every((x) => x.emo === 0), T.map((x) => [x.t, x.emo]));
  ok('5. a wrong key resets to the first chip', R.reset.idx === 0 && R.reset.cur0 && !R.reset.ok0, R.reset);
  ok('5. the sequence in order marks each chip done and breaks the lock', R.okSeen.slice(0, 3).every(Boolean) && R.broke, { ok: R.okSeen, broke: R.broke });
  ok('5. no page errors', errs.length === 0, errs);
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
