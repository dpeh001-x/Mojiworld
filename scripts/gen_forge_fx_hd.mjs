#!/usr/bin/env node
// FORGE RESULT ANIMATION, HD — both anvil sets from ONE padded base (ludo.ai).
// ============================================================================
// Per user: "Anvil Animation of enhancement very glitchy, can enlarge and upscale."
// The old sets were rolled separately and disagreed: forge_fail was 512 px with a
// smaller, lower anvil, forge_success 634 px - so the anvil jumped between results.
// Worse, the hammer was sliced flat along the top and the smoke cut into walls.
//
// WHY THINGS GET CUT (measured over ~20 rolls): ludo animates inside the INPUT's
// content box plus an automatic margin and pastes that back; whatever the model draws
// past that canvas is clipped along a hard line - row 544 of 1024 for a bare anvil,
// with up to 399 solid pixels on it. A hammer that "swings in from above" starts off
// that canvas. Faint corner dots do not widen the box (ignored), margin 0 moves the
// line down to the anvil, margin 1.0 and frame_size 0 make every model zoom in 56-66%,
// and hydra (the default) reframes to a 1280x720 shot. What works:
//   * the input is the anvil with the HAMMER RAISED above it (--base-hammer), so the
//     content box - and the canvas - already covers the whole strike;
//   * the last frame is pinned to that same image (FORGE_END_ON_BASE=1), which stops
//     the camera push-in every free roll made;
//   * frame_size -9 on the forge model, auto margin; the anvil is 70% of the frame
//     (a smaller one invites the zoom), feet at 95% (edge_fix_test's floor rule).
// Gates: solid ink on the topmost ink row (a clip), ink on the canvas edge, and the
// anvil moving or changing size. write() tapers any residual clip and the edges.
//   node scripts/gen_forge_fx_hd.mjs --base                   scripts/seeds/forge_base_hd.png (bare anvil)
//   node scripts/gen_forge_fx_hd.mjs --hammer                 two static hammer sprites to review
//   node scripts/gen_forge_fx_hd.mjs --base-hammer=N          scripts/seeds/forge_base_hammer_hd.png
//   FORGE_INPUT=hammer FORGE_END_ON_BASE=1 FORGE_ANIM_MODEL=forge \
//     node scripts/gen_forge_fx_hd.mjs --animate=success|fail  roll -> scripts/_tmp_forge_hd/<tag>_*.png
//   FORGE_DEST=<worktree> node scripts/gen_forge_fx_hd.mjs --write=<tag>   -> Sprites/fx/anim/forge_<kind>_0..8.webp
// Shipped (v0.30.x HD forge): success_forge_mujt86hxmyj, fail_forge_mujtfjaq73p.
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KEY = process.env.LUDO_API_KEY, API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const REVIEW = path.join(ROOT, 'scripts', '_tmp_forge_hd');
const BASE = path.join(ROOT, 'scripts', 'seeds', 'forge_base_hd.png');
const SRC = process.env.FORGE_BASE_SRC || path.join(ROOT, 'Sprites', 'fx', 'anim', 'forge_success_0.webp');
const IN = 1024, OUT = 1024;
// Where --write puts the frames. Default the repo; point it at a worktree when the checkout is shared
// (these REPLACE tracked files, and a parallel session's working copy is not the place to drop them).
const DEST = process.env.FORGE_DEST || ROOT;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// exact flag or flag=value ('--base' must not match '--base-hammer')
const arg = (k) => { const a = process.argv.find((x) => x === '--' + k || x.startsWith('--' + k + '=')); return a ? (a.split('=')[1] ?? true) : null; };
// Animation models push the camera in on a small subject (a 50%-wide anvil came back zoomed
// until it overflowed the floor), so the anvil is 70% wide - the original success set's
// framing, which stayed clean - and every prompt locks the camera.
// Stated positively: ludo documents that negative phrasing backfires on the forge model.
const CAM = ' The camera is locked off: the view stays exactly as in the first frame, and the anvil keeps '
  + 'exactly the same size and the same place in every frame.';
