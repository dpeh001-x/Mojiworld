// Live test: IS THE FORGE SMOOTH TO USE?
//
// Per user: "ensure the enhance UI and animation and features are all smooth
// for player".
//
// Covers the whole surface a player touches rather than one feature: the
// animation is ready before the first strike, it stops when the forge closes,
// the panel leaves no inline state behind for the next open, every rung shows
// the odds and the price the code actually uses, the button reflects what you
// can afford, a maxed piece offers nothing, and hammering the button neither
// errors nor leaves a timer running.
//   node scripts/forge_ux_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

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
await page.waitForFunction(() => typeof openEnhancementModal === 'function' && typeof attemptEnhance === 'function'
  && typeof rollItemDrop === 'function' && typeof _FORGE_FX_MS !== 'undefined', null, { timeout: 120000 });
await page.waitForTimeout(1500);

// ---- 1) opening the forge warms both animations ----
const warm = await page.evaluate(() => {
  const before = Object.keys(_forgeFxPreloaded || {}).length;
  player.mojicoins = 99999999;
  if (!Array.isArray(player.inventory)) player.inventory = [];
  const it = rollItemDrop(1, 40); it.slot = 'weapon'; it.stars = 6; it.name = 'UX Probe';
  player.inventory.push(it); window._UX = { it };
  openEnhancementModal();
  return { before, after: Object.keys(_forgeFxPreloaded || {}) };
});
// give the browser a beat to decode the 18 warmed frames
await page.waitForTimeout(1200);
const decoded = await page.evaluate(async () => {
  const probe = (kind, i) => new Promise((res) => {
    const im = new Image();
    im.onload = () => res(im.naturalWidth > 0);
    im.onerror = () => res(false);
    im.src = 'Sprites/fx/anim/forge_' + kind + '_' + i + '.webp';
  });
  const t0 = performance.now();
  const all = await Promise.all([...Array(9).keys()].map(i => probe('success', i))
    .concat([...Array(9).keys()].map(i => probe('fail', i))));
  // Warmed frames come straight out of cache; the timing is the point, not the
  // boolean - an uncached set cannot resolve 18 network fetches this fast.
  return { allOk: all.every(Boolean), ms: Math.round(performance.now() - t0) };
});

// ---- 2) closing the forge mid-strike must stop the anvil ----
const orphan = await page.evaluate(() => {
  const it = window._UX.it; it.stars = 6;
  window._UX.realRandom = Math.random; Math.random = () => 0.999;   // force a failure
  attemptEnhance(it);
  const fx = document.getElementById('enhance-forge-fx');
  const during = { display: fx.style.display, parent: fx.parentElement.tagName };
  document.getElementById('enhance-modal').style.display = 'none';   // player walks away
  return { during };
});
await page.waitForTimeout(400);
const afterClose = await page.evaluate(() => {
  const fx = document.getElementById('enhance-forge-fx');
  return { display: getComputedStyle(fx).display, parent: fx.parentElement.tagName,
    inlinePosition: fx.style.position, timerAlive: _forgeFxTimer != null,
    hasInlineStyle: fx.getAttribute('style') != null && fx.getAttribute('style') !== '' };
});

// ---- 3) every rung shows the odds and the price the code actually uses ----
const rungs = await page.evaluate(() => {
  const it = window._UX.it;
  const rows = [];
  for (let s = 0; s <= 9; s++) {
    it.stars = s;
    player.mojicoins = 99999999;
    openEnhancementModal();
    renderEnhancementModal(it);
    const html = document.getElementById('enhance-preview').innerHTML;
    const rate = (html.match(/([0-9]+)% success/) || [])[1];
    const cost = (html.match(/([0-9,]+) mojicoins/) || [])[1];
    const btn = document.getElementById('do-enhance');
    rows.push({ s, shownRate: rate ? +rate : null, trueRate: starSuccessRate(s),
      shownCost: cost ? +cost.replace(/,/g, '') : null, trueCost: STAR_COSTS[s],
      btnText: btn ? btn.textContent.trim() : null, btnDisabled: btn ? !!btn.disabled : null });
  }
  return rows;
});

