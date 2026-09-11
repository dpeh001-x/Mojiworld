#!/usr/bin/env node
// Boss HP bar furniture (ludo.ai text->sprite), v2 - in the game's own style.
//
// Per user (2026-09-10, screenshot of the bar): "The boss health bar can be better regenerated to
// something more appropriate to the game art style." v1 (v0.29.x) asked for dark-fantasy filigree:
// gunmetal rails, baroque finials, gothic spikes. It was well made and belonged to a different
// game - the cast is chunky chibi with thick keylines and glossy cel shading (see the quest
// compass, the spore, the cast flashes), and a gothic frame over that reads as borrowed. v2 asks
// for the house idiom: chunky rounded gold rails with a thick near-black outline, glossy
// highlights, rounded end caps, a small gem emblem at the centre, and a HOLLOW middle.
//
// Two pieces, same files as v1 so the loader and manifest are untouched:
//   Sprites/fx/ui_bossbar_frame.webp - the frame, 1024 wide, height as painted (uniform scale,
//                                      never squashed - v1 forced 1024x112 with fit:fill, which
//                                      is how a 16:9 generation became a 9:1 smear)
//   Sprites/fx/ui_bossbar_fill.webp  - the ribbon, 1024x64, source-cropped by HP% at draw time
//
// The game 3-slices the frame at its natural aspect (v0.30.462), which means the draw code has
// to know WHERE the hollow, the end caps and the centre emblem are. v1 hardcoded those from one
// look at the art; v2 MEASURES them off the written bytes and emits geom.json for the ship patch
// to bake into _BB_GEOM. Gates refuse a frame whose hollow is not really hollow, whose caps eat
// the bar, or that is too dark to carry a keyline over the fill; and a fill that is not opaque,
// not red-to-pink, or too dim. Candidates are dumped so a refusal can be looked at.
//
//   node scripts/gen_bossbar_ui.mjs                 # dry run: prompts
//   node scripts/gen_bossbar_ui.mjs --generate      # both pieces (needs LUDO_API_KEY)
//   node scripts/gen_bossbar_ui.mjs --generate --only=frame|fill   --rolls=3
//   node scripts/gen_bossbar_ui.mjs --measure       # re-measure the frame on disk, print geom
import { mkdir, writeFile, rename, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
sharp.cache(false);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'Sprites', 'fx');
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f, d) => { const a = argv.find((x) => x.startsWith(f + '=')); return a ? a.split('=')[1] : d; };
const ROLLS = Number(val('--rolls', 3));
const DUMP = process.env.BOSSBAR_DUMP_DIR || join(ROOT, 'scripts', '_tmp_bossbar');
const GEOM_OUT = process.env.BOSSBAR_GEOM_OUT || join(DUMP, 'geom.json');
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const apiKey = process.env.LUDO_API_KEY;
const FRAME_W = 1024, FILL_W = 1024, FILL_H = 64;

const STYLE = ' Chunky chibi cartoon game UI in the style of a cute mobile RPG: bold clean shapes, a thick '
  + 'uniform near-black outline round every edge, soft cel shading from an upper light, glossy white highlight '
  + 'streaks on the rounded surfaces, bright saturated colour. Flat 2D game UI sprite on a fully transparent '
  + 'background, no drop shadow, no scenery, no text, no numbers, no letters, no watermark.';
// Roll 1 and 2 of the first run painted two SEPARATE rails with knobs on each - open at both ends,
// so the hollow ran the full width and the gate refused them. The frame has to be one closed
// loop, said three ways: a stadium outline, four sides named, a slot INSIDE it.
// Per user, on seeing the gold-rails-and-gem crest candidates: "the style can be a little less
// gothic classical". So: no crest, no gems, no filigree or engraving - a soft rounded tube of a
// frame with big round end caps and one small plain star badge, toy-like rather than regal.
// Third steer, on the toy capsule with the star badge: "this is too cartoonish". Between the
// gothic filigree (v1) and the toy (v2b) sits the register the rest of the game's UI panels use -
// a sleek anime-RPG plate: dark graphite metal with slim gold trim, angular gold end caps, one
// small diamond emblem. Refined, not cute; simple, not baroque. The style tail below is this
// prompt's own; the chibi STYLE line is for sprites, and it is what made the capsule a toy.
const FRAME_STYLE = ' Sleek modern fantasy-RPG game UI, the kind a polished anime action RPG uses for its boss '
  + 'bar: crisp clean vector-like edges, a fine dark outline, subtle bevel and soft highlight on the gold, flat '
  + 'shading, refined and elegant but SIMPLE. Not chibi, not cute, not a toy, not cartoonish, not photoreal. '
  + 'Flat 2D UI sprite on a fully transparent background, no drop shadow, no scenery, no text, no numbers, no '
  + 'letters, no watermark.';
