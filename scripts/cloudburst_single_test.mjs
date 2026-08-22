// ONE CLOUDBURST AT A TIME.
// ============================================================================
// Per user: "skywisp seems to summon 2 cloudburst, change it to 1 only."
//
// Each skywisp/cloudbun drops its storm cloud ON the player (cx = player centre
// +/- 35 px), so with more than one caster in range the clouds land on top of
// one another: one readable sprite, several independent hitboxes, and damage
// that scales with the size of the flock rather than with anything the player
// can see or dodge. Sky Garden spawns EIGHT wisps (3 platform-locked + 5
// roaming), so this is the normal case there, not an edge case.
//
// Measured on 4 naturally-staggered wisps over 20 s BEFORE the fix: 2-or-more
// clouds for 67% of frames, modal state 2, peak 4 — which is exactly the
// report. This test drives the real monster AI and fails if that ever returns.
//
// It deliberately does NOT assert "a cloud is always up": the cap is about
// never stacking, and cloud uptime is allowed to move with spawn density.
// Run: node scripts/cloudburst_single_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = process.env.PORT || 9478;
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
const FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => typeof loadMap === 'function' && typeof spawnMonster !== 'undefined', { timeout: 60000 });
await page.evaluate(() => {
  const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
  window._lxBootGateDone = true;
  const c = document.querySelector('#class-select-modal .cls-card'); if (c && !player.cls) { try { c.click(); } catch (e) {} }
  const g = document.getElementById('class-select-modal'); if (g) g.style.display = 'none';
  player.level = 60; player.cls = 'warrior'; player.invulnerable = 9e9; player.hp = 99999; player.maxHp = 99999;
  try { loadMap('skyGarden'); } catch (e) { try { loadMap('forest'); } catch (e2) {} }
  game.paused = false;
});
await page.waitForTimeout(5000);

const r = await page.evaluate(async () => {
  game.monsters.length = 0; game.hazards.length = 0;
  for (let i = 0; i < 4; i++) { try { spawnMonster(player.x + (i - 2) * 70, player.y - 60, 'skywisp'); } catch (e) {} }
  // Only aggro them. _mskTimer is left for the dispatcher to seed, which
  // staggers first casts — forcing it here would synchronise the flock and
  // manufacture an all-fire-then-all-expire cycle that the real game never has.
  for (const m of game.monsters) m.aggroTarget = player;
  const hist = {}; let peak = 0, frames = 0;
  const t0 = performance.now();
  while (performance.now() - t0 < 20000) {
    game.paused = false;
    await new Promise((res) => requestAnimationFrame(res));
    const n = game.hazards.filter((h) => h && h.type === 'mob_cloudburst').length;
    if (n > peak) peak = n;
    hist[n] = (hist[n] || 0) + 1;
    frames++;
  }
  const casters = game.monsters.filter((m) => m && m.currentHp > 0).length;
  const multi = Object.keys(hist).reduce((a, k) => a + (+k >= 2 ? hist[k] : 0), 0);
  const anyCloud = Object.keys(hist).reduce((a, k) => a + (+k >= 1 ? hist[k] : 0), 0);
  return { casters, frames, peak, hist, multiPct: +(100 * multi / frames).toFixed(1), upPct: +(100 * anyCloud / frames).toFixed(1) };
});

const res = [];
const ok = (n, c, x) => res.push({ n, pass: !!c, x: x === undefined ? '' : String(x).slice(0, 150) });
const shape = Object.keys(r.hist).sort().map((k) => `${k}:${(100 * r.hist[k] / r.frames).toFixed(0)}%`).join(' ');
ok('four skywisps were live and casting', r.casters === 4 && r.upPct > 5, `${r.casters} casters, a cloud up ${r.upPct}% of ${r.frames} frames`);
ok('NEVER more than one cloudburst on screen', r.peak <= 1, `peak concurrent = ${r.peak}  (distribution ${shape})`);
ok('zero frames with clouds stacked', r.multiPct === 0, `${r.multiPct}% of frames had 2+ clouds (was 67% before the cap, modal 2)`);
ok('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));

let bad = 0;
for (const x of res) { if (!x.pass) bad++; console.log(`${x.pass ? 'PASS' : 'FAIL'}  ${x.n}${x.x ? '   [' + x.x + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
await browser.close(); srv.kill();
process.exit(bad ? 1 : 0);
