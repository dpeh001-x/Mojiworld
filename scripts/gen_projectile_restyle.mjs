#!/usr/bin/env node
// Restyle projectile / vfx sprites into the game's own look (per user:
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
  // King Gloopaloo — the cyan gel puddle he leaves on the floor. Was: a tall
  // glassy WATER dome, closer to a rendered droplet than to the chibi cast, and
  // domed where the hazard is drawn as a flat 2:1 ground decal.
  gloop_puddle: {
    out: 'Sprites/vfx/gloop_puddle.webp',
    ar: 'ar_16_9',
    prompt: 'A wide shallow puddle of thick cyan slime spilled flat on the ground, seen from a low three-quarter '
      + 'angle: a squat irregular blob of glossy aqua-blue gel with rounded drip lobes bulging out around its rim, '
      + 'a bright glossy highlight streak across the top of the surface, two or three small round bubbles floating '
      + 'in the gel, and a couple of tiny separate droplets beside it. Low and spread out, wider than it is tall.',
    style: ' Cute chunky cartoon game sprite in the style of a chibi mobile RPG: ONE puddle centred in frame and '
      + 'spread wide across the width, a thick uniform near-black outline round the whole silhouette, soft cel '
      + 'shading, glossy white highlight blobs, bright saturated cyan, a low flat spreading silhouette that reads '
      + 'as liquid pooled on the floor and NOT as a dome, ball or bubble. Fully transparent background, no ground '
      + 'shadow, no background scenery, no text, no border, no frame, not pixel art, not photorealistic.',
  },
  // Elemental Apotheosis charge pulse. NEW file. Was borrowing the warrior
  // dust_ring via the colour-bucket heuristic (#ffee44 is in the warrior
  // palette), so a four-element mage ultimate threw tan dust.
  apo_ring: {
    out: 'Sprites/fx/apo_ring.webp',
    size: [768, 768],
    prompt: 'A magic convergence ring seen from a low angle, top-down-ish: one wide flat circular rune band with a '
      + 'COMPLETELY EMPTY transparent centre, its circumference split into four glowing elemental quarters that blend '
      + 'into one another — orange fire with licking flames, pale cyan ice with sharp crystal shards, bright yellow '
      + 'lightning with jagged arcs, violet arcane with drifting motes — set with small angular glyphs around the band '
      + 'and four bright nodes where the quarters meet, energy sparks flicking outward from the outer edge.',
    style: ' Cute chunky cartoon game sprite in the style of a chibi mobile RPG: ONE ring centred in frame, filling the '
      + 'frame edge to edge, a thick dark outline on the band, soft cel shading, glossy highlights, bright saturated '
      + 'colours, and a HOLLOW transparent middle — a ring, not a disc, not a sphere, not a portal with a filled '
      + 'centre. Fully transparent background, no ground, no character, no scenery, no text, no border, no frame, '
      + 'not pixel art, not photorealistic.',
  },
  // Archbishop "Apotheosis" judgment pulse. NEW file. Its performAround uses
  // #fff1a0, which IS in _LX_FX_WARRIOR_COLORS - so the priest's holy pulse
  // was drawing the WARRIOR'S TAN DUST RING, five times per cast.
  holy_ring: {
    out: 'Sprites/fx/holy_ring.webp',
    size: [768, 768],
    prompt: 'A radiant holy halo ring seen from a low angle: one wide circular band of polished warm gold with a '
      + 'COMPLETELY EMPTY transparent centre, sacred geometry engraved along the band, small cross and sunburst '
      + 'glyphs spaced evenly around it, four ornate laurel or feathered-wing flourishes at the cardinal points, '
      + 'soft white-gold light blooming off the whole circumference and thin rays of blessed light rising from the '
      + 'outer edge. Divine, consecrated, benevolent.',
    style: ' Cute chunky cartoon game sprite in the style of a chibi mobile RPG: ONE ring centred in frame, filling '
      + 'the frame edge to edge, a thick dark outline on the band, soft cel shading, glossy highlights, warm '
      + 'saturated gold and cream, and a HOLLOW transparent middle — a halo ring, not a disc, not a coin, not a '
      + 'sphere, not a portal with a filled centre. Fully transparent background, no ground, no character, no '
      + 'scenery, no text, no border, no frame, not pixel art, not photorealistic.',
  },
  // Barnaby's charge finisher. NEW file. He threw a DAGGER sprite
  // (p_dagger.webp) as his boxing jab - a knife on a bare-knuckle boxer.
  // Drawn in 'orient' mode, so the fist must point RIGHT in the source.
  p_flamefist: {
    out: 'Sprites/projectiles/p_flamefist.webp',
    size: [640, 512],
    ar: 'ar_1_1',   // ar_4_3 and ar_5_4 both fail the API (400 / hang); square + letterbox
    prompt: 'A massive clenched fist punching straight to the RIGHT, seen from the side, wreathed in fire: a chunky '
      + 'boxing-glove-like fist with the knuckles leading, wrapped in scuffed tan hand-wraps at the wrist, engulfed '
      + 'in orange and yellow flames that stream BACKWARD to the left off the wrist in a trailing comet tail, bright '
      + 'white-hot core at the knuckles, embers flicking off the flames. The fist fills the frame and drives right.',
    style: ' Cute chunky cartoon game sprite in the style of a chibi mobile RPG: ONE fist centred in frame and aimed '
      + 'RIGHT, a thick uniform near-black outline round the whole silhouette, soft cel shading, glossy highlights, '
      + 'bright saturated orange and gold flame, a bold silhouette that reads instantly as a flaming punch at '
      + 'thumbnail size. No arm beyond the wrist, no character, no body. Fully transparent background, no ground '
      + 'shadow, no background scenery, no text, no border, no frame, not pixel art, not photorealistic.',
  },
  // v0.30.x — Doombringer B, remade as a homing single-target barrage (per user:
  // "it should be one of the more powerful skills dealing good strong damage to
  // 1 monster, like summoning homing fireballs. Then generate the necessary
  // sprites that are similar to the shockwave").
  //
  // "Similar to the shockwave" is a STYLE brief, not a shape one: p_shockwave is
  // a painterly VFX orb - white-hot core, crimson body, jagged near-black flame
  // corona, glow - with no outline anywhere. The chibi house style above would
  // fight it, so this target overrides the style entirely and matches the
  // Doombringer's own crimson palette (#cc3344 / #ff4455) rather than the Sage
  // meteor's orange, so the two homing ults never read as the same skill.
  p_doom_fireball: {
    out: 'Sprites/projectiles/p_doom_fireball.webp',
    size: [640, 640],
    ar: 'ar_1_1',
    prompt: 'A hurtling ball of dark crimson hellfire seen from the side, travelling to the RIGHT: a searing '
      + 'white-hot core at the leading right edge, wrapped in layered crimson and blood-red flame, ringed by a '
      + 'jagged corona of near-black charred flame licks, with a long tapering tail of red fire and dark smoke '
      + 'streaming BACKWARD to the left. A few bright embers and one thin ring of shockwave light around the core. '
      + 'The fireball fills the frame and drives right.',
    style: ' Painterly 2D game VFX sprite in the style of an action RPG skill effect: ONE fireball centred in '
      + 'frame and aimed RIGHT, rendered as glowing light and flame with NO outline and NO cel-shaded cartoon '
      + 'edges, a blown-out white core falling off through hot crimson to deep blood red and finally to charred '
      + 'near-black at the jagged rim, soft additive glow, a bold silhouette that still reads at thumbnail size. '
      + 'Dark crimson and black palette, no orange-gold campfire tones. Fully transparent background, no ground '
      + 'shadow, no background scenery, no text, no border, no frame, not pixel art, not photorealistic.',
  },

  // ---- second restyle wave -------------------------------------------------
  // Per user: "will need to use ludo.ai to rework the sprites to fit the game
  // aesthetics more". Seven, and they miss in different ways, so each gets its
  // own correction rather than a shared re-roll.
  //
  // Two of them are shaped wrong for their OWN render mode, which is the part
  // no amount of restyling would have fixed: LX_PROJ gives mghostshot and
  // venom `mode: 'orient'`, meaning the sprite is rotated to point along its
  // velocity — but both are drawn radially symmetric (a ring and a ball), so
  // the rotation communicates nothing. Both are rebuilt with a leading edge
  // aimed RIGHT, which is the direction the orient blit treats as forward.

  // stump — bark chunk. Was: a photoreal slab of mossy timber, no outline,
  // reads as a photograph of wood rather than a thrown projectile.
  mbark: {
    out: 'Sprites/projectiles/mbark.webp',
    prompt: 'A single chunky wedge of tree bark flying through the air as a thrown projectile: one thick angular '
      + 'slab of warm brown bark with two or three bold carved grain lines, a few chunky rounded clumps of bright '
      + 'moss clinging to one edge, and two small splinters breaking off the corner.',
  },
  // Blight Elder — grave-seed. Was: a dense tangle of thin tendrils, smoke and
  // pink petals; far too intricate to resolve at the ~14 px it is drawn at.
  mblightseed: {
    out: 'Sprites/projectiles/mblightseed.webp',
    // Roll 1 came back as a plain olive bean: the blight crack and the tendrils
    // were both listed AFTER the seed and the model kept only the seed, so the
    // Blight Elder identity was gone. Readability was fixed and character lost.
    // The glowing crack now LEADS the description and the tendrils are given a
    // shape and a count instead of an adjective.
    prompt: 'A cracked corrupted seed pod split by glowing blight: a jagged BRIGHT ACID-GREEN glowing crack runs '
      + 'down the middle of the pod like lava through rock, throwing off a green glow, and the pod around it is a '
      + 'hard dark olive-brown husk. THREE thick black curling tendrils, each as fat as a finger, hook out from the '
      + 'top and sides of the pod and curl over it. Only a few large shapes, no fine detail, no smoke, no petals.',
  },
  // Emberling — fire ember. Already close to house style; regenerated for the
  // outline weight and glossy cel shading the rest of the set carries.
  memberspark: {
    out: 'Sprites/projectiles/cast/memberspark.webp',
    prompt: 'A single chunky teardrop flame ember flying as a projectile: ONE rounded blob of fire, deep orange at '
      + 'the base rising through bright amber to a pale yellow-white hot core, with two short curling flame licks '
      + 'off the top and two small round embers floating beside it.',
  },
  // Spectre Cannoneer — ghost shot. Was: a flat violet RING that reads as a
  // copyright symbol, and symmetric besides, so its orient rotation is invisible.
  mghostshot: {
    out: 'Sprites/projectiles/cast/mghostshot.webp',
    prompt: 'A single ghostly cannon shot streaking to the RIGHT: a rounded skull-like spectral head of pale violet '
      + 'ectoplasm forming the LEADING edge on the right with two hollow glowing eye sockets, its body tapering '
      + 'BACKWARD to the left into two or three wispy tattered ghost-tails. Clearly a projectile in flight with a '
      + 'front and a back. Absolutely NOT a ring, NOT a circle, NOT a letter or symbol.',
    style: ' Cute cartoon game sprite in the style of a chibi mobile RPG: ONE object centred in frame and clearly '
      + 'aimed RIGHT, a thick uniform near-black outline round the whole silhouette, soft cel shading, glossy white '
      + 'highlight blobs, bright saturated violet and pale cyan, an ASYMMETRIC silhouette with an obvious leading '
      + 'edge that reads instantly as something flying rightward. Fully transparent background, no ground shadow, '
      + 'no background scenery, no text, no letters, no border, no frame, not pixel art.',
  },
  // Aries — cosmic ram-bolt. Directional already; thin and muddy in the middle.
  p_zodiacbolt: {
    out: 'Sprites/projectiles/p_zodiacbolt.webp',
    prompt: 'A single fiery ram-horn bolt streaking to the RIGHT: a chunky curled ram horn of molten gold-orange '
      + 'flame forming the LEADING point on the right, with a thick tapering tail of fire and two or three sparks '
      + 'streaming BACKWARD to the left. Bold and solid, not thin or stringy.',
    ar: 'ar_16_9',
  },
  // Scorpio — stinger venom. Was: a symmetric green ball with a small nub, so
  // its orient rotation reads as nothing at all.
  p_venom: {
    out: 'Sprites/projectiles/p_venom.webp',
    prompt: 'A single venom stinger dart flying to the RIGHT: a sharp curved scorpion stinger barb of glossy dark '
      + 'violet chitin forming the LEADING point on the right, a fat glowing droplet of acid-green venom clinging '
      + 'behind it, and two small venom droplets trailing BACKWARD to the left.',
    style: ' Cute cartoon game sprite in the style of a chibi mobile RPG: ONE object centred in frame and clearly '
      + 'aimed RIGHT, a thick uniform near-black outline round the whole silhouette, soft cel shading from an '
      + 'upper-left light, glossy white highlight blobs on the droplet, bright saturated acid-green and violet, an '
      + 'ASYMMETRIC pointed silhouette that reads instantly as a dart in flight, not a ball and not an egg. Fully '
      + 'transparent background, no ground shadow, no background scenery, no text, no border, no frame, not pixel art.',
  },
  // Leo — cosmic burst. Spins fast, so it stays radial; it just needs the
  // house outline and gloss instead of reading as a flat vector star.
  p_starburst: {
    out: 'Sprites/projectiles/p_starburst.webp',
    prompt: 'A single chunky cosmic starburst: ONE bold eight-pointed star with thick tapering points of radiant '
      + 'gold, a warm amber core with a glossy white hot centre, and four small round sparkles tucked between the '
      + 'points. Radially symmetric so it reads while spinning fast.',
  },
};

