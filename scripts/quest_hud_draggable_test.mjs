// Every floating quest indicator can be picked up and moved, per user:
// "floating quest indicator should be draggable and movable".
//
// The QUESTS tracker already could. The two quest PINS could not: neither was
// registered with the HUD drag module, and both were `pointer-events: none`, so
// a press fell through to the canvas.
//
// This drives the REAL mouse at real screen coordinates, so hit-testing decides
// what receives the press. Dispatching a PointerEvent straight at the element
// would pass on the old build too — it bypasses exactly the thing that was
// broken. It also dismisses any story-beat cutscene first: that overlay is
// SUPPOSED to eat clicks while it is up, and leaving it on makes a healthy HUD
// look broken (it did, in the first version of this check).
// Run: node scripts/quest_hud_draggable_test.mjs [file.html]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const URL = 'file:///' + path.join(ROOT, args[0] || 'mojiworld_game.html').split(path.sep).join('/');
const browser = await chromium.launch({ channel: 'chrome', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
let bad = 0;
const check = (ok, label, detail) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail !== undefined ? '  — ' + JSON.stringify(detail) : ''}`); if (!ok) bad++; };

await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof loadMap === 'function' && typeof acceptQuest === 'function', { timeout: 90000 });
await page.evaluate(() => {
  const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
  window._lxBootGateDone = true;
  const c = document.querySelector('#class-select-modal .cls-card');
  if (c && !player.cls) { try { c.click(); } catch (e) {} }
  const g = document.getElementById('class-select-modal'); if (g) g.style.display = 'none';
  player.level = 40;
  // A PQ map with the Stage 1 quest live, so the PQ objective pin renders for
  // real. Forcing display:block instead does not hold — its own renderer runs
  // on the game loop and hides it again the moment it sees no PQ quest.
  loadMap('clockworkUnderpassLobby');
  delete player.quests.completed.q_clockwork_underpass;
  acceptQuest('q_clockwork_underpass');
  for (const id in QUESTS) {
    if ((QUESTS[id].levelReq || 1) <= 40 && !QUESTS[id].cls) { acceptQuest(id); break; }
  }
  if (typeof renderQuestTracker === 'function') renderQuestTracker();
  if (typeof _renderPqObjectivePin === 'function') _renderPqObjectivePin();
});
await page.waitForTimeout(2500);
await page.evaluate(() => {
  const ov = document.getElementById('story-beat-overlay');
  if (ov) ov.classList.remove('on');
  for (const m of document.querySelectorAll('.modal-overlay')) {
    if (getComputedStyle(m).display !== 'none') m.style.display = 'none';
  }
  // The PQ pin is live from real quest state above. The expedition pin needs a
  // whole Tower run to appear, so it alone is forced — nothing re-renders it
  // without an active expedition, so the forced state holds for the test.
  const ex0 = document.getElementById('expedition-quest-pin');
  if (ex0) {
    if (!ex0.innerHTML.trim()) ex0.innerHTML = '<span style="display:block;padding:4px 8px;">TEST OBJECTIVE</span>';
    ex0.style.display = 'block';
  }
  // Stack them apart so one does not sit on top of the other during the test.
  const ex = document.getElementById('expedition-quest-pin');
  if (ex) ex.style.top = '220px';
});
await page.waitForTimeout(250);

const TARGETS = ['quest-tracker', 'pq-objective-pin', 'expedition-quest-pin'];
const results = {};
for (const id of TARGETS) {
  const info = await page.evaluate((id) => {
    const el = document.getElementById(id);
    if (!el) return { missing: true };
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (cs.display === 'none' || r.width < 4) return { hidden: true, display: cs.display };
    const cx = Math.round(r.left + Math.min(r.width / 2, 60)), cy = Math.round(r.top + 8);
    const hit = document.elementFromPoint(cx, cy);
    return {
      pointerEvents: cs.pointerEvents,
      inDragModule: !!el._hudDraggable,
      rect: { left: Math.round(r.left), top: Math.round(r.top) },
      grab: { cx, cy },
      reachable: !!(hit && el.contains(hit)),
      topEl: hit ? (hit.id || hit.className || hit.tagName) : null,
      title: el.getAttribute('title'),
    };
  }, id);
  if (info.missing || info.hidden) { results[id] = info; continue; }
  await page.mouse.move(info.grab.cx, info.grab.cy);
  await page.mouse.down();
  await page.mouse.move(info.grab.cx + 90, info.grab.cy + 70, { steps: 8 });
  await page.mouse.move(info.grab.cx + 180, info.grab.cy + 140, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(150);
  const after = await page.evaluate((id) => {
    const el = document.getElementById(id);
    const r = el.getBoundingClientRect();
    let saved = null; try { saved = localStorage.getItem('mojiHudPos:' + id); } catch (e) {}
    return { left: Math.round(r.left), top: Math.round(r.top), saved: !!saved };
  }, id);
  info.moved = Math.round(Math.hypot(after.left - info.rect.left, after.top - info.rect.top));
  info.persisted = after.saved;
  // and the position must survive the panel re-rendering itself
  const held = await page.evaluate((id) => {
    const el = document.getElementById(id);
    const before = el.getBoundingClientRect().left;
    if (typeof renderQuestTracker === 'function') renderQuestTracker();
    if (typeof _renderPqObjectivePin === 'function') _renderPqObjectivePin();
    return Math.abs(el.getBoundingClientRect().left - before) < 2;
  }, id);
  info.survivesRerender = held;
  results[id] = info;
}
await browser.close();

for (const id of TARGETS) console.log(`  ${id.padEnd(22)} ${JSON.stringify(results[id])}`);

for (const id of TARGETS) {
  const x = results[id] || {};
  check(!x.missing && !x.hidden, `${id}: is on screen to be grabbed`, x);
  check(x.pointerEvents === 'auto', `${id}: accepts a press (was pointer-events:none on the pins)`, x.pointerEvents);
  check(x.reachable === true, `${id}: the press actually lands on it, not the canvas behind`, x.topEl);
  check(x.inDragModule === true, `${id}: is registered with the HUD drag module`, x.inDragModule);
  check((x.moved | 0) > 50, `${id}: a real mouse drag moves it`, x.moved);
  check(x.persisted === true, `${id}: the new spot is remembered`, x.persisted);
  check(x.survivesRerender === true, `${id}: and survives the panel re-rendering`, x.survivesRerender);
}
check(errs.length === 0, 'no page errors', [...new Set(errs)].slice(0, 3));
console.log(bad ? `\n${bad} FAILED` : '\nall green');
process.exit(bad ? 1 : 0);
