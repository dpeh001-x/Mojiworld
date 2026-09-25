// The quest HUD: fewer words, bolder, cute.
//
// Per user: "for this quest HUD, can make it less words, bolder, cute". Rendered through the real
// renderQuestTracker with a story pointer, a PQ stage, a multi-objective act quest and 176 unseen quests:
//   1. the header is a number bubble and a keycap - no "new ·"
//   2. the story pointer has no "Next:" and no "see"; the act numeral is a pill; the giver a chip
//   3. "STAGE 1 — The Ticket Rush Lobby" reads [1] "Ticket Rush Lobby"; the full name is the tooltip
//   4. the guide line drops the map subtitle and "Return to" - on the first render AND after the
//      twice-a-second live refresh rewrites it
//   5. a counted quest gets a progress bar at its real fraction, with the count on the bar line
//   6. bolder and rounder: Fredoka names, Nunito 800-900 numbers
//   7. the whole panel spends fewer words than the same quests did before
//   node scripts/quest_hud_cute_test.mjs        (MOJI_GAME_FILE to test a candidate)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require('playwright-core');
const fs = require('node:fs');
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const net = await import('node:net');
const free = (p) => new Promise((r) => { const s = net.createServer(); s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.env.PORT; for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT, env: process.env });
await new Promise((r) => setTimeout(r, 2000));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof renderQuestTracker === 'function' && typeof loadMap === 'function' && typeof QUESTS === 'object', null, { timeout: 180000 });
await page.evaluate(() => {
  try { _lxBootGateDone = true; window._prologueActive = false; window._prologuePending = false; if (typeof _prologueFinish === 'function') _prologueFinish(true); } catch (e) {}
  for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.setProperty('display', 'none', 'important'); }
  document.querySelectorAll('[id^="story-beat"], #lo-stack, #tutorial-modal, #everdawn-welcome-overlay').forEach((e) => e.remove());
  player.cls = 'warrior'; player.level = 30; player.invulnerable = 9e9;
  player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true });
  loadMap('town', 300); game.paused = false;
});
await page.waitForTimeout(2500);

