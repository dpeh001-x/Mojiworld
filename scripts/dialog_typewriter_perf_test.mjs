// The NPC dialog typewriter must not make the game lag while it types. Per user: "The NPC text in the dialogue
// seem to lag, could you reduce the lag for it".
// Types one long speech on a 4x CPU throttle and reads the browser's own counters over the reveal:
//   - forced layouts: the reveal used to measure the box twice per LETTER (~1 layout per letter even after
//     the browser coalesced them); a frame-synced reveal measures once per frame - well under one per two letters;
//   - pace: a 14 ms timer chain starves behind heavy frames, so the speech crawled (30 s+ for a ~7 s speech
//     at 4x throttle). The reveal must land on its own clock;
// and checks it still behaves: the finished text is exact, the pace keeps its punctuation holds, a skip
// finishes at once, and a speech started mid-reveal is not typed into by the one it replaced.
//   node scripts/dialog_typewriter_perf_test.mjs [port]   (MOJI_GAME_FILE overrides the page)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.argv[2] || 9947);
const PAGE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => typeof openNPC === 'function' && typeof _runDialogTypewriter === 'function' && typeof loadMap === 'function', null, { timeout: 90000 });
await page.evaluate(async () => {
  try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
  for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  applyClass('warrior'); loadMap('town', 300); await new Promise((r) => setTimeout(r, 1500));
  openNPC({ name: 'Test NPC', role: 'shop', x: 0, y: 0 });
  await new Promise((r) => setTimeout(r, 600));
  const d = document.getElementById('dialog'); if (d && d._twSkip) d._twSkip();
});
const cdp = await page.context().newCDPSession(page);
await cdp.send('Performance.enable');
await cdp.send('Emulation.setCPUThrottlingRate', { rate: +(process.env.THROTTLE || 4) });
const metric = async () => { const m = (await cdp.send('Performance.getMetrics')).metrics; const o = {}; for (const x of m) o[x.name] = x.value; return o; };
const SPEECH = 'Well now, traveller, you look like someone who has walked a long road. The ovens are warm, the bread is fresh, ' +
  'and the <b>Megamall</b> never sleeps; not really. Buy what you need... or just sit a while, and listen. ' +
  'Some say the bell above the square has hung mid-swing for twelve ages! Others say it is waiting for someone. ' +
  'Who can tell? I only sell the bread.';
const before = await metric();
const run = await page.evaluate(async (SPEECH) => {
  const dlg = document.getElementById('dialog');
  const el = document.getElementById('dialog-text');
  const frames = [];
  let last = performance.now(), live = true;
  const loop = (t) => { frames.push(t - last); last = t; if (live) requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  const t0 = performance.now();
  _runDialogTypewriter(SPEECH);
  while (dlg._twTimer && performance.now() - t0 < 30000) await new Promise((r) => setTimeout(r, 50));
  const ms = performance.now() - t0;
  live = false;
  await new Promise((r) => setTimeout(r, 100));
  const tmp = document.createElement('div'); tmp.innerHTML = SPEECH;
  return { ms: Math.round(ms), text: el.textContent === tmp.textContent, long: frames.filter((f) => f > 50).length,
           frames: frames.length, p95: Math.round(frames.slice().sort((a, b) => a - b)[Math.floor(frames.length * 0.95)] || 0) };
}, SPEECH);
const after = await metric();
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
// behaviour: skip, and a speech replaced mid-reveal
const beh = await page.evaluate(async (SPEECH) => {
  const dlg = document.getElementById('dialog'), el = document.getElementById('dialog-text');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const want = (h) => { const d = document.createElement('div'); d.innerHTML = h; return d.textContent; };
  _runDialogTypewriter(SPEECH); await sleep(150);
  dlg._twSkip();
  const skipped = !dlg._twTimer && el.textContent === want(SPEECH);
  _runDialogTypewriter(SPEECH); await sleep(200);
  _runDialogTypewriter('Second line, short.');
  while (dlg._twTimer) await sleep(40);
  await sleep(400);   // any loop left over from the first speech would have typed into the box by now
  const replaced = el.textContent === 'Second line, short.';
  return { skipped, replaced, got: el.textContent.slice(0, 60) };
}, SPEECH);
await browser.close(); server.kill();
const layouts = after.LayoutCount - before.LayoutCount, styles = after.RecalcStyleCount - before.RecalcStyleCount;
const chars = SPEECH.replace(/<[^>]+>/g, '').length;
let fails = 0; const ok = (name, c, x) => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'}  ${name}  ${JSON.stringify(x)}`); };
console.log(`typed ${chars} letters in ${run.ms} ms; layouts ${layouts}, style recalcs ${styles}, frames ${run.frames}, p95 ${run.p95} ms, >50 ms: ${run.long}`);
// LayoutCount also carries the game's own per-frame layouts, so it moves with the frame rate. Measured at this
// 4x setting: per-letter measuring = 310-371 layouts for 353 letters (0.9-1.05/letter); per-frame = 45-196 (<= 0.56).
ok('the reveal does not force layout per letter', layouts <= chars * 0.75, { layouts, letters: chars });
ok('the finished text is exactly the speech', run.text, {});
ok('the speech lands on its own clock, punctuation holds included (not instant, not crawling)', run.ms > 3500 && run.ms < 11000, { ms: run.ms });
ok('a skip finishes the speech at once', beh.skipped, beh);
ok('a speech replaced mid-reveal is not typed into by the one it replaced', beh.replaced, beh);
ok('no page errors', errs.length === 0, errs.slice(0, 2));
console.log(fails ? `FAIL(${fails})` : 'ALL PASS');
process.exit(fails ? 1 : 0);
