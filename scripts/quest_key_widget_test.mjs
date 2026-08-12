// The quest-guide widget as a DOM element: homed under the HP HUD, compact,
// draggable, position persisted, and the two accuracy fixes (vertical distance
// counted; "no heading" no longer masquerades as "arrived").
// Run: node scripts/quest_key_widget_test.mjs [file.html]
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
await page.waitForFunction(() => typeof _qnavDrawKey === 'function' && typeof _qnavHeading === 'function', { timeout: 60000 });
await page.evaluate(() => {
  const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
  window._lxBootGateDone = true;                       // the loop bails until the overlay fades
  const card = document.querySelector('#class-select-modal .cls-card');
  if (card && !player.cls) { try { card.click(); } catch (e) {} }
  const gate = document.getElementById('class-select-modal'); if (gate) gate.style.display = 'none';
  game.paused = false; player.level = 40;
  game.qnav = null; game._qnavOptOut = false; game._qnavKeyPos = null;
  if (typeof tickQuestUnlocks === 'function') tickQuestUnlocks();
});
await page.waitForTimeout(3000);
// The element is created lazily on the first draw with a target set, so drive
// both explicitly rather than hoping an idle tick does it.
await page.evaluate(() => { _qnavAutoTrack(); _qnavDrawKey(); });
await page.waitForTimeout(200);

// ---- it exists, is visible, and is genuinely compact ----------------------
const geo = await page.evaluate(() => {
  const el = document.getElementById('qnav-key');
  const hud = document.getElementById('stats');
  if (!el || !hud) return { missing: !el ? 'widget' : 'hud' };
  const r = el.getBoundingClientRect(), h = hud.getBoundingClientRect();
  const cs = getComputedStyle(el);
  return {
    w: Math.round(r.width), h: Math.round(r.height), left: Math.round(r.left), top: Math.round(r.top),
    hudLeft: Math.round(h.left), hudBottom: Math.round(h.bottom), hudRight: Math.round(h.right),
    display: cs.display, position: cs.position,
    text: (el.textContent || '').replace(/\s+/g, ' ').trim(),
    qnav: game.qnav,
  };
});
console.log(`widget ${geo.w}x${geo.h} at (${geo.left},${geo.top}) | HUD bottom ${geo.hudBottom}, left ${geo.hudLeft} | "${geo.text}"`);
check(!geo.missing, 'the widget element exists', geo);
// Abort here rather than let the rest pass vacuously on undefined — the first
// run of this suite reported "is displayed" as a PASS while the element did
// not exist at all, because `undefined !== 'none'`.
if (geo.missing) { console.log('\nwidget missing — aborting'); await browser.close(); process.exit(1); }
check(geo.display === 'flex', 'and is displayed once a quest is tracked', geo.display);
check(geo.position === 'fixed', 'it is viewport-positioned (drag-friendly)', geo.position);
check(geo.h > 0 && geo.h <= 40, 'compact: 40px tall or less', geo.h);
check(geo.w > 0 && geo.w <= 200, 'compact: 200px wide or less', geo.w);

// ---- default home: under the HP HUD, aligned to its left edge -------------
check(Math.abs(geo.left - geo.hudLeft) <= 4, 'left-aligned with the HP HUD', { widget: geo.left, hud: geo.hudLeft });
check(geo.top >= geo.hudBottom && geo.top <= geo.hudBottom + 24, 'sits directly UNDER the HP HUD', { top: geo.top, hudBottom: geo.hudBottom });

// ---- draggable, clamped, and remembered ----------------------------------
const drag = await page.evaluate(async () => {
  const el = document.getElementById('qnav-key');
  const r0 = el.getBoundingClientRect();
  const send = (type, x, y) => el.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerId: 1, bubbles: true, cancelable: true }));
  send('pointerdown', r0.left + 10, r0.top + 10);
  send('pointermove', r0.left + 310, r0.top + 210);
  send('pointerup', r0.left + 310, r0.top + 210);
  const r1 = el.getBoundingClientRect();
  return { from: [Math.round(r0.left), Math.round(r0.top)], to: [Math.round(r1.left), Math.round(r1.top)], saved: game._qnavKeyPos };
});
console.log(`drag ${JSON.stringify(drag.from)} -> ${JSON.stringify(drag.to)}`);
check(drag.to[0] > drag.from[0] + 250 && drag.to[1] > drag.from[1] + 150, 'pointer drag moves the widget', drag);
check(!!drag.saved && Number.isFinite(drag.saved.fx), 'the dragged position is recorded as viewport fractions', drag.saved);

