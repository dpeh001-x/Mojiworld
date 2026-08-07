// PADDED ATTACK FRAMES MUST STAY ON THE FLOOR (v0.29.509).
//
// Types in _ATK_FRAME_SCALE author their swing frames inside a padded canvas so
// the weapon arc isn't clipped. The draw box is scaled back up so the BODY
// keeps its idle size — but the Y anchor came from the STATIC sprite's content
// bottom, and scaling that offset by _atkScale multiplied the error. Any type
// whose swing frames don't sit flush on their canvas floor floated for the
// whole attack (smith golem: ~15% of its drawn height, per user "levitates
// midair"), and drifted as the per-frame gap changed.
//
// This measures what actually reaches the canvas: _lxDrawSoft is intercepted,
// so the asserted number is the real blit rect, not a re-derivation of the
// maths under test. Foot Y = blitY + blitH x (that image's own content bottom).
// Run: node scripts/attack_frame_plant_test.mjs
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// --allow-file-access-from-files is REQUIRED, not a convenience. Both the fix
// and this measurement read pixels back out of a canvas, and a plain file://
// page taints the canvas the moment a file:// image is drawn into it — so
// _spriteContentBox returns null, the code falls back to the old static-sprite
// anchor, and the test would measure the unfixed path while reporting on the
// fixed one. The flag makes this page behave like the served build (http, the
// Steam wrapper, Pages), which is where the fix actually runs.
const browser = await chromium.launch({ channel: 'chrome', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.goto('file:///' + path.join(ROOT, 'mojiworld_game.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof _drawMonsterSprite === 'function' && typeof _ATK_FRAME_SCALE === 'object', { timeout: 60000 });

const out = await page.evaluate(async () => {
  const TYPES = Object.keys(_ATK_FRAME_SCALE);
  const res = {};
  for (const type of TYPES) {
    const set = _monsterFramesFor(type);
    if (!set) { res[type] = { err: 'no frame set' }; continue; }
    // wait for idle + attack frames to decode
    const t0 = Date.now();
    const ready = () => (set.idle && set.idle[0] && set.idle[0].complete && set.idle[0].naturalWidth)
                     && (set.attack && set.attack[0] && set.attack[0].complete && set.attack[0].naturalWidth);
    while (!ready() && Date.now() - t0 < 20000) await new Promise((r) => setTimeout(r, 200));
    if (!ready()) { res[type] = { err: 'frames never decoded' }; continue; }

    const t = monsterTypes[type];
    const m = { type, x: 400, y: 300, w: t.w, h: t.h, facing: 1, hp: 100, maxHp: 100, vx: 0, vy: 0, onGround: true };

    // intercept the real blit
    const blits = [];
    const realDraw = window._lxDrawSoft;
    window._lxDrawSoft = function (c, img, x, y, w, h, o) { blits.push({ img, x, y, w, h }); return realDraw.apply(this, arguments); };
    const realState = window._monsterStateFrame;
    const sample = (state, idx) => {
      window._monsterStateFrame = (mm) => { mm._frameIsAttack = (state === 'attack'); return set[state][idx]; };
      blits.length = 0;
      ctx.save();
      try { _drawMonsterSprite(m, 400, 300); } catch (e) { /* reported via foot=null */ }
      ctx.restore();
      const b = blits.find((z) => z.img === set[state][idx]);
      if (!b) return null;
      const box = _spriteContentBox(b.img);
      const ih = b.img.naturalHeight || b.img.height || 1;
      if (!box || !(box.bottom > box.top)) return null;
      return b.y + b.h * ((box.bottom + 1) / ih);      // where this frame's feet land
    };

    const idleFeet = [], atkFeet = [];
    for (let i = 0; i < (set.idle ? set.idle.length : 0); i++) { const f = sample('idle', i); if (f != null) idleFeet.push(f); }
    for (let i = 0; i < (set.attack ? set.attack.length : 0); i++) { const f = sample('attack', i); if (f != null) atkFeet.push(f); }
    window._monsterStateFrame = realState;
    window._lxDrawSoft = realDraw;

    if (!idleFeet.length || !atkFeet.length) { res[type] = { err: 'no measurable blits' }; continue; }
    const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    const idleAvg = avg(idleFeet);
    res[type] = {
      h: t.h,
      idleAvg,
      atkMin: Math.min(...atkFeet), atkMax: Math.max(...atkFeet),
      worstOffset: Math.max(...atkFeet.map((f) => Math.abs(f - idleAvg))),   // px above/below the idle foot line
      spread: Math.max(...atkFeet) - Math.min(...atkFeet),                   // drift WITHIN the swing
      frames: atkFeet.length,
    };
  }
  return res;
});
await browser.close();

// A padded swing frame may legitimately shift a pixel or two; 3px is the
// tolerance below which nothing is visible at gameplay scale.
const TOL = 3;
let bad = 0;
console.log('type            frames  idle-foot  attack-foot range   worst-offset  in-swing drift');
for (const [type, r] of Object.entries(out)) {
  if (r.err) { console.log(`  FAIL  ${type.padEnd(14)} ${r.err}`); bad++; continue; }
  const ok = r.worstOffset <= TOL && r.spread <= TOL;
  if (!ok) bad++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${type.padEnd(14)} ${String(r.frames).padStart(2)}   ${r.idleAvg.toFixed(1).padStart(8)}   ${r.atkMin.toFixed(1)}..${r.atkMax.toFixed(1)}   ${r.worstOffset.toFixed(1).padStart(6)}px   ${r.spread.toFixed(1).padStart(6)}px`);
}
console.log(errs.length ? '\npage errors: ' + errs.slice(0, 3).join(' | ') : '\nno page errors');
console.log(bad ? `\n${bad} type(s) float off the foot line (tolerance ${TOL}px)` : `\nall good — every padded swing frame plants within ${TOL}px of the idle foot line`);
process.exit(bad || errs.length ? 1 : 0);
