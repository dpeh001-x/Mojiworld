// GROUND-SHADOW PROPORTION — measures the ellipse radii actually drawn under
// entities, so "more vertically squashed" is a number rather than an opinion.
// Monsters carry TWO stacked shadows: the older flat one in drawMonster (fixed
// 2.5px vertical radius) and _lxDrawBlobShadow, whose vertical radius is a
// FRACTION of its horizontal one — that second ellipse is what sets the read.
// Run: node scripts/shadow_squash_test.mjs
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const TARGET = Number(process.env.SHADOW_TARGET || 0.16);   // max ry/rx we accept
const PORT = 9033;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(10000);

const R = await page.evaluate(async (TARGET) => {
  const res = [];
  const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra) });
  for (const id of ['class-select-modal','advancement-modal','tutorial-modal','loading-overlay',
                    'story-beat-overlay','boss-intro-overlay','dialog']) {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
  }
  loadMap('forest'); game.paused = false;
  const ctx = canvas.getContext('2d');

  // capture every ellipse drawn during one entity's draw call
  const capture = (fn) => {
    const orig = ctx.ellipse;
    const seen = [];
    ctx.ellipse = function (x, y, rx, ry, ...rest) {
      seen.push({ x, y, rx, ry, ratio: rx > 0 ? ry / rx : 0 });
      return orig.apply(this, [x, y, rx, ry, ...rest]);
    };
    try { fn(); } finally { ctx.ellipse = orig; }
    return seen;
  };

  const rows = [];
  for (const type of ['slime', 'mushroom', 'boneGolem', 'blockEle', 'fatLizard']) {
    game.monsters.length = 0;
    const m = spawnMonster(600, 300, type, false);
    if (!m) continue;
    m.x = 600; m.y = 300; m.vx = 0; m.vy = 0; m.onGround = true; m.spawn = 0;
    m._shadowGY = null;
    for (let k = 0; k < 20; k++) {
      const s = MONSTER_SPRITES[type];
      if (s && s.complete && s.naturalWidth > 0) break;
      await new Promise(r => setTimeout(r, 40));
    }
    // the shadows are the WIDEST flat ellipses drawn; body parts are far smaller
    // relative to the mob box, so filter to ellipses at least a third of its width
    const all = capture(() => { try { drawMonster(m); } catch (e) {} });
    const shadows = all.filter(e => e.rx >= m.w * 0.3 && e.ratio > 0 && e.ratio < 0.6);
    if (!shadows.length) continue;
    const tallest = shadows.reduce((a, b) => (b.ratio > a.ratio ? b : a));
    rows.push({ type, w: m.w, n: shadows.length,
                rx: +tallest.rx.toFixed(1), ry: +tallest.ry.toFixed(1), ratio: +tallest.ratio.toFixed(3) });
  }
  // A 1.5px vertical floor keeps small shadows from vanishing, so a narrow
  // entity legitimately sits above the ratio: 9px rx * 0.13 = 1.17 -> floored to
  // 1.5 -> ratio 0.167. Accept the ratio OR the floor; anything else is a miss.
  const FLOOR = 1.5;
  const squashed = (r) => r.ratio <= TARGET + 0.001 || r.ry <= FLOOR + 0.01;
  ok('monster shadows were found', rows.length >= 3, rows.map(r => r.type).join(','));
  for (const r of rows) {
    ok(`${r.type}: shadow flattened`, squashed(r),
       `rx ${r.rx} ry ${r.ry} ratio ${r.ratio}${r.ry <= FLOOR + 0.01 ? ' (at the 1.5px floor)' : ''}`);
  }
  // Monsters used to draw TWO stacked ground ellipses (the legacy drawMonster
  // block plus _lxDrawBlobShadow); they overlapped, so the intersection
  // darkened twice and showed a double edge. Exactly one must survive.
  for (const r of rows) {
    ok(`${r.type}: exactly ONE shadow ellipse`, r.n === 1, `${r.n} drawn`);
  }

  // the player shares _lxDrawBlobShadow, so it must stay consistent
  game.monsters.length = 0;
  player.x = 600; player.y = 300; player.vy = 0; player.onGround = true;
  const pAll = capture(() => { try { drawPlayer(); } catch (e) {} });
  const pSh = pAll.filter(e => e.rx >= player.w * 0.3 && e.ratio > 0 && e.ratio < 0.6);
  if (pSh.length) {
    const t = pSh.reduce((a, b) => (b.ratio > a.ratio ? b : a));
    ok('player shadow squashed to match', squashed({ ratio: t.ratio, ry: t.ry }),
       `rx ${t.rx.toFixed(1)} ry ${t.ry.toFixed(1)} ratio ${t.ratio.toFixed(3)}` +
       (t.ry <= FLOOR + 0.01 ? ' (at the 1.5px floor)' : ''));
  } else {
    ok('player shadow measured', false, 'no player shadow ellipse found');
  }
  return { res, rows };
}, TARGET);

let pass = 0, fail = 0;
for (const r of R.res) {
  if (r.pass) { pass++; console.log(`  PASS  ${r.n}${r.extra ? '  (' + r.extra + ')' : ''}`); }
  else { fail++; console.log(`  FAIL  ${r.n}  ${r.extra}`); }
}
console.log('\nmeasured shadow ellipses:');
for (const r of R.rows) console.log(`  ${r.type.padEnd(12)} mob w ${String(r.w).padStart(3)}  rx ${String(r.rx).padStart(5)}  ry ${String(r.ry).padStart(4)}  ry/rx ${r.ratio}`);
console.log(`\n${pass} passed, ${fail} failed  (target ry/rx <= ${TARGET})`);
// A pre-existing fault in the background cache-warm routine fires on a PLAIN
// idle load of origin's build too (an <img> onerror handler setting .textContent
// on a null element), so it is not this suite's to report. Verified by loading
// both builds untouched and seeing the identical error. Everything else still
// fails the run, so a NEW error is not hidden by this filter.
const KNOWN = /Cannot set properties of null \(setting 'textContent'\)/;
const newErrs = errs.filter((e) => !KNOWN.test(e));
console.log('pageerrors:', errs.length, `(${errs.length - newErrs.length} known pre-existing)`, newErrs.slice(0, 3));
await browser.close(); server.kill();
process.exit(fail || newErrs.length ? 1 : 0);
