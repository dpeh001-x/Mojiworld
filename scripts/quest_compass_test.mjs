// Quest compass: it draws only when tracking, points at the right thing, is
// pruned when the quest ends, and survives a save round-trip.
//
// The draw itself is verified by COUNTING REAL ctx CALLS through a proxy —
// asserting "the function ran without throwing" would pass on a function that
// draws nothing, which is the failure mode that matters here.
// Run: node scripts/quest_compass_test.mjs [file.html]
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
await page.waitForFunction(() => typeof _qnavDrawCompass === 'function' && typeof renderQuestJournal === 'function', { timeout: 60000 });
await page.evaluate(() => {
  const card = document.querySelector('#class-select-modal .cls-card');
  if (card && !player.cls) { try { card.click(); } catch (e) {} }
  const gate = document.getElementById('class-select-modal');
  if (gate) gate.style.display = 'none';
  game.paused = false;
  player.level = 40;
  if (typeof tickQuestUnlocks === 'function') tickQuestUnlocks();
  // Count draw calls made by the compass, not by the rest of the frame.
  window.__tally = () => {
    const n = { fillText: 0, fill: 0, stroke: 0, fillRect: 0 };
    const keep = {};
    for (const k of Object.keys(n)) { keep[k] = ctx[k]; ctx[k] = function (...a) { n[k]++; return keep[k].apply(ctx, a); }; }
    try { _qnavDrawCompass(); } finally { for (const k of Object.keys(n)) ctx[k] = keep[k]; }
    return n;
  };
});

// Not tracking -> draws nothing at all.
const off = await page.evaluate(() => { game.qnav = null; return window.__tally(); });
check(Object.values(off).every((v) => v === 0), 'draws nothing while not tracking', off);

// Tracking a same-map NPC quest -> draws, and the banner names that NPC.
const on = await page.evaluate(() => {
  // pick a quest whose giver stands on the map we are standing on
  let qid = null;
  for (const k in QUESTS) {
    const d = (() => { try { return _qnavDest(k); } catch (_e) { return null; } })();
    if (d && d.kind === 'npc' && d.map === game.currentMap) { qid = k; break; }
  }
  if (!qid) qid = Object.keys(QUESTS)[0];
  game.qnav = qid;
  const d = _qnavDest(qid);
  const texts = [];
  const keep = ctx.fillText;
  ctx.fillText = function (t, ...a) { texts.push(String(t)); return keep.apply(ctx, [t, ...a]); };
  try { _qnavDrawCompass(); } finally { ctx.fillText = keep; }
  return { qid, sameMap: d && d.map === game.currentMap, who: d && d.who, texts, tally: window.__tally() };
});
console.log(`tracking ${on.qid} (same map: ${on.sameMap}) — drew: ${JSON.stringify(on.texts)}`);
check(on.tally.fillText > 0, 'draws text while tracking', on.tally);
check(on.tally.fill > 0 || on.tally.fillRect > 0, 'draws the banner shape', on.tally);
check(on.texts.some((t) => t.includes(on.who)), 'the banner names the destination', { who: on.who, texts: on.texts });
check(on.texts.some((t) => t.includes('🧭')), 'the banner carries the compass glyph', on.texts);

// Off-map target -> the banner must mention the next hop, not just the goal.
const far = await page.evaluate(() => {
  let qid = null, dd = null;
  for (const k in QUESTS) {
    const d = (() => { try { return _qnavDest(k); } catch (_e) { return null; } })();
    if (d && d.map !== game.currentMap && d.hops > 0) { qid = k; dd = d; break; }
  }
  if (!qid) return { skipped: true };
  game.qnav = qid;
  const texts = [];
  const keep = ctx.fillText;
  ctx.fillText = function (t, ...a) { texts.push(String(t)); return keep.apply(ctx, [t, ...a]); };
  try { _qnavDrawCompass(); } finally { ctx.fillText = keep; }
  return { qid, hops: dd.hops, mapName: (MAPS[dd.map] && MAPS[dd.map].name) || dd.map, texts };
});
if (far.skipped) check(false, 'an off-map quest exists to test', far);
else {
  console.log(`off-map ${far.qid} (${far.hops} hops) — drew: ${JSON.stringify(far.texts)}`);
  check(far.texts.some((t) => t.includes(far.mapName)), 'names the destination map', far);
  check(far.texts.some((t) => /next:/.test(t)), 'names the next hop to walk to', far.texts);
}

// Pruning: completing the quest must drop the target.
const pruned = await page.evaluate(() => {
  const qid = game.qnav;
  player.quests.completed[qid] = true;
  delete player.quests.active[qid];
  delete player.quests.unlocked[qid];
  _qnavPrune();
  const after = game.qnav;
  const tally = window.__tally();
  delete player.quests.completed[qid];
  return { after, tally };
});
check(pruned.after === null, 'a completed quest stops being tracked', pruned.after);
check(Object.values(pruned.tally).every((v) => v === 0), 'and the compass goes quiet', pruned.tally);

// Persistence: qnav must be in the save allowlist.
const saved = await page.evaluate(() => ({
  inList: typeof GAME_SAVE_FIELDS !== 'undefined' && GAME_SAVE_FIELDS.includes('qnav'),
}));
check(saved.inList, 'qnav is in GAME_SAVE_FIELDS (survives reload)', saved);

check(errs.length === 0, 'no page errors', errs);
console.log(bad ? `\n${bad} FAILED` : '\nall green');
await browser.close();
process.exit(bad ? 1 : 0);