const r = await page.evaluate(async () => {
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  document.querySelectorAll('#lx-pause, #everdawn-welcome-overlay').forEach((e) => e.remove()); game.paused = false;
  _ensureQuests();
  const pq = Object.keys(QUESTS).find((k) => /^STAGE 1 \u2014/i.test(QUESTS[k].name || ''));
  const multi = Object.keys(QUESTS).find((k) => Array.isArray(QUESTS[k].objectives) && QUESTS[k].objectives.length >= 2 && k !== pq);
  for (const k of Object.keys(player.quests.active)) delete player.quests.active[k];
  player.quests.active[pq] = { progress: 19, targetCount: 100 };
  if (multi) player.quests.active[multi] = { progress: 3, objProgress: {} };
  window._lxFreshQuestCount = () => 176;
  renderQuestTracker();
  const el = document.getElementById('quest-tracker');
  const out = { pq, pqName: QUESTS[pq].name };
  const head = el.querySelector('.qt-head');
  out.headText = head ? head.textContent.replace(/\s+/g, ' ').trim() : '';
  out.key = _questKeyLabel();
  const rows = [...el.querySelectorAll('.qt-row')];
  const nextRow = el.querySelector('.qt-row.qt-next') || rows[0];
  out.nextText = nextRow ? nextRow.textContent.replace(/\s+/g, ' ').trim() : '';
  out.nextStep = !!(nextRow && nextRow.querySelector('.qt-step'));
  const pqRow = rows.find((x) => (x.getAttribute('title') || '') === QUESTS[pq].name) || rows.find((x) => /Ticket Rush/.test(x.textContent));
  out.pqRowTitle = pqRow ? pqRow.getAttribute('title') : null;
  out.pqName = pqRow ? (pqRow.querySelector('.qt-name') || {}).textContent : null;
  out.pqStep = pqRow ? ((pqRow.querySelector('.qt-step') || {}).textContent || '') : '';
  const bar = pqRow && pqRow.querySelector('.qt-bar > i');
  out.barPct = bar ? parseFloat(bar.style.width) : null;
  out.barCount = pqRow && pqRow.querySelector('.qt-barrow .qt-prog') ? pqRow.querySelector('.qt-barrow .qt-prog').textContent : null;
  const guide = pqRow && pqRow.querySelector('.qt-guide');
  out.guide0 = guide ? guide.textContent : null;
  await wait(1300);   // the live refresh rewrites every guide line twice a second
  out.guide1 = guide ? guide.textContent : null;
  const cs = (sel, p) => { const n = el.querySelector(sel); return n ? getComputedStyle(n)[p] : ''; };
  out.nameFont = cs('.qt-name', 'fontFamily'); out.nameWeight = +cs('.qt-name', 'fontWeight');
  out.progWeight = +cs('.qt-prog', 'fontWeight'); out.guideWeight = +cs('.qt-guide', 'fontWeight');
  out.words = el.textContent.replace(/[^A-Za-z0-9]+/g, ' ').trim().split(' ').filter(Boolean).length;
  // a quest ready to hand in: the guide is the giver's name, not "Return to ..."
  const giverQ = Object.keys(QUESTS).find((k) => QUESTS[k].giver && QUESTS[k].count && k !== pq && k !== multi);
  delete player.quests.active[multi];
  player.quests.active[giverQ] = { progress: QUESTS[giverQ].count, readyToHandIn: true };
  renderQuestTracker(); await wait(700);
  const gRow = [...el.querySelectorAll('.qt-row')].find((x) => x.querySelector(`.qt-guide[data-qid="${giverQ}"]`));
  out.readyGuide = gRow ? gRow.querySelector('.qt-guide').textContent : null;
  out.readyGiver = QUESTS[giverQ].giver;
  out.readyPill = gRow ? (gRow.querySelector('.qt-prog.done') || {}).textContent : null;
  return out;
});
await b.close(); try { srv.kill(); } catch (e) {}
console.log(JSON.stringify(r, null, 1));
ok('1. the header is a number bubble and a keycap, not "176 new \u00b7 Q"', /176/.test(r.headText) && !/new/i.test(r.headText) && r.headText.endsWith(r.key), r.headText);
ok('2. the story pointer drops "Next:" and "see"', r.nextText && !/Next:/.test(r.nextText) && !/\bsee\b/.test(r.nextText), r.nextText);
ok('2. ...and its act numeral is a pill', r.nextStep, r.nextStep);
ok('3. "STAGE 1 \u2014 The Ticket Rush Lobby" reads as a [1] pill + "Ticket Rush Lobby", full name in the tooltip', r.pqStep === '1' && r.pqName === 'Ticket Rush Lobby' && /^STAGE 1/.test(r.pqRowTitle || ''), JSON.stringify({ step: r.pqStep, name: r.pqName, title: r.pqRowTitle }));
ok('4. the guide drops the map subtitle', r.guide0 && !/\u2014|\u00b7/.test(r.guide0) && /Clockwork Underpass/.test(r.guide0), r.guide0);
ok('4. ...and stays short after the live refresh rewrites it', r.guide1 === r.guide0, `${r.guide0} -> ${r.guide1}`);
ok('4. a quest ready to hand in guides to the giver by name, without "Return to"', r.readyGuide && !/Return to/.test(r.readyGuide) && r.readyGuide.indexOf(r.readyGiver) >= 0 && /Turn in/.test(r.readyPill || ''), JSON.stringify({ g: r.readyGuide, pill: r.readyPill }));
ok('5. the stage has a progress bar at 19%, with 19/100 on the bar line', r.barPct === 19 && r.barCount === '19/100', `${r.barPct}% "${r.barCount}"`);
ok('6. bolder and rounder: Fredoka names, Nunito 800+ numbers and guides', /Fredoka/.test(r.nameFont) && r.nameWeight >= 600 && r.progWeight >= 800 && r.guideWeight >= 800, JSON.stringify({ f: r.nameFont, n: r.nameWeight, p: r.progWeight, g: r.guideWeight }));
ok('7. the panel spends fewer words on these quests: at most 35 (43 before this pass, counting numbers)', r.words <= 35, r.words);
ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
let fail = 0;
for (const x of results) { if (!x.pass) fail++; console.log(`${x.pass ? 'PASS' : 'FAIL'}  ${x.n}${x.pass ? '' : '  -- ' + x.x}`); }
console.log(`\n${results.length - fail}/${results.length} passed`);
process.exit(fail ? 1 : 0);
