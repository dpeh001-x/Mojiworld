#!/usr/bin/env node
// Restyle four projectile sprites into the game's own look (per user:
// "regenerate the following sprites to be more in sync with the character and
// game design": mcoffinshard, mspine, mspore, p_pincer).
//
// The gap, looking at the four together: mspore and p_pincer ARE the house
// style — chunky chibi forms, thick near-black outline, soft cel shading with
// glossy highlights. mcoffinshard is painterly and grimy, and mspine is
// literal PIXEL ART, a different technique altogether. So the house style is
// not invented here; it is copied off the two that already match, and all four
// are regenerated against it so the set reads as one artist.
//
// Candidates only — writes scripts/_style_pack/<key>/<key>_c1..c3.webp.
// Installing over shipped art is a separate, deliberate step.
//   node scripts/gen_projectile_restyle.mjs             # dry-run, prints prompts
//   node scripts/gen_projectile_restyle.mjs --generate  # needs LUDO_API_KEY
//   flags: --only=<key>  --n=<candidates per key, default 3>
import sharp from 'sharp';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_ROOT = join(repoRoot, 'scripts', '_style_pack');
const argv = process.argv.slice(2);
const val = (f, d) => { const a = argv.find((x) => x.startsWith(f + '=')); return a ? a.split('=')[1] : d; };

// The house look, lifted from mspore / p_pincer and from the cast's own
// heavy-outline chibi art (Guguma et al). Every prompt ends with this.
const STYLE = ' Cute chunky cartoon game sprite in the style of a chibi mobile RPG: ONE object centred in frame, '
  + 'a thick uniform near-black outline running the whole way round the silhouette, soft cel shading from a single '
  + 'upper-left light, glossy white highlight blobs on the rounded surfaces, bright saturated colours, chunky '
  + 'rounded forms with a bold silhouette that still reads at thumbnail size. Fully transparent background, '
  + 'no ground shadow, no background scenery, no text, no border, no frame, not pixel art, not photorealistic.';

const TARGETS = {
  // tombWraith — ghost-flame coffin splinter. Was: muddy painterly browns.
  mcoffinshard: {
    out: 'Sprites/projectiles/mcoffinshard.webp',
    prompt: 'A single jagged splinter of haunted coffin wood flying through the air as a projectile: one chunky '
      + 'angular plank shard of deep violet-brown timber with visible grain and a bent iron nail driven through it, '
      + 'its trailing edge wreathed in a small cold teal-green ghost flame with a wisp curling off the back.',
  },
  // pufferfish — venomous spine dart. Was: dithered pixel art, off-technique.
  // Roll 1 came back as a rounded white lump: naming the pufferfish pulled the
  // model onto the FISH, and the shared style line's "chunky rounded forms" is
  // the opposite of a thin dart. The animal is gone from the prompt and this
  // target carries its own style tail asking for a slender silhouette.
  mspine: {
    out: 'Sprites/projectiles/mspine.webp',
    prompt: 'A single long slender venom dart seen side-on, lying horizontally: one narrow needle-like thorn spike '
      + 'about six times longer than it is wide, tapering to a needle-sharp point aimed to the RIGHT, pale bone-white '
      + 'polished shaft, three short backward-swept barbs near the blunt left end, and the sharp tip dipped in glossy '
      + 'teal-green venom with a single drip bead hanging from it.',
    style: ' Cute cartoon game sprite in the style of a chibi mobile RPG: ONE long thin object centred in frame and '
      + 'filling the width horizontally, a thick uniform near-black outline round the whole silhouette, soft cel '
      + 'shading from a single upper-left light, a couple of glossy white highlight streaks along the shaft, a SLENDER '
      + 'pointed silhouette that reads instantly as a dart or needle, not a blob and not an egg. Fully transparent '
      + 'background, no ground shadow, no background scenery, no text, no border, no frame, not pixel art.',
  },
  // Shroom — spore pod. Already close; regenerated so the set matches.
  mspore: {
    out: 'Sprites/projectiles/mspore.webp',
    prompt: 'A cute round spore pod projectile: one plump mint-teal sphere with a simple happy face (two big glossy '
      + 'black dot eyes and a small curved smile), three shiny bubblegum-pink spore bulbs budding off its surface, '
      + 'ringed by a soft spiky pale-cyan spore aura.',
  },
  // Octobaby — tentacle pincer. Already close; regenerated so the set matches.
  p_pincer: {
    out: 'Sprites/projectiles/p_pincer.webp',
    prompt: 'A purple octopus tentacle pincer: two thick glossy violet tentacle arms curving together into an open '
      + 'C-shaped claw that opens to the right, rows of small round suckers along the inner edges, tapered pointed '
      + 'tips, plump rubbery segments.',
  },
};

