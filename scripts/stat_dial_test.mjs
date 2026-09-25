// The U panel's stat dial: every lane is a chip at the end of its own radar spoke.
//
// Per user: "Create a more interactive way to improve the buttons, to position at the various ends of
// the sonogram, stylise and polish it, improve on the fonts as well, make it look very hip and pop".
// Driven with a real mouse in the running game:
//   1. seven chips, each sitting on the line of its own spoke, none overlapping another or the disc
//   2. a click invests one point (SP -1, the stat actually applied), and "+50 HP" pops off the chip
//   3. +10 invests ten; a HELD press keeps investing and its release is not an extra click
//   4. hovering a chip previews the build after it, and lights that lane's spoke
//   5. the radar shape is the build: each vertex at r0 + ratio * (maxR - r0)
//   6. with no SP every chip locks and the starburst dims; a maxed lane says MAX and ignores clicks
//   7. the type is Cinzel for names (the gold plaques) and Nunito 900 for numbers
//   node scripts/stat_dial_test.mjs        (MOJI_GAME_FILE to test a candidate)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require('playwright-core');
const fs = require('node:fs');
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const net = await import('node:net');
const free = (p) => new Promise((r) => { const s = net.createServer(); s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.env.PORT || process.argv[2]; for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT, env: process.env });
await new Promise((r) => setTimeout(r, 2000));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 900 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof openLevelUpPanel === 'function' && typeof loadMap === 'function', null, { timeout: 180000 });
await page.evaluate(() => {
  try { _lxBootGateDone = true; window._prologueActive = false; window._prologuePending = false; if (typeof _prologueFinish === 'function') _prologueFinish(true); } catch (e) {}
  for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.setProperty('display', 'none', 'important'); }
  document.querySelectorAll('[id^="story-beat"], #lo-stack, #tutorial-modal, #everdawn-welcome-overlay').forEach((e) => e.remove());
  player.cls = 'warrior'; player.level = 60; player.invulnerable = 9e9;
  player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true });
  loadMap('town', 300); game.paused = false;
});
await page.waitForTimeout(2500);
const setup = (sp, spent) => page.evaluate(async ({ sp, spent }) => {
  document.querySelectorAll('#lx-pause, #everdawn-welcome-overlay').forEach((e) => e.remove());
  player.skillPoints = sp; player._levelUpSpent = Object.assign({}, spent);
  game._uTab = 'lp'; openLevelUpPanel();
  await new Promise((r) => setTimeout(r, 500));
  const d = document.getElementById('lp-dial'); if (d) d.scrollIntoView({ block: 'center' });
  await new Promise((r) => setTimeout(r, 300));
  return !!d;
}, { sp, spent });
const box = (lane) => page.evaluate((lane) => { const c = document.querySelector('#lp-grid .lu-card[data-lane="' + lane + '"]'); if (!c) return null; const q = c.getBoundingClientRect(); return { x: q.x + q.width / 2, y: q.y + q.height / 2, bx: q.right - 14 }; }, lane);
const state = () => page.evaluate(() => ({ sp: player.skillPoints, spent: Object.assign({}, player._levelUpSpent), maxHp: player.maxHp, baseAtk: player.baseAtk }));

