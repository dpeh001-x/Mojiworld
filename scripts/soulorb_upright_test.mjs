// Necromancer Soul Ward orbs must render UPRIGHT — no procedural spin.
//
// Per user: "for the necromancer soul orbs sprite do not rotate it, ensure the
// sprite remains upright." The sprite is a soul-flame with a readable top and
// bottom, so spinning it reads as tumbling debris rather than a hovering ward.
//
// Checking this is easy to get wrong in a way that passes for the wrong reason.
// drawNecromancerOrbs only takes the SPRITE branch once the art has decoded;
// until then it draws procedural circles and never calls drawImage at all. A
// test that just counts ctx.rotate calls would therefore go green on a machine
// where the webp never loaded — the orb art absent entirely, reported as fixed.
// So this asserts the sprite branch was actually taken before trusting the
// rotation result, and reads the real canvas transform at drawImage time rather
// than trusting that no rotation arrived by some other route.
//
// It also guards the opposite error: Divine Aegis draws its orbs with an
// identical rotate line and must KEEP spinning (its art is a radially
// symmetric golden orb, the case where a free spin costs nothing).
// Run: node scripts/soulorb_upright_test.mjs [file.html]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const URL = 'file:///' + path.join(ROOT, args[0] || 'mojiworld_game.html').split(path.sep).join('/');
const browser = await chromium.launch({ channel: 'msedge', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
let bad = 0;
const check = (ok, label, detail) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail !== undefined ? '  — ' + JSON.stringify(detail) : ''}`); if (!ok) bad++; };

await page.goto(URL + '?dev=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof drawNecromancerOrbs === 'function' && typeof MAPS !== 'undefined', { timeout: 90000 });

// Wait for the orb art itself to decode — without it the renderer never
// reaches the sprite branch and every assertion below would be vacuous.
const spriteReady = await page.waitForFunction(
  () => { const i = (typeof LX_BULT_PROJ !== 'undefined') && LX_BULT_PROJ.necromancer_soulorb;
          return !!(i && i.complete && i.naturalWidth > 0); },
  { timeout: 30000 }).then(() => true).catch(() => false);

// Prime the 9-frame loop and wait for it to decode. The first _projAnimFrame
// call only KICKS OFF the image loads and returns null, and _readyN is only
// refreshed from inside _bossLoopFrame — so poll THROUGH _projAnimFrame rather
// than reading the array, or the stagger check silently skips on every run.
const loopReady = await page.waitForFunction(
  () => { if (typeof _projAnimFrame !== 'function') return false;
          _projAnimFrame('p_necromancer_soulorb');
          const a = PROJ_ANIM_FRAMES['p_necromancer_soulorb'];
          return !!(a && (a._readyN || 0) > 1); },
  { timeout: 30000 }).then(() => true).catch(() => false);

const r = await page.evaluate(() => {
  const out = {};
  loadMap('town');
  player.x = 400; player.y = 300; game.camera.x = 0;

  // Four orbs at deliberately different phases: if anything still rotates by
  // phase, at least three of these produce a non-identity rotation.
  const mk = (phase, i) => ({ x: 400 + i * 60, y: 320, baseAng: i, phase, hitCd: 0 });
  player._necromancerOrbs = { life: 12000, maxLife: 12000,
    orbs: [mk(0, 0), mk(Math.PI / 2, 1), mk(Math.PI, 2), mk(Math.PI * 1.5, 3)] };
  game.time = 1234;   // a time at which the old code would definitely be mid-spin

  // Spy on the real 2D context: record the transform actually in force at each
  // drawImage, plus any rotate() call and its argument.
  const rotCalls = [], blits = [];
  const origRotate = ctx.rotate, origDraw = ctx.drawImage;
  ctx.rotate = function (a) { rotCalls.push(a); return origRotate.call(this, a); };
  ctx.drawImage = function (...a) {
    const m = this.getTransform();
    blits.push({ a: m.a, b: m.b, c: m.c, d: m.d });
    return origDraw.apply(this, a);
  };
  try { drawNecromancerOrbs(); } finally { ctx.rotate = origRotate; ctx.drawImage = origDraw; }

  out.necroRotates = rotCalls.length;
  out.necroBlits = blits.length;
  // Axis-aligned means the off-diagonal terms of the 2x2 are zero. Tiny float
  // dust from the canvas scale transform is tolerated; a real spin is O(1).
  out.necroSkew = blits.map(m => +Math.max(Math.abs(m.b), Math.abs(m.c)).toFixed(6));
  out.worstSkew = out.necroSkew.length ? Math.max(...out.necroSkew) : null;

  // CONTROL — Divine Aegis must still spin, or the fix went too far.
  player._necromancerOrbs = null;
  player._aegis = { life: 12000, maxLife: 12000,
    orbs: [mk(0, 0), mk(Math.PI / 2, 1)] };
  const aegisRot = [];
  ctx.rotate = function (a) { aegisRot.push(a); return origRotate.call(this, a); };
  try { if (typeof drawAegisOrbs === 'function') drawAegisOrbs(); } finally { ctx.rotate = origRotate; }
  out.aegisRotates = aegisRot.length;
  player._aegis = null;

  // The per-orb stagger that replaced the spin: two different offsets must be
  // able to select different frames of the loop. Verified on the plumbing
  // directly so it does not depend on how many frames happen to have decoded.
  out.offsetArity = _projAnimFrame.length;   // 2 = (skill, offsetMs)
  const fr = (off) => (typeof _projAnimFrame === 'function') ? _projAnimFrame('p_necromancer_soulorb', off) : null;
  const a0 = fr(0), a1 = fr(216);            // half a 432 ms cycle apart
  out.framesDecoded = (PROJ_ANIM_FRAMES['p_necromancer_soulorb'] || [])._readyN || 0;
  out.staggerDiffers = out.framesDecoded > 1 ? (a0 !== a1) : null;
  return out;
});

console.log(`\nsprite decoded: ${spriteReady} | loop primed: ${loopReady} | sprite blits: ${r.necroBlits} | loop frames decoded: ${r.framesDecoded}`);

console.log('\nUPRIGHT');
check(r.necroBlits > 0, 'the sprite branch actually ran (guards a vacuous pass)', r.necroBlits);
check(r.necroRotates === 0, 'drawNecromancerOrbs never calls ctx.rotate', r.necroRotates);
check(r.worstSkew !== null && r.worstSkew < 1e-6, 'every orb blit is axis-aligned (no rotation in the transform)', r.necroSkew);

console.log('\nSTAGGER (what replaced the spin as per-orb variety)');
check(r.offsetArity === 2, '_projAnimFrame accepts a per-instance offsetMs', r.offsetArity);
check(r.staggerDiffers !== false, 'different offsets select different loop frames', r.staggerDiffers);

console.log('\nCONTROL — Divine Aegis must NOT have been changed');
check(r.aegisRotates > 0, 'drawAegisOrbs still spins its radially symmetric orbs', r.aegisRotates);

check(errs.length === 0, 'no page errors', errs.slice(0, 3));
console.log(bad === 0 ? '\nALL PASS' : `\n${bad} FAILED`);
await browser.close();
process.exit(bad === 0 ? 0 : 1);