const clamp = await page.evaluate(() => {
  _qnavKeyPlace(99999, 99999, true);
  const r = document.getElementById('qnav-key').getBoundingClientRect();
  return { right: Math.round(r.right), bottom: Math.round(r.bottom), vw: window.innerWidth, vh: window.innerHeight };
});
check(clamp.right <= clamp.vw && clamp.bottom <= clamp.vh, 'a wild drag is clamped inside the viewport', clamp);

const persisted = await page.evaluate(() => ({
  inSave: typeof GAME_SAVE_FIELDS !== 'undefined' && GAME_SAVE_FIELDS.includes('_qnavKeyPos'),
}));
check(persisted.inSave, '_qnavKeyPos is in GAME_SAVE_FIELDS (survives reload)', persisted);

// ---- accuracy 1: vertical distance counts --------------------------------
// The old widget measured |dx| only, so a target straight up read 0 and said
// "arrived". Stand directly below it and require a real distance.
const vert = await page.evaluate(() => {
  const d = _qnavDest(game.qnav);
  const h = _qnavHeading(d);
  if (!h) return { skipped: true };
  const px = player.x, py = player.y;
  player.x = h.x; player.y = h.y + 400;          // directly below, a real climb
  _qnavDrawKey();
  const sub = document.querySelector('#qnav-key .qk-t i').textContent;
  player.x = px; player.y = py;
  return { sub, h };
});
if (vert.skipped) check(false, 'a heading exists to test vertical distance', vert);
else {
  console.log(`standing 400px below the target -> "${vert.sub}"`);
  check(!/arrived/.test(vert.sub), 'a target 400px above is NOT reported as arrived', vert.sub);
  check(/\d+m/.test(vert.sub), 'it reports a real distance', vert.sub);
  check(/[↑▲]/.test(vert.sub), 'and flags that the target is above', vert.sub);
}

// ---- accuracy 2: "no heading" is distinct from "arrived" -----------------
const noHead = await page.evaluate(() => {
  // a hunt quest whose monsters are not spawned here yields no heading
  const qid = Object.keys(QUESTS).find((k) => {
    let d = null; try { d = _qnavDest(k); } catch (_e) {}
    return d && !_qnavHeading(d);
  });
  if (!qid) return { skipped: true };
  const prev = game.qnav;
  game.qnav = qid; _LX_QC.qid = null;             // bust the 300ms dest cache
  _qnavDrawKey();
  const el = document.getElementById('qnav-key');
  const out = { glyph: el.querySelector('.qk-a').textContent, sub: el.querySelector('.qk-t i').textContent };
  game.qnav = prev; _LX_QC.qid = null;
  return out;
});
if (noHead.skipped) console.log('  (no heading-less quest available to test)');
else {
  console.log(`no-heading state -> "${noHead.glyph}" / "${noHead.sub}"`);
  check(noHead.glyph !== '◆', 'a target with no heading does not show the "arrived" glyph', noHead);
  check(!/arrived/.test(noHead.sub), 'and does not claim you arrived', noHead);
}

// ---- it hides again when the guide is off --------------------------------
const off = await page.evaluate(() => {
  game.qnav = null;
  _qnavDrawKey();
  return getComputedStyle(document.getElementById('qnav-key')).display;
});
check(off === 'none', 'the widget hides when nothing is tracked', off);

check(errs.length === 0, 'no page errors', errs);
console.log(bad ? `\n${bad} FAILED` : '\nall green');
await browser.close();
process.exit(bad ? 1 : 0);