// ---- 4) the button tells the truth about affordability, and a maxed piece
//         offers nothing ----
const states = await page.evaluate(() => {
  const it = window._UX.it;
  it.stars = 6; player.mojicoins = 1;
  renderEnhancementModal(it);
  const poorBtn = document.getElementById('do-enhance');
  const poor = { text: poorBtn ? poorBtn.textContent.trim() : null, disabled: poorBtn ? !!poorBtn.disabled : null };
  player.mojicoins = 99999999;
  renderEnhancementModal(it);
  const richBtn = document.getElementById('do-enhance');
  const rich = { text: richBtn ? richBtn.textContent.trim() : null, disabled: richBtn ? !!richBtn.disabled : null };
  it.stars = MAX_STARS;
  renderEnhancementModal(it);
  const maxBtn = document.getElementById('do-enhance');
  const maxed = { hasForgeBtn: !!maxBtn, html: document.getElementById('enhance-preview').innerHTML.length };
  it.stars = 6;
  return { poor, rich, maxed };
});

// ---- 5) hammering the button ----
const spam = await page.evaluate(() => {
  const it = window._UX.it;
  openEnhancementModal();
  for (let i = 0; i < 6; i++) { it.stars = 6; it._pity = 0; player.mojicoins = 99999999; attemptEnhance(it); }
  return { timerAlive: _forgeFxTimer != null };
});
await page.waitForTimeout(3400);   // longer than the card dwell, so this measures cleanup and not impatience
const afterSpam = await page.evaluate(() => {
  const fx = document.getElementById('enhance-forge-fx');
  const el = document.getElementById('enhance-celebration');
  Math.random = window._UX.realRandom;
  return { timerAlive: _forgeFxTimer != null, fxDisplay: getComputedStyle(fx).display,
    fxParent: fx.parentElement.tagName, cardStuck: el.classList.contains('go') };
});


// ---- 6) the grind loop: one click per attempt, with REAL mouse clicks ----
// The boot overlay covers the modal until a session starts, so it has to go
// before any coordinate-based click means anything.
await page.evaluate(() => { const o = document.getElementById("loading-overlay"); if (o) o.remove(); });
const loop = await page.evaluate(() => {
  const it = window._UX.it; it.stars = 6; it._pity = 0;
  player.mojicoins = 99999999;
  window._UX.realRandom = Math.random; Math.random = () => 0.999;   // always fail, so stars never move
  openEnhancementModal(); renderEnhancementModal(it);
  return { coins: player.mojicoins, cost: STAR_COSTS[it.stars] };
});
await page.waitForTimeout(60);   // the button handler is wired on a setTimeout(0)
// A ★6 preview is tall enough to push the Forge button below the fold at this
// viewport, and a coordinate click there lands outside the window entirely -
// elementFromPoint returned null and the first cut of this file read that as
// "the feature does not work". Scroll it into view before measuring anything.
await page.locator('#do-enhance').scrollIntoViewIfNeeded();
const btnBox = await page.evaluate(() => {
  const b = document.getElementById("do-enhance"); const r = b.getBoundingClientRect();
  const x = Math.round(r.left + r.width / 2), y = Math.round(r.top + r.height / 2);
  const hit = document.elementFromPoint(x, y);
  // A point inside the modal but well away from the Forge button, for the
  // "clicking elsewhere only dismisses" case. The celebration overlay is
  // absolutely positioned INSIDE the modal, not over the viewport, so a click
  // at the top-left of the screen never touches it - which is what the first
  // cut of this file got wrong.
  const mr = document.querySelector('#enhance-modal .modal').getBoundingClientRect();
  return { x, y, hitId: hit ? (hit.id || hit.tagName) : null,
    awayX: Math.round(mr.left + 30), awayY: Math.round(mr.top + mr.height * 0.75) };
});
await page.mouse.click(btnBox.x, btnBox.y);          // 1st attempt
await page.waitForTimeout(900);                      // anvil done, card up
const cardUp = await page.evaluate(() => ({
  up: document.getElementById("enhance-celebration").classList.contains("go"),
  coins: player.mojicoins,
}));
await page.mouse.click(btnBox.x, btnBox.y);          // same spot again
await page.waitForTimeout(120);
const afterSecond = await page.evaluate(() => ({
  up: document.getElementById("enhance-celebration").classList.contains("go"),
  coins: player.mojicoins,
}));
// a click somewhere ELSE on the card must only dismiss
await page.waitForTimeout(1200);
const elsewhere = await page.evaluate(() => {
  const it = window._UX.it; player.mojicoins = 99999999;
  attemptEnhance(it); return { coins: player.mojicoins };
});
await page.waitForTimeout(900);
await page.mouse.click(btnBox.awayX, btnBox.awayY);   // inside the modal, away from the button
await page.waitForTimeout(150);
const afterElsewhere = await page.evaluate(() => {
  const o = { up: document.getElementById("enhance-celebration").classList.contains("go"), coins: player.mojicoins };
  Math.random = window._UX.realRandom;
  return o;
});