const only = val('--only', null);
const N = Math.max(1, Math.min(4, +val('--n', '3')));
const keys = only ? only.split(',') : Object.keys(TARGETS);
for (const k of keys) if (!TARGETS[k]) { console.error('unknown target: ' + k); process.exit(1); }

if (!argv.includes('--generate')) {
  console.log(`restyle ${keys.length} sprite(s), ${N} candidate(s) each -> scripts/_style_pack/<key>/\n`);
  for (const k of keys) console.log(`=== ${k}  -> ${TARGETS[k].out}\n${TARGETS[k].prompt}${STYLE}\n`);
  console.log('Re-run with --generate. Writes candidates only; install is separate.');
  process.exit(0);
}
const KEY = process.env.LUDO_API_KEY;
if (!KEY) { console.error('LUDO_API_KEY required (user env var).'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';

const fetchBuf = async (url) => {
  const r = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!r.ok) throw new Error('fetch ' + r.status);
  return Buffer.from(await r.arrayBuffer());
};

for (const k of keys) {
  const t = TARGETS[k];
  // keep each file's shipped geometry so nothing shifts in-game
  const meta = await sharp(join(repoRoot, t.out)).metadata();
  const dir = join(OUT_ROOT, k);
  await mkdir(dir, { recursive: true });
  console.log(`\n=== ${k}  (${meta.width}x${meta.height})`);
  for (let i = 1; i <= N; i++) {
    let done = false;
    for (let attempt = 1; attempt <= 3 && !done; attempt++) {
      try {
        const res = await fetch(`${API}/assets/image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `ApiKey ${KEY}` },
          body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1',
                                 n: 1, augment_prompt: false, prompt: t.prompt + (t.style || STYLE) }),
          signal: AbortSignal.timeout(180000),
        });
        if (!res.ok) throw new Error('api ' + res.status + ' ' + (await res.text()).slice(0, 120));
        const data = await res.json();
        // /assets/image answers with a BARE ARRAY: [{url}] — not {images:[...]}.
        // Getting this wrong silently discards a successful generation (and the
        // credit spent on it), so accept every shape the endpoint may return.
        const _arr = Array.isArray(data) ? data : (data.images || data.image_urls || []);
        const _first = _arr[0];
        const url = (typeof _first === 'string') ? _first : (_first && _first.url) || data.url;
        if (!url) throw new Error('no url: ' + JSON.stringify(data).slice(0, 160));
        const raw = await fetchBuf(url);
        // trim the generated padding, then letterbox into the shipped geometry
        const trimmed = await sharp(raw).ensureAlpha().trim({ threshold: 8 }).toBuffer();
        const buf = await sharp(trimmed)
          .resize(meta.width, meta.height, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .webp({ quality: 92 }).toBuffer();
        const st = await sharp(buf).stats();
        const alpha = st.channels[3];
        const clear = alpha ? Math.round((1 - alpha.mean / 255) * 100) : 0;
        const f = join(dir, `${k}_c${i}.webp`);
        await writeFile(f, buf);
        console.log(`  c${i}: ${(buf.length / 1024).toFixed(1)}KB, ${clear}% transparent -> ${f}`);
        done = true;
      } catch (e) {
        console.log(`  c${i} attempt ${attempt} failed: ${String(e).slice(0, 140)}`);
        if (attempt === 3) console.log(`  c${i}: GIVING UP`);
        else await new Promise(r => setTimeout(r, 3000));
      }
    }
  }
}
console.log('\nCandidates written. Review, then install the picks deliberately.');
