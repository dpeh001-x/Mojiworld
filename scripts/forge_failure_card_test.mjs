// Live test: A FAILED FORGE IS TOLD WITH THE SAME WEIGHT AS A SUCCESSFUL ONE.
//
// Per user: "Failure on enhancement is very slipshod unlike success that has a
// message that popups, suggestion to make failure have a popup message and
// central positioning of the animation".
//
// Driven through the REAL enhance flow - a real item from rollItemDrop, the
// real openEnhancementModal, the real attemptEnhance - with Math.random stubbed
// to choose the outcome, because the outcome is the only thing under test and a
// 12-95% roll is not something to wait on. Every assertion reads the live DOM.
//   node scripts/forge_failure_card_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync } from 'node:fs';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const SHOT = process.env.LXSHOT || null;

const net_ = await import('node:net');
const free = (p) => new Promise((r) => { const s = net_.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const { spawn } = await import('node:child_process');
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof attemptEnhance === 'function' && typeof openEnhancementModal === 'function'
  && typeof rollItemDrop === 'function' && typeof _FORGE_FX_MS !== 'undefined', null, { timeout: 120000 });
await page.waitForTimeout(1500);

// Harness: a real item, a real modal, and a scripted roll sequence.
await page.evaluate(() => {
  window._LXF = {};
  window._LXF.realRandom = Math.random;
  // A queue of forced rolls; anything past the end falls back to the real RNG,
  // so nothing else in the frame is starved of randomness.
  window._LXF.queue = [];
  Math.random = function () {
    if (window._LXF.queue.length) return window._LXF.queue.shift();
    return window._LXF.realRandom.call(Math);
  };
  window._LXF.newItem = function () {
    player.mojicoins = 999999999;
    if (!Array.isArray(player.inventory)) player.inventory = [];
    const it = rollItemDrop(1, 40);
    if (it) player.inventory.push(it);
    return it;
  };
  window._LXF.read = function () {
    const el = document.getElementById('enhance-celebration');
    const fx = document.getElementById('enhance-forge-fx');
    const modal = document.querySelector('#enhance-modal .modal');
    const r = (n) => { const e = document.getElementById(n); return e ? (e.textContent || '') : null; };
    const fr = fx ? fx.getBoundingClientRect() : null;
    const mr = modal ? modal.getBoundingClientRect() : null;
    return {
      go: !!(el && el.classList.contains('go')),
      fail: !!(el && el.classList.contains('fail')),
      milestone: !!(el && el.classList.contains('milestone')),
      heading: r('ec-heading'), name: r('ec-name'),
      flavor: r('ec-flavor'), pity: r('ec-pity'),
      starsHtml: (document.getElementById('ec-stars') || {}).innerHTML || '',
      confetti: ((document.getElementById('ec-confetti') || {}).children || []).length,
      fxVisible: !!(fx && fx.style.display === 'block'),
      fxCentre: (fr && fr.width) ? { x: Math.round(fr.left + fr.width / 2), y: Math.round(fr.top + fr.height / 2) } : null,
      modalCentre: (mr && mr.width) ? { x: Math.round(mr.left + mr.width / 2), y: Math.round(mr.top + mr.height / 2) } : null,
      fxMs: (typeof _FORGE_FX_MS !== 'undefined') ? _FORGE_FX_MS : null,
      // The heading is gradient text via background-clip:text. Overriding it with
      // the `background` SHORTHAND silently resets that clip and paints a solid
      // bar with the letters knocked out - invisible, and green on every other
      // assertion. Read the computed value so that cannot come back.
      headingClip: (() => { const h = document.getElementById('ec-heading');
        if (!h) return null; const cs = getComputedStyle(h);
        return cs.webkitBackgroundClip || cs.backgroundClip || null; })(),
    };
  };
  window._LXF.dismiss = function () {
    const el = document.getElementById('enhance-celebration');
    if (el) { el.classList.remove('go'); el.classList.remove('fail'); }
    const c = document.getElementById('ec-confetti'); if (c) c.innerHTML = '';
    const p = document.getElementById('ec-pity'); if (p) p.textContent = '';
  };
});

const fire = async (rolls, stars) => page.evaluate(({ rolls, stars }) => {
  window._LXF.dismiss();
  const it = window._LXF.item || (window._LXF.item = window._LXF.newItem());
  if (!it) return { noItem: true };
  it.stars = stars; it._pity = 1;
  openEnhancementModal();
  window._LXF.queue = rolls.slice();
  attemptEnhance(it);
  const mid = window._LXF.read();          // read WHILE the anvil is swinging
  return { itemName: it.name, starsAfter: it.stars, mid };
}, { rolls, stars });

// ---- 1) a plain failure. NOT at star 0: starSuccessRate(0) is 95 and the
// pity bonus pushes it to 101, so a forced roll of 99.9 still SUCCEEDS - the
// first cut of this file forced a failure that could not happen and then read
// the success card. Star 4 rolls 63+6 = 69, comfortably below the forced 99.9,
// and canDowngradeOnFail only opens at star 5, so no star is lost here.
const failRun = await fire([0.999], 4);
const duringFx = failRun.mid;
await page.waitForTimeout(1100);
const failCard = await page.evaluate(() => window._LXF.read());
if (SHOT) {
  try { mkdirSync(SHOT, { recursive: true }); } catch (e) {}
  // The boot overlay sits above the modal until a session starts, so a raw
  // capture is just the title screen. It repaints itself on every sprite-load
  // tick, so hiding it does not stick - it has to be removed. Capture only;
  // every assertion above reads the live DOM and is unaffected either way.
  await page.evaluate(() => { const o = document.getElementById('loading-overlay'); if (o) o.remove(); });
  await page.screenshot({ path: SHOT + '/forge_fail_card.png' });
}

// ---- 2) a failure that costs a star ----
const lossRun = await fire([0.999, 0.10], 6);
await page.waitForTimeout(1100);
const lossCard = await page.evaluate(() => window._LXF.read());

// ---- 3) a success straight after, to prove nothing leaks ----
const winRun = await fire([0.0], 1);
await page.waitForTimeout(1100);
const winCard = await page.evaluate(() => window._LXF.read());
if (SHOT) await page.screenshot({ path: SHOT + '/forge_success_card.png' });

// ---- 4) close the forge mid-swing: no card may be left waiting ----
await page.evaluate(() => { window._LXF.dismiss(); });
const closed = await page.evaluate(async () => {
  const it = window._LXF.item;
  it.stars = 0; it._pity = 1;
  openEnhancementModal();
  window._LXF.queue = [0.999];
  attemptEnhance(it);
  document.getElementById('enhance-modal').style.display = 'none';   // player walks away
  return true;
});
await page.waitForTimeout(1100);
const afterClose = await page.evaluate(() => window._LXF.read());

const dx = (a, b) => (a && b) ? Math.abs(a.x - b.x) : null;
const dy = (a, b) => (a && b) ? Math.abs(a.y - b.y) : null;

ok('the anvil animation plays CENTRED in the modal, not over its title',
  duringFx && duringFx.fxVisible && dx(duringFx.fxCentre, duringFx.modalCentre) <= 2
  && dy(duringFx.fxCentre, duringFx.modalCentre) <= 2,
  { fxCentre: duringFx && duringFx.fxCentre, modalCentre: duringFx && duringFx.modalCentre,
    offBy: duringFx ? { x: dx(duringFx.fxCentre, duringFx.modalCentre), y: dy(duringFx.fxCentre, duringFx.modalCentre) } : null });
ok('...and the card is held back while it swings, so they do not overlap',
  duringFx && duringFx.go === false && duringFx.fxMs > 0,
  { cardShownDuringAnim: duringFx && duringFx.go, animMs: duringFx && duringFx.fxMs });
ok('a FAILURE now raises the popup card',
  failCard.go === true && failCard.fail === true,
  { shown: failCard.go, failStyling: failCard.fail, heading: failCard.heading });
ok('...and its heading is actually legible, not a gradient bar with the text knocked out',
  failCard.headingClip === 'text', { computedBackgroundClip: failCard.headingClip });
ok('...naming the item, in Brok\'s voice, with the star bar',
  !!failCard.name && failCard.name === failRun.itemName
  && /\S/.test(failCard.flavor || '') && (failCard.starsHtml || '').length > 40,
  { name: failCard.name, flavor: (failCard.flavor || '').slice(0, 70) });
ok('...and it tells you the pity bonus, which only ever lived in a vanishing toast',
  /\+\d+% success/.test(failCard.pity || ''), { pity: failCard.pity });
ok('...with embers falling rather than confetti bursting', failCard.confetti > 0,
  { emberCount: failCard.confetti });
ok('losing a star reads differently, and marks the star that was lost',
  lossCard.go && lossCard.fail && lossCard.heading !== failCard.heading
  && (lossCard.starsHtml || '').indexOf('#ff7766') >= 0 && lossRun.starsAfter === 5,
  { heading: lossCard.heading, starsAfter: lossRun.starsAfter, shown: lossCard.go, failStyling: lossCard.fail,
    marksLostStar: (lossCard.starsHtml || '').indexOf('#ff7766') >= 0, sameHeadingAsPlainFail: lossCard.heading === failCard.heading });
ok('a win straight after a loss is not tinted by it',
  winCard.go === true && winCard.fail === false && (winCard.pity || '') === ''
  && /ENHANCED|EPIC|LEGENDARY|PERFECTED/.test(winCard.heading || ''),
  { heading: winCard.heading, stillFailStyled: winCard.fail, leakedPity: winCard.pity });
ok('closing the forge mid-swing leaves no card waiting for next time',
  afterClose.go === false, { cardShown: afterClose.go });
ok('no page errors', errs.length === 0, errs.slice(0, 3));

for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter(q => q.pass).length}/${results.length} checks passed`);
await b.close(); srv.kill();
process.exit(results.every(q => q.pass) ? 0 : 1);