// ---- 1 + 5 + 7: geometry, shape, type ----
const hasDial = await setup(300, { hp: 100, mp: 20, atk: 50, def: 0, acc: 10, speed: 2, jump: 0 });
const G = await page.evaluate(() => {
  const svg = document.getElementById('lp-radar-svg'), grid = document.getElementById('lp-grid');
  if (!svg || !grid) return null;
  const sr = svg.getBoundingClientRect(), k = sr.width / LP_DIAL.W;
  const toSvg = (x, y) => ({ x: (x - sr.left) / k, y: (y - sr.top) / k });
  const chips = [...grid.querySelectorAll('.lu-card')].map((c) => { const q = c.getBoundingClientRect(); return { id: c.getAttribute('data-lane'), cls: c.className, q: { l: q.left, r: q.right, t: q.top, b: q.bottom }, c: toSvg(q.left + q.width / 2, q.top + q.height / 2) }; });
  const onSpoke = chips.map((ch, i) => {
    const a = _lpAngle(i, chips.length), dx = ch.c.x - LP_DIAL.cx, dy = ch.c.y - LP_DIAL.cy;
    // the chip centre sits on the ellipse point of ITS spoke's angle
    return Math.hypot(ch.c.x - (LP_DIAL.cx + Math.cos(a) * LP_DIAL.rx), ch.c.y - (LP_DIAL.cy + Math.sin(a) * LP_DIAL.ry));
  });
  let overlap = 0;
  for (let i = 0; i < chips.length; i++) for (let j = i + 1; j < chips.length; j++) {
    const A = chips[i].q, B = chips[j].q; if (A.l < B.r && B.l < A.r && A.t < B.b && B.t < A.b) overlap++;
  }
  // no chip corner inside the disc
  let inDisc = 0;
  for (const ch of chips) for (const [x, y] of [[ch.q.l, ch.q.t], [ch.q.r, ch.q.t], [ch.q.l, ch.q.b], [ch.q.r, ch.q.b]]) { const p = toSvg(x, y); if (Math.hypot(p.x - LP_DIAL.cx, p.y - LP_DIAL.cy) < LP_DIAL.disc) inDisc++; }
  const pts = (document.getElementById('lp-shape').getAttribute('points') || '').split(' ').map((s) => s.split(',').map(Number));
  const expectR = LEVELUP_OPTIONS.map((o) => LP_DIAL.r0 + _lpRatio(o) * (LP_DIAL.maxR - LP_DIAL.r0));
  const gotR = pts.map(([x, y]) => Math.hypot(x - LP_DIAL.cx, y - LP_DIAL.cy));
  const f = (sel, p) => { const e = document.querySelector(sel); return e ? getComputedStyle(e)[p] : ''; };
  return { n: chips.length, ids: chips.map((c) => c.id), offSpoke: Math.max(...onSpoke), overlap, inDisc,
    shapeErr: Math.max(...gotR.map((g, i) => Math.abs(g - expectR[i]))), nameFont: f('#lp-grid .lu-name', 'fontFamily'),
    numFont: f('#lp-dial .lp-sp-num', 'fontFamily'), numWeight: f('#lp-dial .lp-sp-num', 'fontWeight'),
    center: (document.getElementById('lp-remaining') || {}).textContent };
});
ok('1. seven chips, one per lane, in spoke order', hasDial && G && G.n === 7 && G.ids.join() === 'hp,mp,atk,def,acc,speed,jump', JSON.stringify(G && G.ids));
ok('1. each chip sits at the end of its own spoke (within 2 design px)', G && G.offSpoke <= 2, G && G.offSpoke);
ok('1. no chip overlaps another chip or the dial', G && G.overlap === 0 && G.inDisc === 0, JSON.stringify(G && { overlap: G.overlap, cornersInDisc: G.inDisc }));
ok('5. the radar shape is the build (every vertex within 1 px of r0 + ratio * span)', G && G.shapeErr <= 1, G && G.shapeErr);
ok('7. Cinzel names, Nunito 900 numbers, SP in the medallion', G && /Cinzel/.test(G.nameFont) && /Nunito/.test(G.numFont) && +G.numWeight >= 900 && G.center === '300', JSON.stringify(G && [G.nameFont, G.numFont, G.numWeight, G.center]));

