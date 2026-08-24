#!/usr/bin/env node
// Starry backdrops for the advancement modal — one per TIER (ludo.ai).
// Output -> Sprites/talents/starfield_1.webp / starfield_2.webp (1024x768).
//   node scripts/generate_advancement_backdrops.mjs            # dry-run
//   node scripts/generate_advancement_backdrops.mjs --generate  # skip-existing
//   node scripts/generate_advancement_backdrops.mjs --generate --force
// Needs LUDO_API_KEY.
//
// Replaces the CSS sparkle field on #advancement-modal .modal::after, which was
// six radial-gradient dot layers tiled at 70-150px — readable as a pattern, not
// as a sky. One image per tier so the 1st and 2nd advancement are visibly
// different rooms: warm and hopeful for the job step, cold and vast for the
// master step.
//
// The same fight as generate_talent_backgrounds.mjs: the API only accepts
// image_type 'sprite' (every other value 400s), and that biases hard toward a
// cut-out object floating on white. The prompt has to say full-bleed, no
// cutout, no white, no frame, no subject, repeatedly — and these sit BEHIND a
// gold title and white body copy, so they must stay deep and low-contrast with
// an empty centre.
import sharp from 'sharp';
import { writeFile, mkdir, access, rename } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(repoRoot, 'Sprites', 'talents');
const W = 1024, H = 768;
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);

// Roll 1 asked for "deep dark values, very low contrast, nothing bright" and
// got exactly that: two near-black rectangles with a few star points, mean luma
// 8.3 and 3.8 of 255, and no visible difference between the tiers. That is the
// failure generate_talent_backgrounds.mjs already recorded — the model obeys the
// darkness and has nothing left to draw. The art wants to be INTERESTING; the
// modal's scrim is what makes text readable, and it costs nothing to tune.
const COMMON =
  'A detailed painterly COSMIC VISTA illustration — deep space seen from far out, like a game concept-art sky plate. ' +
  'The starfield fills the whole rectangular image and continues past all four edges. ' +
  'Rich atmospheric depth: luminous nebula clouds with visible brushwork, layered dust lanes, dense drifts of small stars ' +
  'behind brighter foreground stars, distant galaxies far off. Cinematic and beautiful. ' +
  'NO people, NO characters, NO creatures, NO planets or moons in the foreground, NO spacecraft, NO frames, NO borders, ' +
  'NO UI, NO logo, NO vignette ring. NO TEXT of any kind: no letters, numbers, words or watermark. The sky is: ';

const SETS = {
  // 1st advancement — warm, hopeful, the sky you set out under
  starfield_1: COMMON +
    'a warm golden-amber nebula blooming across the lower half with soft dust lanes curling upward through it, ' +
    'dense drifts of pale gold and cream stars, a few bright warm stars with gentle flares, deep indigo sky between ' +
    'the clouds, the feeling of a dawn about to break somewhere beyond the frame',
  // 2nd advancement — cold, vast, imperial; the sky you ascend into
  starfield_2: COMMON +
    'an immense violet and amethyst nebula cathedral sweeping diagonally across the frame in towering columns of ' +
    'glowing dust, brilliant blue-white star clusters burning inside it, a remote spiral galaxy small and sharp in ' +
    'the distance, near-black void between the columns, solemn and imperial and much colder than a golden sky',
};

const exists = async (p) => { try { await access(p); return true; } catch { return false; } };

// Drop a dead letterbox margin. The endpoint sometimes paints the vista inside
// a rectangle on a blank field (roll 2 did exactly that for starfield_1: a
// black margin down the left and across the top and bottom). Find the content
// bounding box above a low luma floor and crop to it. A genuinely full-bleed
// image reports the whole frame and passes through unchanged.
// Mean luma of a finished plate. Roll 3 of starfield_2 came back at 0.1 of 255
// - an unusable black frame - and the retry loop passed it because it only
// watched for HTTP errors. Anything outside this band is treated as a failed
// attempt so the loop rolls again rather than overwriting good art.
const LUMA_MIN = 18, LUMA_MAX = 150;
async function meanLuma(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let sum = 0, n = 0;
  for (let i = 0; i < data.length; i += 4) { sum += data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114; n++; }
  return sum / n;
}

