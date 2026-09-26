// Story beats play ONE at a time. A beat that fires while another is on screen must wait its turn: before, both
// shared the overlay and both kept their key handlers, so one Enter turned a page of each (launch polish sweep).
//   node scripts/story_beat_queue_test.mjs [page.html] [port]      (MOJI_GAME_FILE / serves this repo by default)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html', PORT = +(process.argv[3] || 9934);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ ...(process.env.PW_EXE ? { executablePath: process.env.PW_EXE } : { channel: 'msedge' }), headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
await page.addInitScript(() => {
  try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {}
  window.__keyL = 0;
  const ae = EventTarget.prototype.addEventListener, re = EventTarget.prototype.removeEventListener;
  EventTarget.prototype.addEventListener = function (t, f, o) { if (this === document && t === 'keydown' && (o === true)) window.__keyL++; return ae.apply(this, arguments); };
  EventTarget.prototype.removeEventListener = function (t, f, o) { if (this === document && t === 'keydown' && (o === true)) window.__keyL--; return re.apply(this, arguments); };
});
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => typeof _playStoryBeat === 'function' && typeof loadMap === 'function', null, { timeout: 90000 });
const r = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
  try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
  for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  applyClass('warrior'); player._tutorialSeen = true; player._storyBeatsSeen = player._storyBeatsSeen || {}; player._storyBeatsSeen.everdawn_welcome = true;
  loadMap('town', 300); await sleep(1500);
  try { _closeTutorial(true); } catch (e) {}
  const ov = document.getElementById('story-beat-overlay'); if (ov) ov.classList.remove('on');
  await sleep(700);
  const txt = () => (document.getElementById('story-beat-text') || {}).textContent || '';
  const enter = async () => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); await sleep(450); };
  const out = { seen: [] };
  const base = window.__keyL;
  const closed = { a: 0, b: 0 };
  _playStoryBeat({ mode: 'dialog', stanzas: [{ speaker: 'A', text: 'ALPHA one' }, { speaker: 'A', text: 'ALPHA two' }] }, () => { closed.a++; });
  await sleep(300);
  const retB = _playStoryBeat({ mode: 'dialog', stanzas: [{ speaker: 'B', text: 'BRAVO one' }, { speaker: 'B', text: 'BRAVO two' }] }, () => { closed.b++; });
  await sleep(500);
  out.retB = retB;
  out.keyHandlersWhileA = window.__keyL - base;
  out.seen.push(txt().trim().slice(0, 12));
  for (let i = 0; i < 6; i++) { await enter(); await sleep(700); out.seen.push(txt().trim().slice(0, 12) + (document.getElementById('story-beat-overlay').classList.contains('on') ? '' : ' [off]')); }
  out.closed = closed; out.keyHandlersAfter = window.__keyL - base; out.paused = game.paused;
  return out;
});
await browser.close(); server.kill();
let fails = 0; const ok = (name, c, x) => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'}  ${name}  ${JSON.stringify(x)}`); };
const seq = r.seen.map((s) => s.replace(/\s*\[off\]$/, '').slice(0, 5));
ok('a beat fired over another is accepted (it will play)', r.retB === true, { retB: r.retB });
ok('only ONE beat listens to the keyboard at a time', r.keyHandlersWhileA === 1, { handlers: r.keyHandlersWhileA });
ok('the first beat stays on screen until it is finished', r.seen[0].startsWith('ALPHA one'), r.seen);
const ia = seq.lastIndexOf('ALPHA'), ib = seq.indexOf('BRAVO');
ok('the second beat plays after the first, in full', ib > ia && ia >= 0 && r.seen.some((s) => s.startsWith('BRAVO two')), r.seen);
ok('each beat closes exactly once', r.closed.a === 1 && r.closed.b === 1, r.closed);
ok('no key handler is left behind', r.keyHandlersAfter <= 0, { left: r.keyHandlersAfter });   // <= 0: an unrelated capture handler may leave during the run
ok('no page errors', errs.length === 0, errs.slice(0, 2));
console.log(fails ? `FAIL(${fails})` : 'ALL PASS');
process.exit(fails ? 1 : 0);
