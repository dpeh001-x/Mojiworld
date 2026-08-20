// BOSS PROJECTILE SPRITE COVERAGE — no cast falls back to the procedural ball.
// ============================================================================
// Per user: "why is octababy firing a white blue non-sprite ball, ensure that
// all bosses cast have sprites".
//
// drawProjectiles paints authored art only when a skill is in BOTH LX_MOB_PROJ
// (the image) and _PROJ_SPRITE_BLIT (how to draw it); anything else drops to
// the procedural ellipse tinted by the projectile's own `color`. The reported
// ball was `waterPillar`, whose color is literally '#88ccff'.
//
// This does three things a table-read alone would not:
//   1. Enumerates every skill an enemy projectile can carry from the SOURCE
//      (spawn sites + declarative `shoot:` fields), so a newly-added cast is
//      caught rather than only the ones someone remembered to list here.
//   2. Discounts skills with a bespoke `p.skill === '...'` branch inside
//      drawProjectiles — those are sprited by their own renderer.
//   3. For each newly-wired skill, runs the REAL drawProjectiles and asserts a
//      drawImage actually happened. A table entry pointing at a missing file
//      would pass a membership check while painting nothing at all, which is
//      worse than the ball it replaced.
// Run: node scripts/boss_proj_sprite_coverage_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');

// --- source scan: every skill an enemy projectile can carry ----------------
const GAME = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const src = require('fs').readFileSync(path.join(ROOT, GAME), 'utf8');
const skills = new Set();
for (const m of src.matchAll(/game\.projectiles\.push\(\{[\s\S]{0,900}?\}\)/g)) {
  if (!/owner:\s*'enemy'/.test(m[0])) continue;
  const sk = m[0].match(/skill:\s*'([^']+)'/);
  if (sk) skills.add(sk[1]);
}
for (const m of src.matchAll(/shoot:\s*'([^']+)'/g)) skills.add(m[1]);

const PORT = 9363;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`http://localhost:${PORT}/${GAME}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'SprTest');
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

const R = await page.evaluate(async (list) => {
  loadMap('forest', 300);
  await new Promise(r => setTimeout(r, 1400));
  game.paused = false;

  const projK = new Set(Object.keys(LX_MOB_PROJ || {}));
  const blitK = new Set(Object.keys(_PROJ_SPRITE_BLIT || {}));
  const dedicated = new Set();
  for (const m of drawProjectiles.toString().matchAll(/p\.skill\s*===\s*'([^']+)'/g)) dedicated.add(m[1]);

  const unsprited = list.filter(sk => !(projK.has(sk) && blitK.has(sk)) && !dedicated.has(sk));

  // The 8 wired in this pass — each must actually PAINT.
  const WIRED = ['tidalSweep', 'waterPillar', 'pincerSweep', 'claw',
                 'barnJab', 'arrowRain', 'mhoming', 'mlob'];
  const painted = {}, decoded = {};
  for (const sk of WIRED) {
    const img = LX_MOB_PROJ[sk];
    decoded[sk] = !!(img && img.naturalWidth > 0);
    game.projectiles.length = 0;
    game.projectiles.push({
      x: player.x + 60, y: player.y, vx: 5, vy: 0, w: 40, h: 40,
      life: 200, damage: 1, owner: 'enemy', skill: sk,
    });
    let drew = 0;
    const orig = ctx.drawImage.bind(ctx);
    ctx.drawImage = function (...a) { drew++; return orig(...a); };
    try { drawProjectiles(); } catch (e) {}
    ctx.drawImage = orig;
    painted[sk] = drew;
  }
  return { unsprited, painted, decoded, scanned: list.length, projN: projK.size, blitN: blitK.size };
}, [...skills].sort());
await browser.close(); server.kill();

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 135) });
const WIRED = ['tidalSweep', 'waterPillar', 'pincerSweep', 'claw', 'barnJab', 'arrowRain', 'mhoming', 'mlob'];

ok('the source scan actually found the enemy skills', R.scanned > 60, `${R.scanned} skills scanned`);
ok('NO enemy cast falls back to the procedural ball', R.unsprited.length === 0,
   R.unsprited.length ? 'still unsprited: ' + R.unsprited.join(', ') : 'all covered');
for (const sk of WIRED) {
  ok(`${sk} sprite decodes`, R.decoded[sk], R.decoded[sk] ? 'ok' : 'image never decoded — table points at a missing file');
}
ok('every newly-wired cast actually paints a sprite',
   WIRED.every(sk => (R.painted[sk] | 0) > 0),
   WIRED.map(sk => sk + '=' + R.painted[sk]).join(' '));

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
