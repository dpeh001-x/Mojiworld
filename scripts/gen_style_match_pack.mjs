#!/usr/bin/env node
// STYLE-MATCH PACK (per user): regenerate mbark, morange, qte_break and
// gravitos_singularity_zone closer to the game's house style.
//
// House style, read off the sprites that already land (p_comet, mstarshot,
// p_gravdrop, gravitos_blackhole): bold black outline, saturated colour, rim
// glow, one chunky centred silhouette on pure alpha, readable at ~30 px.
//
// Generates N CANDIDATES per target into scripts/_style_pack/<key>/ and never
// touches Sprites/ — the chosen one is installed separately. Per the user's
// standing preference: preview first, then pick.
//   node scripts/gen_style_match_pack.mjs             # dry-run, prints prompts
//   node scripts/gen_style_match_pack.mjs --generate  # needs LUDO_API_KEY
//   flags: --only=<key>  --n=3
import sharp from 'sharp';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(repoRoot, 'scripts', '_style_pack');
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f, d) => { const a = argv.find((x) => x.startsWith(f + '=')); return a ? a.split('=')[1] : d; };

// Shared style contract. Every prompt gets this, so the four read as one set.
const STYLE =
  'Game asset sprite for a 2D side-scrolling platformer in the Mojiworld aesthetic. ' +
  'Pure transparent background, alpha only — no scene, no ground, no floor shadow, no text, no watermark, no border. ' +
  '768x768 square canvas, ONE object centred at ~70% scale with a generous empty transparent margin on every side — nothing cropped. ' +
  'Soft painterly cel-shaded anime style with BOLD BLACK OUTLINES, vibrant saturated colours, ' +
  'crisp rim-light and an inner glow, chunky readable silhouette that still reads clearly when shrunk to 30 pixels. ' +
  'No photorealism, no muted greys, no drop shadow under the object. ';

const TARGETS = {
  mbark: {
    dest: 'Sprites/projectiles/mbark.webp',
    note: 'thrown projectile — stump mob. Current art is a flat brown guitar-pick shape with a cartoon FACE, which is neither bark nor on-style.',
    desc: 'a jagged chunk of torn TREE BARK hurled as a projectile: a thick splintered wedge of rich brown wood with deep cracked grain, ' +
      'pale raw splintered edges, patches of vivid green moss and tiny lichen on one face, a few small wood splinters flying off it. ' +
      'NO face, no eyes, no expression — it is a piece of wood, not a creature. Warm woodland browns and mossy greens with a soft amber rim-light.',
  },
  morange: {
    dest: 'Sprites/projectiles/cast/morange.webp',
    note: 'thrown projectile — Sunbun citrus toss. Current art is flat, with odd spike shapes and no glow.',
    desc: 'a bright ORANGE CITRUS FRUIT hurled as a projectile, shown as a juicy half-orange with the segmented pith facing the viewer: ' +
      'glistening translucent orange segments radiating from a pale centre, a thick vivid orange rind, ' +
      'a lively spray of glowing juice droplets arcing off one side. Sunny saturated oranges and golds, bright cheerful citrus glow.',
  },
  qte_break: {
    dest: 'Sprites/fx/anim/qte_break_*.webp',
    anim: true,
    note: 'QTE shatter burst, a 9-frame animation. Current frames read as a generic stock spark explosion — no outline discipline, muddy colour.',
    desc: 'a single burst of SHATTERING GOLDEN LIGHT: a bright white-hot core with sharp radiating shards of amber and gold glass ' +
      'flying outward in a clean starburst, a crisp ring of impact energy around it, a few larger angular shards with bold dark edges. ' +
      'Punchy gold-and-white energy, high contrast, no smoke and no dust — clean stylised shatter, not a realistic explosion.',
  },
  gravitos_singularity_zone: {
    dest: 'Sprites/fx/gravitos_singularity_zone.webp',
    // Verified against the draw site before writing this prompt, and it moved
    // the brief twice: the zones are 100x70 RECTS blitted at w+24 x h+24
    // (~1.32 landscape), so a square source is squashed ~25%; and the
    // procedural overlay painted on top is warm cream-gold rgba(255,244,180),
    // so the violet/cyan first draft would have fought it. Landscape + gold.
    ar: 'ar_4_3',
    box: [1024, 768],
    // v2 concept, per user: "2d side scroller view ... eerie blue glow with a
    // translucent portal like field". The gold floor-plate draft was rejected;
    // this is a barrier you stand INSIDE, seen flat-on from the side like the
    // rest of the game, not a slab seen in perspective.
    note: 'Gravitos SAFE-ZONE for the Singularity Collapse OHKO — the shelter you stand inside. Concept redone per user: side-scroller view, eerie blue, translucent portal field.',
    desc: 'a translucent rectangular BARRIER FIELD of eerie blue energy, drawn FLAT-ON from the SIDE like a 2D side-scrolling ' +
      'platformer — straight on, no perspective, no top-down view, no 3D tilt, no floor slab and no ground plane. ' +
      'It is a shimmering portal-like wall of pale cyan and deep electric-blue light, mostly SEE-THROUGH in the middle so the ' +
      'arena behind it would still show, with a bright luminous blue border framing the rectangle, ' +
      'soft vertical energy striations and rippling interference bands across the surface, ' +
      'faint drifting motes and a cold ghostly haze inside, and crisp glowing runic glyph marks along the frame. ' +
      'Eerie haunted blues and cyans only — no gold, no purple, no orange. It must read as a protective portal-field ' +
      'you can step INSIDE, not a solid panel and not a doorway.',
  },
};

