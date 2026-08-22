// The downed hero's X X eyes carry a black outline.
//
// Per user: "Thicken the X X of the downed eyes by a 1 px black outline."
//
// _lxDrawDeadEyes strokes each cross in layered passes, widest first, so each
// pass shows as a ring around the next. The trap this test exists for: the new
// black ring is WIDER than the pale readability rim that was already there, so
// dropping it in without moving the rim would paint straight over it — the
// crosses would look right in a screenshot while the read-on-any-skin-tone pass
// had been silently deleted. So this checks the full ordering, not just that
// something black got drawn.
// Run: node scripts/dead_eyes_outline_test.mjs [file.html]
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
await page.waitForFunction(() => typeof _lxDrawDeadEyes === 'function', { timeout: 90000 });

const r = await page.evaluate(() => {
  // Record the state actually in force at each stroke, in call order.
  const passes = [];
  const origStroke = ctx.stroke;
  ctx.stroke = function (...a) {
    passes.push({ w: +this.lineWidth.toFixed(3), c: String(this.strokeStyle), cap: this.lineCap });
    return origStroke.apply(this, a);
  };
  try { _lxDrawDeadEyes(); } catch (e) { return { err: String(e).slice(0, 140) }; }
  finally { ctx.stroke = origStroke; }
  return { passes, core: (typeof _LX_DEAD_EYE !== 'undefined') ? _LX_DEAD_EYE.r * 0.5 : null };
});

if (r.err) { console.log('FAILED — ' + r.err); await browser.close(); process.exit(1); }
console.log('\nstroke passes, in draw order:');
for (const p of r.passes) console.log(`  w ${String(p.w).padStart(6)}   ${p.c}`);

const isBlack = (c) => /^#000(000)?$/i.test(c) || /^rgba?\(0,\s*0,\s*0(,\s*1)?\)$/i.test(c);
// Two eyes, so every pass appears twice — compare one eye's worth.
const perEye = r.passes.slice(0, r.passes.length / 2);

console.log('\nA BLACK OUTLINE EXISTS');
check(r.passes.length === 6, 'three passes per eye, both eyes (6 strokes)', r.passes.length);
check(perEye.some(p => isBlack(p.c)), 'one pass is pure black', perEye.map(p => p.c));

console.log('\nIT IS AN OUTLINE — 1 UNIT EACH SIDE OF THE CROSS');
const black = perEye.find(p => isBlack(p.c));
const cross = perEye.find(p => /2a1420/i.test(p.c));
check(!!cross, 'the dark cross pass is still there', perEye.map(p => p.c));
check(!!black && !!cross && Math.abs((black.w - cross.w) - 2) < 0.001,
      'the black pass is exactly 2 units wider — 1 per side', { black: black && black.w, cross: cross && cross.w });
check(!!black && !!cross && r.passes.indexOf(black) < r.passes.indexOf(cross),
      'and is drawn UNDER the cross, so it reads as an outline not a blob');

console.log('\nTHE PALE RIM SURVIVED (the trap)');
const pale = perEye.find(p => /255,\s*255,\s*255/.test(p.c));
check(!!pale, 'the pale readability rim pass still exists', perEye.map(p => p.c));
check(!!pale && !!black && pale.w > black.w,
      'and is still the WIDEST pass — the black ring did not swallow it',
      { pale: pale && pale.w, black: black && black.w });
check(!!pale && !!black && Math.abs((pale.w - black.w) - 2) < 0.001,
      'showing 1 unit of pale outside the black on each side', { pale: pale && pale.w, black: black && black.w });

console.log('\nTHE CROSS ITSELF IS UNCHANGED');
check(!!cross && r.core != null && Math.abs(cross.w - r.core) < 0.001,
      'the dark cross keeps its original r*0.50 width', { cross: cross && cross.w, expected: r.core });

check(errs.length === 0, 'no page errors', errs.slice(0, 3));
console.log(bad === 0 ? '\nALL PASS' : `\n${bad} FAILED`);
await browser.close();
process.exit(bad === 0 ? 0 : 1);
