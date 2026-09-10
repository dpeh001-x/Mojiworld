#!/usr/bin/env node
// Sprites/ui/cs_preview_bg.webp + cs_preview_bg_floor.webp - the backdrop inside the
// character-creation preview box.
// ============================================================================
// Per user, on the violet shrine niche: "for the background regenerate it again, make the colour
// tone more neutral white grey and one with a floor for the character."
//
// THE CONCEPT NOW. A pale studio alcove: an archway of light grey stone with soft fluting and
// faint silver carving, opening onto a bright white-grey haze. Two files from ONE painting:
//   cs_preview_bg.webp        the open haze, nothing to stand on
//   cs_preview_bg_floor.webp  the same alcove with a flat stone floor across the bottom third and
//                             a low round dais where the figure stands
// The floor is COMPOSITED, not prompted. The first run asked the model for a floor in five rolls
// and got five floorless archways (sharpest lower-half step 3 of 255, the same as the open
// variant) - this endpoint paints the alcove it knows. Painting the floor here means the two
// variants are the same picture above the horizon, so switching between them is a real choice
// about the floor and nothing else, and the floor line cannot fail to exist.
// The CSS ships the floor variant; the open one stays on disk as the alternative.
//
// WHAT IT SITS BEHIND. .cs-look-preview-wrap is a 240x240 rounded square (158 on mobile) with the
// hero canvas centred on top, so the figure stands dead centre with its feet near the bottom. The
// art has to be interesting at the edges and get out of the way through the middle.
//
//   node scripts/gen_cs_preview_backdrop.mjs                     # print the brief
//   node scripts/gen_cs_preview_backdrop.mjs --generate          # needs LUDO_API_KEY; ships both
//   flags: --rolls N   --keep <seated open roll>   (re-judge a saved roll and ship both from it)
import sharp from 'sharp';
import { writeFile, rename } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const S = 512;
const has = (f) => process.argv.includes(f);
const argOf = (f, d) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : d; };
const ROLLS = Number(argOf('--rolls', '5'));
export const FILES = { plain: 'cs_preview_bg.webp', floor: 'cs_preview_bg_floor.webp' };

const PROMPT =
  'A quiet pale STUDIO ALCOVE painted as a full square scene that fills the whole picture edge to '
  + 'edge, in NEUTRAL WHITE and LIGHT GREY tones only. A tall archway of smooth light grey stone '
  + 'frames the view, its pillars running down both side edges and its arch curving across the '
  + 'top, with soft carved fluting and faint silver-grey filigree in the stone. Through the '
  + 'archway behind, a bright soft white-grey haze lit gently from above, with a few faint pale '
  + 'motes of light drifting. '
  + 'The colours are ONLY white, off-white, light grey, mid grey and soft silver. Completely '
  + 'desaturated: no purple, no violet, no blue, no gold, no yellow, no red, no green, no warm '
  + 'tint, no cool tint, no saturated colour anywhere. '
  + 'The middle of the picture is OPEN and quiet - just soft haze between the pillars, nothing '
  + 'painted in the centre. Every corner of the picture has stone, carving or haze painted in it, '
  + 'nothing left as plain empty background. '
  + 'Storybook game art, bold clean shapes, soft painted light, calm and airy. '
  + 'No character, no person, no creature, no statue. No text, no letters, no watermark, no user '
  + 'interface, no picture frame or border around the edge. '
  + 'There is NO floor and NO ground: the haze continues all the way down to the bottom edge, '
  + 'no steps, no platform, no dais, nothing to stand on.';

