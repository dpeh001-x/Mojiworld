// The Tower Arbiter, every sprite set regenerated without slices (ludo.ai animate). v0.30.x arbiter-regen
// =============================================================================
// Per user: "There is honestly a lot of slice and cutoff for these, could you regenerate the sprite
// sequence for arbiter". Rays, flames and the raised sword ended on hard straight lines - the worst a
// HORIZONTAL cut at y~872 across the pillar set - and the walk's blade ran off the bottom of the canvas.
//
// WHY THE OLD PIPELINES SLICED. generate_arbiter_attacks.mjs and gen_tower_anim_ludo.mjs animate FROM the
// boss's own sprite (right: the knight stays identical) inside a TIGHT working frame - the knight's box plus
// 0.35-0.75 of padding - and bake the result back at the source's own offset. The animator never draws past
// its frame, so anything the motion needed beyond it was cut flat on the frame's edge, and that edge lands
// INSIDE the game canvas. gen_tower_anim then feathered the edge, which only turned the cut into a fade
// that still stops on one line. Their clip test looked at the canvas border alone, so an interior cut passed.
//
// WHAT THIS DOES INSTEAD.
//  1. Room: the working frame is sized so the knight fills <= 40% of its width and <= 55% of its height
//     (the effect sets), or the WHOLE game canvas (idle / walk / dash, whose knight already fills ~44 x 58%
//     of it - room the canvas cannot show is room a cut can hide in). Feet sit a small margin above the
//     frame's bottom, on the set's floor line.
//  2. Same knight, same place: every set is animated from its OWN shipped frame 0 (his own art) and baked
//     back by inverting the seed transform, then one registration fit (scale + shift, alpha IoU) maps the new
//     frame 0 onto the shipped frame 0 - one transform for all nine frames, so the motion is kept and the
//     knight lands at the size, x and floor line the set's calibration was authored against.
//  3. A clip detector that sees interior slices (clipScan): no ink on the top / left / right canvas border,
//     no bright ink on the floor row outside the boots, and no long hard straight edge - a run of rows (or
//     columns) whose art stops on one pixel line - anywhere in the frame. Plus, before the bake, no ink in
//     the outer margin of the animator's own frame (a cut in the making). A roll is kept only if all nine
//     frames pass; otherwise it is re-rolled, up to --rolls.
//
//   node scripts/gen_arbiter_regen.mjs                                   # the plan
//   LUDO_API_KEY=... node scripts/gen_arbiter_regen.mjs --generate [--only column] [--rolls 2]
//   node scripts/gen_arbiter_regen.mjs --bake [--only column]            # bake + score every downloaded roll
//   node scripts/gen_arbiter_regen.mjs --pick column 3                   # roll 3 -> OUT/out/Sprites/bosses/...
//   node scripts/gen_arbiter_regen.mjs --check <root>                    # detector over a tree of frames
// OUT (LX_ARB_OUT) defaults to fa_reports/arbiter_regen; references (LX_ARB_REF) to OUT/orig, the shipped
// frames. Job ids are recorded in OUT/jobs.json the moment the POST answers; a re-run polls, never re-POSTs.
// =============================================================================
import sharp from 'sharp';
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
sharp.cache(false);

