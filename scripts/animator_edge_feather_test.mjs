// Animator edge-feather parity certification: the monster_animator preview
// must soften clipped sprite edges exactly like the game (v0.29.198).
import { chromium } from 'playwright-core';
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--disable-gpu', '--mute-audio'] });
try {
  const p = await b.newContext({ serviceWorkers: 'block' }).then(c => c.newPage());
  const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 140)));
  await p.goto('http://localhost:8080/monster_animator.html', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => window.__core && window.__core.softDraw && window.__app, null, { timeout: 30000 });
  await p.waitForTimeout(1200);

  // 1) helper exported + behaves like the game's (probe / soften / pass-through)
  const r = await p.evaluate(async () => {
    const C = window.__core;
    const load = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
    const clipped = await load('Sprites/monsters/idle/bonebosn_0.webp');
    const clean = await load('Sprites/monsters/mushpup.webp');
    const mk = () => { const c = document.createElement('canvas'); c.width = 160; c.height = 160; return c; };
    const A = mk(), B = mk();
    A.getContext('2d').drawImage(clipped, 0, 0, 160, 160);
    C.softDraw(B.getContext('2d'), clipped, 0, 0, 160, 160);
    const rowAlpha = (cv, y) => { const d = cv.getContext('2d').getImageData(0, y, 160, 1).data; let s = 0; for (let i = 3; i < d.length; i += 4) s += d[i]; return s; };
    return {
      clippedEdges: C.edgesTouched(clipped), cleanEdges: C.edgesTouched(clean),
      rawTop: rowAlpha(A, 0), softTop: rowAlpha(B, 0),
      rawBottom: rowAlpha(A, 158), softBottom: rowAlpha(B, 158),
    };
  });
  ok('animator helper flags clipped frames (bonebosn top)', !!(r.clippedEdges && r.clippedEdges.t), r.clippedEdges);
  ok('animator helper ignores padded art', r.cleanEdges === null, { cleanEdges: r.cleanEdges });
  ok('animator softens the clipped top edge (>60% alpha drop)', r.softTop < r.rawTop * 0.4, { rawTop: r.rawTop, softTop: r.softTop });
  ok('animator leaves the bottom (feet) edge untouched', r.softBottom === r.rawBottom, { rawBottom: r.rawBottom, softBottom: r.softBottom });

  // 2) the STAGE actually uses it: select bonebosn, paint, and check the drawn
  //    frame's top edge on the stage canvas is feathered (no hard row).
  const stage = await p.evaluate(async () => {
    window.__app.select('bonebosn');
    await new Promise(res => setTimeout(res, 1500));
    for (let i = 0; i < 12; i++) { window.__app._setNow(performance.now() + i * 130); window.__app.paint(); }
    const cv = document.querySelector('canvas');
    const ctx = cv.getContext('2d');
    const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
    // find the topmost row with any alpha, and measure its alpha mass vs 6 rows below —
    // a feathered top ramps up gradually; a hard clip starts at full mass.
    const W = cv.width;
    const rowMass = (y) => { let s = 0; for (let x = 0; x < W; x++) s += d[(y * W + x) * 4 + 3]; return s; };
    let top = -1;
    for (let y = 0; y < cv.height; y++) { if (rowMass(y) > 200) { top = y; break; } }
    if (top < 0) return { err: 'nothing painted' };
    return { top, massTop: rowMass(top), massDeeper: rowMass(top + 8) };
  });
  ok('stage renders bonebosn with a RAMPED top edge (feather visible: top row mass << row+8)',
     !stage.err && stage.massTop < stage.massDeeper * 0.6, stage);

  // 3) on-stage indicator: clipped art announces "edge feather active" in the
  //    caption; unclipped art stays silent. Recorded by hooking fillText.
  const cap = await p.evaluate(async () => {
    const texts = [];
    const orig = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (t, ...a) { texts.push(String(t)); return orig.call(this, t, ...a); };
    const run = async (type) => {
      window.__app.select(type);
      await new Promise(res => setTimeout(res, 1200));
      texts.length = 0;
      window.__app._setNow(performance.now()); window.__app.paint();
      return texts.filter(t => t.includes('edge feather active'));
    };
    const clipped = await run('bonebosn');
    const clean = await run('kingKrook');
    CanvasRenderingContext2D.prototype.fillText = orig;
    return { clipped, clean };
  });
  ok('stage caption announces the feather for clipped art (bonebosn: top, one per state panel)',
     cap.clipped.length >= 1 && cap.clipped.every(t => t.includes('top')), cap.clipped);
  ok('stage caption stays silent for unclipped art (kingKrook)', cap.clean.length === 0, cap.clean);
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} finally { await b.close(); }
let pass = 0, fail = 0;
for (const r of results) { (r.pass ? pass++ : fail++); console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.n + (r.x !== undefined ? '  ' + JSON.stringify(r.x) : '')); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
