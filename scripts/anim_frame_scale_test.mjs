// Per-frame calib scale (fs) certification — v0.29.x. Frame sets whose ART
// draws the figure at inconsistent sizes (towerArbiter walk/attack) are
// normalised by a baked per-frame scale array, applied identically in the
// game renderer and the animator preview.
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

// ---- static checks: bake + plumbing present in both renderers ----
const calibSrc = readFileSync('anim_calib.js', 'utf8');
const calib = JSON.parse(calibSrc.match(/window\.LX_ANIM_CALIB = (\{[\s\S]*?\n\});/)[1]);
const ta = calib.towerArbiter || {};
ok('bake: towerArbiter walk.fs is a 9-frame array with a real correction',
   Array.isArray(ta.walk && ta.walk.fs) && ta.walk.fs.length === 9 && ta.walk.fs.some(f => f > 1.2), ta.walk && ta.walk.fs);
ok('bake: towerArbiter attack.fs is a 9-frame array', Array.isArray(ta.attack && ta.attack.fs) && ta.attack.fs.length === 9, ta.attack && ta.attack.fs);

const game = readFileSync('mojiworld_game.html', 'utf8');
ok('game: frame images stamped with their index (_lxFi)', game.includes("img._lxFi = i;"));
ok('game: calib loader passes fs through', game.includes('Array.isArray(e.fs)'));
ok('game: boss draw folds fs[frameIdx] into the scale', game.includes('_bc.fs[sprite._lxFi]'));

const anim = readFileSync('monster_animator.html', 'utf8');
ok('animator: loadCalib preserves fs', anim.includes('out[t][s].fs = e.fs.map'));
ok('animator: stage draw applies fs[idx]', anim.includes('c.fs[idx]'));

// ---- headless: the animator actually renders the correction ----
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--disable-gpu', '--mute-audio'] });
try {
  const p = await b.newContext({ serviceWorkers: 'block' }).then(c => c.newPage());
  const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 140)));
  await p.goto('http://localhost:8080/monster_animator.html', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => window.__core && window.__app, null, { timeout: 30000 });
  const r = await p.evaluate(async () => {
    window.__app.select('towerArbiter');
    await new Promise(res => setTimeout(res, 2000));
    const c = window.__app.CALIB().towerArbiter;
    // paint the tiny walk frame (idx 1, 80ms clock) and the full-size frame
    // (idx 0); measure the knight's painted height in the walk column.
    const cv = document.querySelector('canvas'), ctx = cv.getContext('2d');
    const colH = (t) => {
      window.__app._setNow(t); window.__app.paint();
      const cols = window.__app.columns();
      const walk = cols.find(k => k.state === 'walk');
      const x0 = Math.max(0, Math.round(walk.cx - walk.slotW / 2)), w = Math.round(walk.slotW);
      const d = ctx.getImageData(x0, 0, w, walk.groundY).data;
      let top = -1;
      for (let y = 0; y < walk.groundY && top < 0; y++) {
        let m = 0;
        for (let x = 0; x < w; x++) m += d[(y * w + x) * 4 + 3];
        if (m > 2000) top = y;
      }
      return walk.groundY - top;
    };
    const fs = c.walk.fs;
    const hWith = colH(80);            // frame 1, correction on
    c.walk.fs = null;
    const hWithout = colH(80);         // same frame, correction off
    c.walk.fs = fs;
    return { fsLoaded: fs, hWith, hWithout };
  });
  ok('animator CALIB carries the baked fs array', Array.isArray(r.fsLoaded) && r.fsLoaded[1] > 1.2, r.fsLoaded);
  // the row-mass threshold skips thin sword rows, so the measured growth is
  // the knight body (< the raw 2.01 fs factor) — >1.25x still proves fs applied
  ok('fs correction visibly scales the under-drawn walk frame up on stage',
     r.hWith > r.hWithout * 1.25, { hWith: r.hWith, hWithout: r.hWithout });
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} finally { await b.close(); }

let pass = 0, fail = 0;
for (const r of results) { (r.pass ? pass++ : fail++); console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.n + (r.x !== undefined ? '  ' + JSON.stringify(r.x) : '')); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