const MOTION = {
  // The hammer is SMALL and in view the whole time: a hammer that 'swings down from above' starts off the model's
  // canvas, and whatever is off the canvas is clipped - that is what sliced the old hammer flat.
  success: 'A small blacksmith hammer, fully visible the whole time, rises just above the anvil and strikes the top of it: a brilliant white-gold flash bursts at the strike '
    + 'point on the anvil face, a fountain of golden sparks and embers sprays up and outwards and falls away, the '
    + 'anvil face glows hot orange and then cools. The anvil itself never moves, never changes size and stays planted '
    + 'on the ground. All sparks, flash and glow stay well inside the frame. Clean cel-shaded game FX, bold black '
    + 'outlines, fully transparent background.',
  // Asking for a close look at CRACKS made the model push in on them (two rolls zoomed until the anvil
  // overflowed the frame), so the failure is told in wide strokes: a glancing hit, a puff, dying embers.
  fail: 'A small blacksmith hammer, fully visible the whole time, rises just above the anvil, hits it wrong and glances off with a dull clang. A '
    + 'dim orange flash, then a SMALL round puff of grey smoke rises just above the anvil face, stays close to the anvil and fades, '
    + 'and a few dull red embers pop and fizzle out. The anvil face is left with a thin dark crack. The whole hammer and '
    + 'all the smoke stay small and well inside the frame, with empty space above and around them. Clean cel-shaded game '
    + 'FX, bold black outlines, fully transparent background.',
};

// Retry only failures that happen BEFORE the request leaves (DNS, connect): the job was never created, so a
// retry cannot double-bill. This machine's resolver drops api.ludo.ai intermittently.
const preSend = (e) => /ENOTFOUND|EAI_AGAIN|ECONNREFUSED|Connect Timeout|UND_ERR_CONNECT/.test(String(e && (e.cause && (e.cause.code || e.cause.message)) || e));
async function retrying(fn, isSafe, tries = 6) {
  for (let i = 1; ; i++) { try { return await fn(); } catch (e) { if (i >= tries || !isSafe(e)) throw e; await sleep(3000 * i); } }
}
async function ludo(route, body, timeout = 900000) {
  const res = await retrying(() => fetch(`${API}/${route}`, { method: 'POST', headers: { Authorization: `ApiKey ${KEY}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(timeout), body: JSON.stringify(body) }), preSend);
  if (res.status === 402) throw new Error('402 OUT OF CREDITS');
  const txt = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} ${txt.slice(0, 160)}`);
  let j = JSON.parse(txt);
  if (res.status === 202 && j.id) {                      // async job (memory: ludo-api-async-jobs)
    const id = j.id; let wait = Number(j.poll_after_ms) || 5000;
    for (let i = 0; ; i++) {
      if (i > 150) throw new Error('job timed out');
      await sleep(Math.max(4000, wait));
      const r = await retrying(() => fetch(`${API}/assets/jobs/${id}`, { headers: { Authorization: `ApiKey ${KEY}` }, signal: AbortSignal.timeout(45000) }), () => true);   // a poll is a read: always safe
      if (r.status === 429) { await r.text().catch(() => {}); continue; }
      const k = await r.json();
      if (k.status === 'succeeded') { j = k.result; break; }
      if (k.status === 'failed' || k.status === 'cancelled') throw new Error('job ' + k.status + ' ' + JSON.stringify(k.error || '').slice(0, 160));
      wait = Number(k.poll_after_ms) || wait;
    }
  }
  return j;
}
async function fetchBuf(url) { const r = await retrying(() => fetch(url, { signal: AbortSignal.timeout(180000) }), () => true); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); }
async function framesFrom(data, n) {
  const d = Array.isArray(data) ? data[0] : data;
  const urls = d.individual_frame_urls || [];
  if (urls.length >= n) { const o = []; for (let i = 0; i < n; i++) o.push(await fetchBuf(urls[i])); return o; }
  if (d.spritesheet_url && d.num_cols && d.num_rows) {
    const sheet = await fetchBuf(d.spritesheet_url), meta = await sharp(sheet).metadata();
    const cw = Math.floor(meta.width / d.num_cols), ch = Math.floor(meta.height / d.num_rows), o = [];
    for (let r = 0; r < d.num_rows && o.length < n; r++) for (let c = 0; c < d.num_cols && o.length < n; c++) o.push(await sharp(sheet).extract({ left: c * cw, top: r * ch, width: cw, height: ch }).png().toBuffer());
    if (o.length >= n) return o;
  }
  throw new Error('no usable frames');
}
const raw = async (b) => { const { data, info } = await sharp(b).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); return { data, W: info.width, H: info.height }; };
// Max alpha within 2 px of each edge: a cut shows up as solid ink ON the edge.
function edges({ data, W, H }) {
  const e = { l: 0, r: 0, t: 0, b: 0 };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const a = data[(y * W + x) * 4 + 3]; if (!a) continue;
    if (x < 2) e.l = Math.max(e.l, a); if (x >= W - 2) e.r = Math.max(e.r, a);
    if (y < 2) e.t = Math.max(e.t, a); if (y >= H - 2) e.b = Math.max(e.b, a);
  }
  return e;
}
// The anvil: bbox of solid ink in the lowest 30% of the frame (below any smoke or sparks' core).
function anvilBox({ data, W, H }) {
  let x0 = W, x1 = -1, yb = -1;
  for (let y = Math.floor(H * 0.7); y < H; y++) { let n = 0; for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] > 200) { n++; if (x < x0) x0 = x; if (x > x1) x1 = x; } if (n > W * 0.08) yb = y; }
  return { cx: (x0 + x1) / 2 / W, w: (x1 - x0) / W, feet: yb / H };
}