export async function rgba(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, W: info.width, H: info.height };
}
export function bboxOf(im, thr = 16) {
  const { data, W, H } = im; let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] > thr) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return x1 < 0 ? null : { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
// ---- THE CLIP DETECTOR ------------------------------------------------------------------------------
// A STOP is a pixel with alpha > 40 whose neighbour one step outward has alpha <= 8: art ending hard.
// A CUT is a straight run of stops on one pixel line (+-1 px, a one-pixel gap allowed), mostly BRIGHT (the
// pixel or the one inboard above 70 - the knight's dark outline is his own edge), that the art's
// outline does not carry on past: beyond either end of the run, fewer than 5 of the next 6 rows (columns) have
// ink on the line or within 2 px of it. That is what separates the user's slices - an ember with its far half
// missing, rays ending on one vertical, a blade top sheared flat by a horizontal - from the long straight
// edges this knight really has (a vertical blade, the edge of a pauldron), whose outline runs on past any
// stretch of it. Lengths are measured against the ink box: a run of 4% of its height (vertical lines) or
// width (horizontal lines), at least 14 px. Floor row (the lowest inked row): the boots stand on it by design
// (dark, <= 12 bright px); a blade or ray cut by it is bright (28-373 px measured on the shipped frames).
export const CLIP = { IN: 40, OUT: 8, DARK: 70, RUN_FRAC: 0.04, RUN_MIN: 14, CONT: 5, FLOOR_BRIGHT: 110, FLOOR_MAX: 20 };
export function clipScan(im, o = {}) {
  const { data, W, H } = im; const C = Object.assign({}, CLIP, o);
  const bb = bboxOf(im, C.OUT); if (!bb) return { empty: true, fail: true, fails: ['empty'] };
  const A = (x, y) => data[(y * W + x) * 4 + 3];
  const L = (x, y) => { const i = (y * W + x) * 4; return Math.max(data[i], data[i + 1], data[i + 2]); };
  // HIS OWN BODY is not what gets sliced: his violet cloth (plume, cape - blue-dominant, not bright) and his gold plate
  // and bronze (yellow or warm, g/r 0.70-1, not white-hot) are drawn with soft or lit edges, so a flat pauldron top or a smooth plume would
  // read as bright interior. The slices are in his steel, his flames, his light; those keep counting. (A frame-bound crop
  // through his body is caught before the bake by rawEdge.)
  const body = (x, y) => { const i = (y * W + x) * 4, r = data[i], g = data[i + 1], b = data[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (b > g + 25 && r >= g && mx < 200) return true;   // violet cloth
    return mx < 225 && mx > 0 && ((mx - mn) / mx > 0.35 || r > b + 15) && r >= g && g >= 0.70 * r && b < g; };   // gold / bronze plate, warm (embers and flame edges are redder: g/r < 0.7; steel is neutral or cool)
  const counts = (x, y, dx, dy) => (L(x, y) > C.DARK || L(x - dx, y - dy) > C.DARK) && !body(x, y);
  let border = 0, floor = 0;
  // the floor test reads the row his soles stand on - the lowest inked row (the canvas bottom for idle / walk / lunge,
  // row 1298 for the pillar): only dark boots belong there; a glow or blade cut off along it is bright
  let fy = H - 1; while (fy > 0) { let any = false; for (let x = 0; x < W; x++) if (A(x, fy) > C.IN) { any = true; break; } if (any) break; fy--; }
  for (let x = 0; x < W; x++) { if (A(x, 0) > C.IN) border++; if (A(x, fy) > C.IN && L(x, fy) > C.FLOOR_BRIGHT) floor++; }
  for (let y = 0; y < H; y++) { if (A(0, y) > C.IN) border++; if (A(W - 1, y) > C.IN) border++; }
  // stop masks, one per direction
  const mk = () => new Uint8Array(W * H), sR = mk(), sL = mk(), sT = mk(), sB = mk();
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    if (A(x, y) <= C.IN) continue; const i = y * W + x;
    if (A(x + 1, y) <= C.OUT) sR[i] = counts(x, y, 1, 0) ? 2 : 1;   // 2 = a bright stop, 1 = a dark one
    if (A(x - 1, y) <= C.OUT) sL[i] = counts(x, y, -1, 0) ? 2 : 1;
    if (A(x, y + 1) <= C.OUT) sB[i] = counts(x, y, 0, 1) ? 2 : 1;
    if (A(x, y - 1) <= C.OUT) sT[i] = counts(x, y, 0, -1) ? 2 : 1;
  }
  const limV = Math.max(C.RUN_MIN, C.RUN_FRAC * bb.h), limH = Math.max(C.RUN_MIN, C.RUN_FRAC * bb.w);
  // every straight run of at least `lim`, then keep only those the outline does not continue past
  const cuts = (m, vertical, lim, o) => {
    const n = vertical ? H : W, lines = vertical ? W : H;
    const at = (c, k) => (c < 0 || c >= lines || k < 0 || k >= n) ? 0 : (vertical ? m[k * W + c] : m[c * W + k]);
    const ink = (c, k) => (c < 0 || c >= lines || k < 0 || k >= n) ? false : (vertical ? A(c, k) : A(k, c)) > C.IN;
    // o = the outward side of this direction (+1 right / down, -1 left / up). A cut leaves nothing ON the line past the
    // run's end - the clip removed it - only the shape's own side running back inward; an edge that goes on keeps ink
    // on the line or just either side of it.
    const goesOn = (c, k, dir) => { let hits = 0; for (let j = 1; j <= 6; j++) { const kk = k + dir * j; for (const d of [-2, -1, 0, 1, 2]) if (ink(c + o * d, kk)) { hits++; break; } } return hits >= C.CONT; };
    let longest = { len: 0, at: -1, k0: -1 }; const found = [];
    for (let c = 1; c < lines - 1; c++) { let start = -1, gap = 0, last = -1, lit = 0;
      const close = () => { if (start < 0) return; const len = last - start + 1;
        if (lit * 2 >= len) {   // mostly bright: the art's own outline did not draw this edge
          if (len > longest.len) longest = { len, at: c, k0: start };
          if (len >= lim && !goesOn(c, start, -1) && !goesOn(c, last, 1)) found.push({ len, at: c, k0: start }); }
        start = -1; lit = 0; };
      for (let k = 1; k < n - 1; k++) {
        const v = Math.max(at(c, k), at(c + 1, k));
        if (v) { if (start < 0) start = k; last = k; gap = 0; if (v === 2) lit++; }
        else if (start >= 0 && ++gap > 1) { close(); gap = 0; }
      }
      close(); }
    found.sort((p, q) => q.len - p.len);
    return { longest, cut: found[0] || null };
  };
  const runs = { R: cuts(sR, true, limV, 1), L: cuts(sL, true, limV, -1), T: cuts(sT, false, limH, -1), B: cuts(sB, false, limH, 1) };
  const fails = [];
  if (border) fails.push('border:' + border);
  if (floor > C.FLOOR_MAX) fails.push('floor:' + floor);
  for (const k of ['R', 'L', 'T', 'B']) {
    const q = runs[k].cut; if (!q) continue;
    // the soles stand on the floor line: a flat run in the bottom 3% of the ink is the ground contact - anything
    // cut BY the floor is judged by the floor-row test above
    if (k === 'B' && q.at >= bb.y1 - Math.max(6, bb.h * 0.03)) continue;
    fails.push(`${k}-cut@${q.at}:${q.len}px`);
  }
  return { bb, border, floor, runs, lim: { v: +limV.toFixed(1), h: +limH.toFixed(1) }, fails, fail: fails.length > 0 };
}
// Before the bake: ink on the outer 3 px of the animator's own frame is art the frame cut off (the next pixel out
// does not exist; a whole spark a few px inside it is fine). Top / left / right only - the bottom margin sits below the floor line and is
// judged by the floor test after the bake.
export function rawEdge(im, m = 3) {
  const { data, W, H } = im; let n = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (y >= m && x >= m && x < W - m) continue;
    if (y >= H - m) continue;
    if (data[(y * W + x) * 4 + 3] > 40) n++;
  }
  return n;
}
// Blade-tip taper (from generate_arbiter_attacks.mjs, unchanged): steel width across the outermost 6% of the
// blade's reach over its width mid-blade. Intact points measured 0.07-0.10, sheared ones 0.30-1.08.
export const TIP_MAX = 0.28;
export async function bladeTipRatio(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const steel = [], arm = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * C; if (data[i + 3] < 110) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx ? (mx - mn) / mx : 0;
    if (mx > 120 && sat < 0.20) steel.push(x, y); else if (mx > 40 && sat >= 0.32) arm.push(x, y);
  }
  if (steel.length < 200 || arm.length < 200) return null;
  let ax = 0, ay = 0; for (let k = 0; k < arm.length; k += 2) { ax += arm[k]; ay += arm[k + 1]; }
  ax /= arm.length / 2; ay /= arm.length / 2;
  let fx = 0, fy = 0, fd = -1;
  for (let k = 0; k < steel.length; k += 2) { const dx = steel[k] - ax, dy = steel[k + 1] - ay, d = dx * dx + dy * dy; if (d > fd) { fd = d; fx = steel[k]; fy = steel[k + 1]; } }
  fd = Math.sqrt(fd);
  const ux = (fx - ax) / fd, uy = (fy - ay) / fd, px = -uy, py = ux;
  const band = (lo, hi) => { let mn = 1e9, mx = -1e9, n = 0;
    for (let k = 0; k < steel.length; k += 2) { const dx = steel[k] - ax, dy = steel[k + 1] - ay, t = dx * ux + dy * uy; if (t < lo || t > hi) continue; const p = dx * px + dy * py; if (p < mn) mn = p; if (p > mx) mx = p; n++; }
    return n ? mx - mn : null; };
  const tip = band(fd * 0.94, fd + 2), mid = band(fd * 0.55, fd * 0.75);
  return (tip == null || !mid) ? null : tip / mid;
}