const FRAME_PROMPT = 'A BOSS HEALTH BAR FRAME for a 2D action RPG, very wide and thin, seen straight on: ONE single '
  + 'closed frame around a long thin slot - a continuous border running all the way round: a slim rail of dark '
  + 'graphite metal edged with a thin bright gold trim line along the top and along the bottom, and at each end '
  + 'a solid angular gold end cap shaped like a short pointed chevron that CONNECTS the top rail to the bottom '
  + 'rail and closes the frame. One small gold diamond-shaped emblem sits centred on the top rail. Clean and '
  + 'restrained: NO filigree, NO scrollwork, NO baroque or gothic ornament, NO gems other than the one diamond '
  + 'emblem, NO stars, NO spikes, NO engraving. The rails are slim, about a quarter as thick as the slot between '
  + 'them. The long slot INSIDE the frame MUST be completely empty and transparent - a hollow open window where '
  + 'a health fill will show through from behind - nothing painted inside it, no fill, no red bar, no gradient, '
  + 'no glass.' + FRAME_STYLE;
const FILL_PROMPT = 'A HEALTH BAR FILL texture for a 2D game: a very wide thin horizontal ribbon of glossy '
  + 'bright crimson-red to hot-pink liquid energy, flat cel shaded - a lighter pink band across the top third '
  + 'with a crisp white glossy highlight streak, a deeper red band along the bottom, a few small round '
  + 'bubbles and sparkles inside it. It fills the whole image edge to edge, corner to corner, with NO border, '
  + 'no outline, no frame, no end caps, no background and no text.';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function fetchBuf(url) { const r = await fetch(url, { signal: AbortSignal.timeout(90000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); }
async function makeImage(prompt, label, ratio) {
  let last;
  for (let a = 1; a <= 4; a++) {
    try {
      const res = await fetch(`${API}/assets/image`, { method: 'POST', headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: ratio, n: 1, augment_prompt: false, prompt }), signal: AbortSignal.timeout(150000) });
      if (res.status === 402) { console.log('OUT OF CREDITS'); process.exit(3); }
      if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 140)}`);
      const data = await res.json();
      const url = Array.isArray(data) ? data[0] && data[0].url : (data && (data.url || (data.images && data.images[0] && data.images[0].url)));
      if (!url) throw new Error('no url in the response');
      return await fetchBuf(url);
    } catch (e) { last = e; console.log(`  ${label} attempt ${a} failed: ${e.message}`); if (a < 4) await sleep(4000 * a); }
  }
  throw new Error(`${label} FAILED: ${last && last.message}`);
}

// ---- measurement --------------------------------------------------------------------------------
async function raw(buf) { const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); return { d: data, W: info.width, H: info.height, A: (x, y) => data[(y * info.width + x) * 4 + 3] }; }
function colourStats(p, band) {
  const { d, W, H } = p; let op = 0, dark = 0, bright = 0, sat = 0, inBand = 0, solid = 0;
  for (let i = 0; i < W * H * 4; i += 4) { const a = d[i + 3]; if (a >= 250) solid++; if (a < 200) continue; op++;
    const r = d[i], g = d[i + 1], b = d[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    // "dark" is luminance under 90, not max-channel under 70: a gold object's keyline in this
    // cast is dark BROWN (the quest compass, and every toy-prompt roll), and the near-black test
    // refused three good frames at 0-2% while their brown ink was a fifth of the pixels.
    const lum = 0.299 * r + 0.587 * g + 0.114 * b; if (lum < 90) dark++; if (lum > 150) bright++;
    const s = mx ? (mx - mn) / mx : 0; if (s >= 0.35 && mx >= 64) { sat++; if (band) { const c = mx - mn; let h = mx === r ? ((g - b) / c) % 6 : mx === g ? (b - r) / c + 2 : (r - g) / c + 4; h *= 60; if (h < 0) h += 360; if (band[0] <= band[1] ? (h >= band[0] && h <= band[1]) : (h >= band[0] || h <= band[1])) inBand++; } } }
  return { op, dark: op ? dark / op : 0, bright: op ? bright / op : 0, sat: op ? sat / op : 0, band: sat ? inBand / sat : 0, solid: solid / (W * H) };
}
function measureFrame(p) {
  const { W, H, A } = p, x0 = Math.round(W * 0.2), x1 = Math.round(W * 0.8);
  const clearRow = []; for (let y = 0; y < H; y++) { let c = 0; for (let x = x0; x < x1; x++) if (A(x, y) < 20) c++; clearRow.push(c / (x1 - x0) >= 0.95); }
  let best = { y0: -1, y1: -1 }, run = -1;
  for (let y = 0; y <= H; y++) { const on = y < H && clearRow[y]; if (on && run < 0) run = y; if (!on && run >= 0) { if (run > 0 && y < H && y - run > best.y1 - best.y0) best = { y0: run, y1: y }; run = -1; } }
  if (best.y0 < 0) return null;
  const hy0 = best.y0, hy1 = best.y1, my = (hy0 + hy1) >> 1;
  let hx0 = W >> 1, hx1 = W >> 1; while (hx0 > 0 && A(hx0 - 1, my) < 128) hx0--; while (hx1 < W && A(hx1, my) < 128) hx1++;
  let clear = 0; for (let y = hy0; y < hy1; y++) for (let x = hx0; x < hx1; x++) if (A(x, y) < 20) clear++;
  const hollowClear = clear / Math.max(1, (hy1 - hy0) * (hx1 - hx0));
  const prof = []; for (let x = 0; x < W; x++) { let c = 0; for (let y = 0; y < H; y++) if (A(x, y) >= 128) c++; prof.push(c); }
  const samp = []; for (let x = Math.round(W * 0.25); x < Math.round(W * 0.4); x++) samp.push(prof[x]); for (let x = Math.round(W * 0.6); x < Math.round(W * 0.75); x++) samp.push(prof[x]);
  samp.sort((a, b) => a - b); const rail = samp[samp.length >> 1], tol = Math.max(3, Math.round(rail * 0.25)), plain = (x) => Math.abs(prof[x] - rail) <= tol, RUN = 24;
  let capL = 0; for (let x = 0; x < W - RUN; x++) { let ok = true; for (let k = 0; k < RUN; k++) if (!plain(x + k)) { ok = false; break; } if (ok) { capL = x; break; } }
  let capR = 0; for (let x = W - 1; x >= RUN; x--) { let ok = true; for (let k = 0; k < RUN; k++) if (!plain(x - k)) { ok = false; break; } if (ok) { capR = W - 1 - x; break; } }
  // The crest is found with a much tighter tolerance than the caps: a round badge sitting on the
  // rail only clears the cap tolerance (25% of the rail) in its middle columns, so the first cut
  // measured a 75px star badge as 26px and would have stretched its flanks with the rails.
  const tol2 = Math.max(2, Math.round(rail * 0.06)), plain2 = (x) => Math.abs(prof[x] - rail) <= tol2;
  const c = W >> 1; let floX0 = c, floX1 = c;
  if (!(plain2(c) && plain2(c - 8) && plain2(c + 8))) {
    while (floX0 > capL && !(plain2(floX0 - 1) && plain2(floX0 - 2) && plain2(floX0 - 3))) floX0--;
    while (floX1 < W - capR && !(plain2(floX1) && plain2(floX1 + 1) && plain2(floX1 + 2))) floX1++;
    floX0 = Math.max(capL, floX0 - 4); floX1 = Math.min(W - capR, floX1 + 4);   // a little air so the badge's outline is never on a stretched slice
  }
  capL = Math.max(capL, hx0); capR = Math.max(capR, W - hx1);
  // CORNER INSET: how much further in the hollow's edge sits at its top and bottom rows than at
  // its middle row. A capsule's hollow is rounded, a chevron's is angled, and the game draws the
  // trough and fill as a RECTANGLE - so at each end the fill stopped flat inside a curved cap with
  // dark wedges in the corners (per user: "there is a cutoff at the edge"). The draw code clips
  // the trough and fill to a rounded rect of this radius so the fill follows the frame.
  const inset = (row) => { let l = W >> 1, r = W >> 1; while (l > 0 && A(l - 1, row) < 128) l--; while (r < W && A(r, row) < 128) r++; return Math.max(l - hx0, hx1 - r, 0); };
  const cin0 = Math.max(inset(hy0 + 1), inset(hy1 - 2), Math.round((inset(hy0 + Math.round((hy1 - hy0) * 0.25)) + inset(hy1 - Math.round((hy1 - hy0) * 0.25))) * 1.3));
  // ...but never further than the cap's opaque body covers on its thinnest hollow row, or the
  // trough would show past the frame's outer edge. (The sleek chevron covers ~47px at every row
  // against a 33px inset; a capsule's outer curve could be thinner than its inner one.)
  let cover = W; for (let y = hy0; y < hy1; y++) { let fo = 0; while (fo < W && A(fo, y) < 128) fo++; let lo = W - 1; while (lo > 0 && A(lo, y) < 128) lo--;
    let hl = W >> 1; while (hl > 0 && A(hl - 1, y) < 128) hl--; let hr = W >> 1; while (hr < W && A(hr, y) < 128) hr++; cover = Math.min(cover, hl - fo, lo - hr); }
  const cin = Math.max(0, Math.min(cin0, cover - 4));
  // HOLLOW OUTLINE, sampled: [row, leftEdge, rightEdge] at nine rows from the hollow's top to its
  // bottom. The draw code clips the trough and fill to this polygon, so the fill reaches exactly
  // the hollow's corners - rounded, chamfered or square - and never past the cap's outer edge.
  // (A rectangle cannot do both on a chevron: its inner and outer edges are parallel, so what
  // reaches the top corner pokes out above the tip.)
  const hpoly = []; for (let i = 0; i < 9; i++) { const r = Math.round(hy0 + (hy1 - 1 - hy0) * i / 8); let l = W >> 1, rr = W >> 1; while (l > 0 && A(l - 1, r) < 128) l--; while (rr < W && A(rr, r) < 128) rr++; hpoly.push([r, l, rr]); }
  return { W, H, hy0, hy1, hx0, hx1, capL, capR, floX0, floX1, cin, capCover: cover, hpoly, rail, hollowClear: +hollowClear.toFixed(3) };
}
function gateFrame(g, c) {
  const bad = []; if (!g) return ['no hollow strip: no row band across the middle 60% of the width is transparent'];
  const hh = g.hy1 - g.hy0; if (hh < g.H * 0.2) bad.push(`hollow too thin (${hh}px of ${g.H})`); if (hh > g.H * 0.8) bad.push(`hollow is most of the height (${hh}px of ${g.H}) - no rails`);
  if (g.hx0 <= 0 || g.hx1 >= g.W) bad.push('open ends: the hollow runs off the canvas, so the rails are not joined by end caps');
  if (g.hx1 - g.hx0 < g.W * 0.6) bad.push(`hollow too short (${g.hx1 - g.hx0}px of ${g.W})`);
  if (g.hollowClear < 0.97) bad.push(`hollow not really hollow (${(100 * g.hollowClear).toFixed(1)}% clear, want >= 97%)`);
  if (g.capL > g.W * 0.3 || g.capR > g.W * 0.3) bad.push(`end caps eat the bar (${g.capL} / ${g.capR}px)`);
  if (g.floX1 - g.floX0 > g.W * 0.4) bad.push(`centre crest too wide (${g.floX1 - g.floX0}px)`);
  // bright >= 12%, not 25%: a graphite frame with gold trim is MEANT to be mostly dark, and the
  // trim is what has to read over the fill. The old filigree measured 4%; the gold capsule 50%.
  if (c.dark < 0.04) bad.push(`no keyline (${(100 * c.dark).toFixed(1)}% dark)`); if (c.bright < 0.12) bad.push(`too dark to read (${(100 * c.bright).toFixed(0)}% bright)`);
  return bad;
}
function gateFill(c) {
  const bad = [];
  if (c.solid < 0.98) bad.push(`not opaque edge to edge (${(100 * c.solid).toFixed(1)}% solid)`);
  if (c.sat < 0.25) bad.push(`too grey (${(100 * c.sat).toFixed(0)}% saturated)`); if (c.band < 0.5) bad.push(`not red-to-pink (${(100 * c.band).toFixed(0)}% in band)`);
  if (c.bright < 0.25) bad.push(`too dim (${(100 * c.bright).toFixed(0)}% bright)`);
  return bad;
}
const fmtG = (g) => g ? `H ${g.H} hollow y ${g.hy0}..${g.hy1} x ${g.hx0}..${g.hx1} (${(100 * g.hollowClear).toFixed(1)}% clear) caps ${g.capL}/${g.capR} crest ${g.floX0}..${g.floX1} rail ${g.rail}` : 'no hollow';
async function install(file, buf) { await mkdir(DIR, { recursive: true }); const dst = join(DIR, file); await writeFile(dst + '.tmp', buf); await rename(dst + '.tmp', dst); console.log(`  -> Sprites/fx/${file} (${Math.round(buf.length / 1024)}KB)`); }

// ---- main ----------------------------------------------------------------------------------------
const only = val('--only', '');
if (has('--measure')) {
  const png = await sharp(join(DIR, 'ui_bossbar_frame.webp')).png().toBuffer(); const p = await raw(png), g = measureFrame(p), c = colourStats(p);
  console.log(fmtG(g), '| keyline', (100 * c.dark).toFixed(1) + '%', 'bright', (100 * c.bright).toFixed(0) + '%', '| gates:', gateFrame(g, c).join('; ') || 'pass');
  if (g) { await mkdir(dirname(GEOM_OUT), { recursive: true }); await writeFile(GEOM_OUT, JSON.stringify(g, null, 2) + '\n'); console.log('geom ->', GEOM_OUT); }
  process.exit(0);
}
async function seatFrame(src) {
  let content; try { content = await sharp(src).trim({ threshold: 10 }).png().toBuffer(); } catch { content = await sharp(src).png().toBuffer(); }
  return sharp(content).resize({ width: FRAME_W, withoutEnlargement: false }).png().toBuffer();
}
async function judgeFrame(png, label) {
  const out = await sharp(png).webp({ quality: 95, alphaQuality: 100, effort: 6 }).toBuffer();
  const p = await raw(await sharp(out).png().toBuffer()), g = measureFrame(p), c = colourStats(p), bad = gateFrame(g, c);
  console.log(`${label}: ${fmtG(g)} | keyline ${(100 * c.dark).toFixed(1)}% bright ${(100 * c.bright).toFixed(0)}% - ${bad.length ? 'REJECT: ' + bad.join('; ') : 'PASSES'}`);
  return { out, g, bad };
}
async function installFrame(out, g) { await install('ui_bossbar_frame.webp', out); await mkdir(dirname(GEOM_OUT), { recursive: true }); await writeFile(GEOM_OUT, JSON.stringify(g, null, 2) + '\n'); console.log('  geom ->', GEOM_OUT); }
const frameFrom = val('--frame-from', '');
if (frameFrom) {   // re-seat a dumped raw (or any candidate) through the frame pipeline, no API call
  const { out, g, bad } = await judgeFrame(await seatFrame(await readFile(frameFrom)), 'frame from ' + frameFrom.split(/[\\/]/).pop());
  if (bad.length) process.exit(2); await installFrame(out, g); process.exit(0);
}
const fillFrom = val('--fill-from', '');
if (fillFrom) {   // re-seat a dumped or hand-picked candidate through the fill pipeline, no API call
  const { out, bad } = await judgeFill(await seatFill(await readFile(fillFrom)), 'fill from ' + fillFrom.split(/[\\/]/).pop());
  if (bad.length) process.exit(2); await install('ui_bossbar_fill.webp', out); process.exit(0);
}
if (!has('--generate')) { console.log('DRY RUN\n\n# frame\n' + FRAME_PROMPT + '\n\n# fill\n' + FILL_PROMPT + '\n'); process.exit(0); }
if (!apiKey) { console.error('LUDO_API_KEY not set'); process.exit(1); }
await mkdir(DUMP, { recursive: true });
let failed = [];
if (!only || only === 'frame') {
  let done = false;
  for (let roll = 1; roll <= ROLLS && !done; roll++) {
    const src = await makeImage(FRAME_PROMPT, `frame roll ${roll}`, 'ar_16_9');
    await writeFile(join(DUMP, `frame_r${roll}_raw.png`), src);   // the raw, so a gate fix can re-seat it with --frame-from
    const { out, g, bad } = await judgeFrame(await seatFrame(src), `frame roll ${roll}`); await writeFile(join(DUMP, `frame_r${roll}.webp`), out);
    if (!bad.length) { await installFrame(out, g); done = true; }
  }
  if (!done) failed.push('frame');
}
// The ribbon is a TEXTURE, source-cropped by HP% and drawn edge to edge, so it must be opaque
// to the last pixel. The model paints it as a sprite - a rounded ribbon with a soft transparent
// hairline along the bottom (run 1: 95-97% solid, refused three times with the colour already
// right). So: trim, take the inner 92% x 88% so the painted edge is outside the crop, resize,
// and flatten what little alpha is left onto the ribbon's own median colour.
async function seatFill(src) {
  let content; try { content = await sharp(src).trim({ threshold: 10 }).png().toBuffer(); } catch { content = await sharp(src).png().toBuffer(); }
  const m = await sharp(content).metadata();
  const left = Math.round(m.width * 0.04), top = Math.round(m.height * 0.06);
  const inner = await sharp(content).extract({ left, top, width: m.width - 2 * left, height: m.height - 2 * top }).resize(FILL_W, FILL_H, { fit: 'fill' }).png().toBuffer();
  const p = await raw(inner); const rs = [], gs = [], bs = [];
  for (let i = 0; i < p.W * p.H * 4; i += 4) if (p.d[i + 3] >= 250) { rs.push(p.d[i]); gs.push(p.d[i + 1]); bs.push(p.d[i + 2]); }
  const med = (a) => { a.sort((x, y) => x - y); return a[a.length >> 1] || 0; };
  return sharp(inner).flatten({ background: { r: med(rs), g: med(gs), b: med(bs) } }).png().toBuffer();
}
async function judgeFill(png, label) {
  const out = await sharp(png).webp({ quality: 92 }).toBuffer();
  const c = colourStats(await raw(await sharp(out).png().toBuffer()), [320, 20]), bad = gateFill(c);
  console.log(`${label}: solid ${(100 * c.solid).toFixed(1)}% sat ${(100 * c.sat).toFixed(0)}% band ${(100 * c.band).toFixed(0)}% bright ${(100 * c.bright).toFixed(0)}% - ${bad.length ? 'REJECT: ' + bad.join('; ') : 'PASSES'}`);
  return { out, bad };
}
if (!only || only === 'fill') {
  let done = false;
  for (let roll = 1; roll <= ROLLS && !done; roll++) {
    const src = await makeImage(FILL_PROMPT, `fill roll ${roll}`, 'ar_16_9');
    await writeFile(join(DUMP, `fill_r${roll}_raw.png`), src);   // the raw, so a pipeline fix can re-seat it for free
    const { out, bad } = await judgeFill(await seatFill(src), `fill roll ${roll}`); await writeFile(join(DUMP, `fill_r${roll}.webp`), out);
    if (!bad.length) { await install('ui_bossbar_fill.webp', out); done = true; }
  }
  if (!done) failed.push('fill');
}
console.log(failed.length ? `FAILED: ${failed.join(' ')}` : 'boss bar UI generated');
process.exit(failed.length ? 2 : 0);
