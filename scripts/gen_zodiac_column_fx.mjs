// Per-sign columnStrike art for the four zodiac column casters (ludo.ai).
// ============================================================================
// Seven of the twelve signs carry a signature move (_sigMove in the zodiac
// type builder): aries / capricorn / pisces swing, and taurus / scorpio /
// sagittarius / aquarius fire a columnStrike. The three swingers each got
// their own swing art (swing_zodiac_*), but all four column signs shared ONE
// generic strike beam (fx_col_zodiac) and ONE generic telegraph
// (tg_col_zodiac) — while every other column boss in the game (arbiter,
// sovereign, legosaurus, pathsbane, archon, tombwraith, tombhexer,
// blightelder, ossuarytyrant) has per-caster art. This closes that gap.
//
// SIZES match the art being replaced, per the request to stay close to the
// base reference: strike beams 512x1120 (fx_col_zodiac) and telegraphs 288x512
// (every tg_col_* in the game). Content occupies the same share of the canvas
// as the reference (~66% width on the beams), so the on-screen read is
// unchanged — the engine stretches both to the beam box anyway.
//
// CUTOFF: docs/prompts/sprite_column_strike.md asks for "fade the very top and
// bottom ~5% to transparent so the off-screen buffer blends instead of cutting
// off hard" — and the incumbent fx_col_zodiac violates it with 190 opaque
// pixels sitting on its bottom border. Every sprite here gets an explicit
// alpha feather and is asserted to finish with ZERO opaque pixels on all four
// borders, which none of the shared zodiac art managed.
//
//   node scripts/gen_zodiac_column_fx.mjs            # dry-run, print the plan
//   node scripts/gen_zodiac_column_fx.mjs --generate # call Ludo (LUDO_API_KEY)
//   flags: --only taurus,scorpio  --force
import { mkdir, writeFile, rename, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(repoRoot, 'Sprites', 'fx');
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

// Strike beam: bandable motif only — the engine stretches it ~1:8 vertically.
const BEAM_BASE = 'game vfx sprite, a single tall vertical column of energy centered horizontally, '
  + 'filling the frame top to bottom, bright hot core down the centerline about 30% of the width, '
  + 'soft translucent falloff on the left and right so it reads as light rather than a solid slab, ';
const BEAM_TAIL = ', the motif is a repeating flowing vertical pattern that survives being stretched '
  + 'tall - rising motes and drifting bands, no single large hero element that would smear. '
  + '16-bit painterly VFX, vibrant, faint inner edge glow. Pure transparent background, alpha only: '
  + 'no scene, no ground, no character, no platform, no text, no letters, no numbers, no watermark.';

// Telegraph: a WARNING, not the attack (matches gen_col_telegraphs.mjs).
const TG_BASE = 'game vfx sprite, tall vertical DANGER ZONE telegraph pillar, a ghostly translucent '
  + 'column of warning light rising the full height of the frame, hard bright glowing edge stripes '
  + 'down both sides, a glowing rune ring on the ground at the base, faint chevron arrows flowing '
  + 'upward inside the column, semi-transparent wispy core so the background shows through, ';
const TG_TAIL = ', ominous but clearly a warning marker not an explosion, vibrant cartoon fantasy '
  + 'style, crisp thick outline, single centered vertical column, transparent background, no text';

const SIGNS = {
  taurus: {
    beam: 'granite-bull earth theme: dusty stone-grey and warm amber light, cracked granite shards and '
      + 'tumbling rock chips rising inside the beam, glowing molten seams between the stones, ochre dust haze',
    tg: 'granite-bull earth theme: dusty stone-grey and warm amber light, translucent cracked rock chips and '
      + 'drifting ochre dust inside the column, a glowing cracked-earth rune ring at the base',
  },
  scorpio: {
    beam: 'venomlord poison theme: magenta and deep violet toxic light, dripping luminous venom runnels and '
      + 'rising poison bubbles inside the beam, thin barbed stinger silhouettes, sickly pink haze',
    tg: 'venomlord poison theme: magenta and deep violet toxic light, translucent venom droplets and faint '
      + 'barbed stinger glints inside the column, a glowing pink toxin rune ring at the base',
  },
  sagittarius: {
    beam: 'starchaser archer theme: burnt amber and warm orange starlight, slender falling arrow shafts and '
      + 'star-trail streaks raining down inside the beam, bowstring-taut light lines, golden spark dust',
    tg: 'starchaser archer theme: burnt amber and warm orange starlight, translucent falling arrow shafts and '
      + 'small star glints inside the column, a glowing amber archery-target rune ring at the base',
  },
  aquarius: {
    beam: 'tidesworn water theme: cyan and deep ocean blue light, rising water ribbons and streams of bubbles '
      + 'inside the beam, pale foam crests and rippling caustic bands, cool aquamarine haze',
    tg: 'tidesworn water theme: cyan and deep ocean blue light, translucent rising bubbles and thin water '
      + 'ribbons inside the column, a glowing aquamarine wave rune ring at the base',
  },
};

const JOBS = [];
for (const [sign, t] of Object.entries(SIGNS)) {
  JOBS.push({ sign, kind: 'beam', file: `fx_col_zodiac_${sign}.webp`, W: 512, H: 1120,
              contentW: 0.66, featherX: 0.06, featherY: 0.05, prompt: BEAM_BASE + t.beam + BEAM_TAIL });
  JOBS.push({ sign, kind: 'tg', file: `tg_col_zodiac_${sign}.webp`, W: 288, H: 512,
              contentW: 1.0, featherX: 0.035, featherY: 0.04, prompt: TG_BASE + t.tg + TG_TAIL });
}

const only = arg('--only');
const jobs = only ? JOBS.filter((j) => only.split(',').includes(j.sign)) : JOBS;
if (!jobs.length) { console.error('no matching jobs'); process.exit(1); }

if (!has('--generate')) {
  console.log(`# ${jobs.length} sprites -> Sprites/fx/  (4 strike beams 512x1120, 4 telegraphs 288x512)\n`);
  for (const j of jobs) console.log(`  ${j.file.padEnd(30)} ${j.W}x${j.H}  ${j.kind}`);
  console.log('\n# re-run with --generate (needs LUDO_API_KEY). flags: --only a,b  --force');
  process.exit(0);
}
const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY not set'); process.exit(1); }
const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function fetchBuf(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(90000) });
  if (!r.ok) throw new Error('fetch ' + r.status);
  return Buffer.from(await r.arrayBuffer());
}