// ---- THE SETS ---------------------------------------------------------------------------------------
// region: 'canvas' = the whole game canvas (+ a floor margin); 'pad' = knight box / 0.40 wide, / 0.55 tall.
const KNIGHT = 'The SAME golden armoured knight in every frame: identical ornate polished gold plate armour with deep violet trim, '
  + 'closed gold helm with a violet plume, long violet cape, one large straight double-edged silver greatsword with a gold crossguard. '
  + 'Identical armour, cape, plume, sword and colours in every frame; he faces the same way as in the source image throughout. ';
const FRAME = 'Clean cartoon game-sprite art with a dark outline, exactly like the source image. Fully TRANSPARENT background in every '
  + 'frame - no scene, no floor, no ground shadow, no text, no border. The knight stays the SAME SIZE and in the SAME PLACE in every '
  + 'frame: no zoom, no camera move, feet on the SAME ground line. The ENTIRE knight, the whole sword and every effect stay well inside '
  + 'the frame with a wide empty margin on all four sides - nothing ever touches or crosses the frame edge, nothing is cropped or cut '
  + 'off. Nothing is ever drawn at or below the soles of his feet: no ground impact, no dust cloud, no ground glow, no shadow. '
  + 'Effects are compact: they stay within about one body-width of him and fade out softly - no beams, no pillars of light, no '
  + 'shockwaves or bursts that reach the frame edge. '
  + 'The SWORD is always drawn complete from crossguard to a sharp tapered POINT, a crisp solid blade with clean edges - never a '
  + 'motion blur, smear, streak or afterimage, never ending in a flat cut. Smooth seamless loop.';
