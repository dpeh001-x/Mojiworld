// The forge's ENHANCED / FAILED card as a black-glass band (v0.30.988).
//
// Per user: "make the colour a slightly more black glass transparent look, and look at top AAA designs
// to improve on this". Checked on the live card, win and loss:
//   1. the band is smoked black glass: near-black, translucent, blurred where blur is available,
//      faded at both ends, and no purple box / thick border / rounded corners
//   2. the star row leads, the new star is marked (and popped), the empty slots stay visible
//   3. the title is a plain word in engraved type - the typed "★ … ★" / "✕ … ✕" ornaments are gone
//   4. the item carries an old -> new star chip; a plain failure says the star was kept
//   5. a loss marks the lost star and turns the band ember
//   6. (v0.30.993) the star row is big (30px) and the landing is flashy: earned stars light in a
//      cascade, the new star slams in after them with rays, a ring and a spray of sparks, and the
//      band flashes on impact
//   node scripts/forge_result_card_test.mjs        (MOJI_GAME_FILE to test a candidate)
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
const page = await (await b.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof openEnhancementModal === 'function' && typeof _showEnhanceCelebration === 'function', null, { timeout: 180000 });
await page.waitForTimeout(1500);
const r = await page.evaluate(async () => {
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  try { _lxBootGateDone = true; } catch (e) {}
  const lo = document.getElementById('loading-overlay'); if (lo) lo.remove();
  player.mojicoins = 99999999;
  const it = rollItemDrop(1, 40); player.inventory.push(it);
  openEnhancementModal();
  await wait(400);
  const el = document.getElementById('enhance-celebration');
  const card = el.querySelector('.ec-card');
  const read = () => {
    const cs = getComputedStyle(card);
    const bg = cs.backgroundColor.match(/[\d.]+/g).map(Number);
    const kids = [...card.children].map((c) => c.id || c.className);
    return {
      bg, radius: parseFloat(cs.borderTopLeftRadius) || 0, border: parseFloat(cs.borderTopWidth) || 0,
      width: card.getBoundingClientRect().width, overlayWidth: el.getBoundingClientRect().width,
      mask: cs.webkitMaskImage || cs.maskImage || '', backdrop: cs.backdropFilter || cs.webkitBackdropFilter || '',
      order: kids, heading: document.getElementById('ec-heading').textContent,
      headingFont: getComputedStyle(document.getElementById('ec-heading')).fontFamily,
      lv: (document.getElementById('ec-lv') || {}).textContent || null,
      lvClass: (document.getElementById('ec-lv') || {}).className || '',
      stars: [...document.querySelectorAll('#ec-stars .s')].map((s) => s.className.replace('s ', '')),
      offColour: (() => { const o = document.querySelector('#ec-stars .s.off'); return o ? getComputedStyle(o).color : null; })(),
      hairTop: getComputedStyle(card, '::before').backgroundImage,
      starPx: parseFloat(getComputedStyle(document.getElementById('ec-stars')).fontSize) || 0,
      onAnims: [...document.querySelectorAll('#ec-stars .s.on')].map((x) => { const c = getComputedStyle(x); return c.animationName + '@' + c.animationDelay; }),
      newAnim: (() => { const n = document.querySelector('#ec-stars .s.new'); return n ? getComputedStyle(n).animationName : ''; })(),
      raysAnim: (() => { const n = document.querySelector('#ec-stars .s.new'); return n ? getComputedStyle(n, '::before').animationName : ''; })(),
      sparks: document.querySelectorAll('#ec-stars .s.new .sp').length,
      flashAnim: getComputedStyle(el, '::after').animationName,
      land: el.style.getPropertyValue('--ec-land'),
    };
  };
  const cleared = () => { el.classList.remove('go', 'fail', 'milestone'); };
  it.stars = 4; _showEnhanceCelebration(it, 4); await wait(900);
  const win = read(); cleared(); await wait(100);
  it.stars = 4; _showEnhanceFailure(it, { lostStar: false, pity: 6 }); await wait(900);
  const fail = read(); cleared(); await wait(100);
  it.stars = 5; _showEnhanceFailure(it, { lostStar: true, pity: 12 }); await wait(900);
  const lost = read(); cleared();
  return { win, fail, lost, lowFx: document.documentElement.classList.contains('lx-nobackdrop') };
});
await b.close(); try { srv.kill(); } catch (e) {}
console.log(JSON.stringify(r, null, 1));
const W0 = r.win;
ok('1. smoked black glass: near-black (every channel <= 16) and translucent (alpha 0.7-0.9)', W0.bg.length === 4 && W0.bg[0] <= 16 && W0.bg[1] <= 16 && W0.bg[2] <= 16 && W0.bg[3] >= 0.7 && W0.bg[3] <= 0.9, JSON.stringify(W0.bg));
ok('1. a band across the panel, faded at both ends: full overlay width, a gradient mask, no border, square ends', W0.width >= W0.overlayWidth - 2 && /gradient/.test(W0.mask) && W0.border === 0 && W0.radius === 0, JSON.stringify({ w: W0.width, of: W0.overlayWidth, mask: W0.mask.slice(0, 40), border: W0.border, radius: W0.radius }));
ok('1. it blurs what is behind it wherever blur is on (low-fx mode strips it by design)', r.lowFx || /blur/.test(W0.backdrop), `${W0.backdrop} lowFx=${r.lowFx}`);
ok('1. ruled by a gold hairline', /gradient/.test(W0.hairTop), W0.hairTop.slice(0, 60));
ok('2. the star row leads the band', W0.order[0] === 'ec-stars', JSON.stringify(W0.order));
ok('2. ten slots: three earned, the new fourth marked, six empty but visible', W0.stars.length === 10 && W0.stars.filter((s) => s === 'on').length === 3 && W0.stars[3] === 'new' && W0.stars.slice(4).every((s) => s === 'off') && /rgba\(255, 255, 255, 0\.1[0-9]*\)/.test(W0.offColour || ''), JSON.stringify({ s: W0.stars, off: W0.offColour }));
ok('3. titles are plain words in engraved Cinzel - no typed star / cross ornaments', W0.heading === 'ENHANCED' && r.fail.heading === 'FAILED' && r.lost.heading === 'STAR LOST' && /Cinzel/.test(W0.headingFont), JSON.stringify([W0.heading, r.fail.heading, r.lost.heading, W0.headingFont]));
ok('4. the item carries its old -> new star chip', /\u2605\s*3\s*\u2192\s*\u2605\s*4/.test(W0.lv || ''), W0.lv);
ok('4. a plain failure says the star was kept', /\u2605\s*4 kept/.test(r.fail.lv || '') && /held/.test(r.fail.lvClass), r.fail.lv);
ok('5. a loss marks the lost star and names the drop', r.lost.stars.indexOf('lost') === 5 && /\u2605\s*6\s*\u2192\s*\u2605\s*5/.test(r.lost.lv || ''), JSON.stringify({ s: r.lost.stars, lv: r.lost.lv }));
ok('5. ...on an ember-ruled band', r.lost.hairTop !== W0.hairTop && /200, 80, 64|255, 194, 178/.test(r.lost.hairTop), r.lost.hairTop.slice(0, 80));
ok('6. the star row is big: 28px or more (was 19)', W0.starPx >= 28, W0.starPx);
const _delays = W0.onAnims.map((a) => parseFloat(a.split('@')[1]) || 0);
ok('6. earned stars light up in a cascade, one after another', W0.onAnims.length === 3 && W0.onAnims.every((a) => /ecStarLight/.test(a)) && _delays[0] < _delays[1] && _delays[1] < _delays[2], JSON.stringify(W0.onAnims));
ok('6. the new star slams in after the cascade, over spinning rays, spraying sparks', /ecStarSlam/.test(W0.newAnim) && /ecRays/.test(W0.raysAnim) && W0.sparks >= 10 && parseFloat(W0.land) > _delays[2] * 1000, JSON.stringify({ n: W0.newAnim, r: W0.raysAnim, sp: W0.sparks, land: W0.land, lastOn: _delays[2] }));
ok('6. the band flashes on the impact of a win, not of a loss', /ecFlash/.test(W0.flashAnim) && !/ecFlash/.test(r.lost.flashAnim || ''), JSON.stringify({ win: W0.flashAnim, lost: r.lost.flashAnim }));
ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
let fail = 0;
for (const x of results) { if (!x.pass) fail++; console.log(`${x.pass ? 'PASS' : 'FAIL'}  ${x.n}${x.pass ? '' : '  -- ' + x.x}`); }
console.log(`\n${results.length - fail}/${results.length} passed`);
process.exit(fail ? 1 : 0);
