// Aquarius' idle keeps her eyes open.
// ============================================================================
// Per user, over a screenshot of the fight: "some of the sprites eyes look a
// little creepy, for the sequence involving this eyes regenerate to make it
// look more kawaii cuter looking".
//
// WHAT WAS WRONG, MEASURED. Her eyes are two big round cyan lamps. Counting the
// bright-cyan pixels in the bell region of every frame of every loop:
//
//   walk    [10732,10368,6865,7449,10063,10194,7826,9015,10560]  floor 6865
//   attack  [10736,11575,9577,15744,47180,11885,11285,10027,10566] floor 9577
//   idle    [10715,11218,3450,2984,2766,2746,2785,9395,10401]  floor 2746
//
// Five of her nine idle frames sat around a QUARTER of the light every other
// loop carries, because the shared IDLE_MOTION prompt asks for "an occasional
// blink" and the model drew that blink as the eyes narrowing to dark lidded
// slits — held across five frames, so at 9 fps it reads as a slow glare rather
// than a blink. Her walk and attack never do it, so the idle was also the odd
// one out among her own three loops.
//
// THE BAR IS NOT A MAGIC NUMBER. It is derived from her own WALK loop at run
// time — the known-good reference the art already shipped — so this test keeps
// meaning if the art is ever redrawn again: every idle frame must carry at
// least 80% of the light of the DIMMEST walk frame.
//
// REDRAWN (zodiac rework, per user: "make them look better with some pop elements, but also make them look formidable").
// Aquarius is now a crowned kraken-jellyfish, and the fixed bell box this test used to count cyan in lands on her crystal
// crown and the lightning glyphs on her helmet - cyan is everywhere on the new art, so a pixel count in a box no longer
// sees her eyes at all. What the test protects is unchanged: her eyes never go dark or shut in any loop. So the eyes
// are now FOUND, per frame: two blobs of glowing white-cyan at the same height, 70-115 px apart, centred on her middle
// (x 600 +- 40) under the helmet brim. The helmet glyphs never pair up like that and the tentacle tips sit too low.
// Measured on the redraw (lit px per eye pair): idle 284-1759, walk 116-1600, attack 100-2810; every frame has both.
// The old "never below 60% of the brightest idle frame" does not carry over: the idle now curls and uncurls, and the
// helmet brim covers most of the eyes in the curled pose (the static pick itself shows 473) - that is a pose, not a
// blink, and the per-frame pair check below is what catches an eye that actually closes.
//
// Run: node scripts/aquarius_eyes_test.mjs
import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const Z = path.join(ROOT, 'Sprites', 'bosses', 'zodiac');
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 240) });
// A lit eye pixel: opaque glowing white-cyan (the eye cores are ~185,255,255).
const lit = (d, i) => d[i + 3] > 200 && d[i + 1] > 235 && d[i + 2] > 235 && d[i] > 120 && d[i] < 240;
const MIN_EYE = 40;   // px per eye: a slit or a shut eye falls apart below this
async function eyes(file) {   // -> [left, right] blob pixel counts of the best eye pair, or null
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); const W = info.width, H = info.height;
  const lab = new Int32Array(W * H).fill(-1), comps = [];
  for (let p = 0; p < W * H; p++) {
    if (lab[p] !== -1 || !lit(data, p * 4)) continue;
    const c = { n: 0, sx: 0, sy: 0 }, st = [p]; lab[p] = comps.length;
    while (st.length) { const q = st.pop(), x = q % W; c.n++; c.sx += x; c.sy += (q - x) / W;
      for (const r of [q - 1, q + 1, q - W, q + W]) if (r >= 0 && r < W * H && lab[r] === -1 && lit(data, r * 4)) { lab[r] = comps.length; st.push(r); } }
    comps.push(c);
  }
  const cand = comps.filter((c) => c.n > 25 && c.n < 6000).map((c) => ({ n: c.n, mx: c.sx / c.n, my: c.sy / c.n }));
  let pair = null;
  for (const a of cand) for (const b of cand) {
    if (a.mx >= b.mx) continue; const sep = b.mx - a.mx, mid = (a.mx + b.mx) / 2, r = Math.max(a.n, b.n) / Math.min(a.n, b.n);
    if (Math.abs(a.my - b.my) < 14 && r < 2.2 && sep > 70 && sep < 115 && Math.abs(mid - 600) < 40 && a.my > 450 && a.my < 760
      && (!pair || a.n + b.n > pair[0] + pair[1])) pair = [a.n, b.n];
  }
  return pair;
}
async function dims(file) { const m = await sharp(file).metadata(); return `${m.width}x${m.height}`; }
async function frameDelta(a, b) {   // mean absolute difference, as a fraction - proves the loop moves
  const A = await sharp(a).resize(180, 180, { fit: 'fill' }).ensureAlpha().raw().toBuffer();
  const B = await sharp(b).resize(180, 180, { fit: 'fill' }).ensureAlpha().raw().toBuffer();
  let s = 0; for (let i = 0; i < A.length; i++) s += Math.abs(A[i] - B[i]);
  return s / A.length / 255;
}
const frames = (st) => Array.from({ length: 9 }, (_, i) => path.join(Z, st, `aquarius_${i}.webp`));
const E = {}, glow = {}, shut = [];
for (const st of ['idle', 'walk', 'attack']) {
  E[st] = []; for (const f of frames(st)) E[st].push(await eyes(f));
  glow[st] = E[st].map((p) => (p ? p[0] + p[1] : 0));
  E[st].forEach((p, i) => { if (!p || Math.min(p[0], p[1]) < MIN_EYE) shut.push(`${st}/${i}${p ? ' ' + p.join('+') : ' none'}`); });
}
const BAR = Math.round(Math.min(...glow.walk) * 0.8);
const dim = glow.idle.map((v, i) => (v < BAR ? i : -1)).filter((i) => i >= 0);
const deltas = []; for (let i = 0; i < 9; i++) deltas.push(await frameDelta(frames('idle')[i], frames('idle')[(i + 1) % 9]));
const size = await dims(frames('idle')[0]), baseSize = await dims(path.join(Z, 'aquarius.webp'));
for (const st of ['idle', 'walk', 'attack']) console.log(`  ${st.padEnd(6)} ${JSON.stringify(E[st].map((p) => (p ? p.join('+') : '-')))}`);
ok('BOTH EYES LIT AND OPEN in every idle, walk and attack frame (a lit pair, each eye >= ' + MIN_EYE + ' px)',
  shut.length === 0, shut.length ? 'no open pair in: ' + shut.join(', ') : '27/27 frames');
ok('HER EYES STAY LIT: every idle frame carries at least 80% of the dimmest walk frame',
  dim.length === 0, dim.length ? `frames ${dim.join(', ')} below the ${BAR} bar: ${dim.map((i) => glow.idle[i]).join(', ')}`
    : `idle floor ${Math.min(...glow.idle)} >= bar ${BAR}`);
ok('SHE IS STILL THE SAME SIZE: idle frames match the base canvas exactly', size === baseSize, `idle ${size}, base ${baseSize}`);
ok('THE LOOP STILL MOVES: consecutive frames differ, so it is not nine copies',
  Math.min(...deltas) > 0.002, `smallest frame-to-frame delta ${Math.min(...deltas).toFixed(4)}`);
let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