export const SETS = {
  idle: { dir: 'idle', key: 'towerArbiter', region: 'canvas', tipGate: true,
    motion: KNIGHT + 'He stands at ease in his guard, BREATHING: the chest and shoulders rise and fall gently, the plume and the cape '
      + 'sway slightly. The greatsword stays held low in his hand exactly as in the source, its point resting just ABOVE the ground '
      + 'line, never lower than his feet. Small, calm motion only; his feet do not move. ' + FRAME },
  walk: { dir: 'walk', key: 'towerArbiter', region: 'canvas', tipGate: true,
    motion: KNIGHT + 'He MARCHES in place (treadmill) with a clear cartoon march: in every mid-stride frame one knee is lifted with that '
      + 'foot off the ground while the other leg plants, then they alternate; the torso bobs with each step, the plume and cape swing '
      + 'with the rhythm. The greatsword stays held low in one hand, swaying slightly, and its POINT ALWAYS STAYS ABOVE the ground '
      + 'line - the blade never dips below the soles of his feet. He does not travel across the frame; one single connected body. ' + FRAME },
  // v2 (per user, full-screen check): at 1280x720 the game draws this canvas at 0.82 px per art px with his feet ~630 px down the
  // screen, so art above canvas row ~560 leaves the top of the SCREEN - the first set's ribbon loops did. The working frame now
  // stops at row ~540 (knight 58% of its height): a ribbon that reaches its edge is cut there and the roll is refused.
  attack: { dir: 'attack', key: 'towerArbiter', region: 'pad', share: [0.33, 0.58], maxArea: 1600000,
    motion: KNIGHT + 'His SWING, a low horizontal cleave: frame 1 his guard; frames 2-3 he draws the greatsword back over his shoulder, the '
      + 'blade angled back BEHIND him at shoulder height - never raised straight up, its point never above the top of his helm; frames '
      + '4-6 a thin ribbon of violet arcane light spirals CLOSE around his waist and shoulders while he winds up; frame 7 is the BLOW - '
      + 'he sweeps the blade forward in a wide horizontal cleave at waist height, a crisp solid blade with a sharp point, a short violet '
      + 'arc of light trailing it and a few small sparks close to the blade; frames 8-9 the light fades and he settles back into the '
      + 'guard of frame 1. All the light stays near his body and low; nothing rises above his helm by more than a hand. ' + FRAME },
  column: { dir: 'attack', key: 'towerArbitercolumn', region: 'pad', share: [0.40, 0.55],
    motion: KNIGHT + 'He calls down a PILLAR: frames 1-3 he raises the greatsword vertically in front of him with both hands, point to '
      + 'the sky, every part of the blade and its point inside the frame; frames 4-6 he brings it down point-first and RESTS its point on '
      + 'the ground in front of him (the point just touches the ground line, it is not buried), both hands on the hilt, leaning on '
      + 'it, the steel of the blade SHINING with a soft golden glow that hugs the blade - no light, glow, flash or dust at the ground; frames 7-9 the glow '
      + 'fades and he lifts the sword back to his guard. NO light rays, NO burst, NO beam or pillar of light, NO sparks, NO dust - '
      + 'the game draws the pillar itself; only the knight moves and only his blade glows. ' + FRAME },
  // v3 (per user: the first set "looks very odd" - flame drifting off the blade into loose fire, the blade bending, the body
  // wandering; then "make the knight invert the sword and face it downwards so to keep everything in frame"). A reverse-grip
  // downward thrust, everything low. Seeded from his own inverted-grip pose (the new pillar set's
  // frame 7: both hands on the hilt, blade straight down) scaled onto this set's canvas at the verdict knight's size and place
  // (work/verdict_ref2.webp: x 387/357, feet on row 1299, plume at x 628) - so no frame has to raise or flip the sword (asked
  // to turn it over from his idle, the animator raised it overhead every time); calibrated afterwards like the others.
  verdict: { dir: 'attack', key: 'towerArbiterverdict', region: 'pad', flaming: true, share: [0.42, 0.66], refPath: 'work/verdict_ref2.webp', req: 16,
    motion: KNIGHT + 'His VERDICT, with the sword INVERTED, struck down twice. He holds the greatsword exactly as in the source - a reverse '
      + 'grip, both hands on the hilt, the blade hanging straight DOWN in front of him, point to the ground. A flame kindles at the '
      + 'crossguard and runs down the steel to the point, hugging the blade. Then, twice: he pulls the burning sword up a short way - '
      + 'his hands rise from his chest to his chin, the blade STILL pointing straight down, its point rising to his knees - and drives '
      + 'it straight back down in a hard, decisive thrust so the point strikes the ground right in front of his feet, and holds it '
      + 'there, leaning on the hilt. The sword is NEVER turned point-up and NEVER lifted over his head; his hands never go above his '
      + 'chin. Everything stays low, below his helm. THE FIRE STAYS ON THE BLADE: flames cling to the steel and lick only a short way '
      + 'off its edges - no fire anywhere else, no loose or floating flames, no embers, no fire trail, no fire, flash or glow on the '
      + 'ground. The steel stays visible inside the flames: one straight rigid blade that never bends or changes length, tapering to a '
      + 'sharp point. His body, armour, cape and plume stay exactly the same knight in every frame; his feet stay planted. ' + FRAME },
  dash: { dir: 'attack', key: 'towerArbiterdash', region: 'canvas', tipGate: true,
    motion: KNIGHT + 'His LUNGE, in place: frames 1-2 he stands in his guard exactly as in the source; frames 3-5 he braces for '
      + 'a charge - he drops into a deep low crouch, knees bent, leaning forward, the greatsword held LOW at his hip and pointing '
      + 'forward (never raised overhead); frames 6-7 he lunges forward in a long low stride, the sword thrust straight ahead at '
      + 'waist height and the cape streaming out behind him; frames 8-9 he straightens up back into the guard of frame 1, the sword '
      + 'lowered as in the source. Both feet stay on the ground line; the thrust blade and its point stay well inside the frame. ' + FRAME },
};

