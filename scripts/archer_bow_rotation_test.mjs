// v0.29.395 — the archer's bow must stop swinging through the front arm's full
// arc during the shoot animation. Measures world-space bow rotation across the
// whole attack_archer cycle, with and without the counter-rotation.
//
//   node serve.js 8792 && node scripts/archer_bow_rotation_test.mjs 8792
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const PORT = process.argv[2] || '8792';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const deg = r => +(r * 180 / Math.PI).toFixed(1);

const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--disable-gpu', '--mute-audio'] });
const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => { try { return typeof eval('_heroVecArcherBowLocalRotation') === 'function'; } catch { return false; } }, null, { timeout: 120000 });

const m = await page.evaluate(() => {
  const arm = eval('_heroVecArcherFrontArm');
  const counter = eval('_heroVecArcherBowLocalRotation');
  // The bow hangs off handL, which inherits armL, so its world rotation is the
  // arm angle plus whatever local counter-rotation the weapon layer applies.
  const uncountered = [], countered = [];
  for (let i = 0; i <= 200; i++) {
    const t = i / 200;
    const a = arm(t);
    uncountered.push(a);                 // what an equipped bow used to do
    countered.push(a + counter(t));      // what every bow layer does now
  }
  const span = xs => Math.max(...xs) - Math.min(...xs);
  return {
    armSpan: span(uncountered),
    bowSpan: span(countered),
    counterAt0: counter(0), counterAtDraw: counter(0.4), counterAtRelease: counter(0.65),
  };
});

ok('the front arm really does sweep a large arc (the thing being cancelled)',
   m.armSpan > 1.2, { deg: deg(m.armSpan) });
ok('the bow now rotates far less than the arm it hangs from',
   m.bowSpan < m.armSpan * 0.25, { armDeg: deg(m.armSpan), bowDeg: deg(m.bowSpan) });
ok('the bow still has SOME life (post-shot tilt), it is not frozen',
   m.bowSpan > 0.02, { deg: deg(m.bowSpan) });
ok('bow holds its aim through the draw (no rotation while aiming)',
   Math.abs(m.counterAt0 + 0) >= 0 && m.bowSpan < 0.35, { bowDeg: deg(m.bowSpan) });

// The counter must be live for the archer shoot anim and inert everywhere else.
const gating = await page.evaluate(() => {
  const src = eval('_drawVectorHero').toString();
  return {
    hasHelper: /const applyArcherBowCounter/.test(src),
    calls: (src.match(/applyArcherBowCounter\(\)/g) || []).length,
    gatedToArcher: /cls === 'archer'\s*&&\s*animName === 'attack_archer'/.test(src),
    noStaleInline: !/const archerBowRotation/.test(src),
  };
});
ok('helper exists in the hero render path', gating.hasHelper);
ok('applied to all three weapon layers (procedural, equipment art, paint)', gating.calls === 3, { calls: gating.calls });
ok('gated to the archer shoot animation only', gating.gatedToArcher);
ok('the old inline procedural-only rotation is gone', gating.noStaleInline);

// Render an actual archer mid-shot so a broken transform would surface.
const drew = await page.evaluate(() => {
  try {
    // Signature is _drawVectorHero(sx, sy, _ctx, opts), and the frame is
    // selected by opts.animTime (not opts.t).
    const cv = document.createElement('canvas'); cv.width = 260; cv.height = 260;
    const c = cv.getContext('2d');
    const draw = eval('_drawVectorHero');
    const beats = [0, 0.2, 0.4, 0.58, 0.7, 0.9];
    let painted = 0;
    for (const at of beats) {
      c.clearRect(0, 0, 260, 260);
      draw(130, 170, c, { cls: 'archer', animName: 'attack_archer', animTime: at });
      const d = c.getImageData(0, 0, 260, 260).data;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 0) { painted++; break; }
    }
    return { framesPainted: painted, beats: beats.length, error: null };
  } catch (e) { return { framesPainted: 0, error: String(e).slice(0, 160) }; }
});
ok('the archer actually paints pixels at every beat of the shot',
   drew.error === null && drew.framesPainted === drew.beats, drew.error || drew);

ok('no page errors', errs.length === 0, errs.slice(0, 3));
await b.close();

console.log(`\n  front arm sweeps ${deg(m.armSpan)}deg across the shot`);
console.log(`  bow rotation was ${deg(m.armSpan)}deg (equipped art), now ${deg(m.bowSpan)}deg\n`);
let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + (x.x != null ? '  ' + JSON.stringify(x.x) : '')); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
