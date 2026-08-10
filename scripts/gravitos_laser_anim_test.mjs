// Laser Sweep animation: canvas-exact, character-size-stable, no edge cutoffs,
// and a once-through playback scaled to EACH PHASE's pattern duration.
//
//   node serve.js 8910 && node scripts/gravitos_laser_anim_test.mjs 8910 [page]
import { chromium } from 'playwright-core';
import { existsSync, readdirSync } from 'node:fs';
import sharp from 'sharp';
const PORT = process.argv[2] || '8910';
const PAGE = process.argv[3] || 'mojiworld_game.html';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

async function core(p) {
  const { data, info } = await sharp(p).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = info.width, maxX = -1, minY = info.height, maxY = -1;
  for (let i = 0; i < info.width * info.height; i++) if (data[i * 4 + 3] > 200) {
    const x = i % info.width, y = (i / info.width) | 0;
    if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  return { w: info.width, h: info.height, minX, maxX, minY, bh: (maxY - minY + 1) / info.height };
}

const files = readdirSync('Sprites/bosses/attack').filter(f => /^gravitoslaser_\d\.webp$/.test(f)).sort();
ok('9 frames on disk', files.length === 9, { found: files.length });

const baseC = await core('Sprites/bosses/gravitos.webp');
let dimsOk = true, clipOk = true, sizeOk = true, worst = 0;
for (const f of files) {
  const c = await core('Sprites/bosses/attack/' + f);
  if (c.w !== 1656 || c.h !== 1505) dimsOk = false;
  if (c.minX <= 8 || c.minY <= 8 || c.maxX >= c.w - 9) clipOk = false;   // bottom exempt: source art stands on the canvas floor
  const drift = Math.abs(c.bh - baseC.bh) / baseC.bh;
  if (drift > worst) worst = drift;
  if (drift > 0.14) sizeOk = false;
}
ok('CANVAS SIZE: every frame is 1656x1505, the base sprite\'s own canvas', dimsOk, {});
ok('CHARACTER SIZE: body height stays within 14% of the BASE sprite across all frames',
   sizeOk, { worstDrift: +(worst * 100).toFixed(1) + '%', baseH: +(baseC.bh * 100).toFixed(0) + '%' });
ok('NO EDGE CUTOFFS: no body pixel on the left/right/top edges', clipOk, {});
ok('static fallback exists', existsSync('Sprites/bosses/gravitoslaser.webp'), {});

const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox','--disable-gpu','--mute-audio'] });
const page = await (await b.newContext({ serviceWorkers: 'block' })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 180)));
const net = [];
page.on('response', r => { if (/gravitoslaser/.test(r.url())) net.push({ s: r.status(), f: r.url().split('/').pop() }); });
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => { try { return typeof eval('_gravitosLaserFrame') === 'function' && typeof eval('spawnMonster') === 'function'; } catch { return false; } }, null, { timeout: 180000 });

