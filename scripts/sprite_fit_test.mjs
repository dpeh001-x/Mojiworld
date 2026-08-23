// Test: the sprite-framing fix that both art generators now call into.
//
// No browser and no API — synthetic sprites, so it runs in a second and cannot
// be flaky. What it pins is the property the whole design rests on: ONE shared
// transform across the set, so the differences that make an animation survive
// the fit instead of being normalised away.
//   node scripts/sprite_fit_test.mjs
import sharp from 'sharp';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fitToMargin, fitFramesToBase, measure } from './fit_sprite_frames.mjs';
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const DIR = mkdtempSync(join(tmpdir(), 'lxfit-'));
const W = 400;
// a filled disc of radius r centred at (cx, cy) on a WxW transparent canvas
const disc = async (path, r, cx = W / 2, cy = W / 2) => {
  const svg = `<svg width="${W}" height="${W}"><circle cx="${cx}" cy="${cy}" r="${r}" fill="#c33"/></svg>`;
  await sharp(Buffer.from(svg)).webp({ quality: 92, alphaQuality: 100 }).toFile(path);
  return path;
};
const span = async (p) => { const m = await measure(p); return m.x1 - m.x0 + 1; };

// ---- 1) inset a set that runs to the edge ----------------------------------
const base = await disc(join(DIR, 'k.webp'), W / 2);                 // exactly edge to edge
const frames = [];
// frames that DIFFER in size on purpose: this is the motion the fit must keep
for (let i = 0; i < 9; i++) frames.push(await disc(join(DIR, `k_${i}.webp`), W / 2 - i * 4));
const beforeBase = await measure(base);
const beforeSpans = []; for (const f of frames) beforeSpans.push(await span(f));
const r1 = await fitToMargin([base, ...frames], { margin: 0.07, write: true });
const afterBase = await measure(base);
const afterSpans = []; for (const f of frames) afterSpans.push(await span(f));

ok('a set that runs to the edge starts with zero margin', beforeBase.margin === 0, { margin: beforeBase.margin });
ok('after the fit every file clears the margin on all four sides',
  await (async () => { for (const f of [base, ...frames]) { const m = await measure(f);
    if (Math.min(m.x0, m.W - 1 - m.x1, m.y0, m.H - 1 - m.y1) < W * 0.06) return false; } return true; })(),
  { baseMargin: afterBase.margin, target: Math.round(W * 0.07) });
ok('ONE shared transform: the frames keep their size differences',
  (() => { // every frame must have shrunk by the same ratio
    const ratios = afterSpans.map((a, i) => a / beforeSpans[i]);
    const spread = Math.max(...ratios) - Math.min(...ratios);
    return spread < 0.02;
  })(), { scale: +r1.scale.toFixed(3), ratios: afterSpans.map((a, i) => +(a / beforeSpans[i]).toFixed(3)).slice(0, 4) });
ok('...which is the point — per-image fitting would have flattened them',
  new Set(afterSpans).size >= 5, { distinctSpansAfter: new Set(afterSpans).size, of: 9 });

// ---- 2) idempotence: fitting an already-fitted set changes nothing ---------
const again = await fitToMargin([base, ...frames], { margin: 0.07, write: true });
ok('running the fit again is a no-op', again.changed === 0 && again.scale === 1, again);

// ---- 3) match-base: frames land on the base box, base untouched ------------
const b2 = await disc(join(DIR, 'm.webp'), 120);                     // already comfortably framed
const f2 = []; for (let i = 0; i < 9; i++) f2.push(await disc(join(DIR, `m_${i}.webp`), W / 2));  // edge to edge
const b2Before = await measure(b2);
const r3 = await fitFramesToBase(b2, f2, { write: true });
const b2After = await measure(b2);
const f2Span = await span(f2[0]);
ok('match-base leaves the base file byte-identical',
  b2Before.x0 === b2After.x0 && b2Before.x1 === b2After.x1, { before: b2Before.x0, after: b2After.x0 });
ok('match-base pulls the frames onto the base box instead of insetting again',
  Math.abs(f2Span - (b2Before.x1 - b2Before.x0 + 1)) <= 4,
  { frameSpan: f2Span, baseSpan: b2Before.x1 - b2Before.x0 + 1, scale: +r3.scale.toFixed(3) });

// ---- 4) both generators actually call it -----------------------------------
const { readFileSync } = await import('node:fs');
const gen = readFileSync(new URL('./gen_projectile_restyle.mjs', import.meta.url), 'utf8');
const anim = readFileSync(new URL('./regen_anim_from_base.mjs', import.meta.url), 'utf8');
ok('gen_projectile_restyle insets every candidate it writes',
  /fit_sprite_frames\.mjs/.test(gen) && /fitToMargin\(\[f\]/.test(gen) && /--no-fit/.test(gen), {});
ok('regen_anim_from_base maps its frames onto the base',
  /fit_sprite_frames\.mjs/.test(anim) && /fitFramesToBase\(basePath/.test(anim) && /--no-fit/.test(anim), {});

rmSync(DIR, { recursive: true, force: true });
for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter(q => q.pass).length}/${results.length} checks passed`);
process.exit(results.every(q => q.pass) ? 0 : 1);
