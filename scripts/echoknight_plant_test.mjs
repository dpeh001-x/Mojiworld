// Live test: ECHO KNIGHT STANDS ON THE FLOOR.
//
// Per user: "echoknight sprites are pushed too downwards from the floor in
// game (the bottom pixel sinks far down)". Measured before the fix: opaque
// bottom 11.8 px under the foot line, against a 2-6 px house norm. Cause: a
// hardcoded POST-clamp `dy += 7` in _lxMobPlantDy (deliberately placed after
// the 6 px bury clamp so the clamp could not eat it) on art whose bbox bottom
// is 847/850 - no padding for the push to absorb. The animator mirrored the
// same +7 in its POST_CLAMP_PX table; both are gone.
//
// The plant is measured the way the game draws it: drawMonster driven
// directly with a drawImage spy, the dest rect converted to world px via the
// scene transform, the drawn source alpha-scanned for its opaque bottom.
// Golden values for the other post-clamp types prove the change is scoped.
//   node scripts/echoknight_plant_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import net_ from 'node:net';
import { spawn } from 'node:child_process';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const free = (p) => new Promise((r) => { const s = net_.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8731; p <= 8899 && !PORT; p++) if (await free(p)) PORT = String(p);
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof spawnMonster === 'function' && typeof drawMonster === 'function'
  && typeof _lxMobPlantDy === 'function' && typeof MONSTER_SPRITE_META === 'object', null, { timeout: 120000 });
await page.waitForFunction(() => MONSTER_SPRITE_META.echoKnight && MONSTER_SPRITE_META.echoKnight.bboxBottomY != null, null, { timeout: 60000 });

const r = await page.evaluate(async () => {
  try { window._lxIsSanctuary = () => false; } catch (e) {}
  const out = {};
  // ---- the composed ladder, per type (pure function of the game's own inputs) ----
  const plant = (t) => {
    const mt = monsterTypes[t]; const spr = MONSTER_SPRITES[t];
    const srcH = spr && spr.naturalHeight || 0, srcW = spr && spr.naturalWidth || 0;
    const sizeFactor = Math.max(0.85, Math.min(1.20, Math.max(srcW, srcH) / 768));
    const targetH = Math.round((mt.h || 30) * 1.5 * sizeFactor * _lxMobScale(t));
    const meta = MONSTER_SPRITE_META[t] || {};
    const dy = _lxMobPlantDy(t, mt.flies === true, srcH, targetH);
    return Math.round((dy + ((meta.bboxBottomY + 1) / srcH) * targetH) * 100) / 100;   // opaque bottom vs foot line, +down
  };
  out.ladder = {};
  for (const t of ['echoKnight', 'boneGolem', 'grumpsquid', 'seastar', 'future_lyra', 'slime']) out.ladder[t] = plant(t);

  // ---- the real draw: spy the blit, alpha-scan what was drawn ----
  game.monsters = [];
  spawnMonster(600, 380, 'echoKnight', false);
  const m = game.monsters[0]; if (!m) return { err: 'no mob' };
  if (!game.camera) game.camera = { x: 0, y: 0 }; game.camera.x = 0; game.camera.y = 0;
  player.x = 1400; player.y = 400;
  const P = CanvasRenderingContext2D.prototype.drawImage;
  const main = document.getElementById('game');
  const alphaBottomFrac = (img) => {
    const c = document.createElement('canvas'); c.width = img.naturalWidth || img.width; c.height = img.naturalHeight || img.height;
    const x2 = c.getContext('2d', { willReadFrequently: true }); x2.drawImage(img, 0, 0);
    const d = x2.getImageData(0, 0, c.width, c.height).data;
    let B = -1;
    for (let y = c.height - 1; y >= 0 && B < 0; y--) for (let xx = 0; xx < c.width; xx += 2) if (d[(y * c.width + xx) * 4 + 3] > 24) { B = y; break; }
    return (B + 1) / c.height;
  };
  const sample = () => {
    const recs = [];
    CanvasRenderingContext2D.prototype.drawImage = function (img) {
      const a = arguments, t = this.getTransform();
      if (this.canvas === main) recs.push({ img, d: [...a].slice(1), tr: [t.a, t.d, t.e, t.f] });
      return P.apply(this, arguments);
    };
    try { drawMonster(m); } finally { CanvasRenderingContext2D.prototype.drawImage = P; }
    const fr = recs.find(q => q.img && q.d.length >= 4 && (q.img.naturalWidth || q.img.width) > 200);
    if (!fr) return null;
    // v0.30.420+ the mob draw emits no shadow blit to borrow the scene transform
    // from, and the x-axis flips with facing - so the vertical mapping comes
    // from the blit's OWN y-scale (never flipped) and the camera (0 here)
    const Vs = Math.abs(fr.tr[1]), Vf = (game.camera.y || 0) * Vs;
    const ly = fr.tr[1] / Vs, wy = (fr.tr[3] - Vf) / Vs;
    const dn = fr.d.length, dy = fr.d[dn - 3], dh = fr.d[dn - 1];
    const y1 = Math.min(wy + ly * dy, wy + ly * (dy + dh)), y2 = Math.max(wy + ly * dy, wy + ly * (dy + dh));
    const opBot = y1 + alphaBottomFrac(fr.img) * (y2 - y1);
    // every mob blit is a BAKED canvas (v0.29.744 tint/soft bake), so the drawn
    // object carries no path - resolve the underlying Image through the bake's
    // own source pointers, exactly as _detectSpriteBboxBottom does
    let under = fr.img, hops = 0;
    while (under && !under.src && hops++ < 4) under = under._lxBboxSrc || under._lxEdgeSrc || under._lxSrc || under._lxTintSrc || null;
    const src = (under && under.src) ? under.src.split('/').slice(-2).join('/') : 'cached-canvas';
    return { src, sinkPx: Math.round((opBot - (m.y + m.h)) * 10) / 10, obj: fr.img };
  };
  m.vx = 0; m.atkAnimUntil = 0; m._frameIsAttack = false;
  // the baked blit canvas is built on the FIRST draw, so the first sample can
  // legitimately see no big blit yet - retry until one lands
  let st = null;
  for (let i = 0; i < 30 && !st; i++) { st = sample(); if (!st) await new Promise(r => setTimeout(r, 150)); }
  out.staticDraw = st && { src: st.src, sinkPx: st.sinkPx };
  // attack frames decode lazily on first draw - poll until the blit comes from
  // a different baked object than the static (or resolves to an attack path)
  m.atkAnimUntil = performance.now() + 120000; m._frameIsAttack = true;
  let atk = null;
  for (let i = 0; i < 40; i++) {
    atk = sample();
    if (atk && (/monsters\/attack/.test(atk.src) || (st && atk.obj !== st.obj))) break;
    await new Promise(r => setTimeout(r, 150));
  }
  out.attackDraw = atk && { src: atk.src, sinkPx: atk.sinkPx, differentObject: !!(st && atk.obj !== st.obj) };
  game.monsters = [];
  return out;
});
// ---- the animator's mirrored table (served from the same tree) ----
const anim = await (await fetch(`http://localhost:${PORT}/monster_animator.html`)).text();
const pc = (anim.match(/const POST_CLAMP_PX = \{([^}]*)\}/) || [])[1] || '';
await b.close(); srv.kill();

