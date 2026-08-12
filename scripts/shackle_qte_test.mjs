// Shackle QTE: fast taps are never dropped, and photo mode is not a shelter.
//
// The tap test presses AND releases inside a single sim step — the exact case
// the old polled edge-detector could not see. The photo-mode test parks the
// game in the camera and requires the shackle clock to keep draining.
// Run: node scripts/shackle_qte_test.mjs [file.html]
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
await page.waitForFunction(() => typeof _QTE !== 'undefined' && typeof _qteFrame === 'function', { timeout: 60000 });
await page.evaluate(() => {
  const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
  window._lxBootGateDone = true;
  const c = document.querySelector('#class-select-modal .cls-card');
  if (c && !player.cls) { try { c.click(); } catch (e) {} }
  const g = document.getElementById('class-select-modal'); if (g) g.style.display = 'none';
  game.paused = false; player.level = 40; player._god = false;
});
await page.evaluate(() => { try { loadMap('slimeCave'); } catch (_e) {} });
await page.waitForTimeout(5000);

// Start a real shackle from a real boss.
const started = await page.evaluate(() => {
  const king = (game.monsters || []).find((m) => m && m.type === 'king' && !m.dead);
  if (!king) return { noBoss: true };
  player.x = king.x + 20; player.hp = Math.max(player.hp, 500);
  _qteShackleStart(king);
  return { active: !!_QTE.active, seq: (_QTE.seq || []).slice(), remain: Math.round(_QTE.remain) };
});
check(!started.noBoss && started.active, 'a real shackle can be started from the boss', started);
if (started.noBoss || !started.active) { console.log('\ncannot proceed'); await browser.close(); process.exit(1); }
console.log(`shackle started: seq ${JSON.stringify(started.seq)} remain ${started.remain}ms`);

// ---- 1. sub-frame taps ----------------------------------------------------
// Dispatch keydown+keyup back to back with no frame in between, for the exact
// keys the sequence wants. A poll-only reader sees game.keys false every time.
const tap = await page.evaluate(async () => {
  const seq = _QTE.seq.slice();
  const before = _QTE.idx;
  for (const key of seq) {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: key.replace('arrow', 'Arrow').replace('Arrowleft', 'ArrowLeft').replace('Arrowright', 'ArrowRight').replace('Arrowup', 'ArrowUp').replace('Arrowdown', 'ArrowDown'), bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keyup', { key: key.replace('arrow', 'Arrow').replace('Arrowleft', 'ArrowLeft').replace('Arrowright', 'ArrowRight').replace('Arrowup', 'ArrowUp').replace('Arrowdown', 'ArrowDown'), bubbles: true }));
    if (!_QTE.active) break;                      // solved mid-loop
  }
  const queued = _QTE.queue ? _QTE.queue.length : -1;
  // now let ONE frame process them
  const stillActive = _QTE.active;
  if (stillActive) _qteFrame(16, false);
  return { before, queued, idx: _QTE.idx, active: _QTE.active, seqLen: seq.length };
});
console.log(`sub-frame taps: queued ${tap.queued}, idx ${tap.before} -> ${tap.idx}, active ${tap.active}`);
check(tap.queued !== -1, 'presses are captured at the event, not only polled', tap);
check(!tap.active || tap.idx > tap.before, 'a tap that starts and ends inside one frame still counts', tap);

// ---- 2. photo mode must not park the clock --------------------------------
const photo = await page.evaluate(async () => {
  const king = (game.monsters || []).find((m) => m && m.type === 'king' && !m.dead);
  if (!_QTE.active) { player.hp = Math.max(player.hp, 500); _qteShackleStart(king); }
  const r0 = _QTE.remain;
  game._photoMode = true;
  await new Promise((r) => setTimeout(r, 1200));
  const r1 = _QTE.remain;
  game._photoMode = false;
  return { r0: Math.round(r0), r1: Math.round(r1), drained: Math.round(r0 - r1), active: _QTE.active };
});
console.log(`photo mode: remain ${photo.r0} -> ${photo.r1} (drained ${photo.drained}ms over ~1200ms)`);
check(photo.drained > 400, 'the shackle clock keeps draining inside photo mode', photo);

check(errs.length === 0, 'no page errors', errs);
console.log(bad ? `\n${bad} FAILED` : '\nall green');
await browser.close();
process.exit(bad ? 1 : 0);
