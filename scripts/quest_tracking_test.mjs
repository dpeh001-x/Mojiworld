// QUEST TRACKING — the tracked quest must appear in the HUD tracker.
// ============================================================================
// Reported: "Quest Tracking does not work, I tried to put Nougat Bear and Buzz
// Bee as my tracking quests but it does not show up." The screenshot shows the
// compass working ("Buzzbee — somewhere on this map") while the QUESTS panel
// lists three entirely different quests.
//
// Two faults:
//   1. renderQuestTracker() built its rows from Object.keys(player.quests.active)
//      — acceptance order, first three — and never read game.qnav. Tracking a
//      quest genuinely could not change that panel.
//   2. game.qnav was a single id, so tracking a second quest silently replaced
//      the first. The reporter tracked two and saw neither.
//
// Reproduces the reporter's shape: accept more than three quests, then track
// two of the LATER ones (which acceptance order would never surface), and read
// the rendered HUD.
// Run: node scripts/quest_tracking_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 9327;
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
await page.fill('#hero-name-input', 'QTest');
await page.evaluate(() => {
  const m = document.getElementById('class-select-modal');
  for (const el of m.querySelectorAll('button,div,li')) {
    if (el.children.length > 3) continue;
    if (getComputedStyle(el).display === 'none') continue;
    if (/^\s*mage\s*$/i.test((el.textContent || '').trim())) { el.click(); return; }
  }
});
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);

const R = await page.evaluate(async () => {
  player.level = 99;
  _ensureQuests();
  // Six countable kill quests, accepted in order. The last two stand in for
  // "Nougat Bear" and "Buzz Bee": accepted late, so acceptance order buries them.
  const killIds = Object.keys(QUESTS).filter(id => {
    const q = QUESTS[id];
    return q && q.count && (q.kind === 'kill' || q.kind === 'boss');
  }).slice(0, 6);
  player.quests.active = {};
  for (const id of killIds) player.quests.active[id] = { progress: 0 };
  const late = killIds.slice(-2);          // the two the player will track

  const rowNames = () => {
    const el = document.getElementById('quest-tracker');
    return [...el.querySelectorAll('.qt-name')].map(n => n.textContent.trim());
  };
  const nameOf = (id) => QUESTS[id].name;

  // --- untracked baseline: acceptance order wins -------------------------
  game.qnav = null; game.qnavPins = undefined;
  renderQuestTracker();
  await new Promise(r => setTimeout(r, 120));
  const before = rowNames();

  // --- track the two late quests through the REAL journal button ---------
  // Drive the actual click handler rather than assigning state, so the test
  // exercises the path a player uses.
  try { openQuestJournal(); } catch (e) { try { renderQuestJournal(); } catch (_e) {} }
  await new Promise(r => setTimeout(r, 400));
  let clicked = 0;
  for (const id of late) {
    const btn = document.querySelector(`[data-qtrack="${id}"]`);
    if (btn) { btn.click(); clicked++; }
  }
  await new Promise(r => setTimeout(r, 300));
  renderQuestTracker();
  await new Promise(r => setTimeout(r, 150));
  const after = rowNames();

  const pins = Array.isArray(game.qnavPins) ? game.qnavPins.slice() : null;
  return {
    clicked, lateNames: late.map(nameOf), before, after, pins,
    qnav: game.qnav,
    bothPinned: !!(pins && late.every(id => pins.indexOf(id) >= 0)),
    saveAllowlisted: (typeof GAME_SAVE_FIELDS !== 'undefined') && GAME_SAVE_FIELDS.indexOf('qnavPins') >= 0,
  };
});
await browser.close(); server.kill();

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 130) });

ok('both track buttons were reachable and clicked', R.clicked === 2, `clicked=${R.clicked}`);
ok('untracked, the late quests are NOT shown (acceptance order)',
   !R.lateNames.some(n => R.before.includes(n)),
   `panel=${R.before.join(' | ')}`);
// THE bug: tracking must change what the panel shows.
ok('tracking a quest puts it in the HUD tracker',
   R.lateNames.every(n => R.after.includes(n)),
   `tracked=${R.lateNames.join(' + ')}  panel=${R.after.join(' | ')}`);
ok('BOTH tracked quests survive (tracking is not a single slot)',
   R.bothPinned, `pins=${R.pins ? R.pins.join(',') : 'none'}`);
ok('compass still has a single destination', typeof R.qnav === 'string' && R.qnav.length > 0, `qnav=${R.qnav}`);
ok('pins are persisted through the save allowlist', R.saveAllowlisted);

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
