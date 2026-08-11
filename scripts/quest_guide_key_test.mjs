// The directional key: auto-tracks without the player touching anything, draws
// a compact widget, and E cycles then dismisses.
//
// Everything here goes through the REAL paths — the keyboard for E, the quest
// tick for auto-track, and the rendered DOM for the widget. A previous suite in
// this feature stayed green against a build where the code had been clobbered
// out of the file, because it called the render function directly instead.
// Run: node scripts/quest_guide_key_test.mjs [file.html]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const URL = 'file:///' + path.join(ROOT, process.argv[2] || 'mojiworld_game.html').split(path.sep).join('/');
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
let bad = 0;
const check = (ok, label, detail) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail !== undefined ? '  — ' + JSON.stringify(detail) : ''}`); if (!ok) bad++; };

await page.goto(URL + '?dev=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof _qnavDrawKey === 'function' && typeof _qnavCycle === 'function', { timeout: 60000 });
await page.evaluate(() => {
  const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
  // the loop returns every frame until the overlay carries .fade
  window._lxBootGateDone = true;
  const card = document.querySelector('#class-select-modal .cls-card');
  if (card && !player.cls) { try { card.click(); } catch (e) {} }
  const gate = document.getElementById('class-select-modal'); if (gate) gate.style.display = 'none';
  game.paused = false;
  player.level = 40;
  game.qnav = null; game._qnavOptOut = false;
  if (typeof tickQuestUnlocks === 'function') tickQuestUnlocks();
  // v0.29.597 — the widget became a DOM element (the canvas is 960x560 logical
  // and scaled, so nothing drawn on it can be aligned with the HTML HUD). Read
  // the element rather than counting ctx calls.
  window.__read = () => {
    _qnavDrawKey();
    const el = document.getElementById('qnav-key');
    if (!el) return { shown: false, glyph: '', name: '', sub: '', key: '' };
    return {
      shown: getComputedStyle(el).display !== 'none',
      glyph: (el.querySelector('.qk-a') || {}).textContent || '',
      name: (el.querySelector('.qk-t b') || {}).textContent || '',
      sub: (el.querySelector('.qk-t i') || {}).textContent || '',
      key: (el.querySelector('.qk-k') || {}).textContent || '',
    };
  };
});
await page.waitForTimeout(2500);

// 1. Auto-track: the guide must switch itself on. This is the whole point —
// a guide you have to find in a panel does not help someone already lost.
const auto = await page.evaluate(() => {
  game.qnav = null;
  if (typeof _qnavAutoTrack === 'function') _qnavAutoTrack();
  const d = game.qnav ? _qnavDest(game.qnav) : null;
  return { qnav: game.qnav, who: d && d.who, listLen: _qnavGuideList().length };
});
console.log(`auto-track -> ${auto.qnav} (${auto.who}), ${auto.listLen} candidates`);
check(!!auto.qnav, 'the guide picks a target with no player action', auto);
check(auto.listLen > 1, 'there are several candidates to cycle through', auto.listLen);

// 2. It draws.
const drew = await page.evaluate(() => window.__read());
console.log(`key shows: ${JSON.stringify(drew)}`);
check(drew.shown, 'the directional key is visible', drew);
check(!!drew.name, 'it names the destination', drew);
check(['◀', '▶', '◆', '⌖'].includes(drew.glyph), 'it shows a direction glyph', drew.glyph);
check(drew.key === 'E', 'it advertises the E key', drew.key);

// 3. The direction must follow the player, not be a constant.
const flip = await page.evaluate(() => {
  const d = _qnavDest(game.qnav);
  const h = _qnavHeading(d);
  if (!h) return { skipped: true };
  const px = player.x, py = player.y;
  player.y = h.y;                                   // isolate the horizontal axis
  player.x = h.x - 500; const right = window.__read().glyph;
  player.x = h.x + 500; const left = window.__read().glyph;
  player.x = px; player.y = py;
  return { right, left, tx: h.x };
});
if (flip.skipped) check(false, 'a heading exists to test direction', flip);
else {
  console.log(`standing left of target -> ${flip.right}   standing right -> ${flip.left}`);
  check(flip.right === '▶', 'points right when the target is to the right', flip);
  check(flip.left === '◀', 'points left when the target is to the left', flip);
}

// 4. The real E key cycles, and past the end dismisses + sticks.
const cyc = await page.evaluate(() => ({ before: game.qnav, list: _qnavGuideList() }));
await page.keyboard.press('e');
const after1 = await page.evaluate(() => ({ qnav: game.qnav }));
check(after1.qnav !== cyc.before, 'pressing E moves the guide to another quest', { before: cyc.before, after: after1.qnav });
check(cyc.list.includes(after1.qnav), 'and lands on a real candidate', after1.qnav);

const dismissed = await page.evaluate(async () => {
  const list = _qnavGuideList();
  game.qnav = list[list.length - 1];          // sit on the last one
  _qnavCycle();                                // one more step = off
  const off = { qnav: game.qnav, optOut: !!game._qnavOptOut };
  _qnavAutoTrack();                            // must NOT resurrect it
  return { ...off, afterAuto: game.qnav, shown: window.__read().shown };
});
check(dismissed.qnav === null, 'E past the end switches the guide off', dismissed);
check(dismissed.optOut === true, 'and records the opt-out', dismissed);
check(dismissed.afterAuto === null, 'auto-track respects the opt-out', dismissed);
check(dismissed.shown === false, 'a dismissed guide is hidden', dismissed);

// 5. E brings it back, and the opt-out survives a save.
await page.keyboard.press('e');
const back = await page.evaluate(() => ({
  qnav: game.qnav,
  optOut: !!game._qnavOptOut,
  saved: typeof GAME_SAVE_FIELDS !== 'undefined' && GAME_SAVE_FIELDS.includes('_qnavOptOut'),
}));
check(!!back.qnav, 'E brings the guide back after dismissing', back);
check(back.optOut === false, 'and clears the opt-out', back);
check(back.saved, '_qnavOptOut is persisted (a dismissal must outlive a reload)', back);

// 6. E must not fire while the player is typing — party codes and character
// names both contain the letter e, and a guide that jumps mid-word is a bug.
await page.evaluate(() => {
  const i = document.createElement('input');
  i.id = '__typing_probe';
  document.body.appendChild(i);
  i.focus();
  window.__beforeType = game.qnav;
});
await page.keyboard.press('e');
const typed = await page.evaluate(() => {
  const el = document.getElementById('__typing_probe');
  const v = el ? el.value : '';
  if (el) el.remove();
  return { before: window.__beforeType, after: game.qnav, typedValue: v };
});
check(typed.after === typed.before, 'typing "e" in an input does not cycle the guide', typed);
check(typed.typedValue === 'e', 'and the character still reaches the field', typed);

check(errs.length === 0, 'no page errors', errs);
console.log(bad ? `\n${bad} FAILED` : '\nall green');
await browser.close();
process.exit(bad ? 1 : 0);