const only = val('--only', null);
const N = Math.max(1, Math.min(4, +val('--n', '3')));
const keys = only ? only.split(',') : Object.keys(TARGETS);
for (const k of keys) if (!TARGETS[k]) { console.error('unknown target: ' + k); process.exit(1); }

if (!argv.includes('--generate')) {
  console.log(`restyle ${keys.length} sprite(s), ${N} candidate(s) each -> scripts/_style_pack/<key>/\n`);
  // Show the style the target will ACTUALLY be sent, not the global default:
  // per-target overrides exist (p_flamefist, p_doom_fireball) and previewing
  // the wrong one makes the dry run worse than no dry run.
  for (const k of keys) console.log(`=== ${k}  -> ${TARGETS[k].out}\n${TARGETS[k].prompt}${TARGETS[k].style || STYLE}\n`);
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
  // an existing target keeps its shipped geometry; a NEW one declares it
  const _outAbs = join(repoRoot, t.out);
  const meta = (await import('node:fs')).existsSync(_outAbs)
    ? await sharp(_outAbs).metadata()
    : { width: (t.size && t.size[0]) || 768, height: (t.size && t.size[1]) || 768 };
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
          body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: (t.ar || 'ar_1_1'),
                                 n: 1, augment_prompt: false, prompt: t.prompt + (t.style || STYLE) }),
          signal: AbortSignal.timeout(420000),   // the image endpoint has run 3min+ under load
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