if (!(G && G.n === 7)) {
  ok('the dial exists - every interaction check below needs its chips', false, 'no stat dial on this build');
} else {
// ---- 2: a click ----
let s0 = await state();
let hp = await box('hp');
await page.mouse.move(hp.x, hp.y); await page.mouse.down(); await page.mouse.up();
await page.waitForTimeout(150);
let s1 = await state();
const floatTxt = await page.evaluate(() => [...document.querySelectorAll('#lp-fx .lp-float')].map((e) => e.textContent));
ok('2. a click invests exactly one point, and it applies', s1.sp === s0.sp - 1 && s1.spent.hp === s0.spent.hp + 1 && s1.maxHp === s0.maxHp + 50, JSON.stringify({ sp: [s0.sp, s1.sp], hp: [s0.spent.hp, s1.spent.hp], maxHp: [s0.maxHp, s1.maxHp] }));
ok('2. "+50 HP" pops off the chip', floatTxt.includes('+50 HP'), JSON.stringify(floatTxt));

// ---- 3: +10, then a held press ----
const atk = await box('atk');
s0 = await state();
await page.mouse.click(atk.bx, atk.y);
await page.waitForTimeout(150);
s1 = await state();
ok('3. +10 invests ten', s1.sp === s0.sp - 10 && s1.spent.atk === s0.spent.atk + 10 && s1.baseAtk === s0.baseAtk + 100, JSON.stringify({ sp: [s0.sp, s1.sp], atk: [s0.spent.atk, s1.spent.atk] }));
const def = await box('def');
s0 = await state();
await page.mouse.move(def.x - 30, def.y); await page.mouse.down();
// hold until the repeat has clearly kicked in (a starved headless timer can run late, so wait on
// progress rather than a fixed 1.3 s), then release
const tHold = Date.now();
while (Date.now() - tHold < 5000) { await page.waitForTimeout(100); if ((await state()).spent.def - s0.spent.def >= 8) break; }
await page.mouse.up();
await page.waitForTimeout(500);
s1 = await state();
const held = s1.spent.def - s0.spent.def;
ok('3. holding a chip keeps investing (400 ms, then ~12 a second)', held >= 8 && held <= 20, held);
ok('3. ...every held point is paid for, and the release adds no extra click', s0.sp - s1.sp === held, JSON.stringify({ spPaid: s0.sp - s1.sp, invested: held }));

// ---- 4: hover preview ----
const mp = await box('mp');
await page.mouse.move(mp.x - 30, mp.y);
await page.waitForTimeout(250);
const H = await page.evaluate(() => { const pv = document.getElementById('lp-preview'); return { shown: pv && pv.style.display !== 'none', differs: pv && pv.getAttribute('points') !== document.getElementById('lp-shape').getAttribute('points'), hot: [...document.querySelectorAll('#lp-radar-svg .hot')].map((e) => e.getAttribute('data-l')) }; });
ok('4. hovering a chip previews the build after it and lights that lane', H.shown && H.differs && H.hot.length >= 3 && H.hot.every((l) => l === 'mp'), JSON.stringify(H));
await page.mouse.move(5, 5);

// ---- 6: no SP, and a maxed lane ----
await setup(0, { hp: 100, speed: 10 });
const L = await page.evaluate(() => ({ cls: [...document.querySelectorAll('#lp-grid .lu-card')].map((c) => c.getAttribute('data-lane') + ':' + c.className.replace('lu-card lu-node ', '')), empty: document.getElementById('lp-burst').classList.contains('empty'), maxTxt: (document.querySelector('#lp-grid .lu-card[data-lane="speed"] .lu-maxed') || {}).textContent }));
ok('6. with no SP every open lane locks and the starburst dims', L.cls.filter((c) => /locked/.test(c)).length === 6 && L.empty, JSON.stringify(L));
await page.evaluate(() => { player.skillPoints = 20; renderLevelUp(); });
const sp0 = await page.evaluate(() => player.skillPoints);
const spd = await box('speed');
await page.mouse.click(spd.x - 30, spd.y); await page.waitForTimeout(150);
const sp1 = await page.evaluate(() => ({ sp: player.skillPoints, s: player._levelUpSpent.speed }));
ok('6. a maxed lane says MAX and ignores clicks', L.maxTxt === 'MAX' && sp1.sp === sp0 && sp1.s === 10, JSON.stringify({ max: L.maxTxt, sp: [sp0, sp1.sp], speed: sp1.s }));
}
ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
await b.close(); try { srv.kill(); } catch (e) {}
let fail = 0;
for (const x of results) { if (!x.pass) fail++; console.log(`${x.pass ? 'PASS' : 'FAIL'}  ${x.n}${x.pass ? '' : '  -- ' + x.x}`); }
console.log(`\n${results.length - fail}/${results.length} passed`);
process.exit(fail ? 1 : 0);