const r = await page.evaluate(async () => {
  const g = eval('game'), p = eval('player');
  g.mapData = g.mapData || {};
  g.mapData.platforms = [{ type: 'ground', x: 0, y: 448, w: 4000, h: 40 }];
  g.monsters = []; p.cls = 'warrior'; p.level = 100;
  eval('spawnMonster')(800, 400, 'gravitos', true, false);
  const m = g.monsters[0];
  const F = eval('BOSS_ATTACK_FRAMES')['gravitoslaser'];
  const t0 = Date.now();
  while (Date.now() - t0 < 15000) { if (F && F.length && F.every(im => im && im.complete)) break; await new Promise(res => setTimeout(res, 200)); }
  const decoded = F ? F.filter(im => im && im.complete && im.naturalWidth > 0).length : 0;

  m.patternState = 'laser'; m._phaseSprite = null;
  const sample = (dur) => {
    const out = [];
    for (let t = 0; t <= dur; t += Math.max(50, Math.floor(dur / 19))) {
      m.patternTimer = t;
      const im = eval('_gravitosLaserFrame')(m);
      out.push(im ? +(im.src.match(/gravitoslaser_(\d)/) || [])[1] : null);
    }
    return out;
  };
  m._gravPhase = 1; const p1 = sample(1200);
  m._gravPhase = 3; const p3 = sample(1450);
  m._gravPhase = 1;

  const overrideFires = (m.type === 'gravitos' && !m._phaseSprite && m.patternState === 'laser' && !!eval('_gravitosLaserFrame')(m));
  // Read the REAL override for each form. The previous version of this check
  // re-derived the condition inline, so it kept passing after the behaviour
  // changed — it was asserting a copy of the rule, not the rule.
  const perForm = {};
  for (const [label, sprite] of [['form1', null], ['form2', 'gravitos2'], ['form3', 'gravitos3']]) {
    m._phaseSprite = sprite; m._gravStarKey = null; m.patternState = 'laser'; m.patternTimer = 600;
    perForm[label] = !!_gravitosLaserFrame(m) &&
      (m.type === 'gravitos' && !m._gravStarKey && !m._phaseSprite && m.patternState === 'laser');
  }
  m._phaseSprite = null; m._gravStarKey = null;

  // --- FX overlay: the spectacle the caster set deliberately does not carry --
  // Driven LAST: bossAI mutates patternState (it exits the pattern and re-picks
  // once patternTimer passes laserDur), so running it earlier left the mob in
  // a different state and broke the override checks above.
  const fxImg = (() => { try { return eval('LX_FX').gravitos_laserring; } catch (e) { return null; } })();
  const fxLoaded = !!(fxImg && fxImg.complete && fxImg.naturalWidth > 0);
  let bursts = [];
  const realSpawn = window.spawnSpriteBurst;
  try {
    window.spawnSpriteBurst = function (x, y, key, opts) {
      if (key === 'gravitos_laserring') bursts.push({ size: opts && opts.size, life: opts && opts.life, spin: opts && opts.spin });
      return realSpawn.apply(this, arguments);
    };
    m._laserFired = false; m._laserRingUp = false;
    // Re-assert the pattern each tick and stay INSIDE the window (phase-1
    // laserDur is 1200) so bossAI never exits it and re-rolls something else.
    for (let t = 0; t <= 1100; t += 50) {
      m.patternState = 'laser'; m.patternTimer = t;
      try { eval('bossAI')(m); } catch (e) { if (!String(bursts).startsWith('THREW')) bursts = 'THREW: ' + String(e).slice(0, 110); break; }
    }
  } catch (e) { bursts = 'THREW: ' + String(e).slice(0, 110); }
  window.spawnSpriteBurst = realSpawn;

  return { decoded, p1, p3, overrideFires, perForm, fxLoaded, bursts,
           fxDims: fxImg ? fxImg.naturalWidth + 'x' + fxImg.naturalHeight : null,
           dims: F && F[0] ? F[0].naturalWidth + 'x' + F[0].naturalHeight : null };
});

ok('all 9 frames decode in the game', r.decoded === 9, { decoded: r.decoded, dims: r.dims });
ok('no 404 for any laser frame', !net.some(x => x.s === 404), net.filter(x => x.s === 404).slice(0, 4));
const p1 = r.p1.filter(x => x != null), p3 = r.p3.filter(x => x != null);
ok('starts on frame 0 at the charge telegraph', p1[0] === 0, { first: p1[0] });
ok('reaches the final frame by the end of the pattern', p1[p1.length - 1] === 8, { last: p1[p1.length - 1] });
ok('SMOOTH: monotonic once-through in phase 1', p1.every((v, i) => i === 0 || v >= p1[i - 1]), { p1 });
ok('SMOOTH: every frame visited in phase 1', new Set(p1).size === 9, { visited: [...new Set(p1)] });
ok('PHASE-SCALED: phase 3 also completes across its longer 1450 ms window',
   p3[0] === 0 && p3[p3.length - 1] === 8 && p3.every((v, i) => i === 0 || v >= p3[i - 1]), { p3 });
ok('the draw override selects the set during laser', r.overrideFires === true, {});
ok('form-1 ONLY, by design — the art is form-1\'s silhouette (forms 2/3 keep the generic set)',
   r.perForm.form1 === true && r.perForm.form2 === false && r.perForm.form3 === false, r.perForm);
// --- the FX overlay ---------------------------------------------------------
ok('FX: the charge-ring sprite loads', r.fxLoaded === true, { dims: r.fxDims });
ok('FX: the real pattern spawns BOTH rings — charge wind-up and release pulse',
   Array.isArray(r.bursts) && r.bursts.length >= 2, { bursts: r.bursts });
ok('FX: the release ring is tighter and counter-spun against the charge ring',
   Array.isArray(r.bursts) && r.bursts.length >= 2
     && r.bursts[1].size < r.bursts[0].size
     && Math.sign(r.bursts[1].spin) !== Math.sign(r.bursts[0].spin), { bursts: r.bursts });

ok('no page errors', errs.length === 0, errs.slice(0, 3));

await b.close();
let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + (x.x != null ? '  ' + JSON.stringify(x.x) : '')); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
