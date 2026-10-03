// New decoration props for the hunting maps (2026-09-30, per user: "Audit the various maps in Mojiworld and create more
// Sprites/objects for decoration appropriately"). The audit: of 115 maps only the towns and the bridge maps carry props; the ~65
// hunting / dungeon maps had none. Same recipe as gen_objects_flat.mjs (v0.30.1338 / 1352): text-to-image with a Side-Scroll
// camera and Cel-Shaded style, each prop described by its parts and its own colours, and the old art's BOLD black outline (the
// house props measure 2.0-2.6% of sqrt(area); BOLD gave 1.5-1.9%, THICK 2.7-4.3%, so a take of each is asked for and measured).
// Every take is written raw first. --pick fits a take onto a 768 x 768 canvas (drawWorldProps sizes a prop from its canvas):
// content bottom on row 766 like the house props, centred, 24 px clear of the sides (the edge-feather probe), scaled by the
// prop's FILL (the share of the canvas height its content takes).
//   LUDO_API_KEY=... node scripts/gen_objects_decor.mjs gen <key> [key ...]      -> $DECOR_OUT/raw/<key>_<bold|thick>_<i>.png
//   node scripts/gen_objects_decor.mjs pick key=<png> [...]                        -> $DECOR_DEST/<key>.webp
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url); const sharp = require('sharp'); sharp.cache(false);
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
const OUT = process.env.DECOR_OUT || path.join(HERE, '_tmp_obj_decor');
const DEST = process.env.DECOR_DEST || path.join(OUT, 'picked');
// what each prop IS - parts, materials, its own colours; FILL = content height as a share of the 768 canvas
const DESC = {
  forest_mossy_stump: ['an old cut tree stump seen from the side: light brown bark with darker vertical grain lines, a pale ring-cut top, a cap of bright green moss spilling over one edge, and three small red-capped mushrooms with white spots growing at its base', 0.55],
  jungle_glowbloom: ['a clump of tall jungle plants: broad curled deep-teal leaves rising from a small mound, and three drooping bulb-shaped flowers on thin stems glowing a rich aqua-cyan with a bright turquoise core', 0.8],
  reef_amphora: ['an ancient terracotta amphora jar standing upright: a warm orange-brown clay body with a narrow neck and two curved handles, a faded dark-brown painted band around its belly, a few white barnacles and a small coral-pink sea anemone at its base', 0.72],
  wreck_anchor: ["a big old ship's anchor standing upright with its crown resting on the ground: dark rusty-brown iron with orange rust patches, a round ring at the top of the shank, curved arms with pointed flukes, a few white barnacles, and a loop of thick tan rope hanging from the ring", 0.85],
  foundry_ore_cart: ['a small dark iron mine cart seen exactly from the side, on two visible round iron wheels, its riveted body heaped with chunky glowing orange-and-yellow molten ore rocks, a thin wisp of orange heat above the pile', 0.55],
  ice_crystal_cluster: ['a cluster of five tall pointed ice crystals of different heights growing from a dark slate-grey rock with a cap of snow; the crystals are saturated cyan and deep blue with a few bright aqua facets, no white areas', 0.72],
  grave_tombstone: ['a cartoon gravestone with a rounded top: grey stone with a jagged crack, patches of green moss on its shoulders, a small tuft of grass at each side of its base and a small white skull lying at its foot', 0.62],
  candy_lollipop: ['a giant swirl lollipop stuck upright in the ground: a big round flat candy disc with a hot-pink and cream spiral, a glossy highlight, on a thick white stick, and two small wrapped candies (one mint green, one lemon yellow) lying at its base', 0.9],
  // the rest of the set (per user: "art that is similar to the current objects", placed "sparsely but strategically"); where an
  // existing prop already fits a map (brain coral, clamshell, starfish rock, lava crystals, iron anvil, ice lantern, skull pillar,
  // stone planter) it is reused instead of drawn again
  forest_hollow_log: ['a fallen hollow tree log lying on its side, seen exactly from the side: light brown bark with darker grain lines, a dark round hollow opening at its right end showing pale wood rings, green moss patches along the top and a small green fern sprouting from it', 0.4],
  fungal_glowcap_cluster: ['a cluster of three plain mushrooms of different heights: smooth domed caps in warm orange with pale cream spots, pale cream stems, a few tiny glowing golden spores floating around them; plain mushrooms with no faces and no eyes', 0.7],
  jungle_vine_ruin: ['a short broken ancient stone column stump: weathered grey-teal stone with carved horizontal rings and a jagged broken top, overgrown with green vines and small teal leaves hanging down its sides', 0.62],
  wreck_ship_wheel: ["an old wooden ship's steering wheel standing upright on a short thick wooden post: dark brown wood with a brass hub, eight handle spokes of which two are snapped short, and a strand of dark green seaweed draped over the rim", 0.8],
  coast_tiki_torch: ['a bamboo tiki torch: a tall straight bamboo pole with node rings, a woven straw cup at the top holding a bright orange-and-yellow flame, and the pole planted in a small mound of pale sand', 0.95],
  sauro_egg_nest: ['a nest of dry brown twigs and straw holding three big dinosaur eggs: cream-coloured eggs with brown speckles, one egg slightly cracked, seen from the side', 0.45],
  ice_frozen_sled: ['an old wooden sled seen exactly from the side: curved wooden runners, a flat slatted wooden bed with a bundle of supplies tied down with rope, snow piled on top and small blue icicles hanging from the edges', 0.45],
  grave_iron_lantern: ['a short old black iron lamp post: a slim iron pole on a small stone base, topped by a four-sided iron-framed lantern glowing with a saturated green flame, a curl of iron on each side', 0.9],
  candy_gumdrop_pile: ['a small heap of six big sugar-coated gumdrops in cherry red, lime green, orange and grape purple, each a rounded dome with a sugary sparkle, piled three on the bottom, two in the middle and one on top', 0.42],
  storm_lightning_rod: ['a tall iron lightning rod: a thin dark iron pole with a sharp pointed tip, a coil of copper wire wound around its middle, standing on a square grey stone base, with three small saturated electric-blue sparks crackling at the tip', 0.95],
  atrium_marble_urn: ['a tall elegant marble urn on a round pedestal: white marble with gold trim bands and small engraved gold stars, holding a small bouquet of glowing saturated-blue flowers', 0.8],
  bluff_stone_cairn: ['a cairn of five flat grey granite stones balanced in a stack, largest at the bottom and smallest on top, with a small tuft of green grass at its base', 0.62],
  desert_cactus: ['a tall green saguaro cactus with two curved arms raised on either side, vertical ribs, small white spines and a small pink flower on top, standing in a small mound of sand-coloured pebbles', 0.95],
  temple_stone_lantern: ['an ancient carved stone lantern shrine: weathered sandy-brown sandstone, a square open housing with a warm orange flame glowing inside, a tiered pointed stone roof, and a little green moss in the cracks', 0.85],
  // bland-maps (per user: "find which are the blander looking maps and beautify those maps"): a landmark on each long empty stretch of
  // the six blandest hunting maps; all nine picks are BOLD takes (THICK drew black halos inside the armillary rings and round the flame)
  bluff_windswept_pine: ['a small wind-bent pine tree growing out of a cracked grey granite boulder, seen from the side: a twisted dark-brown trunk leaning to the right, three flat layered clumps of deep green needles all swept to the right by the wind, the boulder light grey with darker cracks and a patch of yellow-green lichen', 0.95],
  bluff_pickaxe_boulder: ["a rounded light-grey granite boulder with a jagged dark crack, an old miner's pickaxe stuck into its top at an angle with a worn light-brown wooden handle and a dark iron head, and a coil of tan rope lying against the boulder's base", 0.6],
  glasswind_chime_post: ['a weathered light-brown wooden post with a short crossbar at the top, five long wind chimes hanging from the crossbar on thin strings - slender tubes of clear pale-cyan glass of different lengths with bright white glints - a small cap of snow on the crossbar and three small icicles', 0.95],
  steppe_snowy_pine: ['a small young pine tree heavy with snow: three layered tiers of dark green needles each topped with a thick white snow cap, a short brown trunk, and a small rounded snowdrift at its base', 0.95],
  atrium_armillary: ['a brass armillary sphere on a white marble pedestal: three interlocking polished gold rings tilted around a small glowing pale-blue star orb at the centre, the round pedestal white marble with gold trim bands on a square base', 0.9],
  atrium_star_brazier: ['a slender white marble brazier standing on three curved gold legs, holding a shallow gold bowl of soft glowing pale-gold flames with tiny white star sparkles rising from them', 0.85],
  grave_candle_altar: ['a low weathered black stone altar draped with a tattered dark-purple cloth, topped with a cluster of melted white candles of different heights burning with small pale-green flames, wax dripping down the stone, and a small white skull among the candles', 0.6],
  // three earlier wordings drew the castle on a beach slab or a dune running off the canvas; this one asks for the object alone
  beach_sandcastle: ['a small compact sandcastle game prop: three round pale golden sand towers with crenellated tops, a tiny red pennant flag on the tallest, a few small white and pink seashells pressed into its walls and a small blue toy spade leaning on one tower; the towers rest directly on a flat bottom edge with only a thin lip of sand at their feet, no wider than the castle itself - an isolated object, NOT a beach scene, no sand ground, no dune, no mound spreading to the sides', 0.55],
  catacomb_bone_urn: ['a large cracked stone funeral urn of grey-violet stone with carved bands around its belly, overflowing with old ivory bones and two small skulls, and three melted white candles on its rim with small orange flames', 0.7],
  // bland-maps 3 - the Distorted Portal maps, drawn with DECOR_WORDS=ink (their dark inked look; 'Pixel Art' is not an art_style - HTTP 400)
  rift_cracked_mirror: ['a tall standing mirror in a dark lacquered wooden frame on two short feet, seen straight from the side-front: the black-and-deep-red lacquer frame has small gold corner caps, the glass is shattered into jagged shards that reflect a crimson sky with a faint violet glow along the cracks, and two loose glass shards lie at its feet', 0.95],
  rift_stone_lantern: ['a weathered Japanese stone lantern (toro) of dark slate-blue stone: a square base, a slim post, a firebox with a window glowing a dim crimson-orange, a wide curved pointed roof cap; thin cracks run through the stone with a faint violet light leaking from them, and a little dark moss on the base', 0.9],
  // picked with DECOR_MARGIN=48: at 24 its needles touched the side margin the edge-feather probe watches
  rift_withered_pine: ['a small withered black pine tree in the Japanese style: a twisted dark charcoal trunk bending to one side, three flat sparse clumps of dark navy-teal needles, a few crimson leaves still clinging, growing from a low mound of dark slate rocks', 0.9],
  // distorted-dressing - hung under the Distorted Portal maps' ledges (anchor 'hang'): DECOR_WORDS=ink; the banner is take 1, the
  // string take 2 picked with DECOR_MARGIN=40 (it is wide)
  rift_banner_hang: ['a long tattered crimson silk banner hanging straight down from a short black lacquered crossbar with small gold end caps: a black circular cracked-mirror sigil in its middle, a thin gold border stitched along its edges, a ragged frayed bottom edge with two small gold tassels; the cloth hangs flat and straight, seen from the front', 0.95],
  rift_lantern_string: ['a sagging string of five round red paper lanterns hanging from a thin black cord, each lantern glowing warm orange from inside, with black lacquered top and bottom caps and short red tassels; the cord droops in one shallow curve between two small black iron hooks at its two ends', 0.5],
  // town-beautify (per user: "beautify azure and emerald town more"): one new light for each town, the rest reused
  azure_crystal_lamp: ['a slender academy lamp post: a tall white marble column with gold trim bands on a small square white marble base, topped by an open cradle of curled gold arms holding a big glowing pale-blue faceted crystal with a bright white core', 0.95],
  emerald_lantern_post: ['a village lantern post in the East Asian style: a dark brown wooden post on a small grey stone footing, a short wooden arm near the top from which hangs a round red paper lantern with gold caps and a short red tassel, glowing warm orange inside, and a small jade-green tiled roof cap on top of the post', 0.95],
};
const CAMERA = 'CRITICAL CAMERA: a flat, straight-on side view for a 2D side-scrolling platformer game - the camera looks at the object '
  + 'exactly from the side at eye level, like a theatre flat. NO 3/4 view, NO isometric, no vanishing point, no top surface showing '
  + 'beyond a thin sliver.';   // 'stands on an invisible flat floor line' drew a real black floor line under the first stump
