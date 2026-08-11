// The compass pin belongs to the TARGET, not the player.
//
// Reproduces the report directly: move the player up and down while the target
// stands still, and require the pin not to move. Then move the TARGET and
// require the pin to follow. Both directions matter — a pin hard-coded to a
// constant would pass the first check on its own.
//
// The drawn position is captured by wrapping ctx.fillText, so this measures
// where the marker actually lands rather than re-deriving the arithmetic.
// Run: node scripts/compass_pin_anchor_test.mjs [file.html]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const URL = 'file:///' + path.join(ROOT, process.argv[2] || 'mojiworld_game.html').split(path.sep).join('/');
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 180)));
let bad = 0;
const check = (ok, label, detail) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail !== undefined ? '  — ' + JSON.stringify(detail) : ''}`); if (!ok) bad++; };

await page.goto(URL + '?dev=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof _qnavDrawCompass === 'function' && typeof loadMap === 'function', { timeout: 60000 });
await page.evaluate(() => {
  const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
  window._lxBootGateDone = true;
  const c = document.querySelector('#class-select-modal .cls-card');
  if (c && !player.cls) { try { c.click(); } catch (e) {} }
  const g = document.getElementById('class-select-modal'); if (g) g.style.display = 'none';
  game.paused = false; player.level = 40;
  if (typeof tickQuestUnlocks === 'function') tickQuestUnlocks();
  try { loadMap('town'); } catch (_e) {}
});
await page.waitForTimeout(8000);

// Track a quest whose destination is an NPC standing on THIS map, so the pin
// has a real on-screen target rather than a portal.
const setup = await page.evaluate(() => {
  game.paused = true;                       // freeze: gravity would undo every y we set
  let qid = null;
  for (const k of _qnavGuideList()) {
    const d = _qnavDest(k);
    if (d && d.kind === 'npc' && d.map === game.currentMap) { qid = k; break; }
  }
  if (!qid) return { skipped: true };
  game.qnav = qid; game._qnavOptOut = false; _LX_QC.qid = null;
  const d = _qnavDest(qid);
  const h = _qnavHeading(d);
  // stand near the target so it is on screen and the PIN branch runs
  player.x = h.x - 60;
  window.__pinY = () => {
    let y = null;
    const keep = ctx.fillText;
    ctx.fillText = function (t, x, yy) { if (String(t) === '📍') y = yy; return keep.apply(ctx, arguments); };
    try { _LX_QC.qid = null; _qnavDrawCompass(); } finally { ctx.fillText = keep; }
    return y;
  };
  return { qid, who: d.who, targetY: h.y, targetX: h.x };
});
if (setup.skipped) { console.log('no same-map NPC destination available'); await browser.close(); process.exit(1); }
console.log(`tracking ${setup.qid} -> ${setup.who} at (${Math.round(setup.targetX)}, ${Math.round(setup.targetY)})`);

// ---- 1. the player jumps; the pin must not -------------------------------
const jump = await page.evaluate(() => {
  const out = {};
  player.y = 400; out.standing = window.__pinY();
  player.y = 400 - 160; out.jumping = window.__pinY();      // a big hop
  player.y = 400 + 120; out.below = window.__pinY();
  player.y = 400;
  return out;
});
console.log(`pin y — player standing ${jump.standing}, mid-jump ${jump.jumping}, lower ${jump.below}`);
// Tolerance, not equality: the pin BOBS on purpose (sin, ±3 px), and each
// __pinY() call advances that animation one step. Demanding pixel-freeze would
// be asserting the bob away. 8 px comfortably covers the full bob swing while
// staying far below the 280 px the bug produced.
const BOB = 8;
const swing = Math.max(Math.abs(jump.jumping - jump.standing), Math.abs(jump.below - jump.standing));
console.log(`player moved 280px vertically -> pin moved ${swing.toFixed(2)}px`);
check(jump.standing !== null, 'the pin is actually drawn (the on-screen branch ran)', jump);
check(Math.abs(jump.jumping - jump.standing) < BOB, 'the pin does NOT ride the player upward on a jump', jump);
check(Math.abs(jump.below - jump.standing) < BOB, 'nor downward when the player drops', jump);

// ---- 2. the target moves; the pin must follow ----------------------------
const follow = await page.evaluate(() => {
  const d = _qnavDest(game.qnav);
  const npc = (game.npcs || []).find((n) => n && n.name === d.who);
  if (!npc) return { skipped: true };
  const y0 = npc.y;
  const a = window.__pinY();
  npc.y = y0 - 100;
  const b = window.__pinY();
  npc.y = y0;
  return { a, b, moved: b !== null && a !== null ? a - b : null };
});
if (follow.skipped) check(false, 'the target NPC is in game.npcs', follow);
else {
  console.log(`target raised 100px -> pin y ${follow.a} -> ${follow.b}`);
  check(follow.b !== follow.a, 'the pin DOES move when the target moves', follow);
  check(Math.abs(follow.moved - 100) <= 8, 'and by the same amount the target moved (bob-tolerant)', follow);
}

check(errs.length === 0, 'no page errors', errs);
console.log(bad ? `\n${bad} FAILED` : '\nall green');
await browser.close();
process.exit(bad ? 1 : 0);