// ---- SEED, REGION, BAKE -----------------------------------------------------------------------------
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const OUT = process.env.LX_ARB_OUT || 'C:/Users/dpeh0/AppData/Local/Temp/claude/fa_reports/arbiter_regen';
const REF = process.env.LX_ARB_REF || join(OUT, 'orig');
const N = 9, MAX_PX = 900000;   // the animator refuses True Size (frame_size -9) over 1 MP
export const refFile = (set, i) => join(REF, 'Sprites', 'bosses', SETS[set].dir, `${SETS[set].key}_${i}.webp`);
// the frame a set is seeded from and registered against: its own shipped frame 0, unless it names another (the verdict v3)
const refFor = (set) => SETS[set].refPath ? join(OUT, SETS[set].refPath) : refFile(set, 0);
const FLOOR_MARGIN = 0.04;
// the highest canvas row each set may ink and still be on a 1280x720 screen (feet ~630 px down it; rows per screen px from the
// set's calibrated draw: swing 0.82, pillar 1.02, verdict 0.95 screen px per art px), with 10-45 px to spare
export const SCREEN_TOP = { attack: 540, column: 690, verdict: 680 };   // limits measured: 530 / 678 / 635 (the shipped swing reached 542)
const MARKS = process.env.LX_ARB_MARKS !== '0', MARK_A = Number(process.env.LX_ARB_MARK_A || 255), CORNER = 18;   // corner marks on the seed; px cleared per raw corner
// clear the corner squares of a raw frame (the marks, or whatever the animator made of them)
async function clearCorners(buf) {
  const im = await rgba(buf); const { data, W, H } = im;
  for (const [cx, cy] of [[0, 0], [W - CORNER, 0], [0, H - CORNER], [W - CORNER, H - CORNER]])
    for (let y = cy; y < cy + CORNER; y++) for (let x = cx; x < cx + CORNER; x++) data[(y * W + x) * 4 + 3] = 0;
  return sharp(data, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
}      // the frame runs 4% of its height below the floor line: the boots never touch its edge
// The working frame in CANVAS pixels (may run past the canvas; the outside is transparent).
export async function regionFor(set) {
  const ref = await rgba(readFileSync(refFor(set))), bb = bboxOf(ref, 8);
  const floor = bb.y1 + 1;
  if (SETS[set].region === 'canvas') {
    const h = Math.round(ref.H / (1 - FLOOR_MARGIN));
    return { x: 0, y: floor - Math.round(h * (1 - FLOOR_MARGIN)), w: ref.W, h, W: ref.W, H: ref.H, floor, knight: bb };
  }
  // Effect sets: the knight fills <= 30% of the width and <= 42% of the height (the first rolls at 40 / 55% still ran
  // bursts of light into the frame edge). Their knights are drawn small in these canvases (~360-440 px tall), so even
  // this frame keeps the seed at about the canvas's own resolution (area capped at 1.15 MP); kept inside the canvas.
  // (The pillar zoomed in on him at 30 / 42% - the animator fills a frame whose subject is small - so it keeps 40 / 55%.)
  const [sw0, sh0] = SETS[set].share || [0.30, 0.42];
  let w = Math.round(bb.w / sw0), h = Math.round(bb.h / sh0 / (1 - FLOOR_MARGIN));
  const cap = Math.sqrt((SETS[set].maxArea || 1150000) / (w * h)); if (cap < 1) { w = Math.round(w * cap); h = Math.round(h * cap); }
  w = Math.min(w, ref.W); h = Math.min(h, Math.round((floor) / (1 - FLOOR_MARGIN)));
  const cx = (bb.x0 + bb.x1 + 1) / 2, x = Math.max(0, Math.min(ref.W - w, Math.round(cx - w / 2)));
  return { x, y: floor - Math.round(h * (1 - FLOOR_MARGIN)), w, h, W: ref.W, H: ref.H, floor, knight: bb };
}
// Cut region r out of a canvas-sized image (transparent outside the canvas), scaled to <= MAX_PX.
export async function seedFor(set) {
  const r = await regionFor(set);
  const big = await sharp(readFileSync(refFor(set))).extend({ top: r.h, bottom: r.h, left: r.w, right: r.w, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const crop = await sharp(big).extract({ left: r.x + r.w, top: r.y + r.h, width: r.w, height: r.h }).png().toBuffer();
  const k = Math.sqrt(MAX_PX / (r.w * r.h));
  const sw = Math.round(r.w * k), sh = Math.round(r.h * k);
  // THE ANIMATOR CROPS TO THE SUBJECT, NOT TO THE IMAGE. Measured on the first rolls: True Size framing clips every
  // frame to the seed's own ink box plus ~90-110 px (raw frames 2-4 of a column roll all stopped on row 273, the seed's
  // ink top being 381; the swing's raised blade on row 293 - the same flat cut the shipped sets carry). Padding the
  // seed with transparency therefore buys nothing by itself. Four faint marks in the corners (alpha 24) stretch the
  // subject box to the whole working frame; the bake erases them again (CORNER).
  const marks = [[0, 0], [sw - 3, 0], [0, sh - 3], [sw - 3, sh - 3]].map(([left, top]) => ({ input: { create: { width: 3, height: 3, channels: 4, background: { r: 40, g: 40, b: 46, alpha: MARK_A / 255 } } }, left, top }));
  const sized = await sharp(crop).resize(sw, sh, { kernel: 'lanczos3' }).png().toBuffer();
  const buf = await sharp(sized).composite(MARKS ? marks : []).webp({ quality: 96, alphaQuality: 100 }).toBuffer();
  return { r, buf, sw, sh, k, share: { w: +(r.knight.w / r.w).toFixed(3), h: +(r.knight.h / r.h).toFixed(3) } };
}
// Alpha-mask registration: the (s, tx, ty) that best lays mask B (placed in canvas space) over mask A,
// scaling about A's foot point. Coarse at 1/4 resolution, then refined at 1/2.
function maskAt(im, f) {
  const w = Math.ceil(im.W / f), h = Math.ceil(im.H / f), m = new Uint8Array(w * h);
  for (let y = 0; y < im.H; y++) for (let x = 0; x < im.W; x++) if (im.data[(y * im.W + x) * 4 + 3] > 128) m[((y / f) | 0) * w + ((x / f) | 0)] = 1;
  return { m, w, h };
}
function iou(a, b, fx, fy, s, tx, ty, bx) {
  let inter = 0, uni = 0;
  for (let y = bx.y0; y <= bx.y1; y++) for (let x = bx.x0; x <= bx.x1; x++) {
    const sx = Math.round((x - fx - tx) / s + fx), sy = Math.round((y - fy - ty) / s + fy);
    const bv = (sx >= 0 && sy >= 0 && sx < b.w && sy < b.h) ? b.m[sy * b.w + sx] : 0, av = a.m[y * a.w + x];
    if (av && bv) inter++; if (av || bv) uni++;
  }
  return uni ? inter / uni : 0;
}
export async function register(refIm, newIm) {
  const bbA = bboxOf(refIm, 128), bbB = bboxOf(newIm, 128);
  let best = { s: 1, tx: 0, ty: 0, iou: -1 };
  for (const [f, sList, tR, tStep] of [[4, null, 64, 4], [2, 'fine', 8, 1]]) {
    const a = maskAt(refIm, f), b = maskAt(newIm, f);
    const fx = (bbA.x0 + bbA.x1) / 2 / f, fy = (bbA.y1 + 1) / f;
    const pad = 80 / f, bx = { x0: Math.max(0, Math.floor(Math.min(bbA.x0, bbB.x0) / f - pad)), y0: Math.max(0, Math.floor(Math.min(bbA.y0, bbB.y0) / f - pad)),
      x1: Math.min(a.w - 1, Math.ceil(Math.max(bbA.x1, bbB.x1) / f + pad)), y1: Math.min(a.h - 1, Math.ceil(Math.max(bbA.y1, bbB.y1) / f + pad)) };
    const scales = sList ? [-0.012, -0.008, -0.004, 0, 0.004, 0.008, 0.012].map((d) => best.s + d) : Array.from({ length: 19 }, (_, i) => 0.82 + i * 0.02);
    const c0 = sList ? best : { tx: 0, ty: 0 }, cur = Object.assign({}, best, { iou: -1 });
    for (const s of scales) for (let tx = c0.tx - tR; tx <= c0.tx + tR; tx += tStep) for (let ty = c0.ty - tR; ty <= c0.ty + tR; ty += tStep) {
      const v = iou(a, b, fx, fy, s, tx / f, ty / f, bx); if (v > cur.iou) Object.assign(cur, { s, tx, ty, iou: v });
    }
    best = cur;
  }
  return Object.assign(best, { fx: (bbA.x0 + bbA.x1) / 2, fy: bbA.y1 + 1 });
}
// Place a raw animator frame (seed resolution) onto the set's canvas: invert the seed transform, then
// apply the registration (scale s about the foot point f, shift t). One transform per roll.
async function place(raw, sd, reg) {
  const S = (reg ? reg.s : 1) / sd.k, r = sd.r;
  const X = Math.round(reg ? reg.fx + reg.s * (r.x - reg.fx) + reg.tx : r.x);
  const Y = Math.round(reg ? reg.fy + reg.s * (r.y - reg.fy) + reg.ty : r.y);
  const m = await sharp(raw).metadata(), w = Math.round(m.width * S), h = Math.round(m.height * S);
  const layer = await sharp(raw).ensureAlpha().resize(w, h, { kernel: 'lanczos3', fit: 'fill' }).png().toBuffer();
  const P = Math.max(w, h, r.W, r.H);
  const big = await sharp({ create: { width: r.W + 2 * P, height: r.H + 2 * P, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: layer, left: X + P, top: Y + P }]).png().toBuffer();
  return sharp(big).extract({ left: P, top: P, width: r.W, height: r.H }).png().toBuffer();
}
// FEET ON THE FLOOR, EVERY FRAME. The animator lets the figure drift a few px (measured: a walk frame with both
// boots 26 px above the line). Each baked frame is shifted so its lowest non-steel ink sits on the shipped frame 0's
// floor row - the row the set's calibration stands him on. Steel is left out so a blade tip cannot set the floor.
function lowestInk(im) {
  const { data, W, H } = im;
  for (let y = H - 1; y >= 0; y--) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4; if (data[i + 3] <= 40) continue;
    const mx = Math.max(data[i], data[i + 1], data[i + 2]), mn = Math.min(data[i], data[i + 1], data[i + 2]);
    if (mx > 100 && mx < 250 && (mx - mn) / mx < 0.2) continue;
    return y;
  }
  return -1;
}
async function shiftY(png, W, H, dy) {
  if (!dy) return png;
  const P = Math.abs(dy) + 2;
  const big = await sharp({ create: { width: W, height: H + 2 * P, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: png, left: 0, top: P + dy }]).png().toBuffer();
  return sharp(big).extract({ left: 0, top: P, width: W, height: H }).png().toBuffer();
}
export async function bakeRoll(set, raws0, geom) {
  const raws = []; for (const r of raws0) raws.push(await clearCorners(r));
  // the inverse of the seed transform THIS roll was made with (regions changed between rolls)
  const sd = geom ? Object.assign({}, geom, { share: { w: +(geom.r.knight.w / geom.r.w).toFixed(3), h: +(geom.r.knight.h / geom.r.h).toFixed(3) } }) : await seedFor(set);
  const refIm = await rgba(readFileSync(refFor(set)));
  const floorRow = bboxOf(refIm, 40).y1;
  const reg = await register(refIm, await rgba(await place(raws[0], sd, null)));
  const frames = [], report = [];
  for (let i = 0; i < raws.length; i++) {
    const rawIm = await rgba(raws[i]);
    let png = await place(raws[i], sd, reg);
    // down onto the floor freely (a floating frame); never UP by more than 3 px - ink below his soles is not lifted
    // out of sight of the floor test, it is left where the canvas cuts it and the roll fails
    const low = lowestInk(await rgba(png)); let snap = low < 0 ? 0 : floorRow - low; if (snap < -3) snap = 0;
    png = await shiftY(png, sd.r.W, sd.r.H, snap);
    const webp = await sharp(png).webp({ quality: 92, alphaQuality: 100 }).toBuffer();
    const c = clipScan(await rgba(webp));
    const edge = rawEdge(rawIm);
    const tip = SETS[set].flaming ? null : await bladeTipRatio(webp);
    const fails = c.fails.slice();
    if (edge) fails.push('raw-edge:' + edge);
    // ON SCREEN: at 1280x720 his feet stand ~630 px down the screen; art above SCREEN_TOP leaves the top of the screen
    if (SCREEN_TOP[set] != null && c.bb && c.bb.y0 < SCREEN_TOP[set]) fails.push('above-screen:' + c.bb.y0);
    // the taper test reads light, sparks and fire as steel, so it gates only the sets without effects
    if (tip != null && tip > TIP_MAX) fails.push((SETS[set].tipGate ? 'blunt-tip:' : 'tip-info:') + tip.toFixed(2));
    frames.push(webp);
    report.push({ i, snap, fails, runs: Object.fromEntries(Object.entries(c.runs).map(([k, v]) => [k, (v.cut ? v.cut.len : 0) + '/' + v.longest.len])), lim: c.lim, floor: c.floor, edge, tip: tip == null ? null : +tip.toFixed(3), bb: c.bb });
  }
  return { frames, report, reg, seed: { w: sd.sw, h: sd.sh, k: +sd.k.toFixed(4), share: sd.share, region: { x: sd.r.x, y: sd.r.y, w: sd.r.w, h: sd.r.h } } };
}

// ---- LUDO JOBS ----------------------------------------------------------------------------------------
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const KEY = process.env.LUDO_API_KEY;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const JOBS = join(OUT, 'jobs.json');
const loadJobs = () => existsSync(JOBS) ? JSON.parse(readFileSync(JOBS, 'utf8')) : {};
const saveJobs = (j) => { writeFileSync(JOBS + '.tmp', JSON.stringify(j, null, 1)); renameSync(JOBS + '.tmp', JOBS); };
const rollDir = (set) => join(OUT, 'rolls', set);
const rawPath = (set, roll, i) => join(rollDir(set), `r${roll}_${i}.png`);
const fetchBuf = async (u) => { for (let a = 1; ; a++) { try { const r = await fetch(u, { signal: AbortSignal.timeout(180000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); } catch (e) { if (a >= 4) throw e; await sleep(3000 * a); } } };
async function postJob(set, roll, seedBuf) {
  for (let a = 1; a <= 40; a++) {
    const res = await fetch(`${API}/assets/sprite/animate`, { method: 'POST', signal: AbortSignal.timeout(300000),
      headers: { Authorization: `ApiKey ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ initial_image: 'data:image/webp;base64,' + seedBuf.toString('base64'), motion_prompt: SETS[set].motion,
        frames: SETS[set].req || N, frame_size: -9, model: 'eagle', individual_frames: true, loop: true, image_type: 'sprite' }) });
    if (res.status === 402) throw Object.assign(new Error('402 OUT OF CREDITS'), { fatal: true });
    if (res.status === 429) { await res.text().catch(() => ''); await sleep(15000 + Math.random() * 5000); continue; }   // queue full: wait, not a failure
    const text = await res.text();
    if (!res.ok && res.status !== 202) throw new Error(`POST ${res.status}: ${text.slice(0, 200)}`);
    return JSON.parse(text);
  }
  throw new Error('queue stayed full');
}
async function pollJob(id) {
  let wait = 6000;
  for (let i = 0; i < 400; i++) {
    await sleep(wait);
    const r = await fetch(`${API}/assets/jobs/${id}`, { headers: { Authorization: `ApiKey ${KEY}` }, signal: AbortSignal.timeout(60000) }).catch(() => null);
    if (!r) continue;
    if (r.status === 429) { await r.text().catch(() => ''); wait = Math.min(30000, wait * 2 + Math.random() * 3000); continue; }
    if (!r.ok) { await r.text().catch(() => ''); continue; }
    const d = await r.json(); const st = String(d.status || '').toLowerCase();
    if (st === 'failed' || st === 'cancelled' || st === 'error') throw new Error('job ' + st + ': ' + JSON.stringify(d).slice(0, 200));
    const res = (d.result && !Array.isArray(d.result)) ? Object.assign({}, d, d.result) : d;
    if (st === 'succeeded' || res.individual_frame_urls || res.spritesheet_url) return res;
    wait = Math.min(15000, Math.max(5000, Number(d.poll_after_ms) || 6000));
  }
  throw new Error('job did not finish');
}

// ---- MAIN ---------------------------------------------------------------------------------------------
async function main() {
  const argv = process.argv.slice(2), has = (f) => argv.includes(f), arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
  const only = arg('--only') ? arg('--only').split(',') : Object.keys(SETS);
  const candDir = (set, roll) => join(OUT, 'cand', set, 'r' + roll);
  const outPath = (set, i, root = join(OUT, 'out')) => join(root, 'Sprites', 'bosses', SETS[set].dir, `${SETS[set].key}_${i}.webp`);
  const rollsOf = (set) => { const r = []; for (let n = 1; n < 100; n++) if (existsSync(rawPath(set, n, N - 1))) r.push(n); return r; };
  if (has('--check')) {
    const root = arg('--check'); let bad = 0;
    for (const set of only) for (let i = 0; i < 16; i++) {
      const p = outPath(set, i, root); if (!existsSync(p)) break;
      const c = clipScan(await rgba(readFileSync(p))); if (c.fail) bad++;
      console.log(`${(set + ' ' + i).padEnd(10)} ${c.fail ? 'FAIL ' + c.fails.join(' ') : 'ok'}   cut/longest ${JSON.stringify(Object.fromEntries(Object.entries(c.runs).map(([k, v]) => [k, (v.cut ? v.cut.len : 0) + '/' + v.longest.len])))} lim ${JSON.stringify(c.lim)} floor ${c.floor}`);
    }
    console.log(bad ? bad + ' frame(s) fail' : 'all frames pass'); return;
  }
  if (has('--pick')) {
    const set = arg('--pick'), roll = argv[argv.indexOf('--pick') + 2];
    for (let i = 0; i < N; i++) { const o = outPath(set, i); mkdirSync(dirname(o), { recursive: true }); writeFileSync(o, readFileSync(join(candDir(set, roll), `${SETS[set].key}_${i}.webp`))); }
    console.log(`picked ${set} roll ${roll} -> ${dirname(outPath(set, 0))}`); return;
  }
  if (has('--bake')) {
    for (const set of only) for (const roll of (arg('--roll') ? [Number(arg('--roll'))] : rollsOf(set))) {
      let cnt = 0; while (existsSync(rawPath(set, roll, cnt))) cnt++;
      const raws = Array.from({ length: cnt }, (_, i) => readFileSync(rawPath(set, roll, i)));
      const jj = loadJobs()[`${set}:${roll}`];
      let b = await bakeRoll(set, raws, jj && jj.geom); const d = candDir(set, roll); mkdirSync(d, { recursive: true });
      // A LONGER ROLL (req > 9): keep the nine-in-a-row (wrapping: the sequence loops) whose frames all pass, moving the most
      if (cnt > N) {
        const ok = b.report.map((q) => !q.fails.some((x) => !/^tip-info:/.test(x)));
        const th = []; for (const fr of b.frames) th.push(await sharp(fr).ensureAlpha().resize(64, 64, { fit: 'fill' }).raw().toBuffer());
        const dist = (p, q) => { let t = 0; for (let k = 0; k < p.length; k += 4) t += Math.abs(p[k + 3] - q[k + 3]) + Math.abs(p[k] - q[k]) / 3; return t / (p.length / 4); };
        let best = null;
        for (let st = 0; st < cnt; st++) { const idx = Array.from({ length: N }, (_, k) => (st + k) % cnt); if (!idx.every((k) => ok[k])) continue;
          let mv = 0; for (let k = 0; k + 1 < N; k++) mv += dist(th[idx[k]], th[idx[k + 1]]); if (!best || mv > best.mv) best = { idx, mv }; }
        console.log(`${set} roll ${roll}: ${cnt} frames, passing: ${ok.map((v, k) => v ? k : '.').join(' ')}; best run ${best ? best.idx.join(',') + ' (motion ' + best.mv.toFixed(0) + ')' : 'none'}`);
        if (best) b = { ...b, frames: best.idx.map((k) => b.frames[k]), report: best.idx.map((k, i) => ({ ...b.report[k], i, src: k })), run: best.idx };
        else b = { ...b, report: b.report.map((q) => ({ ...q, fails: q.fails.length ? q.fails : ['no-clean-run'] })) };
      }
      b.frames.forEach((f, i) => writeFileSync(join(d, `${SETS[set].key}_${i}.webp`), f));
      writeFileSync(join(d, 'report.json'), JSON.stringify({ reg: b.reg, seed: b.seed, run: b.run || null, frames: b.report }, null, 1));
      const gating = (q) => q.fails.filter((x) => !/^tip-info:/.test(x)); const nBad = b.report.filter((q) => gating(q).length).length;
      console.log(`${set} roll ${roll}: ${nBad ? nBad + ' frame(s) FAIL' : 'ALL 9 PASS'}  reg s ${b.reg.s.toFixed(3)} t ${b.reg.tx},${b.reg.ty} iou ${b.reg.iou.toFixed(3)}`);
      for (const q of b.report) if (q.fails.length) console.log(`   ${q.i}: ${q.fails.join(' ')}`);
    }
    return;
  }
  if (!has('--generate')) {
    for (const set of only) { const sd = await seedFor(set); console.log(`${set.padEnd(8)} ${SETS[set].dir}/${SETS[set].key}  region ${sd.r.w}x${sd.r.h} at ${sd.r.x},${sd.r.y}  seed ${sd.sw}x${sd.sh}  knight share ${sd.share.w} x ${sd.share.h}`); }
    console.log('\n--generate needs LUDO_API_KEY. Flags: --only a,b --rolls N'); return;
  }
  if (!KEY) { console.error('LUDO_API_KEY required'); process.exit(1); }
  const rolls = Number(arg('--rolls') || 1), jobs = loadJobs();
  for (const set of only) {   // POST the new rolls first, recording each id the moment it exists
    mkdirSync(rollDir(set), { recursive: true });
    const used = Object.values(jobs).filter((j) => j.set === set).map((j) => j.roll);
    let next = Math.max(0, ...used, ...rollsOf(set)) + 1;
    const sd = await seedFor(set); writeFileSync(join(rollDir(set), 'seed.webp'), sd.buf);
    for (let k = 0; k < rolls; k++, next++) {
      const d = await postJob(set, next, sd.buf);
      const id = d && (d.id || d.job_id || d.jobId);
      if (!id) { console.log(`${set} r${next}: POST answered without a job id: ${JSON.stringify(d).slice(0, 160)}`); continue; }
      jobs[`${set}:${next}`] = { set, roll: next, id, credits: d.credits_charged ?? null, posted: new Date().toISOString(), done: false, geom: { r: sd.r, k: sd.k, sw: sd.sw, sh: sd.sh } };
      saveJobs(jobs); console.log(`${set} r${next}: job ${id} (credits ${d.credits_charged ?? '?'})`);
    }
  }
  const pending = Object.values(jobs).filter((j) => !j.done && only.includes(j.set));
  await Promise.all(pending.map(async (j) => {
    try {
      const res = await pollJob(j.id);
      const urls = Array.isArray(res.individual_frame_urls) ? res.individual_frame_urls : [];
      if (urls.length < N) throw new Error('only ' + urls.length + ' frames');
      for (let i = 0; i < urls.length; i++) writeFileSync(rawPath(j.set, j.roll, i), await sharp(await fetchBuf(urls[i])).png().toBuffer());
      j.done = true; j.finished = new Date().toISOString(); saveJobs(jobs);
      console.log(`${j.set} r${j.roll}: ${N} frames downloaded`);
    } catch (e) { j.error = String(e.message).slice(0, 200); saveJobs(jobs); console.log(`${j.set} r${j.roll}: ${j.error}`); if (/job (failed|cancelled|error)/.test(j.error)) { j.done = true; saveJobs(jobs); } }
  }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