// Multiply alpha by a linear ramp over the outer edges, then hard-zero the
// outermost ring. This is what guarantees the no-cutoff assertion below.
async function feather(buf, W, H, fx, fy) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = Math.max(1, Math.round(W * fx)), py = Math.max(1, Math.round(H * fy));
  const C = info.channels;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = Math.min(x, W - 1 - x), dy = Math.min(y, H - 1 - y);
      let k = 1;
      if (dx < px) k = Math.min(k, dx / px);
      if (dy < py) k = Math.min(k, dy / py);
      if (dx === 0 || dy === 0) k = 0;                 // border ring is always clear
      if (k < 1) { const i = (y * W + x) * C + 3; data[i] = Math.round(data[i] * k); }
    }
  }
  return sharp(data, { raw: { width: W, height: H, channels: C } }).png().toBuffer();
}

async function gen(job) {
  const dest = join(DIR, job.file);
  if (!has('--force') && await exists(dest)) { console.log(`  ${job.file} exists — skip`); return; }
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const ratio = attempt >= 3 ? 'ar_1_1' : 'ar_9_16';
      const res = await fetch(`${API}/assets/image`, {
        method: 'POST',
        headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: ratio,
                               n: 1, augment_prompt: false, prompt: job.prompt }),
        signal: AbortSignal.timeout(120000),
      });
      if (!res.ok) throw new Error(`image ${res.status}: ${(await res.text()).slice(0, 140)}`);
      const data = await res.json();
      const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
      if (!url) throw new Error('no url in response');
      const raw = await fetchBuf(url);
      let content; try { content = await sharp(raw).trim().toBuffer(); } catch { content = raw; }
      // Fit the content to the same share of the canvas the reference used,
      // centered on transparent — then feather so nothing touches a border.
      const cw = Math.round(job.W * job.contentW);
      const inner = await sharp(content).resize(cw, job.H, { fit: 'fill' }).png().toBuffer();
      const canvas = await sharp({ create: { width: job.W, height: job.H, channels: 4,
                                             background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite([{ input: inner, left: Math.round((job.W - cw) / 2), top: 0 }]).png().toBuffer();
      const feathered = await feather(canvas, job.W, job.H, job.featherX, job.featherY);
      const out = await sharp(feathered).webp({ quality: 92 }).toBuffer();

      // Assert: zero opaque pixels on any border, and the sprite is not a slab.
      const { data: p2, info: i2 } = await sharp(out).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const A = (x, y) => p2[(y * i2.width + x) * i2.channels + 3];
      let border = 0, clear = 0;
      for (let x = 0; x < i2.width; x++) { if (A(x, 0) > 16) border++; if (A(x, i2.height - 1) > 16) border++; }
      for (let y = 0; y < i2.height; y++) { if (A(0, y) > 16) border++; if (A(i2.width - 1, y) > 16) border++; }
      for (let i = 3; i < p2.length; i += 4) if (p2[i] < 20) clear++;
      const pct = (100 * clear / (i2.width * i2.height));
      if (border !== 0) throw new Error(`border bleed ${border}px after feather`);
      await mkdir(DIR, { recursive: true });
      await writeFile(dest + '.tmp', out); await rename(dest + '.tmp', dest);
      console.log(`  ok -> ${job.file} ${i2.width}x${i2.height} ${out.length}b, transparent ${pct.toFixed(1)}%, border 0 (ratio ${ratio})`);
      if (pct < 8) console.warn(`     WARNING: ${job.file} is nearly opaque — inspect it`);
      return;
    } catch (e) { lastErr = e; if (attempt < 4) await sleep(3000 * attempt); }
  }
  console.error(`  FAIL ${job.file}: ${lastErr && lastErr.message}`);
  process.exitCode = 2;
}

console.log(`generating ${jobs.length} zodiac column sprites...`);
for (const j of jobs) { await gen(j); await sleep(800); }
console.log('done.');