// ---- 7) the transcendence panel quotes the live curve ----
const trans = await page.evaluate(() => {
  const it = window._UX.it; it.stars = MAX_STARS; it.transcended = false;
  renderEnhancementModal(it);
  const h = document.getElementById("enhance-preview").innerHTML;
  const nums = [...h.matchAll(/~\+(\d+)%/g)].map(m => +m[1]);
  const keep = Math.pow(STAR_GROWTH, MAX_STARS) * 0.5;
  it.stars = 6;
  return { shown: nums,
    trueSig: Math.round((keep * starSigMult({ stars: MAX_STARS }) - 1) * 100),
    trueOrd: Math.round((keep * starMult({ stars: MAX_STARS }) - 1) * 100),
    staleFlat: Math.round((keep * Math.pow(STAR_GROWTH, MAX_STARS) - 1) * 100) };
});

const badRate = rungs.filter(r => r.shownRate !== r.trueRate);
const badCost = rungs.filter(r => r.shownCost !== r.trueCost);

ok('opening the forge warms BOTH animations, so the first strike is not the load',
  warm.after.includes('success') && warm.after.includes('fail') && warm.before === 0,
  { preloadedBefore: warm.before, preloadedAfter: warm.after });
ok('...and those 18 frames really are decoded and in cache',
  decoded.allOk && decoded.ms < 400, { allDecoded: decoded.allOk, msToResolve18: decoded.ms });
ok('the anvil is playing over the modal while it swings',
  orphan.during.display === 'block' && orphan.during.parent === 'BODY', orphan.during);
ok('closing the forge mid-strike STOPS it - no anvil left smoking over the world',
  afterClose.display === 'none' && afterClose.timerAlive === false,
  { display: afterClose.display, parent: afterClose.parent, timerStillRunning: afterClose.timerAlive });
ok('...and it hands itself back to the stylesheet, so the next open starts clean',
  afterClose.hasInlineStyle === false && afterClose.parent !== 'BODY',
  { leftoverInlineStyle: afterClose.hasInlineStyle, parent: afterClose.parent });
ok('every rung shows the odds the code actually rolls', badRate.length === 0,
  { wrong: badRate.length, of: rungs.length, shown: rungs.map(r => r.shownRate), actual: rungs.map(r => r.trueRate) });
ok('every rung shows the price the code actually charges', badCost.length === 0,
  { wrong: badCost.length, of: rungs.length, shown: rungs.map(r => r.shownCost) });
ok('the button says what it will do, and refuses when you cannot pay',
  states.poor.disabled === true && /Not enough/i.test(states.poor.text || '')
  && states.rich.disabled === false && /Forge/.test(states.rich.text || ''),
  { cannotAfford: states.poor, canAfford: states.rich });
ok('a maxed piece offers no forge at all', states.maxed.hasForgeBtn === false && states.maxed.html > 100,
  states.maxed);
ok('hammering the button leaves exactly one animation running, then none',
  spam.timerAlive === true && afterSpam.timerAlive === false && afterSpam.fxDisplay === 'none',
  { duringSpam: spam.timerAlive, after: afterSpam.timerAlive, fxDisplay: afterSpam.fxDisplay });
ok('...and no result card is left stuck on screen', afterSpam.cardStuck === false,
  { cardStuck: afterSpam.cardStuck });
ok('a click on the Forge button while the card is up FORGES - one click per attempt',
  cardUp.up === true && afterSecond.up === false && afterSecond.coins < cardUp.coins,
  { cardWasUp: cardUp.up, cardClearedByTheClick: !afterSecond.up,
    coinsBefore: cardUp.coins, coinsAfter: afterSecond.coins, spentAgain: cardUp.coins - afterSecond.coins,
    whatIsUnderTheButtonPoint: btnBox.hitId });
ok('...while a click anywhere else on the card only dismisses it',
  afterElsewhere.up === false && afterElsewhere.coins === elsewhere.coins,
  { dismissed: !afterElsewhere.up, coinsUnchanged: afterElsewhere.coins === elsewhere.coins });
ok('the transcendence panel quotes the LIVE curve, not the retired flat one',
  trans.shown.includes(trans.trueSig) && trans.shown.includes(trans.trueOrd)
  && !trans.shown.includes(trans.staleFlat),
  { shown: trans.shown, trueSignaturePeak: trans.trueSig, trueOrdinaryPeak: trans.trueOrd, staleFlatValue: trans.staleFlat });
ok('no page errors', errs.length === 0, errs.slice(0, 3));

for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter(q => q.pass).length}/${results.length} checks passed`);
await b.close(); srv.kill();
process.exit(results.every(q => q.pass) ? 0 : 1);
