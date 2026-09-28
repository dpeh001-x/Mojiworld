// Virga's wings clear the feather probe — and she is the same size on screen.
// ============================================================================
// v0.30.293. The bug: the engine feathers any edge its probe finds art on, and
// Virga's idle/walk/attack frames sat 0-3px from the border (two walk frames
// genuinely cut), so her wings faded and clipped. fly, composed with 66px of
// margin, was always clean — that is the reference this restores.
//
// v0.30.1382 virga-flap: walk, fly and attack are redrawn with full wing flaps (per user). The fly frames now sit
// inside the same >= 50 px margin as the rest, and the redrawn walk / fly carry a uniform per-frame scale (fs) that
// keeps her body its old size on screen - in fs, never in s, because the hit region is cut from the calib-s box.
//
// Asserted here, no browser needed:
//   1. every idle/walk/attack/fly frame clears a real margin on L/R/T
//   2. the shipped edge table says "" (uncut) for all 36
//   3. the canvas is still 1332x1332 — the renderer derives draw size from the
//      source long edge, so a changed canvas would silently resize the boss
//   4. anim_calib carries s = 1/k on the exact keys the renderer looks up, so
//      the recompose is cancelled and she is the SAME size on screen
//   5. fly keeps the user's own s, and the redrawn walk / fly carry their size
//      compensation as a uniform fs (idle / attack carry none)
// Run: node scripts/virga_wings_test.mjs
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
sharp.cache(false);
// v0.30.x zodiac rework (per user): the redrawn Virgo is composed at 0.879 of its v0.30.293 size inside the same >= 50 px
// margin, so the recompose factor is 0.913 x 0.879 and calib s = 1/K = 1.246 keeps her the same size on screen.
const A = 24, MIN = 50, K = 0.8025;
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 200) });

const margins = async (p) => {
  const img = sharp(p).ensureAlpha();
  const { width: W, height: H } = await img.metadata();
  const b = await img.raw().toBuffer();
  let x0 = W, x1 = -1, y0 = H;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (b[(y * W + x) * 4 + 3] > A) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; }
  }
  return { W, H, m: Math.min(x0, W - 1 - x1, y0) };
};

let worst = 1e9, worstAt = '', badCanvas = [];
for (const st of ['idle', 'walk', 'attack', 'fly']) {
  for (let i = 0; i < 9; i++) {
    const p = `Sprites/bosses/zodiac/${st}/virgo_${i}.webp`;
    const { W, H, m } = await margins(p);
    if (m < worst) { worst = m; worstAt = `${st}/virgo_${i}`; }
    if (W !== 1332 || H !== 1332) badCanvas.push(`${st}/${i} ${W}x${H}`);
  }
}
ok('every idle/walk/attack/fly frame clears the feather probe by a real margin',
   worst >= MIN, `tightest: ${worstAt} at ${worst}px (was 0-3px; probe cell is ~28px)`);
ok('the canvas is unchanged at 1332x1332 (draw size derives from the long edge)',
   badCanvas.length === 0, badCanvas.join(', ') || 'all 36 frames 1332x1332');


const es = readFileSync('data/sprite_edges.js', 'utf8');
const tbl = JSON.parse(es.slice(es.indexOf('window.LX_SPRITE_EDGES = ') + 25, es.indexOf('};', es.indexOf('window.LX_SPRITE_EDGES = ')) + 1));
const keys = Object.keys(tbl).filter((k) => /virgo/.test(k) && /zodiac\/(idle|walk|attack|fly)/.test(k));
const flagged = keys.filter((k) => tbl[k] !== '');
ok('the shipped edge table marks all 36 frames uncut', keys.length === 36 && flagged.length === 0,
   `${keys.length} keys, ${flagged.length} still flagged${flagged.length ? ': ' + flagged.slice(0, 3).join(', ') : ''}`);
ok('CONTROL: the table still flags a genuinely cut sprite elsewhere (probe not neutered)',
   Object.values(tbl).some((v) => v !== ''), 'some sprites must still read as cut');

const cal = readFileSync("data/anim_calib.js", "utf8");
const want = +(1 / K).toFixed(3);
// Parse the object, do not pattern-match it. The first version built a regex
// from a single-quoted string, so every s collapsed to a literal s and the
// check could never pass on a correct file.
const _ci = cal.indexOf("window.LX_ANIM_CALIB = ");
let _d = 0, _s0 = cal.indexOf("{", _ci), _s1 = -1;
for (let i = _s0; i < cal.length; i++) { const c = cal[i]; if (c === "{") _d++; else if (c === "}") { _d--; if (!_d) { _s1 = i; break; } } }
let CAL = {};
try { CAL = JSON.parse(cal.slice(_s0, _s1 + 1)); } catch (e) { CAL = {}; }
const V = CAL.zodiac_virgo || {};
const sOf = (k) => (V[k] && typeof V[k].s === "number") ? V[k].s : null;
ok("calib compensates the recompose on all three states (same on-screen size)",
   sOf("zodiac/idle") === want && sOf("zodiac/walk") === want && sOf("zodiac/attack") === want,
   );
// 0588c6b9 baked a user-pasted animator patch that gives fly its OWN calib (s 1.14,
// dy -0.035). That is the user's sizing, not the recompose compensation, so the
// invariant is "fly never carries 1/K", not "fly has no entry".
ok("...and fly does NOT carry the recompose compensation (it was never rescaled)",
   sOf("zodiac/fly") !== want, "fly s=" + sOf("zodiac/fly") + " (1/K=" + want + " here would resize the one clean state)");
// v0.30.1382 virga-flap - the redrawn walk / fly draw her body smaller on the same canvas (the full flaps need the
// room); a uniform fs puts it back to its old size (measured by a head + chest template match against the static).
const fsOf = (k) => (V[k] && Array.isArray(V[k].fs)) ? V[k].fs : null;
const uni = (k, v) => { const f = fsOf(k); return !!f && f.length === 9 && f.every((x) => x === v); };
ok("the redrawn walk and fly keep her body size through a uniform per-frame scale (fs), not s",
   uni("zodiac/walk", 1.055) && uni("zodiac/fly", 1.101) && sOf("zodiac/fly") === 1.14 && !fsOf("zodiac/idle") && !fsOf("zodiac/attack"),
   "walk fs " + JSON.stringify(fsOf("zodiac/walk")) + ", fly fs " + JSON.stringify(fsOf("zodiac/fly")) + ", fly s " + sOf("zodiac/fly"));

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
