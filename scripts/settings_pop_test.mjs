// Live test: SETTINGS, DARK POP. Per user: "This could also you a design rework" (after the dark Compendium and
// MojiDex). Opens the real panel and reads the DOM and computed style:
//   - every setting is still there exactly once, gathered into six cards in two columns (SCREEN, SOUND, GAME |
//     GRAPHICS, COMFORT, SAVE), and on a narrow screen the columns stack;
//   - it is dark: card panels, no paper-white backgrounds, the title a Fredoka logo with a pink drop, and the labels
//     keep the black outline the v0.29 typography pass asked for;
//   - each card's accent colours its "on" toggles; the row buttons are not squashed; nothing is cut off, and the
//     footer stays on the bottom edge when the cards scroll.
// v0.30.1102, the narrow view (per user: "can be further slightly improved"): an 800-900 px window and a landscape
// touch phone keep both columns (the 820x600 window fits whole); one column only under 800 px, with the sliders
// stretched across the row; a fade above the footer while there is more below, gone at the end and absent when
// nothing scrolls; bigger switches on touch screens.
// v0.30.1109, punk pop (per user: "more punk pop feel with shadow and better outlines for each section"): every card
// a paper outline with a hard slab of its own colour behind it (ink-rimmed) and halftone dots; the tags inked
// stickers, tilted alternately.
//   node scripts/settings_pop_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import net from 'node:net';
import { spawn } from 'node:child_process';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const free = (p) => new Promise((r) => { const s = net.createServer(); s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2]; for (let p = 18731; p <= 18829 && !PORT; p++) if (await free(p)) PORT = String(p);
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore', env: { ...process.env, MOJI_GAME_FILE: process.env.MOJI_GAME_FILE || '' } });
await new Promise((r) => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
const open = async (w, h, mobile) => {
  const page = await (await b.newContext({ viewport: { width: w, height: h }, ...(mobile ? { isMobile: true, hasTouch: true } : {}) })).newPage();
  page.on('pageerror', (e) => errs.push(`${w}x${h}: ` + String(e).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof openSettingsModal === 'function', null, { timeout: 120000 });
  await page.waitForTimeout(1500);
  // headless trips the perf governor, whose reduced-effects mode strips every box-shadow: pin it off before reading
  await page.evaluate(async () => { try { window._perfTick = function () {}; LX_PERF.veryLowFx = false; } catch (e) {}
    const cs = document.getElementById('class-select-modal'); if (cs) cs.style.display = 'none';
    document.documentElement.classList.remove('lx-nobackdrop'); openSettingsModal(); await new Promise((r) => setTimeout(r, 400));
    document.documentElement.classList.remove('lx-nobackdrop'); });
  return page;
};
const probe = () => {
  const m = document.getElementById('settings-modal'), rc = (e) => e.getBoundingClientRect();
  const cols = [...m.querySelectorAll('.set-cols > .set-col')], cards = [...m.querySelectorAll('.set-grp')];
  const ids = ['set-scale', 'set-uiscale', 'set-fullscreen-row', 'set-fdesk', 'set-bgm', 'set-sfx', 'set-mute', 'set-bgmute', 'set-difficulty', 'set-hotkeys-row',
    'set-tutorial-open', 'set-debug', 'set-gfx', 'set-gpu-row', 'set-fx-weather', 'set-fx-ambient', 'set-fx-shadows', 'set-fx-dmgnum', 'set-lowfx', 'set-reducemotion',
    'set-shake', 'set-flash', 'set-cbrarity', 'set-quit-row', 'save-import-file'];
  const whites = [...m.querySelectorAll('*')].filter((e) => { const c = getComputedStyle(e).backgroundColor.match(/[0-9.]+/g);
    return c && (c.length < 4 || +c[3] > 0.5) && +c[0] >= 225 && +c[1] >= 225 && +c[2] >= 225 && e.getClientRects().length; }).map((e) => e.id || e.className || e.tagName);
  const h2 = getComputedStyle(m.querySelector('h2')), lab = getComputedStyle(m.querySelector('.settings-row label'));
  const btn = (id) => { const e = document.querySelector('#' + id + ' .hs-btn'); return e ? { w: Math.round(rc(e).width), fits: e.scrollWidth <= e.clientWidth + 1 } : null; };
  const onBg = (id) => { const e = document.getElementById(id); return e && e.classList.contains('on') ? getComputedStyle(e).backgroundColor : 'off'; };
  const done = m.querySelector('.actions .close'), mr = rc(m);
  return {
    cards: cards.map((c) => (c.querySelector('.set-grp-h') || {}).textContent), perCol: cols.map((c) => c.querySelectorAll('.set-grp').length),
    side: cols.length === 2 && rc(cols[1]).left >= rc(cols[0]).right - 1, stacked: cols.length === 2 && rc(cols[1]).top >= rc(cols[0]).bottom - 1,
    idCounts: ids.map((id) => m.querySelectorAll('#' + id).length), rows: m.querySelectorAll('.settings-row').length,
    cardBg: cards[0] ? getComputedStyle(cards[0]).backgroundColor : null, whites,
    h2Font: h2.fontFamily, h2Shadow: h2.textShadow, h2Tilt: h2.transform, labFont: lab.fontFamily, labStroke: lab.webkitTextStrokeWidth,
    bgmuteOn: onBg('set-bgmute'), weatherOn: onBg('set-fx-weather'),
    fsBtn: btn('set-fullscreen-row'), hkBtn: btn('set-hotkeys-row'),
    fitsScreen: mr.top >= -1 && mr.bottom <= innerHeight + 1, doneVisible: !!done && rc(done).bottom <= mr.bottom + 1 && rc(done).top >= mr.top,
    scrolls: m.scrollHeight > m.clientHeight + 1, sh: m.scrollHeight, w: Math.round(mr.width),
    fade: getComputedStyle(m.querySelector('.actions'), '::before').opacity,
    sliderW: Math.round(rc(document.getElementById('set-bgm')).width), toggleT: getComputedStyle(document.getElementById('set-mute')).transform,
    ink: cards.map((c) => { const g = getComputedStyle(c), t = c.querySelector('.set-grp-h'), tg = getComputedStyle(t), mx = tg.transform.match(/[-0-9.e]+/g) || [];
      return { k: c.dataset.grp, bc: g.borderTopColor, bw: g.borderTopWidth, bs: g.boxShadow, acc: tg.backgroundColor, tbw: tg.borderTopWidth, tbc: tg.borderTopColor, tilt: Math.sign(+mx[1] || 0),
        dots: getComputedStyle(c, '::before').backgroundImage }; }),
  };
};
let page = await open(1280, 720);
const D = await page.evaluate(probe);
await page.close();
page = await open(820, 600);
const W = await page.evaluate(probe);
await page.close();
page = await open(760, 600);
const N = await page.evaluate(probe);
N.footer = await page.evaluate(async () => { const m = document.getElementById('settings-modal'); m.scrollTop = 120; await new Promise((r) => setTimeout(r, 150));
  const a = m.querySelector('.actions').getBoundingClientRect(), r = m.getBoundingClientRect(), k = r.height / m.offsetHeight;
  return { gap: Math.round((r.bottom - a.bottom) / k), bw: Math.round(parseFloat(getComputedStyle(m).borderBottomWidth)) }; });
N.fadeEnd = await page.evaluate(async () => { const m = document.getElementById('settings-modal'); m.scrollTop = 1e9; await new Promise((r) => setTimeout(r, 200));
  return getComputedStyle(m.querySelector('.actions'), '::before').opacity; });
await page.close();
page = await open(844, 390, true);
const P = await page.evaluate(probe);
await b.close(); srv.kill();
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const J = (o) => JSON.stringify(o);
ok('six cards in two side-by-side columns: Screen, Sound, Game | Graphics, Comfort, Save', J(D.cards) === J(['Screen', 'Sound', 'Game', 'Graphics', 'Comfort', 'Save']) && J(D.perCol) === '[3,3]' && D.side, { cards: D.cards, perCol: D.perCol, side: D.side });
ok('every setting is still in the panel exactly once (25 rows)', D.idCounts.every((n) => n === 1) && D.rows === 25, { counts: D.idCounts.join(''), rows: D.rows });
ok('dark: cards are #15131c panels and nothing has a paper-white background', D.cardBg === 'rgb(21, 19, 28)' && !D.whites.length, { card: D.cardBg, whites: D.whites.slice(0, 4) });
ok('the title is a tilted Fredoka logo with a pink drop', /^"?Fredoka/.test(D.h2Font) && /rgb[(]255, 61, 139[)]/.test(D.h2Shadow) && D.h2Tilt !== 'none', { font: D.h2Font, tilt: D.h2Tilt });
ok('labels are Fredoka and keep the thick black outline (v0.29 typography, per user)', /^"?Fredoka/.test(D.labFont) && D.labStroke === '3px', { font: D.labFont, stroke: D.labStroke });
ok("a card's accent colours its on-toggles: Sound pink, Graphics yellow", D.bgmuteOn === 'rgb(255, 61, 139)' && D.weatherOn === 'rgb(255, 228, 92)', { sound: D.bgmuteOn, gfx: D.weatherOn });
ok('the Fullscreen and Hotkeys buttons are not squashed (their words fit)', D.fsBtn && D.hkBtn && D.fsBtn.w >= 60 && D.hkBtn.w >= 60 && D.fsBtn.fits && D.hkBtn.fits, { fs: D.fsBtn, hk: D.hkBtn });
ok('1280x720: the panel is on screen, Done in view, nothing cut off (fits or scrolls)', D.fitsScreen && D.doneVisible, { scrolls: D.scrolls });
ok('punk pop: every card has a paper outline (2.5px, drawn 2px on a 1x screen) and a hard 7px slab of its own colour with an ink rim, and halftone dots',
  D.ink.length === 6 && D.ink.every((c) => c.bc === 'rgb(247, 245, 239)' && parseFloat(c.bw) >= 2 && c.bs.includes(c.acc + ' 7px 7px 0px 0px') && c.bs.includes('rgb(12, 11, 16) 7px 7px 0px 2px') && /radial-gradient/.test(c.dots)),
  D.ink.map((c) => c.k + ':' + c.bc + '/' + c.bw + ' ' + c.bs.slice(0, 90)).slice(0, 2));
ok('the tags are inked stickers (a 2.5px ink edge, 2px on a 1x screen), tilted one way then the other down each column', D.ink.every((c) => parseFloat(c.tbw) >= 2 && c.tbc === 'rgb(12, 11, 16)') && J(D.ink.map((c) => c.tilt)) === '[-1,1,-1,-1,1,-1]',
  { tilts: D.ink.map((c) => c.tilt), edge: D.ink.map((c) => c.tbw).join(',') });
ok('1280x720: all of it fits, so there is no "more below" fade', !D.scrolls && D.fade === '0', { scrolls: D.scrolls, fade: D.fade });
ok('an 820x600 window keeps both columns at 740 px and fits whole (no scroll, no fade)', W.side && W.w === 740 && !W.scrolls && W.fade === '0', { side: W.side, w: W.w, sh: W.sh, fade: W.fade });
ok('under 800 px (760x600) the cards stack in one column, sliders stretched across the row', N.stacked && !N.side && N.sliderW >= 180, { stacked: N.stacked, slider: N.sliderW });
ok('one column: the cards scroll and the footer rides the bottom edge', N.scrolls && N.footer.gap >= 0 && N.footer.gap <= N.footer.bw + 1, N.footer);
ok('one column: a fade above the footer while there is more below, gone at the end', N.fade === '1' && N.fadeEnd === '0', { top: N.fade, end: N.fadeEnd });
ok('a landscape touch phone (844x390) keeps both columns, scrolls under 700 px of cards, with the fade and bigger switches', P.side && P.sh < 700 && P.fade === '1' && String(P.toggleT).startsWith('matrix(1.15'), { side: P.side, sh: P.sh, fade: P.fade, toggle: P.toggleT });
ok('no page errors', errs.length === 0, errs.slice(0, 3));
for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + J(q.x ?? '').slice(0, 240));
console.log(`${results.filter((q) => q.pass).length}/${results.length} checks passed`);
process.exit(results.every((q) => q.pass) ? 0 : 1);
