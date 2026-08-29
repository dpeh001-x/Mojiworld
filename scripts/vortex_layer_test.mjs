// The warlock pools draw behind monsters — and nothing draws twice.
// ============================================================================
// v0.30.290. The change splits drawHazards into two passes, so the risks are
// exactly two: (a) the pools not actually moving under the monsters, and
// (b) a hazard being visited by BOTH passes (the function emits particles and
// runs an expiry, so a double visit would double them).
//
// Both are asserted directly, without frame timing. Each hazard's `life` is
// read inside its own draw branch — well after the pass filter — so a getter
// on it is an exact "this hazard was drawn" probe:
//
//   drawHazards(true)   must draw the pools and NOT the control hazard
//   drawHazards()       must draw the control hazard and NOT the pools
//   => the passes partition the list: every hazard drawn exactly once/frame
//
// Plus a source check that the behind-pass call really sits before the
// monster loop in loop() — the ordering is what the user actually sees.
// Run: node scripts/vortex_layer_test.mjs
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');

const FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 220) });

// ---- source: the behind pass is called before the monsters ------------------
const src = readFileSync(path.join(ROOT, FILE), 'utf8');
const iBehind = src.indexOf('drawHazards(true);');
const iMonsters = src.indexOf('for (const m of game.monsters) {', iBehind > 0 ? iBehind : 0);
const iMain = src.indexOf('\n  drawHazards();');
ok('loop() calls the behind pass BEFORE the monster loop',
   iBehind > 0 && iMonsters > iBehind, `behind@${iBehind} monsters@${iMonsters}`);
ok('...and still calls the normal pass after them',
   iMain > iMonsters, `main pass @${iMain}`);

// CONTROL TYPE: gloop_puddle, not lava_drop — lava_drop needs fields this
// synthetic hazard does not carry, so its branch never ran and it read 0 in
// BOTH passes: a control that is silent proves nothing.
// ---- runtime: the two passes partition the hazard list ----------------------
const PORT = Number(process.env.PORT || 11191);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => typeof drawHazards === 'function' && typeof game !== 'undefined', null, { timeout: 60000 });
await page.waitForTimeout(3000);

const R = await page.evaluate(() => {
  const hits = { soul: 0, necro: 0, control: 0 };
  const mk = (type, key) => {
    const h = { type, x: (game.camera.x || 0) + 100, y: 300, w: 300, h: 200,
                cx: (game.camera.x || 0) + 250, maxLife: 1800, atk: 10 };
    let _life = 1800;
    Object.defineProperty(h, 'life', { get() { hits[key]++; return _life; }, set(v) { _life = v; } });
    return h;
  };
  const saved = game.hazards.slice();
  game.hazards.length = 0;
  game.hazards.push(mk('soul_vortex', 'soul'), mk('necro_maelstrom', 'necro'), mk('gloop_puddle', 'control'));

  const snap = () => ({ ...hits });
  const zero = () => { hits.soul = 0; hits.necro = 0; hits.control = 0; };

  zero();
  try { drawHazards(true); } catch (e) { return { err: 'behind: ' + String(e.message).slice(0, 90) }; }
  const behind = snap();

  zero();
  try { drawHazards(); } catch (e) { return { err: 'main: ' + String(e.message).slice(0, 90) }; }
  const main = snap();

  // The real frame: neither pass may visit a hazard twice.
  zero();
  try { drawHazards(true); drawHazards(); } catch (e) { return { err: 'frame: ' + String(e.message).slice(0, 90) }; }
  const frame = snap();

  game.hazards.length = 0;
  for (const h of saved) game.hazards.push(h);
  return { behind, main, frame, arity: drawHazards.length };
});
await browser.close(); server.kill();

if (R.err) {
  ok('drawHazards ran without throwing in both passes', false, R.err);
} else {
  console.log(`  behind pass: ${JSON.stringify(R.behind)}`);
  console.log(`  main pass:   ${JSON.stringify(R.main)}`);
  console.log(`  full frame:  ${JSON.stringify(R.frame)}   (drawHazards arity ${R.arity})`);
  ok('the behind pass draws BOTH pools', R.behind.soul > 0 && R.behind.necro > 0,
     `soul ${R.behind.soul}, necro ${R.behind.necro}`);
  ok('...and skips every other hazard', R.behind.control === 0,
     `control hazard read ${R.behind.control} times in the behind pass`);
  ok('the main pass draws the other hazards', R.main.control > 0, `control ${R.main.control}`);
  ok('...and skips the pools (they already drew, under the monsters)',
     R.main.soul === 0 && R.main.necro === 0,
     `soul ${R.main.soul}, necro ${R.main.necro} — non-zero here would double-draw and double its particle emitters`);
  ok('across a full frame every hazard is visited exactly once',
     R.frame.soul === R.behind.soul && R.frame.necro === R.behind.necro && R.frame.control === R.main.control,
     JSON.stringify(R.frame));
}

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