const BOLD = 'Clean polished cartoon game-prop art: a BOLD, clean, solid black ink outline of even thickness around the whole silhouette '
  + 'and around every part - thick and clearly readable like a classic cartoon game sticker, but not a chunky band - and NO white border '
  + 'outside the black outline. Smooth flat colour fills with one soft shade and a small highlight, simple readable shapes, minimal '
  + 'texture, no grain, no noise, no painterly brushwork.';
const THICK = 'Clean polished cartoon game-prop art, like a mobile game sticker: a thick, even, bold solid BLACK ink outline around the whole '
  + 'silhouette and around every part, and NO white sticker border outside the black outline. Smooth flat colour fills with one soft '
  + 'shade and a small highlight, simple readable shapes, minimal texture, no grain, no noise, no painterly brushwork.';
const STYLE = 'The object\'s own natural colours (no neon, no rainbow). A single object, centred, full object visible, transparent '
  + 'background, no ground, no floor, no cast shadow, no text. An inanimate object: no face, no eyes, no mouth.';   // a face reads as a monster (the unused giant mushroom)
const argv = process.argv.slice(2);
if (argv[0] === 'pick') {
  const CW = 768, M = Number(process.env.DECOR_MARGIN || 24), BOTTOM = 766;
  for (const p of argv.slice(1)) {
    const [key, file] = p.split('='); if (!DESC[key] || !file || !fs.existsSync(file)) { console.error('bad pick ' + p); process.exit(1); }
    // a ground shadow the prompt did not ask for (the anchor: a 560 px ellipse in the bottom 9 rows under a 96 px crown) - a band in
    // the bottom 20 rows more than twice as wide as the foot directly above it is cleared before the trim, so the foot plants
    const { data: px, info: pi } = await sharp(fs.readFileSync(file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const rowN = (y) => { let n = 0; for (let x = 0; x < pi.width; x++) if (px[(y * pi.width + x) * 4 + 3] > 24) n++; return n; };
    let bot = pi.height - 1; while (bot > 0 && !rowN(bot)) bot--;
    // ...and a thin drawn floor line (the lollipop: 4 rows reaching past its candies on both sides) - within the bottom 5 rows a band
    // 15% wider than the row above it
    let widest = 0, cut = -1; for (let y = bot; y > bot - 20 && y > 0; y--) { const n = rowN(y); if (widest && n < widest * (bot - y <= 5 ? 0.85 : 0.5)) { cut = y; break; } widest = Math.max(widest, n); }
    if (cut >= 0) { for (let y = cut + 1; y <= bot; y++) for (let x = 0; x < pi.width; x++) px[(y * pi.width + x) * 4 + 3] = 0; console.log('  cleared a ground shadow under', key, `(rows ${cut + 1}-${bot})`); }
    const art = await sharp(await sharp(px, { raw: { width: pi.width, height: pi.height, channels: 4 } }).png().toBuffer()).trim({ threshold: 10 }).png().toBuffer();
    const am = await sharp(art).metadata();
    const s = Math.min((DESC[key][1] * CW) / am.height, (CW - 2 * M) / am.width, (BOTTOM - M) / am.height);
    const w = Math.round(am.width * s), h = Math.round(am.height * s);
    const fit = await sharp(art).resize(w, h, { kernel: 'lanczos3' }).png().toBuffer();
    const left = Math.round((CW - w) / 2), top = BOTTOM - h;
    const out = await sharp({ create: { width: CW, height: CW, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: fit, left, top }]).webp({ lossless: true, effort: 6 }).toBuffer();
    fs.mkdirSync(DEST, { recursive: true }); const dst = path.join(DEST, key + '.webp');
    fs.writeFileSync(dst + '.tmp', out); fs.renameSync(dst + '.tmp', dst);
    console.log('picked', key, '<-', path.basename(file), `${w}x${h} @ ${left},${top} on ${CW}x${CW}`);
  }
  process.exit(0);
}
if (!['gen', 'fill'].includes(argv[0]) || !argv[1]) { console.error('usage: gen|fill key... | pick key=png...'); process.exit(1); }   // fill: only the (key, wording) pairs with no take yet
const KEY = process.env.LUDO_API_KEY; if (!KEY) { console.error('LUDO_API_KEY required'); process.exit(1); }
const API = 'https://api.ludo.ai/api'; const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function pollJob(job) {
  const t0 = Date.now(); let wait = 5000;
  for (;;) {
    if (Date.now() - t0 > 900000) throw new Error('job timeout ' + job.id);
    await sleep(wait);
    let r; try { r = await fetch(`${API}/assets/jobs/${job.id}`, { headers: { Authorization: `ApiKey ${KEY}` }, signal: AbortSignal.timeout(30000) }); } catch (e) { wait = Math.min(30000, wait * 1.5); continue; }
    if (r.status === 429) { wait = Math.min(30000, wait * 1.7); continue; }
    if (!r.ok) throw new Error('job HTTP ' + r.status);
    const j = await r.json();
    if (j.status === 'succeeded' || j.status === 'completed') return j;
    if (['failed', 'error', 'cancelled'].includes(j.status)) throw new Error('job ' + j.status);
    wait = Math.min(15000, Math.max(5000, Number(j.poll_after_ms) || wait));
  }
}
async function generate(body) {
  let last;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(`${API}/assets/image`, { method: 'POST', signal: AbortSignal.timeout(180000), headers: { Authorization: `ApiKey ${KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (res.status === 402) throw Object.assign(new Error('out of credits (402)'), { fatal: true });
      if (res.status === 400) throw Object.assign(new Error('HTTP 400 ' + (await res.text()).slice(0, 200)), { fatal: true });
      if (res.status === 429) { await sleep(20000 * attempt); continue; }
      if (!res.ok && res.status !== 202) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
      let j = await res.json();
      if (res.status === 202 || (j && j.id && j.status && !j.url && !Array.isArray(j))) j = await pollJob(j);
      const list = Array.isArray(j) ? j : Array.isArray(j.result) ? j.result : [j.result || j];
      const urls = list.map((x) => x && (x.url || (x.images && x.images[0] && x.images[0].url))).filter(Boolean);
      if (!urls.length) throw new Error('no url');
      return Promise.all(urls.map(async (u) => Buffer.from(await (await fetch(u, { signal: AbortSignal.timeout(150000) })).arrayBuffer())));
    } catch (e) { last = e; if (e.fatal) throw e; console.log(`    attempt ${attempt} failed: ${e.message}`); await sleep(6000 * attempt); }
  }
  throw last;
}
const RAW = path.join(OUT, 'raw'); fs.mkdirSync(RAW, { recursive: true });
const WORDS = (process.env.DECOR_WORDS || 'bold,thick').split(',');
// ink (bland-maps 3): the Distorted Portal's look - a thin dark ink line, flat posterized shading in a dark palette
const INK = 'Dark moody 2D game-prop illustration: a THIN dark navy ink line around the silhouette and the main parts, flat posterized shading in a limited dark palette of deep navy, slate blue, charcoal and crimson, like a silhouette lit by a red sunset; no bold black sticker outline, no white border, no painterly brushwork, no grain.';
const STYLE_INK = 'A single object, centred, full object visible, transparent background, no ground, no floor, no cast shadow, no text. An inanimate object: no face, no eyes, no mouth.';
// four workers over the (key, wording) queue, in argument order; a 402 (credits out, costs nothing) stops new requests and
// exits 2 once the in-flight ones settle (a hard exit mid-fetch tripped a libuv assertion)
const keys = argv.slice(1).filter((k) => DESC[k] || (console.log('skip unknown', k), false));
const queue = []; for (const k of keys) for (const wd of WORDS) queue.push([k, wd]);
let stop = false;
const worker = async () => {
  while (!stop && queue.length) {
    const [k, wd] = queue.shift();
    const have = fs.readdirSync(RAW).filter((f) => f.startsWith(`${k}_${wd}_`)).length;
    if (argv[0] === 'fill' && have) continue;
    try {
      const bufs = await generate({ image_type: 'sprite', art_style: wd === 'ink' ? 'Illustration' : 'Cel-Shaded', perspective: 'Side-Scroll', aspect_ratio: 'ar_1_1',
        n: 1, augment_prompt: false, prompt: wd === 'ink' ? `${DESC[k][0]}. ${CAMERA} ${INK} ${STYLE_INK}` : `${DESC[k][0]}. ${CAMERA} ${wd === 'thick' ? THICK : BOLD} ${STYLE}` });
      bufs.forEach((b, i) => fs.writeFileSync(path.join(RAW, `${k}_${wd}_${have + i + 1}.png`), b));   // raw first, untouched
      console.log(k, wd, bufs.length);
    } catch (e) { console.log(k, wd, 'FAILED', e.message); if (/402/.test(e.message)) stop = true; }
  }
};
await Promise.all([worker(), worker(), worker(), worker()]);
process.exitCode = stop ? 2 : 0;