ok('the plant ladder puts echoKnight within the house norm (0..6 px under the foot line)',
  r.ladder && r.ladder.echoKnight >= 0 && r.ladder.echoKnight <= 6,
  { echoKnight: r.ladder && r.ladder.echoKnight, was: 11.84 });
ok('the REAL draw agrees: opaque bottom of the static sprite within 6 px of the floor',
  r.staticDraw && r.staticDraw.sinkPx >= -1 && r.staticDraw.sinkPx <= 6, r.staticDraw);
ok('an ATTACK frame plants the same way (frames anchor through the same ladder)',
  r.attackDraw && (/monsters\/attack/.test(r.attackDraw.src) || r.attackDraw.differentObject)
  && r.attackDraw.sinkPx >= -3 && r.attackDraw.sinkPx <= 8, r.attackDraw);
ok('golden: the other post-clamp types are untouched (boneGolem 2.99, grumpsquid 9.4, seastar 6.93, future_lyra 2.24, slime 3)',
  r.ladder && Math.abs(r.ladder.boneGolem - 2.99) < 0.3 && Math.abs(r.ladder.grumpsquid - 9.4) < 0.3
  && Math.abs(r.ladder.seastar - 6.93) < 0.3 && Math.abs(r.ladder.future_lyra - 2.24) < 0.3 && Math.abs(r.ladder.slime - 3) < 0.3,
  r.ladder);
ok('the animator mirror dropped echoKnight and kept the other four (parity)',
  pc && !/echoKnight/.test(pc) && /boneGolem: 10/.test(pc) && /grumpsquid: 4/.test(pc) && /future_lyra: 9/.test(pc) && /seastar: 6/.test(pc),
  { POST_CLAMP_PX: pc.trim() });
ok('no page errors', errs.length === 0, errs.slice(0, 3));
for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter(q => q.pass).length}/${results.length} checks passed`);
process.exit(results.every(q => q.pass) ? 0 : 1);
