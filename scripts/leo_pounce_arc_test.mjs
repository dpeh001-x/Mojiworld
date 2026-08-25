// REGULUS — the pounce is an ARC, not a loop.
// ============================================================================
// Per user: "the pounce sprite appears to be ping ponged rather than clean 9
// sequence, please check".
//
// It was not ping-ponged in code — both pickers pass pingpong:false. It was a
// wall-clock LOOP over a set that is not a cycle. v0.30.170 deliberately kept
// only the three genuinely airborne frames (ludo's other six had him standing,
// which would freeze him mid-air), but three frames at 48ms is a full cycle
// every 144ms, so a ~1s leap ran the set ~7 times and snapped last->first each
// time. That flutter is what reads as ping-pong.
//
// The decisive check is the second one: HOLD vy constant and let time pass.
// Under the old wall-clock picker the frame kept changing; under an arc picker
// it cannot, because the frame is a function of where he is in the jump.
// Run: node scripts/leo_pounce_arc_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 9981);
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
await page.fill('#hero-name-input', 'Pounce');
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
await page.evaluate(() => { player.level = 99; player._god = true; loadMap('forest', 300); });
await page.waitForTimeout(4000);

const R = await page.evaluate(async () => {
  game.paused = false;
  const frame = () => new Promise(r => requestAnimationFrame(r));
  const out = { hasArc: typeof _lxPounceArcFrame === 'function' };
  const frames = (typeof ZODIAC_POUNCE_FRAMES !== 'undefined') ? ZODIAC_POUNCE_FRAMES['leo'] : null;
  out.frameCount = frames ? frames.length : 0;
  if (!frames || !frames.length) return out;
  // wait for decode so _readyN is real
  const t0 = performance.now();
  while (performance.now() - t0 < 3000) {
    let n = 0; while (n < frames.length && frames[n] && frames[n].complete && frames[n].naturalWidth > 0) n++;
    if (n === frames.length) break;
    await frame();
  }
  const srcOf = (img) => (img && img.src) ? img.src.split('/').pop() : null;
  const pick = (vy) => srcOf(_zodiacStateImg('leo', 'pounce', 0, { vy }));

  // 1. Sweep the arc: launch (vy very negative) -> apex (0) -> landing (positive).
  const sweep = [];
  for (let vy = -10; vy <= 10; vy += 1) sweep.push({ vy, f: pick(vy) });
  out.sweep = sweep.map(s => s.f);
  const order = [];
  for (const s of sweep) if (!order.length || order[order.length - 1] !== s.f) order.push(s.f);
  out.distinctInOrder = order;
  out.revisits = order.length - new Set(order).size;   // >0 means it went back to a frame it had left

  // 2. THE DECISIVE ONE. Hold vy still and let real time pass. A wall-clock
  //    loop keeps advancing here; an arc picker cannot.
  const held = new Set();
  const t1 = performance.now();
  while (performance.now() - t1 < 1200) { held.add(pick(-4)); await frame(); }
  out.heldDistinct = held.size;

  // 3. Launch and landing must not be the same frame — the arc has to travel.
  out.launchFrame = pick(-9.5);
  out.landFrame = pick(9.5);
  return out;
});
await browser.close(); server.kill();

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 210) });

console.log(`  ${R.frameCount} pounce frames; arc picker present: ${R.hasArc}`);
console.log(`  vy -10..+10 walks through: ${JSON.stringify(R.distinctInOrder)}`);
console.log(`  frames seen while vy held at -4 for 1.2s: ${R.heldDistinct}`);

ok('the pounce is picked by ARC POSITION, not the wall clock', R.hasArc,
   '_lxPounceArcFrame present');
ok('holding a fixed point in the jump holds ONE frame', R.heldDistinct === 1,
   `${R.heldDistinct} distinct frames over 1.2s at a constant vy — a wall-clock loop would have cycled the whole set ~8 times here`);
ok('the arc never returns to a frame it has left', R.revisits === 0,
   `${R.revisits} revisits across the sweep — this is the ping-pong the report describes`);
ok('the arc actually travels: launch and landing differ', R.launchFrame !== R.landFrame,
   `launch ${R.launchFrame} -> landing ${R.landFrame}`);
ok('every authored frame is used somewhere in the arc', R.distinctInOrder.length === R.frameCount,
   `${R.distinctInOrder.length} of ${R.frameCount} frames appear`);
ok('CONTROL: the pounce set is still loaded', R.frameCount > 0, `${R.frameCount} frames`);

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
