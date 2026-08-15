// The Singularity re-entry plays on time: intro on schedule, blackout releases,
// and the bake pipeline neither double-bakes nor floods the entrance.
// Per user: "Waiting too long here before the next thing happens."
// Run: node scripts/gravitos_pace_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 9220;
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
  // A real re-entering player is past class selection; the fresh test profile
  // is not, and a lingering class-select modal would own the pause forever.
  for (const id of ['class-select-modal', 'advancement-modal', 'tutorial-modal'])
    { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  player.cls = 'rogue'; player.level = 100; player.hp = 9e6; player.maxHp = 9e6;
  player._gravitosCineSeen = true;                       // re-entry path (the reported one)
  if (!player._storyBeatsSeen) player._storyBeatsSeen = {};
  player._storyBeatsSeen.gravitos_gate = true;
  game.paused = false;

  // count bakes per source while we watch the entrance
  const counts = new Map();
  const orig = window.createImageBitmap ? window.createImageBitmap.bind(window) : null;
  if (orig) window.createImageBitmap = (src, opts) => {
    const key = (src && src.src) ? String(src.src) : 'other';
    counts.set(key, (counts.get(key) || 0) + 1);
    return orig(src, opts);
  };

  const t0 = performance.now();
  loadMap('gravitosArena', 300);
  let tIntro = null, tClear = null;
  for (let i = 0; i < 220; i++) {                        // watch up to 22 s
    await new Promise(r => setTimeout(r, 100));
    const now = performance.now() - t0;
    const ov = document.getElementById('boss-intro-overlay');
    if (tIntro == null && ov && ov.classList.contains('on')) tIntro = Math.round(now);
    if (tIntro != null && tClear == null && !game.paused && (game.blackFlashOverlay || 0) < 0.3
        && !(ov && ov.classList.contains('on'))) { tClear = Math.round(now); break; }
  }
  let maxPer = 0, total = 0;
  for (const n of counts.values()) { total += n; if (n > maxPer) maxPer = n; }
  return { tIntro, tClear, total, unique: counts.size, maxPer,
           bossAlive: (game.monsters || []).some(m => m.isBoss) };
});

ok('the boss intro arrives on schedule (authored 2.3 s, not half a minute)',
   out.tIntro != null && out.tIntro < 8000, `intro at ${out.tIntro}ms`);
ok('the entrance resolves into the live fight promptly',
   out.tClear != null && out.tClear < 16000, `clear at ${out.tClear}ms`);
ok('the boss is standing in the arena', out.bossAlive);
ok('no source image is baked more than once while the entrance plays',
   out.maxPer <= 1, `max bakes for one source: ${out.maxPer} (total ${out.total} across ${out.unique} sources)`);

let pass = 0, failed = 0;
for (const r of res) { if (r.pass) { pass++; console.log(`  PASS  ${r.n}` + (r.extra ? `  (${r.extra})` : '')); }
  else { failed++; console.log(`  FAIL  ${r.n}  ${r.extra}`); } }
console.log(`${pass} passed, ${failed} failed`);
await browser.close(); server.kill();
process.exit(failed ? 1 : 0);
