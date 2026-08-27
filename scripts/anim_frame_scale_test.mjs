// Per-frame calib scale (fs) certification — v0.29.216 policy.
// The fs ENGINE CAPABILITY (game + animator) must keep working, but as of
// v0.29.216 NO boss bakes it: the user prefers frames to render at the raw
// art's proportions ("reflect how it shows on the raw form without warping").
// The capability is certified by injecting fs at runtime, not via a bake.
import { readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
// Resolve a browser that actually EXISTS. The Linux path stays first so CI is
// untouched, but it is the only candidate this line used to have - and with
// PW_EXE unset on a dev machine that made the launch throw before a single
// assertion ran. 66 scripts shared the line, so 66 gates were passing by never
// executing. Falling through to the local Chrome is what the tests that do run
// already rely on (they pass channel:'chrome').
const EXE = [process.env.PW_EXE,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
].find((p) => p && existsSync(p));
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

// ---- policy: no fs baked anywhere (raw rendering) ----
const calibSrc = readFileSync('data/anim_calib.js', 'utf8');
const calib = JSON.parse(calibSrc.match(/window\.LX_ANIM_CALIB = (\{[\s\S]*?\n\});/)[1]);
const baked = [];
for (const [t, states] of Object.entries(calib))
  for (const [st, e] of Object.entries(states))
    if (Array.isArray(e.fs)) baked.push(`${t}.${st}`);
ok('policy: no per-frame fs baked (bosses render at raw art proportions)', baked.length === 0, baked);

// ---- plumbing: capability present in both renderers ----
const game = readFileSync('mojiworld_game.html', 'utf8');
ok('game: frame images stamped with their index (_lxFi)', game.includes("img._lxFi = i;"));
ok('game: calib loader passes fs through', game.includes('Array.isArray(e.fs)'));
ok('game: boss draw folds fs[frameIdx] into the scale', game.includes('_bc.fs[sprite._lxFi]'));

const anim = readFileSync('monster_animator.html', 'utf8');
ok('animator: loadCalib preserves fs', anim.includes('out[t][s].fs = e.fs.map'));
ok('animator: stage draw applies fs[idx]', anim.includes('c.fs[idx]'));

// ---- headless: runtime-injected fs still scales (capability alive) ----
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--disable-gpu', '--mute-audio'] });
try {
  const p = await b.newContext({ serviceWorkers: 'block' }).then(c => c.newPage());
  const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 140)));
  await p.goto('http://localhost:8080/monster_animator.html', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => window.__core && window.__app, null, { timeout: 30000 });
  const r = await p.evaluate(async () => {
    window.__app.select('towerArbiter');
    await new Promise(res => setTimeout(res, 2000));
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
    const c = window.__app.CALIB().towerArbiter.walk;
    const bakedFs = c.fs || null;
    const hRaw = colH(80);              // walk frame 1, no fs
    c.fs = [1, 1.8, 1, 1, 1, 1, 1, 1, 1];
    const hScaled = colH(80);           // same frame, injected fs
    if (bakedFs) c.fs = bakedFs; else delete c.fs;
    return { hRaw, hScaled };
  });
  ok('runtime-injected fs scales the frame on stage (capability alive)',
     r.hScaled > r.hRaw * 1.15, r);
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} finally { await b.close(); }

let pass = 0, fail = 0;
for (const r of results) { (r.pass ? pass++ : fail++); console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.n + (r.x !== undefined ? '  ' + JSON.stringify(r.x) : '')); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