async function trimLetterbox(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const FLOOR = 14;                       // luma below this is dead margin, not sky
  const lum = (i) => data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
  let minX = w, maxX = -1, minY = h, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (lum((y * w + x) * 4) > FLOOR) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return buf;                                     // all dark: leave it alone
  const cw = maxX - minX + 1, ch = maxY - minY + 1;
  if (cw >= w * 0.97 && ch >= h * 0.97) return buf;             // already full-bleed
  console.log('    trimmed letterbox: ' + w + 'x' + h + ' -> ' + cw + 'x' + ch);
  return await sharp(buf).extract({ left: minX, top: minY, width: cw, height: ch }).toBuffer();
}
async function fetchBuf(u) {
  const r = await fetch(u, { signal: AbortSignal.timeout(120000) });
  if (!r.ok) throw new Error('fetch ' + r.status);
  return Buffer.from(await r.arrayBuffer());
}

const keys = Object.keys(SETS);
if (!has('--generate')) {
  console.log(`# ${keys.length} advancement backdrops -> Sprites/talents/<id>.webp (${W}x${H})\n`);
  for (const k of keys) console.log('  ' + k);
  console.log('\n# Re-run with --generate (needs LUDO_API_KEY). Flags: --force');
  process.exit(0);
}

const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const TIMEOUT = Number(process.env.LUDO_REQ_TIMEOUT_MS || 180000);
const force = has('--force');

let made = 0, skipped = 0, failed = 0;
for (const k of keys) {
  const bp = join(OUT_DIR, `${k}.webp`);
  if (!force && await exists(bp)) { console.log(`  ${k} ... skip (exists)`); skipped++; continue; }
  let last;
  for (let a = 1; a <= 4; a++) {
    try {
      const res = await fetch(`${API}/assets/image`, {
        method: 'POST',
        headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT),
        body: JSON.stringify({
          image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_4_3',
          n: 1, augment_prompt: false, prompt: SETS[k],
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        if (/\b402\b/.test(t)) throw new Error('402 OUT OF CREDITS');
        throw new Error(res.status + ': ' + t.slice(0, 140));
      }
      const data = await res.json();
      const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
      if (!url) throw new Error('no url in response');
      await mkdir(OUT_DIR, { recursive: true });
      // cover-fit to the target box; these are wallpapers, aspect is not sacred
      // image_type sprite returns ALPHA, and roll 4 came back with transparent
      // holes punched through the nebula - as a backdrop the modal gradient
      // would show through them, and the luma trim reads a transparent pixel as
      // dead margin. Flatten onto a near-black ground first so the plate is
      // opaque and full-bleed by construction.
      const flat = await sharp(await fetchBuf(url)).flatten({ background: { r: 7, g: 3, b: 18 } }).png().toBuffer();
      const raw = await trimLetterbox(flat);
      const buf = await sharp(raw).resize(W, H, { fit: 'cover', position: 'centre' })
        .webp({ quality: 90 }).toBuffer();
      const lum = await meanLuma(buf);
      if (lum < LUMA_MIN || lum > LUMA_MAX) {
        throw new Error('unusable plate: mean luma ' + lum.toFixed(1) +
          ' (want ' + LUMA_MIN + '-' + LUMA_MAX + ')');
      }
      console.log('    mean luma ' + lum.toFixed(1));
      await writeFile(bp + '.tmp', buf);
      await rename(bp + '.tmp', bp);      // atomic: never leave a half file
      console.log(`  ${k} ... OK`);
      made++; last = null; break;
    } catch (e) {
      last = e;
      console.log(`  ${k} ... attempt ${a} failed: ${e.message}`);
      if (/402/.test(e.message)) break;
    }
  }
  if (last) failed++;
}
console.log(`Done. ${made} made, ${skipped} skipped, ${failed} failed.`);
