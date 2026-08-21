// The prologue's "memory sharpens" beat is short, and the registry decode
// stays off its critical path.
// Per user: "I wait too long here for gravitos initiation to start could you
// improve the wait and lag time."
// Run: node scripts/prologue_wait_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 9252;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra) });

const out = await page.evaluate(async () => {
  const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade');
  for (const id of ['class-select-modal', 'advancement-modal', 'tutorial-modal'])
    { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  player.cls = 'rogue'; game.paused = false;

  // Time the promise the beat actually waits on, built exactly as applyClass
  // builds it. A build that keeps the registry sweep on this path measures
  // tens of seconds; one that detaches it measures the arena's own work.
  const t0 = performance.now();
  const arenaOwn = Promise.allSettled([
    (typeof _lxPreloadMapAssets === 'function') ? _lxPreloadMapAssets('gravitosArena', null, 'high') : null,
  ]).then(() => {
    try { return (typeof _warmMapArt === 'function') ? _warmMapArt('gravitosArena', { skip: /^gravitos[23]/ }) : null; }
    catch (e) { return null; }
  });
  await arenaOwn;
  const arenaOwnMs = Math.round(performance.now() - t0);

  // and the sweep on its own, to show what was being waited for
  const t1 = performance.now();
  try { await ((typeof _warmDecodeRegistries === 'function') ? _warmDecodeRegistries(true) : null); } catch (e) {}
  const sweepMs = Math.round(performance.now() - t1);
  return { arenaOwnMs, sweepMs };
});
await browser.close(); server.kill();

// Static: the shipped source must not await the sweep, and the caps must be short.
const fs = await import('node:fs');
const src = fs.readFileSync(path.join(ROOT, process.env.MOJI_GAME_FILE || 'mojiworld_game.html'), 'utf8');
const raceIdx = src.indexOf('window._prologueArenaReady = Promise.race([');
const race = raceIdx >= 0 ? src.slice(raceIdx, raceIdx + 900) : '';
ok('the prologue arena-ready promise exists', raceIdx >= 0);
ok('the whole-registry decode sweep is NOT on the beat\'s critical path',
   !!race && !/_warmDecodeRegistries/.test(race),
   /_warmDecodeRegistries/.test(race) ? 'sweep still awaited by the cover' : 'sweep detached');
ok('the sweep still runs (fire-and-forget), so later frames stay warm',
   /Promise\.resolve\(_warmDecodeRegistries\(true\)\)\.catch/.test(src));
ok('the cover\'s cap is a short beat, not a quarter-minute',
   /setTimeout\(_go, (\d+)\)/.test(src) && +/setTimeout\(_go, (\d+)\)/.exec(src)[1] <= 8000,
   'cap ' + (/setTimeout\(_go, (\d+)\)/.exec(src) || [])[1] + 'ms');
ok('the arena\'s own work is what the beat waits for, and it is quick',
   out.arenaOwnMs < 12000, `arena preload + form-1 bake: ${out.arenaOwnMs}ms`);
ok('the detached sweep is genuinely the expensive part',
   out.sweepMs > out.arenaOwnMs, `sweep ${out.sweepMs}ms vs arena ${out.arenaOwnMs}ms`);
ok('the entrance-clip wait is untouched (its own 6 s cap still guards the clip)',
   src.includes('setTimeout(_entryGo, 6000);'));

let pass = 0, failed = 0;
for (const r of res) { if (r.pass) { pass++; console.log(`  PASS  ${r.n}` + (r.extra ? `  (${r.extra})` : '')); }
  else { failed++; console.log(`  FAIL  ${r.n}  ${r.extra}`); } }
console.log(`${pass} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