const key = process.env.LUDO_API_KEY;
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fetchBuf = async (u) => { const r = await fetch(u, { signal: AbortSignal.timeout(120000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); };

// The ground, a neutral grey radial keyed to the CSS scrim, so a cut-out with transparent
// margins - which is what this endpoint reliably returns - can never land off-palette.
const GROUND = Buffer.from(
  `<svg width="${S}" height="${S}">`
  + `<defs><radialGradient id="g" cx="50%" cy="30%" r="82%">`
  + `<stop offset="0%" stop-color="#f3f4f6"/><stop offset="78%" stop-color="#c5c9d0"/><stop offset="100%" stop-color="#a9adb6"/></radialGradient></defs>`
  + `<rect width="${S}" height="${S}" fill="url(#g)"/></svg>`);
// THE FLOOR. Horizon at 68%: a pale stone floor falling slightly darker toward the bottom edge, a
// crisp shadow line where it meets the wall, and a low round dais of two shallow ellipses under
// the spot the figure's feet land (the canvas is 220 of the 240 box; feet sit near 86%).
const HZ = Math.round(S * 0.68);
const FLOOR = Buffer.from(
  `<svg width="${S}" height="${S}">`
  + `<defs><linearGradient id="f" x1="0" y1="0" x2="0" y2="1">`
  + `<stop offset="0%" stop-color="#dfe1e6"/><stop offset="35%" stop-color="#cfd2d9"/><stop offset="100%" stop-color="#b3b7c0"/></linearGradient>`
  + `<radialGradient id="d" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#eceef1"/><stop offset="80%" stop-color="#d7dae0"/><stop offset="100%" stop-color="#c3c7cf"/></radialGradient>`
  + `<radialGradient id="s" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#5a5e68" stop-opacity="0.34"/><stop offset="100%" stop-color="#5a5e68" stop-opacity="0"/></radialGradient></defs>`
  + `<rect x="0" y="${HZ}" width="${S}" height="${S - HZ}" fill="url(#f)"/>`
  + `<rect x="0" y="${HZ}" width="${S}" height="3" fill="#8e929c" fill-opacity="0.75"/>`
  + `<rect x="0" y="${HZ + 3}" width="${S}" height="10" fill="#9da1aa" fill-opacity="0.35"/>`
  + `<ellipse cx="${S / 2}" cy="${Math.round(S * 0.875)}" rx="${Math.round(S * 0.36)}" ry="${Math.round(S * 0.085)}" fill="url(#s)"/>`
  + `<ellipse cx="${S / 2}" cy="${Math.round(S * 0.862)}" rx="${Math.round(S * 0.30)}" ry="${Math.round(S * 0.058)}" fill="#aeb2bb"/>`
  + `<ellipse cx="${S / 2}" cy="${Math.round(S * 0.850)}" rx="${Math.round(S * 0.30)}" ry="${Math.round(S * 0.058)}" fill="url(#d)"/>`
  + `</svg>`);

async function px(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { d: data, w: info.width, h: info.height };
}
async function seat(raw) {
  const trimmed = await sharp(raw).trim({ threshold: 8 }).png().toBuffer().catch(() => sharp(raw).png().toBuffer());
  // COVER, not inside: the square is filled by construction, so no roll can leave bare corners.
  const art = await sharp(trimmed).resize(S, S, { fit: 'cover', position: 'centre' }).png().toBuffer();
  // DESATURATE BY CONSTRUCTION. "Neutral white grey" is a hard requirement, and the model leaks
  // tint (a warm haze, a blue shadow) even when told not to. Pulling saturation to a fifth keeps
  // a whisper of the painted colour temperature and removes any hue the eye could name.
  const grey = await sharp(art).modulate({ saturation: 0.2 }).png().toBuffer();
  // THE HERO SCRIM. A mild neutral dimming of the band the figure stands in, so a pale-skinned,
  // white-haired chibi still separates from a white-grey wall.
  const HERO = Buffer.from(
    `<svg width="${S}" height="${S}"><defs><radialGradient id="h" cx="50%" cy="56%" r="42%">`
    + `<stop offset="0%" stop-color="#3a3d46" stop-opacity="0.26"/>`
    + `<stop offset="62%" stop-color="#3a3d46" stop-opacity="0.16"/>`
    + `<stop offset="100%" stop-color="#3a3d46" stop-opacity="0"/></radialGradient></defs>`
    + `<rect width="${S}" height="${S}" fill="url(#h)"/></svg>`);
  return sharp(GROUND).composite([{ input: grey, left: 0, top: 0 }, { input: HERO }]).webp({ quality: 90 }).toBuffer();
}
export const withFloor = (seated) => sharp(seated).composite([{ input: FLOOR }]).webp({ quality: 90 }).toBuffer();

export async function stats(buf) {
  const f = await px(buf);
  let sat = 0;
  for (let i = 0; i < f.d.length; i += 4) {
    const r = f.d[i], g = f.d[i + 1], b = f.d[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx > 46 && (mx - mn) / mx > 0.18) sat++;                // a pixel with a nameable hue
  }
  const satPct = 100 * sat / (f.w * f.h);
  const p = await px(await sharp(buf).resize(96, 96, { fit: 'fill' }).toBuffer());
  const lum = (i) => 0.299 * p.d[i] + 0.587 * p.d[i + 1] + 0.114 * p.d[i + 2];
  let all = 0, allN = 0; const rows = new Array(96).fill(0); const mid = [];
  for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) {
    const v = lum((y * 96 + x) * 4); all += v; allN++; rows[y] += v / 96;
    if (x > 30 && x < 66 && y > 12 && y < 56) mid.push(v);      // above any floor line
  }
  const mad = (vals) => { const mu = vals.reduce((a, b) => a + b, 0) / vals.length; return vals.reduce((a, b) => a + Math.abs(b - mu), 0) / vals.length; };
  let cd = 0;
  for (const [ox, oy] of [[3, 3], [75, 3], [3, 75], [75, 75]]) {
    const vals = [];
    for (let y = oy; y < oy + 18; y++) for (let x = ox; x < ox + 18; x++) vals.push(lum((y * 96 + x) * 4));
    cd += mad(vals);
  }
  // horizon: the sharpest brightness step between 4-row bands in the lower half
  let horizon = 0;
  for (let y = 48; y < 88; y++) horizon = Math.max(horizon, Math.abs((rows[y + 2] + rows[y + 3]) / 2 - (rows[y - 2] + rows[y - 1]) / 2));
  return { mean: all / allN, satPct, centreDetail: mad(mid), cornerDetail: cd / 4, horizon };
}
export function gate(s, variant) {
  const bad = [];
  if (s.satPct > 2.5) bad.push(`not neutral: ${s.satPct.toFixed(1)}% of pixels carry a nameable hue (want <= 2.5%)`);
  if (s.mean < 118) bad.push(`too dark for a white-grey backdrop: mean ${s.mean.toFixed(0)} (want >= 118)`);
  if (s.mean > 218) bad.push(`blown out: mean ${s.mean.toFixed(0)} (want <= 218)`);
  if (s.cornerDetail < 3.2) bad.push(`the corners are empty ground, not art: detail ${s.cornerDetail.toFixed(1)} (want >= 3.2)`);
  // A visibly empty haze measures 13-16 here: the band's own top-to-bottom light gradient is
  // most of that number. The first cut asked for <= 12 and rejected five clean rolls for it.
  if (s.centreDetail > 20) bad.push(`the middle is busy behind the character: detail ${s.centreDetail.toFixed(1)} (want <= 20)`);
  if (variant === 'floor' && s.horizon < 9) bad.push(`no floor line: sharpest lower-half step ${s.horizon.toFixed(1)} of 255 (want >= 9)`);
  if (variant === 'plain' && s.horizon >= 9) bad.push(`the open variant has a floor line: step ${s.horizon.toFixed(1)} (want < 9)`);
  return bad;
}
async function makeImage(label) {
  let last;
  for (let a = 1; a <= 4; a++) {
    try {
      process.stdout.write(`  ${label} attempt ${a} ... `);
      const res = await fetch(`${API}/assets/image`, { method: 'POST', headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(150000), body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt: PROMPT }) });
      if (res.status === 402) { console.log('OUT OF CREDITS'); process.exit(3); }
      if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 120)}`);
      const data = await res.json();
      const url = Array.isArray(data) ? data[0] && data[0].url : (data && (data.url || (data.images && data.images[0] && data.images[0].url)));
      if (!url) throw new Error('no url in the response');
      console.log('ok'); return await fetchBuf(url);
    } catch (e) { last = e; console.log('fail: ' + e.message); if (a < 4) await sleep(4000 * a); }
  }
  throw new Error(`${label} FAILED: ${last && last.message}`);
}
const line = (t, s) => `${t}: mean ${s.mean.toFixed(0)}, hue ${s.satPct.toFixed(1)}%, centre ${s.centreDetail.toFixed(1)}, corners ${s.cornerDetail.toFixed(1)}, horizon ${s.horizon.toFixed(1)}`;
async function ship(variant, buf) {
  const st = await stats(buf), bad = gate(st, variant);
  console.log(`  ${line(variant, st)} - ${bad.length ? 'REJECT: ' + bad.join('; ') : 'PASSES every gate'}`);
  if (bad.length) return false;
  const out = join(ROOT, 'Sprites', 'ui', FILES[variant]);
  await writeFile(out + '.tmp', buf); await rename(out + '.tmp', out);
  console.log(`  -> Sprites/ui/${FILES[variant]} (${Math.round(buf.length / 1024)}KB)`);
  return true;
}
async function shipBoth(seated) {
  const a = await ship('plain', seated);
  const b = a && await ship('floor', await withFloor(seated));
  return a && b;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  // --keep <file>: ship both variants from a roll this script already seated (post-seat bytes;
  // re-seating would paint the ground and the hero scrim a second time).
  if (has('--keep')) {
    const ok = await shipBoth(await sharp(argOf('--keep')).webp({ quality: 90 }).toBuffer());
    process.exit(ok ? 0 : 2);
  }
  if (!has('--generate')) { console.log('DRY RUN.\n\n' + PROMPT + '\n'); process.exit(0); }
  if (!key) { console.error('LUDO_API_KEY required'); process.exit(1); }
  mkdirSync(join(ROOT, 'scripts', '_tmp_csbg'), { recursive: true });
  let done = false;
  for (let roll = 1; roll <= ROLLS && !done; roll++) {
    const seated = await seat(await makeImage(`roll ${roll}`));
    await writeFile(join(ROOT, 'scripts', '_tmp_csbg', `plain_roll${roll}.webp`), seated);
    done = await shipBoth(seated);
  }
  if (!done) { console.error('no roll passed the gates'); process.exit(2); }
  console.log('\ndone.');
}
