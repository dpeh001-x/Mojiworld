// THE SIX QTE SEALS ARE ONE SET, IN THE PARRY-SHIELD STYLE, OPEN AROUND THE HERO. Per user: "this sprite needs to be
// regenerated into the recent style of the art", "it is a skill used by bosses to QTE", "all the seals will need
// regeneration". Each seal (SHACKLED, GRAVITY BIND, MOLTEN GRIP, TIDAL GRIP, JUDGEMENT SEAL, SPORE SNARE) is a still plus a
// nine-frame loop, drawn around the shackled hero and spun slowly.
//   - FILES: still + 9 frames per seal; canvases unchanged (768 still / 952 frames; the Judgement Seal 1024 / 1024)
//   - NO CUTOFF: no opaque pixel on any canvas edge; >= 8% clear margin (the Judgement Seal >= 40 px)
//   - ROUND: every frame's ink box is a circle (0.85-1.18 wide-to-tall) - it spins
//   - OPEN: the middle of the ring is clear (the hero shows through): the central disc (radius 18% of the canvas) is at
//     most 35% covered on average across the loop (the old gravity vortex and Judgement disc were near-solid there)
//   - ONE SIZE: the five 952 loops' solid ink fills the same share of their canvas (within 3%): every seal draws one size
//   - ONE CANVAS, NO PULSE: a loop's frames keep one solid-ink box (within 4%; a passing glow is not a size change), and
//     every step moves (>= 0.35%)
//   node scripts/qte_seals_art_test.mjs
import { createRequire } from 'node:module'; import path from 'node:path'; import fs from 'node:fs'; import { fileURLToPath } from 'node:url';
const ROOT = process.env.SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json')); const sharp = require('sharp'); sharp.cache(false);
let pass = 0, fail = 0;
const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d !== undefined ? '  ' + JSON.stringify(d).slice(0, 600) : '')); ok ? pass++ : fail++; };
const KEYS = ['qte_chains', 'qte_gravity', 'qte_molten', 'qte_tidal', 'qte_holy', 'qte_spore'];
const read = async (rel) => { const f = path.join(ROOT, rel); if (!fs.existsSync(f)) return null;
  const { data, info } = await sharp(fs.readFileSync(f)).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); const W = info.width, H = info.height;
  let x0 = W, y0 = H, x1 = -1, y1 = -1, c0 = W, d0 = H, c1 = -1, d1 = -1, edge = 0, mid = 0, midN = 0; const R2 = (0.18 * W) ** 2;
  for (let y = 0; y < H; y++) for (let x = 0, i = y * W * 4 + 3; x < W; x++, i += 4) { const a = data[i];
    if (a <= 16) { if ((x - W / 2) ** 2 + (y - H / 2) ** 2 < R2) midN++; continue; }
    if ((x - W / 2) ** 2 + (y - H / 2) ** 2 < R2) { midN++; if (a > 60) mid++; }
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (x === 0 || y === 0 || x === W - 1 || y === H - 1) edge++;
    if (a > 200) { if (x < c0) c0 = x; if (x > c1) c1 = x; if (y < d0) d0 = y; if (y > d1) d1 = y; } }
  // bw/bh: every visible pixel (margins, roundness); cw/ch: the near-opaque ink (alpha > 200) (size and pulse - a glow halo is not a size change)
  return { W, H, edge, pad: Math.min(x0, y0, W - 1 - x1, H - 1 - y1), bw: x1 - x0 + 1, bh: y1 - y0 + 1, cw: c1 - c0 + 1, ch: d1 - d0 + 1, mid: mid / midN, a: data }; };
const S = {};
for (const k of KEYS) { S[k] = { still: await read(`Sprites/fx/${k}.webp`), fr: [] }; for (let i = 0; i < 9; i++) S[k].fr.push(await read(`Sprites/fx/anim/${k}_${i}.webp`)); }
const missing = KEYS.flatMap((k) => [S[k].still ? null : k, ...S[k].fr.map((f, i) => (f ? null : `${k}_${i}`))]).filter(Boolean);
check(missing.length === 0, 'FILES: every seal is a still plus nine loop frames', missing);
const size = KEYS.filter((k) => { const h = k === 'qte_holy'; return !(S[k].still && S[k].still.W === (h ? 1024 : 768) && S[k].fr.every((f) => f && f.W === (h ? 1024 : 952) && f.H === f.W)); });
check(size.length === 0, 'FILES: canvases unchanged (768 still / 952 frames; the Judgement Seal 1024 / 1024)', size);
const all = KEYS.flatMap((k) => [[k, S[k].still], ...S[k].fr.map((f, i) => [`${k}_${i}`, f])]).filter(([, f]) => f);
const cut = all.filter(([n, f]) => f.edge > 0 || f.pad < (n.startsWith('qte_holy') ? 40 : 0.08 * f.W)).map(([n, f]) => `${n} edge ${f.edge} pad ${f.pad}`);
check(cut.length === 0, 'NO CUTOFF: no pixel on a canvas edge, >= 8% margin (the Judgement Seal >= 40 px)', cut);
const oval = all.filter(([, f]) => f.bw / f.bh < 0.85 || f.bw / f.bh > 1.18).map(([n, f]) => `${n} ${(f.bw / f.bh).toFixed(2)}`);
check(oval.length === 0, 'ROUND: every frame is a circle (it spins)', oval);
const shut = KEYS.map((k) => [k, S[k].fr.filter(Boolean).reduce((s, f) => s + f.mid, 0) / 9]).filter(([, m]) => m > 0.35).map(([k, m]) => `${k} ${(m * 100).toFixed(0)}%`);
check(shut.length === 0, 'OPEN: the middle of every ring is clear, so the hero shows through', shut);
const fills = KEYS.filter((k) => k !== 'qte_holy').map((k) => Math.max(...S[k].fr.map((f) => Math.max(f.cw, f.ch) / f.W)));
check(Math.max(...fills) - Math.min(...fills) <= 0.03, 'ONE SIZE: the five 952 loops fill the same share of their canvas', fills.map((x) => +x.toFixed(3)));
const pulse = [], still = [];
for (const k of KEYS) { const fr = S[k].fr.filter(Boolean); if (fr.length !== 9) continue;
  const b = fr.map((f) => Math.max(f.cw, f.ch)); if (Math.max(...b) / Math.min(...b) > 1.04) pulse.push(`${k} ${Math.min(...b)}-${Math.max(...b)}`);
  for (let i = 0; i < 9; i++) { const A = fr[i].a, B = fr[(i + 1) % 9].a; let d = 0, n = 0; for (let p = 3; p < A.length; p += 16) { d += Math.abs(A[p] - B[p]) + Math.abs(A[p - 1] - B[p - 1]); n += 2; }
    if (d / n / 255 * 100 < 0.35) still.push(`${k} ${i}->${(i + 1) % 9}`); } }
check(pulse.length === 0, 'NO PULSE: each loop keeps one ink box (within 4%)', pulse);
check(still.length === 0, 'the loops never stall (every step moves >= 0.35%)', still);
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
