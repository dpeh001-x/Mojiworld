// The cache warmer yields to strained gameplay — and only to that.
// ============================================================================
// v0.30.279. Three scenarios, same instrumentation (count Sprites/ fetches in
// a 20s window starting after the warmer's 15s boot delay), machine state
// simulated by pinning the exact properties the gate reads:
//
//   PLAYING+STRAINED  avgFrame pinned 25ms, paused pinned false
//                     -> patched: warmer parks (near-zero sprite fetches)
//                     -> baseline v0.30.278: warmer sweeps (hundreds)   [FAILS]
//   PAUSED+STRAINED   avgFrame 25ms, paused pinned true
//                     -> warmer sweeps even on the patched build: menus and
//                        pause screens are exactly when warming SHOULD run.
//
// CONTROLS: the service worker must be controlling (the warmer no-ops without
// it, which would fake a pass), and the pinned getters must still be in place
// at the end of the window.
// Run: node scripts/warm_yield_test.mjs            (patched, both scenarios)
//      cp <v0.30.278 copy> _preroot.html; MOJI_GAME_FILE=_preroot.html ...
//      (baseline MUST be served from the repo ROOT: sw.js registers relative
//       to the page URL, so a scripts/-served copy gets no service worker and
//       the warmer never arms — the controls catch that as a fake pass)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 11111);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));

const FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';

const scenario = async (pausedPinned) => {
  const b = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await b.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'load', timeout: 120000 });
  // Pin the exact fields the gate reads, BEFORE the warmer's 15s timer fires.
  await page.waitForFunction(() => typeof LX_PERF !== 'undefined' && typeof game !== 'undefined', null, { timeout: 30000 });
  await page.evaluate((pp) => {
    Object.defineProperty(LX_PERF, 'avgFrame', { configurable: true, get: () => 25, set() {} });
    Object.defineProperty(game, 'paused', { configurable: true, get: () => pp, set() {} });
    window.__spriteFetches = 0;
    const oF = window.fetch;
    window.fetch = function (...a) {
      if (String(a[0]).includes('Sprites/')) window.__spriteFetches++;
      return oF.apply(window, a);
    };
  }, pausedPinned);
  await page.waitForTimeout(18000);                           // past the 15s warm delay
  await page.evaluate(() => { window.__spriteFetches = 0; }); // count a clean window
  await page.waitForTimeout(20000);
  const r = await page.evaluate((pp) => ({
    fetches: window.__spriteFetches,
    swControlling: !!(navigator.serviceWorker && navigator.serviceWorker.controller),
    pinsHeld: LX_PERF.avgFrame === 25 && game.paused === pp,
    cursor: (() => { try { return localStorage.getItem('lx_cacheWarmCursor_v1'); } catch (e) { return null; } })(),
  }), pausedPinned);
  await b.close();
  return r;
};

const playing = await scenario(false);
const paused = await scenario(true);
server.kill();

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 200) });

console.log(`  playing+strained: ${playing.fetches} sprite fetches in 20s  (sw=${playing.swControlling} pins=${playing.pinsHeld} cursor=${playing.cursor})`);
console.log(`  paused+strained:  ${paused.fetches} sprite fetches in 20s  (sw=${paused.swControlling} pins=${paused.pinsHeld} cursor=${paused.cursor})`);

ok('CONTROL: service worker controls the page (warmer can run at all)',
   playing.swControlling && paused.swControlling,
   'without a controlling SW the warmer no-ops and a pass would be fake');
ok('CONTROL: the pinned machine state held for the whole window',
   playing.pinsHeld && paused.pinsHeld);
ok('CONTROL: the warmer is genuinely active this boot (paused scenario sweeps)',
   paused.fetches > 120,
   `${paused.fetches} fetches while paused — menus are exactly when warming should run`);
ok('the warmer yields while the player is in strained gameplay',
   playing.fetches <= 12,
   `${playing.fetches} sprite fetches during strained play (pre-v0.30.279: sweeps regardless — hundreds)`);

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
