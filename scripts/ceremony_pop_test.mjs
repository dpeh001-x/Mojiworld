// Live test: THE CEREMONY WINDOWS IN THE MOJIMON POP PUNK. Per user, on the talent pick and the powerup choice: "it can
// have the POP punk design that we have been using for the mojimon UI design" (and class UI "similarly"). Opens the
// real class advancement, talent pick, powerup choice and Sage Mira's Gift, reads computed style: no gold plate or
// starfield, an ink frame with a raspberry edge, yellow Nunito comic titles on a raspberry banner, comic-panel cards
// (class colour slabs; talent cards keep their painted art), MojiMon purple/pink boon tiles, the pop close disc; then
// claims a boon by clicking its tile, to prove the tiles still work.   node scripts/ceremony_pop_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import net from 'node:net';
import { spawn } from 'node:child_process';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const free = (p) => new Promise((r) => { const s = net.createServer(); s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2]; for (let p = 18931; p <= 18999 && !PORT; p++) if (await free(p)) PORT = String(p);
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore', env: { ...process.env, MOJI_GAME_FILE: process.env.MOJI_GAME_FILE || '' } });
await new Promise((r) => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof openTalentPick === 'function' && typeof showPowerupChoice === 'function', null, { timeout: 120000 });
await page.waitForTimeout(2500);
const R = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  try { window._perfTick = function () {}; LX_PERF.veryLowFx = false; _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
  for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  player.cls = 'warrior'; player.job = null; player.level = 30; player._tutorialSeen = true; player._storyBeatsSeen = new Proxy({}, { get: () => true });
  document.documentElement.classList.remove('lx-nobackdrop');
  const cs = (e, p) => (e ? getComputedStyle(e, p || null) : null);
  const hide = () => { try { closeAllModals(); } catch (e) {} for (const id of ['advancement-modal', 'powerup-modal', 'sage-blessing-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; } };
  const panel = (id, sel) => { const m = document.querySelector(sel); const c = cs(m), a = cs(m, '::after'); return { bg: c && c.backgroundImage, border: c && c.borderTopColor, outline: c && c.outlineColor, after: a && a.backgroundImage, font: c && c.fontFamily }; };
  const title = (sel) => { const t = cs(document.querySelector(sel)), bf = cs(document.querySelector(sel), '::before'); return t && { color: t.color, font: t.fontFamily, stroke: t.webkitTextStrokeWidth, banner: bf && bf.backgroundImage }; };
  const out = {};
  hide(); openAdvancement(); await sleep(700);
  out.adv = { panel: panel('advancement-modal', '#advancement-modal > .modal'), title: title('#advancement-modal .modal h2'),
    cards: [...document.querySelectorAll('#advancement-modal .class-card')].map((c) => ({ shadow: cs(c).boxShadow, cls: c.style.getPropertyValue('--cls-color'), name: cs(c.querySelector('.cls-name')).color })) };
  hide(); player.job = 'berserker'; openTalentPick(); await sleep(700);
  out.tal = { title: document.querySelector('#advancement-modal .modal h2').textContent, cards: [...document.querySelectorAll('#advancement-modal .class-card')].map((c) => ({ art: /talents\/bg\//.test(c.style.backgroundImage || ''),
    name: cs(c.querySelector('.tp-name')).color, warn: cs(c.querySelector('.tp-warn')).backgroundColor })) };
  hide(); showPowerupChoice(); await sleep(900);
  const pm = document.querySelector('#powerup-modal .modal.powerup-reveal');
  out.pwr = { panel: panel('powerup-modal', '#powerup-modal .modal.powerup-reveal'), title: title('#powerup-modal .pr-title'),
    ornaments: ['.pr-corner', '.pr-light-ray', '.pr-motes', '.pc-ring', '.pc-fleuron'].map((s) => [...pm.querySelectorAll(s)].every((e) => cs(e).display === 'none')),
    tiles: [...pm.querySelectorAll('.powerup-card')].map((c) => cs(c).backgroundColor), tileImgs: [...pm.querySelectorAll('.powerup-card')].map((c) => cs(c).backgroundImage),
    burst: [cs(pm, '::before').webkitMaskImage, cs(pm, '::after').webkitMaskImage, cs(pm.querySelector('.powerup-card'), '::before').webkitMaskImage].map((m) => /at 100% 0%/.test(m || '')),
    tileDotsInside: (() => { const t = pm.querySelector('.powerup-card'); const c = cs(t, '::before'); return c.marginTop === '0px' && c.marginLeft === '0px'; })(), feet: [...pm.querySelectorAll('.pr-foot-orn')].map((e) => cs(e).display),
    close: cs(pm.querySelector('.close-btn')).borderTopColor };
  const before = (player.boons || []).length; const tile = pm.querySelector('.powerup-card'); if (tile) tile.click(); await sleep(400); out.pwr.claimed = (player.boons || []).length - before;
  hide(); player.mojicoins = 999999; showPowerupShop(); await sleep(1200);
  out.sage = { shown: getComputedStyle(document.getElementById('sage-blessing-modal')).display !== 'none', panel: panel('sage-blessing-modal', '#sage-blessing-modal .modal.sage-blessing'),
    title: title('#sage-blessing-modal .sb-title'), rays: cs(document.querySelector('#sage-blessing-modal .sb-rays')).display, btn: cs(document.querySelector('#sage-blessing-modal .sb-btn')).backgroundColor };
  hide(); return out;
});
await b.close(); srv.kill();
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x }); const J = (o) => JSON.stringify(o);
const INK = 'rgb(11, 10, 14)', AY = 'rgb(243, 245, 66)', PKD = 'rgb(184, 20, 95)';
const noGold = (p) => p && !/panel_p5|starfield/.test(p.bg || '') && p.border === INK && p.outline === PKD && /^"?Nunito/.test(p.font || '');
const comic = (t) => t && t.color === AY && /^"?Nunito/.test(t.font || '') && parseFloat(t.stroke) >= 5 && /linear-gradient/.test(t.banner || '');
ok('class advancement: no gold plate or starfield, an ink frame with a raspberry edge', noGold(R.adv.panel) && !/starfield/.test(R.adv.panel.after || ''), R.adv.panel);
ok('class advancement: the title is a yellow Nunito comic logo on a raspberry banner', comic(R.adv.title), R.adv.title);
ok("class advancement: each card's hard slab is its class colour, names in yellow", R.adv.cards.length >= 2 && R.adv.cards.every((c) => c.name === AY && /6px 6px 0px 2px/.test(c.shadow)), R.adv.cards.map((c) => c.shadow.slice(0, 40)));
ok('talent pick: the cards keep their painted art, names in yellow, the warning on black tape', /Talent/i.test(R.tal.title) && R.tal.cards.length === 3 && R.tal.cards.every((c) => c.art && c.name === AY && c.warn === INK), R.tal.cards);
ok('powerup: no gold plate, the ink frame, the comic title', noGold(R.pwr.panel) && comic(R.pwr.title), { panel: R.pwr.panel, title: R.pwr.title });
ok('powerup: corners, light ray, motes, rings and fleurons are gone', R.pwr.ornaments.every(Boolean), R.pwr.ornaments);
ok('powerup: tiles alternate MojiMon purple and hot pink', R.pwr.tiles[0] === 'rgb(58, 23, 104)' && R.pwr.tiles[1] === 'rgb(255, 45, 149)' && R.pwr.tiles[2] === 'rgb(58, 23, 104)', R.pwr.tiles);
ok('powerup: the footer keeps its separators (end ornaments hidden) and the close disc is the pop one', R.pwr.feet[0] === 'none' && R.pwr.feet[R.pwr.feet.length - 1] === 'none' && R.pwr.feet.slice(1, -1).every((d) => d !== 'none') && R.pwr.close === 'rgb(244, 241, 234)', { feet: R.pwr.feet, close: R.pwr.close });
ok('the dots are a corner accent, not wallpaper: no dot layer behind the text, one burst masked to the top-right, flat tiles with their own corner, kept inside the tile', !/radial-gradient/.test(R.pwr.panel.bg || '') && !/radial-gradient/.test(R.sage.panel.bg || '') && !/radial-gradient/.test(R.adv.panel.bg || '') && R.pwr.burst.every(Boolean) && R.pwr.tileImgs.every((i) => i === 'none') && R.pwr.tileDotsInside, { burst: R.pwr.burst, tiles: R.pwr.tileImgs, inside: R.pwr.tileDotsInside });
ok('powerup: clicking a tile still claims the boon', R.pwr.claimed === 1, R.pwr.claimed);
ok("Sage Mira's Gift: no gold plate, the comic title, no rays, a yellow button", R.sage.shown && noGold(R.sage.panel) && comic(R.sage.title) && R.sage.rays === 'none' && R.sage.btn === AY, R.sage);
ok('no page errors', errs.length === 0, errs.slice(0, 3));
for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + J(q.x ?? '').slice(0, 220));
console.log(`${results.filter((q) => q.pass).length}/${results.length} checks passed`);
process.exit(results.every((q) => q.pass) ? 0 : 1);