const only = val('--only', null);
const N = Number(val('--n', 3));
const keys = only ? [only] : Object.keys(TARGETS);

if (!has('--generate')) {
  console.log('STYLE-MATCH PACK — ' + keys.length + ' target(s), ' + N + ' candidates each\n');
  for (const k of keys) {
    const t = TARGETS[k];
    console.log('=== ' + k + '  ->  ' + t.dest + (t.anim ? '  (ANIMATION)' : ''));
    console.log('WHY: ' + t.note);
    console.log(STYLE + t.desc);
    console.log('');
  }
  console.log('Re-run with --generate (needs LUDO_API_KEY). Nothing under Sprites/ is touched.');
  process.exit(0);
}

const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const TIMEOUT = Number(process.env.LUDO_REQ_TIMEOUT_MS || 150000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function fetchBuf(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(90000) });
  if (!r.ok) throw new Error('fetch ' + r.status);
  return Buffer.from(await r.arrayBuffer());
}

// trim + contain at 78% on a transparent 768 canvas — the anti-cutoff recipe
// the shipped generators use, so a candidate can't arrive clipped at an edge.
async function normalise(buf, box) {
  const [BW, BH] = box || [768, 768];
  const trimmed = await sharp(buf).trim({ threshold: 8 }).toBuffer();
  const inner = await sharp(trimmed).resize(Math.round(BW * 0.78), Math.round(BH * 0.78),
    { fit: 'inside', withoutEnlargement: false, background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
  const m = await sharp(inner).metadata();
  return sharp({ create: { width: BW, height: BH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: inner, left: Math.round((BW - m.width) / 2), top: Math.round((BH - m.height) / 2) }])
    .webp({ quality: 92 }).toBuffer();
}

async function genOne(key, idx) {
  const t = TARGETS[key];
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(`${API}/assets/image`, {
        method: 'POST',
        headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT),
        body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: t.ar || 'ar_1_1',
          n: 1, augment_prompt: false, prompt: STYLE + t.desc }),
      });
      if (!res.ok) throw new Error('api ' + res.status + ' ' + (await res.text()).slice(0, 160));
      const j = await res.json();
      // The API returns a BARE ARRAY [{url}] — matching the shipped generators
      // (gen_ballista_turret and friends). A hand-written {data:[...]}-only
      // extractor silently failed every call into the 4x retry loop, which
      // looked like a hung job rather than a bug.
      const url = Array.isArray(j) ? j[0]?.url : (j?.url || j?.data?.[0]?.url || j?.images?.[0]?.url);
      if (!url) throw new Error('no url in response: ' + JSON.stringify(j).slice(0, 200));
      const out = await normalise(await fetchBuf(url), t.box);
      const dir = join(OUT, key);
      await mkdir(dir, { recursive: true });
      const p = join(dir, key + '_c' + idx + '.webp');
      await writeFile(p, out);
      return p;
    } catch (e) { lastErr = e; await sleep(1500 * attempt); }
  }
  throw lastErr;
}

for (const k of keys) {
  for (let i = 1; i <= N; i++) {
    try { console.log('ok   ' + (await genOne(k, i)).replace(repoRoot, '.')); }
    catch (e) { console.log('FAIL ' + k + ' c' + i + ': ' + String(e.message).slice(0, 140)); }
  }
}
console.log('\ncandidates in scripts/_style_pack/ — nothing under Sprites/ was touched');
