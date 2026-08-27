// SHACKLED — the world map is neither a shelter nor an exit.
// ============================================================================
// Per user: "can escape being chained by opening the world map".
//
// Two holes, and closing either alone left the escape intact:
//   PARKED     opening a panel sets game.paused; the shackle QTE ticks from the
//              update loop, so the SHACKLED card sat with a stopped clock. Same
//              class v0.29.610 named for photo mode ("not a shelter").
//   CANCELLED  the map offers fast travel, and loadMap ends an active QTE with
//              _qteEnd(false) — so you left and the shackle was voided.
//
// The checks drive the REAL entry point, toggleWorldMap(), because that is what
// the W key, the HUD button and the quest auto-open all call — a guard on the
// key alone would have moved the hole rather than closed it.
// Run: node scripts/shackle_worldmap_test.mjs
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 10801);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`,
  { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'Chained');
await page.evaluate(() => {
  const m = document.getElementById('class-select-modal');
  for (const el of m.querySelectorAll('button,div,li')) {
    if (el.children.length > 3) continue;
    if (getComputedStyle(el).display === 'none') continue;
    if (/^\s*warrior\s*$/i.test((el.textContent || '').trim())) { el.click(); return; }
  }
});
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);
await page.evaluate(() => { player.level = 60; player._god = true; loadMap('forest', 300); });
await page.waitForTimeout(4500);

const R = await page.evaluate(async () => {
  const frame = () => new Promise(r => requestAnimationFrame(r));
  const out = { hasGuard: typeof _lxShackledBlocksMap === 'function' };
  const modal = () => document.getElementById('worldmap-modal');
  const isOpen = () => !!(modal() && modal().style.display === 'flex');
  const close = async () => {
    if (isOpen()) { toggleWorldMap(); await frame(); }
    game.paused = false;
  };
  // godmode is exempt from every CC gate in the file, so it must be OFF here
  player._god = false;
  player.hp = getMaxHp();
  await close();

  // --- CONTROL: unshackled, the map opens normally -------------------------
  _QTE.active = false;
  toggleWorldMap(); await frame();
  out.openUnshackled = isOpen();
  await close();
  out.closedAgain = !isOpen();

  // --- shackled: it must refuse to OPEN ------------------------------------
  // Started through the REAL entry point. Hand-setting _QTE.active with an
  // empty seq does not make a valid shackle: idx >= seq.length reads as
  // "sequence complete", so the game legitimately ended it and the test then
  // blamed the guard for letting the shackle lapse.
  out.startedReal = false;
  if (typeof _qteShackleStart === 'function') {
    _qteShackleStart(game.monsters && game.monsters[0] ? game.monsters[0] : { superBoss: false });
    out.startedReal = !!_QTE.active;
    out.seqLen = (_QTE.seq || []).length;
  }
  const pausedBefore = game.paused;
  toggleWorldMap(); await frame();
  out.openWhileShackled = isOpen();
  out.pausedByAttempt = game.paused && !pausedBefore;
  out.stillShackled = !!_QTE.active;

  // NOT EXERCISED HERE: the second guard, which refuses fast TRAVEL while
  // shackled, lives in an inline predicate inside the W-map render config and
  // is not reachable from outside it. It is belt-and-braces anyway — with the
  // open gate above, a map cannot be open when a shackle lands, because the
  // sim is paused while it is. Recorded plainly rather than faked with a probe
  // that measures something else.

  // --- CONTROL: closing is never blocked -----------------------------------
  // Force it open behind the guard's back, then confirm the guard lets it shut.
  _QTE.active = false;
  toggleWorldMap(); await frame();
  const wasOpen = isOpen();
  if (typeof _qteShackleStart === 'function') _qteShackleStart({ superBoss: false });
  toggleWorldMap(); await frame();
  out.canCloseWhileShackled = wasOpen && !isOpen();

  _QTE.active = false; player._god = true;
  await close();
  return out;
});
await browser.close(); server.kill();

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 210) });

console.log(`  guard present: ${R.hasGuard}   real shackle started: ${R.startedReal} (seq ${R.seqLen})`);
console.log(`  unshackled -> opens ${R.openUnshackled}, closes ${R.closedAgain}`);
console.log(`  shackled   -> opens ${R.openWhileShackled}, paused by the attempt ${R.pausedByAttempt}, still shackled ${R.stillShackled}`);
console.log(`  close while shackled -> ${R.canCloseWhileShackled}`);

ok('the shackle guard exists', R.hasGuard, '_lxShackledBlocksMap');
ok('CONTROL: a REAL shackle was started', R.startedReal === true && (R.seqLen | 0) > 0,
   `_qteShackleStart gave a ${R.seqLen}-key sequence; a hand-set flag with an empty seq is not a shackle`);
ok('CONTROL: the map still opens when you are free', R.openUnshackled === true,
   'a guard that blocked everything would pass the next check for the wrong reason');
ok('CONTROL: and closes again', R.closedAgain === true);
ok('SHACKLED: the map refuses to open', R.openWhileShackled === false,
   'this is the shelter half — opening pauses the sim and parks the QTE clock');
ok('...and the attempt does not pause the game', !R.pausedByAttempt,
   'a refused open that still paused would park the clock anyway');
ok('...and the shackle survives the attempt', R.stillShackled === true,
   'the escape was that loadMap ends an active QTE with _qteEnd(false)');
ok('CONTROL: closing is never blocked', R.canCloseWhileShackled === true,
   'the guard sits below the close branch precisely so it cannot trap the panel open');

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
