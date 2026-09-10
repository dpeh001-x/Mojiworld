// v0.30.x — Five UI / input findings from a parallel audit.
//   1. closeDialog released the pause unconditionally (every sibling asks who else is open).
//   2. Seven surfaces the pause registry treats as blocking were absent from the pad registry.
//   3. The Cure / Pickup rebinds accepted keys another action already owned, and persisted them.
//   4. The boss-intro skip listeners were attached once and never removed.
//   5. The gamepad poller ran a second rAF chain at display refresh, out-running the 60 Hz sim.
//
//   node scripts/ui_input_guard_test.mjs [file.html] [port]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 11257);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(10000);
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'Ui');
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

const r = await page.evaluate(() => {
  const out = {};
  const key = (k) => new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true });

  // ---- 1. a dialog closing over an open modal must NOT release the pause
  const qm = document.getElementById('quest-modal');
  out.hasQuestModal = !!qm;
  if (qm) {
    qm.style.display = 'flex'; game.paused = true;
    closeDialog();
    out.stillPausedUnderJournal = !!game.paused;
    qm.style.display = 'none';
    // this harness boots with a story-beat overlay live, which is a legitimate pause owner -
    // so assert RECONCILIATION (pause == whatever else is open), not an unconditional release
    game.paused = true; closeDialog();
    out.pauseReconciled = (game.paused === ((typeof _anyOtherModalOpen === 'function') ? !!_anyOtherModalOpen() : false));
    out.otherOwners = (typeof _lxPauseOwners === 'function') ? _lxPauseOwners().map((e) => e.id || e.className || '?') : [];
  }

  // ---- 2. the pad registry lists what the pause registry lists
  const need = ['reforge-modal', 'bravo-boon-modal', 'exp-door-modal', 'exp-puzzle-modal', 'exp-seed-modal', 'everdawn-welcome-overlay', 'game-complete-overlay'];
  out.padMissing = need.filter((id) => _LX_PAD_MODAL_IDS.indexOf(id) < 0);

  // ---- 3. rebinding Pickup / Cure onto Move Left is refused and nothing is persisted
  const ik0 = player.interactKey, ck0 = player.cureKey;
  _interactKeyPickup = true; document.dispatchEvent(key('ArrowLeft'));
  out.interactAfterArrow = player.interactKey; out.interactPickupCleared = !_interactKeyPickup;
  _cureKeyPickup = true; document.dispatchEvent(key('ArrowLeft'));
  out.cureAfterArrow = player.cureKey; out.curePickupCleared = !_cureKeyPickup;
  // ...while a harmless key still binds
  _interactKeyPickup = true; document.dispatchEvent(key('j'));
  out.interactAfterJ = player.interactKey;
  player.interactKey = ik0; player.cureKey = ck0; _interactKeyPickup = false; _cureKeyPickup = false;
  out.ik0 = ik0; out.ck0 = ck0;
  return out;
});

// 4 + 5 are structural (an intro and a controller are not reachable headlessly)
const html = await (await fetch(`http://localhost:${PORT}/${PAGE}`)).text();
const introRemoved = html.includes("window.removeEventListener('keydown', game._bossIntroDismiss, true)");
const pollCapped = html.includes('now - _lastPoll >= 15.5');

console.log(JSON.stringify({ ...r, introRemoved, pollCapped }));
const checks = [
  ['harness: the quest journal element exists', r.hasQuestModal === true],
  ['closeDialog keeps the pause while the Journal is still open', r.stillPausedUnderJournal === true],
  ['...and reconciles to whatever else is open once the Journal is gone', r.pauseReconciled === true, 'owners: ' + (r.otherOwners || []).join(',')],
  ['every pause-owner surface is in the pad registry', r.padMissing && r.padMissing.length === 0, 'missing: ' + (r.padMissing || []).join(',')],
  ['Pickup refuses Move Left and is not persisted onto it', r.interactAfterArrow !== 'arrowleft' && r.interactPickupCleared === true],
  ['Cure refuses Move Left and is not persisted onto it', r.cureAfterArrow !== 'arrowleft' && r.curePickupCleared === true],
  ['a free key still binds Pickup', r.interactAfterJ === 'j'],
  ['the boss-intro skip listeners are removed when the intro closes', introRemoved === true],
  ['the gamepad poller is capped at the sim cadence', pollCapped === true],
  ['no page errors', errs.length === 0, errs.join(' | ')],
];
let fails = 0;
for (const [n, ok, extra] of checks) { console.log((ok ? 'PASS ' : 'FAIL ') + n + (extra ? '  [' + extra + ']' : '')); if (!ok) fails++; }
console.log(`${checks.length - fails}/${checks.length} passed`);
await browser.close(); server.kill();
process.exit(fails ? 1 : 0);
