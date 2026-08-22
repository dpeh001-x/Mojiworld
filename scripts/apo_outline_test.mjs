// Test: the Elemental Apotheosis projectile art carries a THIN outline, not the
// heavy black rim it shipped with (per user: "too thick of a black outline").
//
// Measured RADIALLY, which is the only honest way here: rays are cast from the
// sprite's centroid, and for each the dark run inward from the outer alpha edge
// is the rim. A flat "count dark pixels" check cannot work — 80% of the
// singularity's body is legitimately dark (black core, purple ring), so a
// colour census would call the correct art broken.
//   node scripts/apo_outline_test.mjs
import { existsSync, readFileSync } from 'node:fs';
import sharp from 'sharp';
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const KEYS = ['p_apo_fire', 'p_apo_ice', 'p_apo_lightning', 'p_apo_void'];
const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const DARK = 70;

// The keyline BAND each sprite must land in, in source px on its 512 canvas.
// Both bounds matter, and the lower one is the point (user: "should have still
// at least a 2-3px black outline") — an earlier pass peeled the lightning to
// 0 px and the ice to 1 px, which reads as washed-out cel art. Upper bounds
// keep the original complaint fixed. Fire's ceiling is looser because its own
// smoke is dark and sits against the keyline; the singularity's is looser still
// because its outer shadow IS the effect, not an outline.
const RIM = {
  p_apo_fire:      { min: 2, max: 9 },
  p_apo_ice:       { min: 2, max: 6 },
  p_apo_lightning: { min: 2, max: 6 },
  p_apo_void:      { min: 2, max: 48 },
};

async function rim(file) {
  const { data, info } = await sharp(readFileSync(file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const A = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 0 : data[(y * W + x) * C + 3];
  const L = (x, y) => { const i = (y * W + x) * C; return lum(data[i], data[i + 1], data[i + 2]); };
  let sx = 0, sy = 0, n = 0, core = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (A(x, y) > 40) { sx += x; sy += y; n++; }
  if (!n) return { median: 999, core: 0, W, H };
  const cx = sx / n, cy = sy / n;
  // enclosed dark pixels (not touching transparency) = the art's own darks
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    if (A(x, y) <= 40) continue;
    const edge = A(x - 1, y) <= 40 || A(x + 1, y) <= 40 || A(x, y - 1) <= 40 || A(x, y + 1) <= 40;
    if (!edge && L(x, y) < DARK) core++;
  }
  const runs = [];
  for (let a = 0; a < 360; a += 3) {
    const rad = a * Math.PI / 180, dx = Math.cos(rad), dy = Math.sin(rad);
    let rOut = -1;
    for (let r = Math.max(W, H) / 2; r > 2; r--) { if (A(Math.round(cx + dx * r), Math.round(cy + dy * r)) > 40) { rOut = r; break; } }
    if (rOut < 0) continue;
    let t = 0;
    for (let r = rOut; r > 2; r--) {
      const x = Math.round(cx + dx * r), y = Math.round(cy + dy * r);
      if (A(x, y) <= 40) continue;
      if (L(x, y) < DARK) t++; else break;
    }
    runs.push(t);
  }
  runs.sort((a, b) => a - b);
  return { median: runs[Math.floor(runs.length / 2)] || 0, core, W, H };
}

let missing = 0;
for (const k of KEYS) {
  if (!existsSync(`Sprites/projectiles/${k}.webp`)) missing++;
  for (let i = 0; i < 9; i++) if (!existsSync(`Sprites/projectiles/anim/${k}_${i}.webp`)) missing++;
}
ok('all 4 stills + 36 animation frames ship', missing === 0, { missing });

for (const k of KEYS) {
  const r = await rim(`Sprites/projectiles/${k}.webp`);
  ok(`${k}: keeps a black keyline (>= ${RIM[k].min}px — not peeled away)`, r.median >= RIM[k].min, { rimPx: r.median });
  ok(`${k}: and it is not a heavy rim (<= ${RIM[k].max}px)`, r.median <= RIM[k].max, { rimPx: r.median });
  ok(`${k}: canvas is still 512x512 (draw sizing unchanged)`, r.W === 512 && r.H === 512, { size: r.W + 'x' + r.H });
}

// The peel must never have eaten an enclosed dark interior — that is what
// separates "thin the outline" from "erase the singularity".
{
  const v = await rim('Sprites/projectiles/p_apo_void.webp');
  ok('the singularity keeps its black core (peel touched the rim, not the art)', v.core > 20000, { coreDarkPx: v.core });
}

// Frame 0 of each set should match its still's treatment, so the animation does
// not flash a thick outline on its first frame.
for (const k of KEYS) {
  const f = await rim(`Sprites/projectiles/anim/${k}_0.webp`);
  ok(`${k}_0: the animation's first frame carries the same keyline`,
     f.median >= RIM[k].min && f.median <= RIM[k].max + 4, { rimPx: f.median });
}

for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter(q => q.pass).length}/${results.length} checks passed`);
process.exit(results.every(q => q.pass) ? 0 : 1);
