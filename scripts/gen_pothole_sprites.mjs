#!/usr/bin/env node
// Pothole / sinkhole sprites (ludo.ai). The procedural renderer draws a 12 px
// flat black ellipse at 55% alpha, which is invisible on the dark ground of
// every map that uses potholes (per user, with a screenshot of Thornspire
// Thicket). These give each pit a real cavity with a BRIGHT LIT RIM — the rim
// is what makes it read against dark terrain.
//
// Two biome variants, covering the five maps that declare potholes:
//   pothole_earth -> duneSands, thornspireThicket   (sand / soil)
//   pothole_crypt -> cryptHollow, boneGraveyard2, hollowSepulchre2 (stone)
//
// Output -> Sprites/objects/pothole_*.webp (transparent, 256x256).
//   node scripts/gen_pothole_sprites.mjs            # dry-run (print prompts)
//   node scripts/gen_pothole_sprites.mjs --generate # call Ludo (needs LUDO_API_KEY)
//   flags: --force (overwrite), --only=<key>
// =============================================================================
import sharp from 'sharp';
import { writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(repoRoot, 'Sprites', 'objects');
const SIZE = 256;
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const only = (argv.find(a => a.startsWith('--only=')) || '').split('=')[1];

// Short, object-first prompts: long descriptive prefixes make Ludo drift toward
// chibi characters instead of the object.
// v3 (per user, with a crop of the crypt pit: "regenerate this pothole to make it look more flat
// such that it fits the 2d sidescrolling art style angle"). v2 asked for a steep top-down view
// and got a ring seen from ~45 degrees - a well lid lying on a plane the side-scroller does not
// have. The camera in this game sits at ground level: a hole in the floor is a sliver.
const COMMON =
  ' Seen from the SIDE, at ground level, as in a 2D side-scrolling platformer: an extremely FLAT, ' +
  'wide ELLIPSE about four times wider than it is tall - a low, squashed lens. The FAR rim is a thin ' +
  'arc of stones seen almost edge-on; the NEAR rim shows the small FRONT FACES of the kerb stones; ' +
  'between them the opening is a narrow dark sliver. Nothing about it may look like a circle or a ' +
  'top-down view. ONLY THE HOLE ITSELF: no ground plane, no floor, no horizon, no field of sand or ' +
  'stone around it - the rim and the opening float alone on transparency. ' +
  'The opening is a deep BLACK void in the middle. The RIM is the important part: a thick, ' +
  'clearly LIT raised lip running all the way around, bright and high-contrast so the hole ' +
  'stands out against dark ground. Painted game-art style, crisp readable shapes, soft cel shading. ' +
  'NO rounded-square, NO tile, NO card, NO frame, NO border, NO panel, NO background fill or gradient, ' +
  'NO scene, NO character, NO text. FULLY TRANSPARENT background (alpha only). ' +
  // v2: the first pass asked for 92% of the width and came back with the ring
  // sliced flat against both image edges (106/107 opaque pixels sitting ON the
  // left/right border). Ask for a much smaller subject with real empty margin;
  // the trim-and-pad step below then enforces it regardless of what comes back.
  'IMPORTANT FRAMING: the hole must be COMPLETE and UNCROPPED, floating in the middle of the ' +
  'image at about 65% of the image width, with a wide band of EMPTY TRANSPARENT SPACE on all ' +
  'four sides. Nothing may touch or run off any edge of the image.';

const SPRITES = [
  {
    key: 'pothole_earth',
    // v1 came back a dark brown crater with scattered debris splatter — barely
    // more visible than the black ellipse it replaces. The crypt variant proved
    // the shape that reads: a THICK PALE raised ring around a black void. This
    // asks for that same ring in sandstone, and explicitly bans the debris.
    prompt: 'A HOLE IN THE GROUND — an open sinkhole ringed by a THICK RAISED BORDER of pale ' +
      'sun-bleached SANDSTONE kerb blocks - the ring of stones ALONE, cut out like a sticker: no sand ' +
      'field, no ground, no floor, nothing painted beneath or around the ring.' + COMMON +
      ' The ring must be BRIGHT, light-toned and clearly separated from the black opening — ' +
      'almost white where the light hits it, like a stone kerb around a well. ' +
      'Clean solid shapes only: NO scattered debris, NO splatter, NO loose specks or dust ' +
      'outside the ring, NO cracks radiating away from the hole.',
  },
  {
    key: 'pothole_crypt',
    prompt: 'A HOLE IN THE GROUND — an open grave pit in cracked stone flagstones.' + COMMON +
      ' The raised rim is chipped pale grey stone with cold bluish highlights and a few small ' +
      'weathered bone fragments resting on the lip.',
  },
];

if (!has('--generate')) {
  console.log(`# pothole sprites -> Sprites/objects/ (${SIZE}x${SIZE}, webp)\n`);
  for (const s of SPRITES) console.log(`## ${s.key}\n${s.prompt}\n`);
  console.log('# Re-run with --generate (needs LUDO_API_KEY). Flags: --force --only=<key>');
  process.exit(0);
}

const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const TIMEOUT = Number(process.env.LUDO_REQ_TIMEOUT_MS || 180000);
const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
async function fetchBuf(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!r.ok) throw new Error('fetch ' + r.status);
  return Buffer.from(await r.arrayBuffer());
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await mkdir(OUT_DIR, { recursive: true });
let failures = 0;
for (const spr of SPRITES) {
  if (only && spr.key !== only) continue;
  const OUT = join(OUT_DIR, `${spr.key}.webp`);
  if (!has('--force') && await exists(OUT)) { console.log('exists (use --force):', OUT); continue; }
  let done = false, last;
  for (let a = 1; a <= 6 && !done; a++) {   // v3 - six: the flatness gate refuses lids
    try {
      process.stdout.write(`${spr.key} attempt ${a} ... `);
      const res = await fetch(`${API}/assets/image`, {
        method: 'POST',
        headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT),
        // A pothole is a WIDE ellipse. On the square canvas the first passes
        // used, every generation came back with the ring sliced flat against
        // the left and right edges (measured runs 0/0/238/268 — top and bottom
        // perfectly clean, sides cut) because the shape simply had nowhere to
        // go. A 16:9 canvas matches the subject, so the model can leave margins.
        body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: (process.env.LX_PIT_AR || 'ar_16_9'), n: 1, augment_prompt: false, prompt: spr.prompt }),
      });
      if (!res.ok) {
        const t = await res.text();
        if (/\b402\b/.test(t)) throw new Error('402 OUT OF CREDITS');
        throw new Error(res.status + ': ' + t.slice(0, 140));
      }
      let data = await res.json();
      // 2026-09-11: the endpoint answers 202 with a JOB ({id, status, poll_after_ms}); the finished
      // job at GET /assets/jobs/<id> carries result[0].url.
      if (res.status === 202 || (data && data.id && data.status && !data.url && !data.result)) {
        const t0 = Date.now();
        for (;;) {
          await sleep(Math.min(15000, Math.max(2000, Number(data.poll_after_ms) || 5000)));
          const jr = await fetch(`${API}/assets/jobs/${data.id}`, { headers: { Authorization: `ApiKey ${apiKey}` }, signal: AbortSignal.timeout(30000) });
          if (!jr.ok) throw new Error('job ' + jr.status);
          data = await jr.json();
          if (data.status === 'succeeded') break;
          if (data.status === 'failed' || data.status === 'cancelled') throw new Error('job ' + data.status);
          if (Date.now() - t0 > 240000) throw new Error('job still ' + data.status + ' after 240s');
        }
      }
      const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url || data?.result?.[0]?.url);
      if (!url) throw new Error('no url: ' + JSON.stringify(data).slice(0, 120));
      const png = await fetchBuf(url);
      // ---- reject clipped art, then trim + re-pad to a guaranteed margin ----
      // `fit: contain` adds no margin when the subject already fills the frame,
      // so a cropped generation would ship cropped. Measure the opaque bounding
      // box: if the subject sits ON an edge it was cut, and the attempt is
      // wasted rather than saved.
      const { data: px, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const { width: w, height: h, channels: ch } = info;
      const A = (x, y) => px[(y * w + x) * ch + 3];
      // Judge by the LONGEST CONTIGUOUS run of opaque pixels along an edge, not
      // the total. A cut through the subject leaves one long flat chord; a
      // stray speck of debris or a soft shadow leaves short runs, and rejecting
      // those just burns credits on generations that were fine.
      const longestRun = (get, n) => {
        let best = 0, run = 0;
        for (let i = 0; i < n; i++) { if (get(i) > 40) { if (++run > best) best = run; } else run = 0; }
        return best;
      };
      const runs = [
        longestRun((x) => A(x, 0), w), longestRun((x) => A(x, h - 1), w),
        longestRun((y) => A(0, y), h), longestRun((y) => A(w - 1, y), h),
      ];
      const worst = Math.max(runs[0], runs[1]) / w;
      const worstV = Math.max(runs[2], runs[3]) / h;
      const cut = Math.max(worst, worstV);
      if (cut > 0.10) throw new Error(`clipped: longest edge run ${(cut * 100).toFixed(0)}% of an edge (runs ${runs.join('/')} on ${w}x${h})`);
      let x0 = w, y0 = h, x1 = -1, y1 = -1;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (A(x, y) > 40) {
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
      if (x1 < 0) throw new Error('fully transparent result');
      const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
      // v3 - FLATNESS gate: a side-scroller's hole is a sliver. The v2 art measured ~1.7:1
      // (a 45-degree ring); anything under 3:1 still reads as a lid on a plane and is refused.
      const flat = bw / bh;
      if (flat < 3.0) throw new Error(`not flat enough: ${bw}x${bh} is ${flat.toFixed(2)}:1, want >= 3:1 (a side-on sliver, not a lid)`);
      const inner = Math.round(SIZE * 0.86);          // 7% clear margin per side
      const trimmed = await sharp(png).extract({ left: x0, top: y0, width: bw, height: bh })
        .resize(inner, inner, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
      await writeFile(OUT, await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite([{ input: trimmed, gravity: 'center' }])
        .webp({ quality: 92, alphaQuality: 100 })
        .toBuffer());
      const meta = await sharp(OUT).metadata();
      console.log(`OK -> ${OUT} (${meta.width}x${meta.height}, alpha=${meta.hasAlpha}, src bbox ${bw}x${bh}, edge-run ${(cut * 100).toFixed(0)}%)`);
      done = true;
    } catch (e) {
      last = e; console.log('FAIL: ' + e.message);
      if (/402/.test(e.message)) process.exit(3);
      if (a < 4) await sleep(3000 * a);
    }
  }
  if (!done) { failures++; console.error(`giving up on ${spr.key}: ${last?.message}`); }
}
process.exit(failures ? 1 : 0);
