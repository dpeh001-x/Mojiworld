// The quest pin lands ON SCREEN where its target is drawn, per user: "make sure
// the pin issue is properly addressed, the quest pin always is inaccurate".
//
// The defect this guards: _qnavDrawCompass runs inside the frame loop's
// vertical-scroll translate (ctx.translate(0, -camera.y)) yet subtracts
// camera.y again itself, so the pin and its card drew camera.y px too high on
// every vertically-scrolling map — and exactly right on flat ones, which is why
// it read as map-specific. Measured on Honeycomb Hollow: fillText argument
// y 426, device y -2514, camY 2940.
//
// A world-coordinate audit CANNOT catch this — quest_pin_heading_test passed
// throughout, because the heading really was correct; only the draw was not.
// So this test hooks fillText and grades the pin's DEVICE position, transform
// included, against the target's drawn position.
// Run: node scripts/quest_pin_screenspace_test.mjs [file.html]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const URL = 'file:///' + path.join(ROOT, args[0] || 'mojiworld_game.html').split(path.sep).join('/');
const browser = await chromium.launch({ channel: 'chrome', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
let bad = 0;
const check = (ok, label, detail) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail !== undefined ? '  — ' + JSON.stringify(detail) : ''}`); if (!ok) bad++; };

await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof loadMap === 'function', { timeout: 90000 });
const measure = (mapId, standX, standY) => page.evaluate(async (a) => {
  const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
  window._lxBootGateDone = true;
  const c = document.querySelector('#class-select-modal .cls-card');
  if (c && !player.cls) { try { c.click(); } catch (e) {} }
  const g = document.getElementById('class-select-modal'); if (g) g.style.display = 'none';
  player.level = 99;
  loadMap(a.mapId);
  await new Promise((res) => setTimeout(res, 900));
  // Track a genuinely ACTIVE quest with an off-map destination —
  // _qnavLiveDest clears game.qnav for anything else and nothing draws.
  let qid = null;
  for (const id in QUESTS) {
    const q = QUESTS[id];
    if (!q || q.cls || (q.levelReq || 1) > 99 || q.kind !== 'kill') continue;
    try {
      delete player.quests.completed[id];
      acceptQuest(id);
      if (!player.quests.active[id]) continue;
      const d0 = _qnavDest(id);
      if (d0 && d0.map !== a.mapId) { qid = id; break; }
      delete player.quests.active[id];
    } catch (e) {}
  }
  if (!qid) return { noQuest: true };
  game.qnav = qid;
  const h = _qnavHeading(_qnavDest(qid));
  if (!h) return { noHeading: true, qid };
  const hits = [];
  const orig = CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText = function (t, x, y, ...rest) {
    if (t === '📍') {
      const m = this.getTransform();
      hits.push({ devY: m.d * y + m.f, devX: m.a * x + m.e,
                  camY: (game.camera && game.camera.y) || 0 });
    }
    return orig.call(this, t, x, y, ...rest);
  };
  game.paused = false;
  for (let i = 0; i < 70; i++) {
    player.x = a.standX; player.y = a.standY; player.vx = 0; player.vy = 0;
    await new Promise((res) => requestAnimationFrame(res));
  }
  CanvasRenderingContext2D.prototype.fillText = orig;
  const last = hits[hits.length - 1];
  if (!last) return { qid, heading: h, samples: 0 };
  // Where the target is DRAWN: x inline (x - camera.x), y via the world
  // translate — so its device position is (h.x - camX, h.y - camY) and the pin
  // belongs 34px above that, give or take the ±3px bob.
  const camX = (game.camera && game.camera.x) || 0;
  return {
    qid, samples: hits.length,
    camY: Math.round(last.camY),
    errY: Math.round(last.devY - (h.y - last.camY - 34)),
    errX: Math.round(last.devX - (h.x - camX)),
  };
}, { mapId, standX, standY });

// Vertical map, camera scrolled deep — where the bug lived.
const vert = await measure('honeycombHollow', 600, 3300);
// Flat map — where it never showed; guards against a fix that breaks the easy case.
const flat = await measure('forest', 1700, 400);
await browser.close();

console.log(`  honeycombHollow: ${JSON.stringify(vert)}`);
console.log(`  forest:          ${JSON.stringify(flat)}`);

check(!vert.noQuest && !vert.noHeading && vert.samples > 0, 'the pin drew on the vertical map', vert);
check(vert.camY > 1000, 'with the camera genuinely scrolled down (the failing condition)', vert.camY);
check(Math.abs(vert.errY) <= 6, 'vertical map: the pin sits on its target ON SCREEN (was ~2940px high)', vert.errY);
check(Math.abs(vert.errX) <= 6, 'vertical map: x is right too', vert.errX);
check(!flat.noQuest && flat.samples > 0, 'the pin drew on the flat map', flat);
check(Math.abs(flat.errY) <= 6, 'flat map: still exact (the case that always worked)', flat.errY);
check(errs.length === 0, 'no page errors', [...new Set(errs)].slice(0, 3));
console.log(bad ? `\n${bad} FAILED` : '\nall green');
process.exit(bad ? 1 : 0);