async function base() {
  // crop to the anvil's own solid rows (the success still carries a stray spark above it)
  const src = await raw(fs.readFileSync(SRC));
  const { data, W, H } = src; let y0 = -1, y1 = -1, x0 = W, x1 = -1;
  for (let y = 0; y < H; y++) { let n = 0, a = W, b = -1; for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] > 200) { n++; if (x < a) a = x; if (x > b) b = x; } if (n > W * 0.05) { if (y0 < 0) y0 = y; y1 = y; x0 = Math.min(x0, a); x1 = Math.max(x1, b); } }
  const pad = 6, left = Math.max(0, x0 - pad), top = Math.max(0, y0 - pad);
  const anvil = await sharp(fs.readFileSync(SRC)).extract({ left, top, width: Math.min(W - left, x1 - x0 + 2 * pad), height: Math.min(H - top, y1 - y0 + 2 * pad) }).png().toBuffer();
  const m = await sharp(anvil).metadata();
  const aw = Math.round(IN * 0.70), ah = Math.round(m.height * aw / m.width);
  const scaled = await sharp(anvil).resize(aw, ah).png().toBuffer();
  const out = await sharp({ create: { width: IN, height: IN, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: scaled, left: Math.round((IN - aw) / 2), top: Math.round(IN * 0.955) - ah }]).png().toBuffer();
  fs.mkdirSync(path.dirname(BASE), { recursive: true });
  fs.writeFileSync(BASE + '.tmp', out); fs.renameSync(BASE + '.tmp', BASE);
  console.log('wrote ' + path.relative(ROOT, BASE), JSON.stringify(anvilBox(await raw(out))));
}
// Bounding box of SOLID ink (alpha > 200) - on the resting frame that is exactly the anvil.
function solidBox({ data, W, H }) {
  let x0 = W, x1 = -1, y0 = H, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] > 200) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return { x0, x1, y0, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
// THE CROP. ludo animates inside the input's content box plus a margin, and whatever the model draws
// past that canvas is clipped. Pasted back into the 1024 box (frame_size -9) the clip became a hard line
// INSIDE the frame: every roll was cut flat at row 544 (auto margin), or at 630 with the margin at 0 -
// the hammer sliced off, which is the original bug. Faint corner dots do not widen the box (ludo ignores
// them). So: frame_size 0 returns the whole working canvas, a generous margin gives the strike room, the
// canvas edge is the only place a clip can happen (and a roll that clips is rejected), and write() places
// every frame by matching frame 0's anvil to the base anvil.
async function animate(kind) {
  if (!MOTION[kind]) throw new Error('kind must be success|fail');
  fs.mkdirSync(REVIEW, { recursive: true });
  // FORGE_INPUT=hammer starts (and, with FORGE_END_ON_BASE, ends) on the raised-hammer base - see --base-hammer
  const input = process.env.FORGE_INPUT === 'hammer' ? path.join(ROOT, 'scripts', 'seeds', 'forge_base_hammer_hd.png') : BASE;
  const uri = 'data:image/png;base64,' + fs.readFileSync(input).toString('base64');
  const model = process.env.FORGE_ANIM_MODEL || 'eagle';
  const tag = kind + '_' + model + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  // FORGE_END_ON_BASE=1 pins the LAST frame to the base too: free rolls pushed the camera in on the anvil
  // (26-44% bigger, feet cut off), and an animation that must end on the untouched base cannot stay there.
  const body = { initial_image: uri, motion_prompt: MOTION[kind] + CAM, frames: 9, frame_size: -9, model, crop: false, loop: false,
    individual_frames: true };
  // ludo's AUTO margin is the only setting that kept the anvil still: margin 0 cropped right above the anvil,
  // margin 1.0 made every model zoom in 56-66%. Override per axis only to experiment.
  if (process.env.FORGE_MARGIN_H) body.margin_ratio_horizontal = Number(process.env.FORGE_MARGIN_H);
  if (process.env.FORGE_MARGIN_V) body.margin_ratio_vertical = Number(process.env.FORGE_MARGIN_V);
  if (process.env.FORGE_END_ON_BASE) body.final_image = uri;
  const res = await ludo('assets/sprite/animate', body);
  fs.writeFileSync(path.join(REVIEW, tag + '.json'), JSON.stringify(res, null, 1));   // spritesheet_url, for a later /sprite/edit
  const fr = await framesFrom(res, 9);
  const b0 = anvilBox(await raw(fs.readFileSync(BASE)));
  let worst = 0, drift = 0, size = 0, bg = 0, ref = null, dims = '', cut = 0;
  for (let i = 0; i < 9; i++) {
    fs.writeFileSync(path.join(REVIEW, `${tag}_${i}.png`), await sharp(fr[i]).png().toBuffer());
    const r = await raw(fr[i]), e = edges(r), a = anvilBox(r);
    if (i === 0) { ref = b0; dims = `${r.W}x${r.H}`; }
    worst = Math.max(worst, e.l, e.r, e.t);                 // the canvas edge: solid ink here = clipped
    drift = Math.max(drift, Math.abs(a.cx - ref.cx), Math.abs(a.feet - ref.feet)); size = Math.max(size, Math.abs(a.w - ref.w) / ref.w);
    if (r.data[3] > 40 || r.data[(r.W - 1) * 4 + 3] > 40) bg++;
    // the pasted-back clip: solid ink on the TOPMOST ink row (a drawn edge is antialiased)
    for (let y = 0; y < r.H; y++) { let ink = 0, solid = 0; for (let x = 0; x < r.W; x++) { const al = r.data[(y * r.W + x) * 4 + 3]; if (al > 24) ink++; if (al > 200) solid++; } if (ink) { cut = Math.max(cut, solid); break; } }
  }
  console.log(`${tag} (${dims}): crop-line solid px ${cut} | canvas-edge alpha ${worst} | anvil drift ${(drift * 100).toFixed(1)}% size ${(size * 100).toFixed(1)}% | opaque-corner frames ${bg}`
    + (cut > 6 || worst > 60 || drift > 0.03 || size > 0.06 || bg ? '  REJECT' : '  OK'));
}
// Place each raw canvas so its frame-0 anvil lands on the base anvil, fade the last 5% toward the
// left/right/top of BOTH the raw canvas and the 1024 frame (never the floor), write 1024 px frames.
async function write(tag) {
  const kind = tag.split('_')[0];
  const baseBox = solidBox(await raw(fs.readFileSync(BASE)));
  const raw0 = await raw(fs.readFileSync(path.join(REVIEW, `${tag}_0.png`)));
  const b0 = solidBox(raw0);
  // -9 frames come back in the input's own 1024 box: place them as they are
  const same = raw0.W === OUT && raw0.H === OUT;
  const s = same ? 1 : baseBox.w / b0.w;
  const left = same ? 0 : Math.round(baseBox.x0 - b0.x0 * s), top = same ? 0 : Math.round(baseBox.y1 - b0.y1 * s);
  const sm = (t) => { const x = Math.max(0, Math.min(1, t)); return x * x * (3 - 2 * x); };
  const fade = (r, ramp) => { for (let y = 0; y < r.H; y++) for (let x = 0; x < r.W; x++) {
    const k = Math.min(sm(x / ramp), sm((r.W - 1 - x) / ramp), sm(y / ramp)), p = (y * r.W + x) * 4 + 3;
    if (k < 1 && r.data[p]) r.data[p] = Math.round(r.data[p] * k); } return r; };
  const out = [];
  for (let i = 0; i < 9; i++) {
    const f = path.join(REVIEW, `${tag}_${i}.png`);
    if (!fs.existsSync(f)) throw new Error('missing ' + f);
    const r = fade(await raw(fs.readFileSync(f)), Math.round(Math.min(raw0.W, raw0.H) * 0.04));
    // A residual clip: an outermost ink row/column (top, left, right) carrying solid pixels is ludo's canvas
    // edge cutting something - the chosen success roll clips a few spark tips at row 250 and its burst frames
    // at columns 64 and 961. Taper the 48 px inside each such line so the tips fade out instead of stopping.
    {
      const R = Math.round(r.H * 0.047), A = (x, y) => r.data[(y * r.W + x) * 4 + 3];
      const lineY = (y) => { let ink = 0, solid = 0; for (let x = 0; x < r.W; x++) { const al = A(x, y); if (al > 24) ink++; if (al > 200) solid++; } return [ink, solid]; };
      const lineX = (x) => { let ink = 0, solid = 0; for (let y = 0; y < r.H; y++) { const al = A(x, y); if (al > 24) ink++; if (al > 200) solid++; } return [ink, solid]; };
      const taper = (inside) => { for (let y = 0; y < r.H; y++) for (let x = 0; x < r.W; x++) { const d = inside(x, y); if (d < 0 || d >= R) continue; const p = (y * r.W + x) * 4 + 3; if (r.data[p]) r.data[p] = Math.round(r.data[p] * sm(d / R)); } };
      let yT = 0; while (yT < r.H && !lineY(yT)[0]) yT++;
      if (yT < r.H && lineY(yT)[1] > 6) taper((x, y) => y - yT);
      let xL = 0; while (xL < r.W && !lineX(xL)[0]) xL++;
      if (xL < r.W && lineX(xL)[1] > 6) taper((x) => x - xL);
      let xR = r.W - 1; while (xR > 0 && !lineX(xR)[0]) xR--;
      if (xR > 0 && lineX(xR)[1] > 6) taper((x) => xR - x);
    }
    const W2 = Math.round(r.W * s), H2 = Math.round(r.H * s);
    const scaled = await sharp(r.data, { raw: { width: r.W, height: r.H, channels: 4 } }).resize(W2, H2).png().toBuffer();
    // clip the placed canvas to the 1024 frame (extract the overlapping part)
    const cx0 = Math.max(0, -left), cy0 = Math.max(0, -top), cw = Math.min(W2 - cx0, OUT - Math.max(0, left)), ch = Math.min(H2 - cy0, OUT - Math.max(0, top));
    const piece = await sharp(scaled).extract({ left: cx0, top: cy0, width: cw, height: ch }).png().toBuffer();
    const placed = await sharp({ create: { width: OUT, height: OUT, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: piece, left: Math.max(0, left), top: Math.max(0, top) }]).png().toBuffer();
    const pr = fade(await raw(placed), Math.round(OUT * 0.05));
    out.push(await sharp(pr.data, { raw: { width: OUT, height: OUT, channels: 4 } }).webp({ quality: 88, alphaQuality: 90, effort: 6 }).toBuffer());
  }
  const dir = path.join(DEST, 'Sprites', 'fx', 'anim');
  for (let i = 0; i < 9; i++) { const f = path.join(dir, `forge_${kind}_${i}.webp`); fs.writeFileSync(f + '.tmp', out[i]); fs.renameSync(f + '.tmp', f); }
  if (kind === 'success') {   // the still is the resting anvil, same box as the frames
    const st = await sharp(fs.readFileSync(BASE)).resize(OUT, OUT).webp({ quality: 88, alphaQuality: 90, effort: 6 }).toBuffer();
    const f = path.join(DEST, 'Sprites', 'fx', 'forge_success.webp'); fs.writeFileSync(f + '.tmp', st); fs.renameSync(f + '.tmp', f);
  }
  console.log(`wrote forge_${kind}_0..8.webp scale ${s.toFixed(3)} at ${left},${top} (${out.map((b) => Math.round(b.length / 1024) + 'k').join(' ')})`);
}

if (arg('animate') && !KEY) { console.error('LUDO_API_KEY is not set'); process.exit(1); }
if (arg('base')) await base();
else if (arg('animate')) await animate(arg('animate'));
else if (arg('write')) await write(arg('write'));
else console.log('usage: --base | --animate=success|fail | --write=<tag>');
// --hammer: a static hammer sprite for the raised-hammer base (static images have no animation canvas, so
// nothing is clipped). Output scripts/_tmp_forge_hd/hammer_N.png for review.
if (arg('hammer')) {
  if (!KEY) { console.error('LUDO_API_KEY is not set'); process.exit(1); }
  fs.mkdirSync(REVIEW, { recursive: true });
  const prompt = 'A single blacksmith hammer seen from the side, lying horizontal: a chunky dark iron hammer head on the LEFT, '
    + 'its striking face pointing DOWN, and a straight wooden handle extending to the RIGHT. Clean cel-shaded fantasy game art, '
    + 'bold black outline, matching a dark iron anvil, centred, fully transparent background, no hand, no text.';
  for (let n = 1; n <= 2; n++) {
    const d = await ludo('assets/image', { image_type: 'sprite', art_style: 'Cel-Shaded', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt });
    const url = Array.isArray(d) ? d[0] && d[0].url : d.url;
    fs.writeFileSync(path.join(REVIEW, `hammer_${n}.png`), await sharp(await fetchBuf(url)).png().toBuffer());
    console.log('hammer_' + n);
  }
}
// --base-hammer: the base anvil with the hammer RAISED above its face. Every roll that started from the bare
// anvil had the hammer swing in from outside the input, and ludo only animates inside the input's content box
// plus a margin, so the hammer (and the sparks above it) was clipped along a hard line (row 544 of 1024). With
// the hammer IN the first frame the content box - and so the canvas - covers the whole strike.
const BASE_HAMMER = path.join(ROOT, 'scripts', 'seeds', 'forge_base_hammer_hd.png');
if (arg('base-hammer')) {
  const hsrc = path.join(REVIEW, `hammer_${arg('base-hammer') === true ? 1 : arg('base-hammer')}.png`);
  const h = await sharp(fs.readFileSync(hsrc)).ensureAlpha().trim({ threshold: 10 }).png().toBuffer();
  const hm = await sharp(h).metadata();
  const bb = await raw(fs.readFileSync(BASE));
  let y0 = bb.H, x0 = bb.W, x1 = -1;
  for (let y = 0; y < bb.H; y++) for (let x = 0; x < bb.W; x++) if (bb.data[(y * bb.W + x) * 4 + 3] > 200) { if (y < y0) y0 = y; if (x < x0) x0 = x; if (x > x1) x1 = x; }
  const hw = Math.round((x1 - x0) * 0.52), hh = Math.round(hm.height * hw / hm.width);
  const hs = await sharp(h).resize(hw, hh).png().toBuffer();
  // head (left ~28% of the sprite) centred over the anvil's middle, its striking face ~9% of a frame above the anvil
  const left = Math.round((x0 + x1) / 2 - hw * 0.14), top = Math.round(y0 - IN * 0.09 - hh);
  const out = await sharp(fs.readFileSync(BASE)).composite([{ input: hs, left, top }]).png().toBuffer();
  fs.writeFileSync(BASE_HAMMER + '.tmp', out); fs.renameSync(BASE_HAMMER + '.tmp', BASE_HAMMER);
  console.log('wrote ' + path.relative(ROOT, BASE_HAMMER), { hammerTop: top, anvilTop: y0 });
}
