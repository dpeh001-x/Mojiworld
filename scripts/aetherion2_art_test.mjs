// AETHERION FORM 2 - the art itself: one dragon, anchored, no pops.
// ============================================================================
// Per user ("Even after calibration it does not fix, and there is a random sprite in the sequence that does not fit ... the
// animation is not very smooth as well", "Fix all the glitches, regenerate with ludo.ai if required"). Node-only (sharp):
//   ASTRAL  24 frames, frame 0 IS his idle pose and the last frame returns to it, and no frame outside the burst changes the
//           silhouette by more than 4% of the canvas (the old set's frame 7 was a different, leaping dragon)
//   WALK    no wings: every frame's figure stays within 15% of the idle's width (the old walk grew wings in 7 of 9 frames)
//   ANCHOR  through data/anim_calib.js, every form-2 set's FEET land where the idle's do (attack and walk sat 24 / 86 px off)
// Run: node scripts/aetherion2_art_test.mjs
import { createRequire } from 'node:module'; import path from 'node:path'; import fs from 'node:fs'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sharp = createRequire(import.meta.url)('sharp');
const B = (d, k, i) => path.join(ROOT, 'Sprites/bosses', d, k + '_' + i + '.webp');
const count = (d, k) => { let n = 0; while (fs.existsSync(B(d, k, n))) n++; return n; };
const isFx = (r, g, b) => (b > g + 24 && r > g + 12) || (b > 110 && b > g + 40);   // violet spell light: not the dragon
async function info(f) {
  const { data, info } = await sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); const W = info.width, H = info.height;
  const solid = new Uint8Array(W * H); let t = H, b = 0, x0 = W, x1 = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const k = (y * W + x) * 4; if (data[k + 3] <= 128) continue; solid[y * W + x] = 1;
    if (!isFx(data[k], data[k + 1], data[k + 2])) { if (y < t) t = y; if (y > b) b = y; if (x < x0) x0 = x; if (x > x1) x1 = x; } }
  const lo = b - Math.round((b - t) * 0.07); let sx = 0, c = 0;
  for (let y = lo; y <= b; y++) for (let x = 0; x < W; x++) { const k = (y * W + x) * 4; if (data[k + 3] > 128 && !isFx(data[k], data[k + 1], data[k + 2])) { sx += x; c++; } }
  return { W, H, solid, feet: sx / c, w: x1 - x0 + 1 };
}
const iou = (a, b) => { let i = 0, u = 0; for (let k = 0; k < a.length; k++) { if (a[k] || b[k]) u++; if (a[k] && b[k]) i++; } return u ? i / u : 0; };
const ct = fs.readFileSync(path.join(ROOT, 'data/anim_calib.js'), 'utf8'), ca = ct.indexOf('window.LX_ANIM_CALIB = ') + 23;
const CAL = JSON.parse(ct.slice(ca, ct.indexOf('};', ca) + 1));
const res = []; const ok = (n, c, x) => res.push({ n, pass: !!c, x: x === undefined ? '' : String(x) });
const idle = []; for (let i = 0; i < count('idle', 'aetherion2'); i++) idle.push(await info(B('idle', 'aetherion2', i)));
const nA = count('attack', 'aetherion2astral'), astral = []; for (let i = 0; i < nA; i++) astral.push(await info(B('attack', 'aetherion2astral', i)));
ok('the Astral set is 24 frames', nA === 24, nA);
ok('...frame 0 IS his idle pose', iou(astral[0].solid, idle[0].solid) >= 0.9, iou(astral[0].solid, idle[0].solid).toFixed(3));
ok('...and the last frame returns to it', iou(astral[nA - 1].solid, idle[0].solid) >= 0.9, iou(astral[nA - 1].solid, idle[0].solid).toFixed(3));
const steps = []; for (let i = 1; i < nA; i++) { let d = 0; for (let k = 0; k < astral[i].solid.length; k++) if (astral[i].solid[k] !== astral[i - 1].solid[k]) d++; steps.push(d / astral[i].solid.length * 100); }
const off = steps.map((v, i) => [i + 1, v]).filter(([i, v]) => (i < 13 || i > 18) && v > 4);
ok('...no off-model frame: outside the burst (frames 13-18) every step changes < 4% of the canvas', off.length === 0, off.length ? JSON.stringify(off) : 'max ' + Math.max(...steps.filter((_, i) => i + 1 < 13 || i + 1 > 18)).toFixed(1) + '%');
const walk = []; for (let i = 0; i < count('walk', 'aetherion2'); i++) walk.push(await info(B('walk', 'aetherion2', i)));
const iw = idle.reduce((s, q) => s + q.w, 0) / idle.length, wide = walk.map((q) => q.w / iw);
ok('the walk has no wings: every frame within 15% of the idle figure\'s width', wide.every((r) => r > 0.85 && r < 1.15), wide.map((r) => r.toFixed(2)).join(' '));
// screen x of the feet in facing space: dx * targetH + (feet - canvas centre) * px-per-source-px * s  (targetH 658.3 for him)
const TH = 658.3, K = 787.5 / 1656 / 0.87, cal = (k, st) => (CAL[k] && CAL[k][st]) || { s: 1, dx: 0 };
const scr = (k, st, f) => (cal(k, st).dx || 0) * TH + (f.feet - f.W / 2) * K * cal(k, st).s;
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length, ref = mean(idle.map((f) => scr('aetherion2', 'idle', f)));
const atk = []; for (let i = 0; i < count('attack', 'aetherion2'); i++) atk.push(await info(B('attack', 'aetherion2', i)));
for (const [label, k, st, set] of [['walk', 'aetherion2', 'walk', walk], ['attack', 'aetherion2', 'attack', atk], ['Astral', 'aetherion2astral', 'attack', astral.filter((_, i) => i < 13 || i > 18)]]) {
  const d = mean(set.map((f) => scr(k, st, f))) - ref;
  ok('the ' + label + ' set\'s feet land where the idle\'s do (within 8 px)', Math.abs(d) <= 8, d.toFixed(1) + ' px');
}
// his FIRST Astral Judgement must not open on a held stand-in: form 2's sets (the Astral one included) are queued to bake when the
// change begins - the draw-time hook never queued them, because his form-2 idle is already a canvas when it first draws (0/24 baked
// 30 s after the change, measured in real time; 24/24 at 6 s with this)
const G = fs.readFileSync(path.join(ROOT, 'mojiworld_game.html'), 'utf8').replace(/\r\n/g, '\n'), ev = G.indexOf('function _lxAeEvolveStart(m) {');
ok('his form-2 sets (Astral included) are queued to bake when he begins to change', ev >= 0 && G.slice(ev, ev + 600).includes("_lxBossBakeQueue('aetherion2', null)"));
let bad = 0; for (const r of res) { if (!r.pass) bad++; console.log((r.pass ? 'PASS' : 'FAIL') + '  ' + r.n + (r.x ? '   [' + r.x + ']' : '')); }
console.log(''); console.log(bad ? bad + '/' + res.length + ' FAILED' : 'all ' + res.length + ' passed'); process.exit(bad ? 1 : 0);
