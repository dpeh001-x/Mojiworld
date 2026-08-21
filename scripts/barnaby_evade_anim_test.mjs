// Barnaby's ducking and weaving has its own art, per user: "For barnaby boss
// he is doing alot of ducking and weaving, regenerate new duck and weave
// sprites animation compliment his fighting style" + "ensure the canvas and
// character size stays constant throughout the idle, walk, attack, duck weave
// animations".
//
// Two halves:
//   ART CONTRACT — all five sets (idle, walk, attack, duck, weave) share ONE
//   canvas and ONE character scale. _drawBossSprite derives on-screen size
//   from canvas geometry (sourceMaxDim/1024) and anchors feet to the idle
//   set's bbox, so a set on different geometry makes the boss change size or
//   hop vertically at every state switch. Graded by measurement, not by trust
//   in the bake.
//   LIVE DRAW — airborne frames draw the WEAVE set, the landing window draws
//   the DUCK set, and a settled grounded boss draws neither. Before this
//   build, every airborne dart played the walk loop.
// Run: node scripts/barnaby_evade_anim_test.mjs [file.html]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const _target = args[0] || 'mojiworld_game.html';
const URL = 'file:///' + (path.isAbsolute(_target) ? _target : path.join(ROOT, _target)).split(path.sep).join('/');
let bad = 0;
const check = (ok, label, detail) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail !== undefined ? '  - ' + JSON.stringify(detail) : ''}`); if (!ok) bad++; };

// ---------- ART CONTRACT ----------
const TYPE = 'young_confused_barnaby';
const ALPHA = 24;
const bbox = async (p) => {
  const { data, info } = await sharp(p).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  let y0 = H, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
    if (data[(y * W + x) * C + 3] > ALPHA) { if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return { W, H, h: y1 - y0 + 1, foot: y1 };
};
const SETS = ['idle', 'walk', 'attack', 'duck', 'weave'];
const meta = {};
for (const set of SETS) {
  meta[set] = await bbox(path.join(ROOT, 'Sprites', 'bosses', set, `${TYPE}_0.webp`));
}
const ref = meta.idle;
console.log('  frame-0 per set: ' + SETS.map((s) => `${s} ${meta[s].W}x${meta[s].H} h=${meta[s].h} foot=${meta[s].foot}`).join(' | '));
check(SETS.every((s) => meta[s].W === ref.W && meta[s].H === ref.H),
      'CANVAS: all five sets share one canvas', meta);
check(SETS.every((s) => Math.abs(meta[s].h - ref.h) <= ref.h * 0.03),
      'SIZE: frame-0 character height within 3% of idle across all five sets', meta);
check(SETS.every((s) => Math.abs(meta[s].foot - ref.foot) <= 10),
      'FEET: frame-0 foot line within 10px of idle across all five sets', meta);
// the duck actually ducks: some frame dips well below standing height
let duckMin = Infinity;
for (let i = 0; i < 9; i++) duckMin = Math.min(duckMin, (await bbox(path.join(ROOT, 'Sprites', 'bosses', 'duck', `${TYPE}_${i}.webp`))).h);
check(duckMin <= ref.h * 0.92, 'the duck set genuinely crouches (some frame <= 92% of standing height)',
      { duckMin, standing: ref.h });

// ---------- LIVE DRAW ----------
const browser = await chromium.launch({ channel: 'chrome', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof loadMap === 'function', { timeout: 90000 });
const r = await page.evaluate(async () => {
  const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
  window._lxBootGateDone = true;
  const c = document.querySelector('#class-select-modal .cls-card');
  if (c && !player.cls) { try { c.click(); } catch (e) {} }
  const g = document.getElementById('class-select-modal'); if (g) g.style.display = 'none';
  player.level = 90; player.hp = player.maxHp = 9e8;
  loadMap('forest');
  for (let i = 0; i < 240; i++) { if (game.currentMap === 'forest') break; await new Promise((res) => requestAnimationFrame(res)); }
  for (let i = 0; i < 20; i++) await new Promise((res) => requestAnimationFrame(res));
  const out = {};
  out.stores = { weave: !!(typeof BOSS_WEAVE_FRAMES !== 'undefined'), duck: !!(typeof BOSS_DUCK_FRAMES !== 'undefined') };
  if (!out.stores.weave || !out.stores.duck) return out;
  const wArr = BOSS_WEAVE_FRAMES['young_confused_barnaby'] || [];
  const dArr = BOSS_DUCK_FRAMES['young_confused_barnaby'] || [];
  out.loaded = { weave: wArr.length, duck: dArr.length };
  // decode wait
  for (let i = 0; i < 400; i++) {
    const all = [...wArr, ...dArr];
    if (all.length && all.every((im) => im && (im.tagName === 'CANVAS' || (im.complete && im.naturalWidth > 0)))) break;
    await new Promise((res) => requestAnimationFrame(res));
  }
  game.monsters = [];
  let b = null; try { b = spawnMonster(500, 300, 'young_confused_barnaby', true, false); } catch (e) {}
  b = game.monsters[game.monsters.length - 1];
  if (!b) return { ...out, noBoss: true };
  b.currentHp = b.maxHp = 9e9;
  // Hook by REFERENCE (frames may be right-sized into <canvas> with no .src) —
  // and count ONLY draws onto the game canvas. _lxShrinkFrames right-sizes
  // frames by drawing the very same Image references into ITS OWN offscreen
  // canvases, lazily, whenever the per-frame budget allows — an unfiltered
  // hook counts those bakes as renders and flags a "settled" boss for a draw
  // no player ever saw (measured: exactly one phantom violation per run).
  const mainCv = document.getElementById('game-canvas') || document.querySelector('canvas');
  const seen = { weave: 0, duck: 0 };
  const orig = CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage = function (img, ...a) {
    try {
      if (this.canvas === mainCv) {
        if (wArr.indexOf(img) >= 0) seen.weave++;
        else if (dArr.indexOf(img) >= 0) seen.duck++;
      }
    } catch (e) {}
    return orig.call(this, img, ...a);
  };
  game.paused = false;
  // Toss him: airborne long enough to weave, then land to duck.
  const toss = async () => {
    b.y -= 40; b.vy = -14; b.onGround = false;
    for (let i = 0; i < 900; i++) {
      if (b.onGround && i > 10) break;
      await new Promise((res) => requestAnimationFrame(res));
    }
  };
  await toss();
  out.airSeen = { ...seen };
  // LANDING, two separable claims. (a) the landing STAMPED a duck window —
  // deterministic state, no draw required. (b) the duck DRAW path works —
  // proven under a held-open window, because under headless rAF jank the
  // whole organic 260ms window can elapse without a single game draw in it
  // (measured: duck 0 in ~1 run in 3), which is scheduler starvation, not a
  // wiring defect; at a real 60fps the window is ~15 drawn frames.
  out.landStamped = (b._lxDuckUntil || 0) > 0;
  b._lxDuckUntil = performance.now() + 2500;
  const dBefore0 = seen.duck;
  for (let i = 0; i < 600; i++) {
    if (seen.duck > dBefore0) break;
    await new Promise((res) => requestAnimationFrame(res));
  }
  out.afterLand = { ...seen };
  // settle fully: a PINNED grounded boss past the duck window must draw
  // neither set. Pinning is the point — left to wander, the live boss steps
  // off forest ledges, and under headless rAF jank a whole fall-and-land can
  // compress into a single observed frame: a legitimate landing duck that a
  // wall-clock "he should be settled by now" assertion misreads as a failure
  // (it flaked exactly that way, one violation in forty frames).
  const px = b.x, py = b.y;
  // Also strip his jump: the AI gate is `m.jump > 0`, and under headless rAF
  // jank a single observed frame can contain an ENTIRE ai-rolled hop — jump,
  // rise, land, fresh duck stamp — which is the feature working, not a
  // violation. With jump 0 he stays grounded and the claim is testable.
  b.jump = 0;
  b._lxDuckUntil = 0; b._lxAirFrames = 0; b.vx = 0; b.vy = 0;
  let settledFrames = 0, settledViolations = 0;
  for (let i = 0; i < 1200 && settledFrames < 40; i++) {
    b.x = px; b.y = py; b.vx = 0; b.vy = 0;
    const eligible = b.onGround && performance.now() > ((b._lxDuckUntil || 0) + 80);
    const w0 = seen.weave, d0 = seen.duck;
    await new Promise((res) => requestAnimationFrame(res));
    if (eligible && b.onGround) {
      settledFrames++;
      if (seen.weave > w0 || seen.duck > d0) settledViolations++;
    }
  }
  out.settledDelta = { frames: settledFrames, violations: settledViolations };

  // ---------- FLOW (v0.29.960): the seams between states ----------
  // (a) duck is once-through-and-HOLD: deep into its window it returns the
  //     LAST ready frame, never a ping-pong wrap back into the crouch.
  if (typeof _bossDuckFrame === 'function') {
    const held = _bossDuckFrame('young_confused_barnaby', { _animSt: 'duck', _animStAt: performance.now() - 1000 });
    const lastReady = dArr[(dArr._readyN || dArr.length) - 1];
    out.duckHold = { holds: !!held && held === lastReady };
  }
  // (b) weave crossfades like walk: the pair helper hands back two distinct
  //     adjacent frames and a blend fraction.
  if (typeof _bossWeavePair === 'function') {
    const pr = _bossWeavePair('young_confused_barnaby', { _animSt: 'weave', _animStAt: performance.now() - 500, _animSeed: 0 });
    out.weavePair = pr ? { distinct: pr.a !== pr.b, f: +(pr.f || 0).toFixed(3), inRange: pr.f >= 0 && pr.f < 1 } : null;
  }
  // (c) THE CHAIN: hop -> weave from the FIRST frames (vy gate), land -> duck,
  //     hop again inside the duck window -> weave again — and never one walk
  //     or idle frame anywhere in it. This is the seam the old gate leaked:
  //     airFrames > 2 alone put 1-2 WALK frames at the start of every hop.
  const wkArr = (typeof BOSS_WALK_FRAMES !== 'undefined' && BOSS_WALK_FRAMES['young_confused_barnaby']) || [];
  const idArr = (typeof BOSS_IDLE_FRAMES !== 'undefined' && BOSS_IDLE_FRAMES['young_confused_barnaby']) || [];
  let chainMode = false, chainWalkIdle = 0, chainWeaveEarly = 0;
  const orig2 = CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage = function (img, ...a) {
    try {
      if (this.canvas === mainCv && chainMode) {
        if (wkArr.indexOf(img) >= 0 || idArr.indexOf(img) >= 0) chainWalkIdle++;
      }
    } catch (e) {}
    return orig2.call(this, img, ...a);
  };
  b._lxDuckUntil = 0; b._lxAirFrames = 0;
  const wSeen0 = seen.weave;
  chainMode = true;
  b.y -= 6; b.vy = -14; b.onGround = false;
  for (let i = 0; i < 3; i++) await new Promise((res) => requestAnimationFrame(res));
  chainWeaveEarly = seen.weave - wSeen0;   // the vy gate: weave within 3 frames
  for (let i = 0; i < 900; i++) { if (b.onGround && i > 10) break; await new Promise((res) => requestAnimationFrame(res)); }
  const duckAtLand = (b._lxDuckUntil || 0) > 0;
  // chained hop, inside the duck window
  b.y -= 6; b.vy = -14; b.onGround = false;
  for (let i = 0; i < 900; i++) { if (b.onGround && i > 10) break; await new Promise((res) => requestAnimationFrame(res)); }
  chainMode = false;
  CanvasRenderingContext2D.prototype.drawImage = orig2;
  out.chain = { weaveEarly: chainWeaveEarly, duckAtLand, walkIdleLeaks: chainWalkIdle,
                weaveTotal: seen.weave - wSeen0 };
  CanvasRenderingContext2D.prototype.drawImage = orig;
  out.onGround = b.onGround;
  game.monsters = [];
  return out;
});
await browser.close();

console.log(`  live: loaded=${JSON.stringify(r.loaded)} air=${JSON.stringify(r.airSeen)} afterLand=${JSON.stringify(r.afterLand)} settled=${JSON.stringify(r.settledDelta)}`);
if (r.chain) console.log(`  flow: duckHold=${JSON.stringify(r.duckHold)} weavePair=${JSON.stringify(r.weavePair)} chain=${JSON.stringify(r.chain)}`);

check(r.stores && r.stores.weave && r.stores.duck, 'the weave/duck frame stores exist', r.stores);
check(r.loaded && r.loaded.weave === 9 && r.loaded.duck === 9, 'the loader built 9 frames per set from the index', r.loaded);
check(!r.noBoss, 'barnaby spawned', r.noBoss);
check(r.airSeen && r.airSeen.weave > 0, 'AIRBORNE: the weave set draws while he is in the air (was the walk loop)', r.airSeen);
check(r.landStamped === true, 'LANDING: touching down stamps the duck window (the wiring)', r.landStamped);
check(r.afterLand && r.afterLand.duck > r.airSeen.duck, 'and the duck set draws while the window is open (the render path)', r.afterLand);
check(r.settledDelta && r.settledDelta.frames >= 20 && r.settledDelta.violations === 0,
      'SETTLED: grounded frames past the duck window never draw an evade set', r.settledDelta);
// The v0.29.960 flow contract. Skipped wholesale on builds that predate it.
if (r.duckHold !== undefined || r.weavePair !== undefined) {
  check(!!(r.duckHold && r.duckHold.holds),
        'FLOW: deep in its window the duck HOLDS its standing frame (no ping-pong wrap)', r.duckHold);
  check(!!(r.weavePair && r.weavePair.distinct && r.weavePair.inRange),
        'FLOW: weave crossfades — the pair helper blends adjacent frames like walk does', r.weavePair);
  check(!!(r.chain && r.chain.weaveEarly > 0),
        'FLOW: a strong jump weaves from its first frames (the vy gate; was 1-2 walk frames)', r.chain);
  check(!!(r.chain && r.chain.duckAtLand),
        'FLOW: the mid-chain landing stamps its duck', r.chain);
  check(!!(r.chain && r.chain.walkIdleLeaks === 0),
        'FLOW: the whole hop-duck-hop chain shows ZERO walk/idle frames (the seam)', r.chain);
}
check(errs.length === 0, 'no page errors', [...new Set(errs)].slice(0, 3));
console.log(bad ? `\n${bad} FAILED` : '\nall green');
process.exit(bad ? 1 : 0);
