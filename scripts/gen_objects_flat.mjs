// World props redrawn FLAT for a 2D side-scroller (v0.30.1338; per user: "some of the objects such as shadow_shuriken_rack or
// market_stall_2 are facing half left or right whereas what I want is something that fits a 2D sidescroller well without that 3d
// side half facing effect"). The twelve below had a 3/4 camera: one side face showing, tops drawn as parallelograms (the tatami was
// isometric). What was tried, on market_stall_2 and shadow_shuriken_rack:
//   - image-edit of the original told to re-shoot it straight-on: came back unchanged, still 3/4 (as the chest pass found for a
//     restyle - an edit keeps the geometry it is given);
//   - a flat take edited with the ORIGINAL as reference_image (for its style): the reference won - back to 3/4, or broken alpha;
//   - text-to-image with perspective 'Side-Scroll', art_style 'Cel-Shaded' and each prop's own parts and colours: flat. A "thick
//     bold outline" came back as a chunky sticker band, so the outline is asked for at MEDIUM weight (the projectile-pass wording).
// v0.30.1346: the hearth, the signpost and the three fountains (per user: "do the hearth and signpost, the fountains as well"), same
// recipe. A fountain seen flat shows its water as a thin band, not an ellipse. The hearth kept a short chimney over its hood (asked
// twice for none), the signpost was re-rolled from dark walnut to the town's honey-brown; all first takes otherwise but the large
// fountain (take 2, the deeper blue trim).
// v0.30.1352 (per user): "The old sign post and throne heath is better keep them" - both restored byte for byte and dropped from here;
// and the Azure fountains need "good blackoutline like the old signpost". Outline weight, the median ink width at the silhouette edge:
// the old props sit at 2.0-2.6% of sqrt(area) with the whole edge inked; the MEDIUM wording gave ~1%, and the long grand-fountain
// description drowned any outline wording (0.3-0.5%, a third of its edge un-inked). A shorter description with BOLD gives the large
// fountain 19 px on its 1984 canvas (the old art: 16), THICK gives the small one 13 px on its 850 canvas (the old: 12) - on screen,
// at 2.85x and 1x, the two draw the same line. An image-edit asked only to add the outline returned the take unchanged.
// v0.30.1609 (per user: the Azure fountains' base "flat rather than rounded", standing ON the floor's black line): both fountains keep their
// v0.30.1352 takes with only the base straightened by scripts/flatten_prop_base.mjs (fresh takes asking for a flat base changed the design
// and still sagged; image-edits of the art came back curved). A regeneration here brings a rounded base back - flatten the pick the same way.
// Shipped takes (2 per prop, some re-rolled with a sharper description): anvil take 2, every other first take; the glyph stone
// (a rough boulder at first), well (a box of thatch), tatami (a hairline) and crate stack (two crates) needed a second prompt,
// and the crate stack kept its first take (three wide crates) over the re-roll (a tower three times too narrow for its spot).
// --pick fits a take into the ORIGINAL art's content box (BOX: canvas, then the trim box) by AREA, not by the box: a 3/4 box
// carries the side face, and fitting the flat front inside it shrank the wide ones (the rack to 59% of its height). Same floor row
// and centre, 24 px clear of the canvas sides (the 48-sample edge-feather probe reads anything closer as a cut edge and softens it),
// and the ORIGINAL canvas size, because drawWorldProps sizes a prop from its canvas - so each keeps its in-game scale.
// After a pick: update the twelve rows of data/sprite_bbox.js and data/sprite_edges.js (their generators read the shared checkout).
//   LUDO_API_KEY=... node scripts/gen_objects_flat.mjs gen <n> key [key ...]     -> scripts/_tmp_obj_flat/raw/<key>_<i>.png
//   node scripts/gen_objects_flat.mjs pick key=<png> [...]                          -> Sprites/objects/<key>.webp
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url); const sharp = require('sharp'); sharp.cache(false);
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
const OUT = process.env.OBJ_FLAT_OUT || path.join(HERE, '_tmp_obj_flat');
const DEST = process.env.OBJ_FLAT_DEST || path.join(HERE, '..', 'Sprites', 'objects');
// canvas W, H, then the original art's content box L, T, W, H (sharp trim, threshold 4)
const BOX = {
  bastion_anvil: [768, 768, 144, 324, 521, 444], bastion_throne: [992, 992, 182, 161, 630, 831],
  bastion_throne_prayer_candle: [425, 425, 70, 52, 287, 373], bastion_throne_scribe_desk: [768, 768, 98, 102, 591, 606],
  market_stall_1: [768, 768, 107, 183, 564, 585], market_stall_2: [768, 768, 139, 174, 481, 594],
  shadow_shuriken_rack: [768, 768, 126, 70, 519, 698], shadow_tatami: [768, 768, 38, 449, 684, 318],
  wagon_empty: [709, 709, 47, 343, 616, 366], celestial_arcane_glyph_stone: [768, 768, 240, 91, 281, 578],
  crate_stack: [567, 567, 135, 106, 296, 461], well_stone: [768, 768, 134, 167, 502, 601],
  azure_large_waterfountain: [1984, 1984, 253, 382, 1489, 1601], azure_waterfountain: [850, 850, 169, 151, 513, 699],
  town_fountain_small_east: [768, 768, 89, 208, 591, 377],
};
// what each prop IS - its parts, materials and colours as the old art drew them
const DESC = {
  bastion_anvil: "a blacksmith's anvil in its classic side-on silhouette with the horn pointing left: dark iron, a glowing orange-hot metal bar lying on its flat top, standing on a thick light-brown wooden tree-stump block, two blacksmith hammers with wooden handles and iron heads leaning crossed against the front of the stump",
  bastion_throne: "a royal throne seen straight from the front: a tall carved dark reddish-brown wooden frame with a carved crest at the top of the back, a red velvet seat and a red velvet back panel with a darker red embroidered lion emblem, two wooden armrests with square gold ornaments on their fronts, and a steel sword with a gold crossguard leaning against the right armrest",
  bastion_throne_prayer_candle: "three white wax candles with dripping wax and small warm yellow flames - a tall one in the middle and a shorter one on each side - standing in a row on a low rectangular white marble block seen from the front",
  bastion_throne_scribe_desk: "a small dark reddish-brown wooden writing desk seen from the front with a drawer and two legs, an open book with cream pages lying on top, a white feather quill standing in a black inkwell and a short lit white candle in a small brass holder",
  market_stall_1: "a market stall of light warm honey-brown wood: a scalloped yellow and cream striped awning on wooden posts, a wooden counter piled with golden bread loaves, baguettes and a wicker basket of green vegetables and oranges on top, and a purple cloth hanging on the counter front",
  market_stall_2: 'a market stall of light warm honey-brown wood: a scalloped coral-red and cream striped awning on wooden posts, a wooden counter with a wicker basket of red apples and a neat stack of folded bright blue cloth on top, and a charcoal cloth with a scalloped hem hanging on the counter front',
  shadow_shuriken_rack: 'a dark wooden weapon display rack - two upright posts and three horizontal shelf bars - with steel throwing blades (dark grey and violet four-pointed shuriken and kunai tips) standing in a row on each shelf',
  shadow_tatami: "a tatami mat lying on the floor seen from a LOW front angle: we see its front edge with a purple fabric border and a shallow strip of its woven golden straw top surface, a wide low shape about five times wider than tall; a sheathed black katana with a dark red cord lies across it and a short lit white candle stands on it at the right end",
  wagon_empty: "an empty light-brown wooden wagon seen exactly from the side: a plank box body with dark iron corner brackets, two big wooden spoked wheels with dark iron rims (front and back), and a long wooden pull handle sticking out to the left",
  celestial_arcane_glyph_stone: "a smooth, cleanly cut grey stone obelisk seen flat from the front: a tall slim shape with straight parallel sides and a pointed pyramid tip, one flat front face carved with big bold glowing cyan magic runes in two neat columns, a few small cracks, crisp edges (not a rough natural boulder)",
  crate_stack: "three light honey-brown wooden shipping crates stacked in a column, each a flat rectangle of planks with a darker wooden frame, a coil of tan rope lying on the top crate, a burnt black stencil mark on the bottom crate",
  well_stone: "a round grey cobblestone well seen flat from the front: a stone wall with a wooden rim, two wooden posts on either side holding a triangular gable roof of golden straw thatch shaped like an upside-down V, a wooden crossbeam with a crank, a rope and a small wooden bucket hanging in the middle",
  azure_large_waterfountain: "a tall, elegant cartoon three-tier water fountain seen flat from the side: white marble with royal blue trim and blue diamond gems, a slender pillar holding two scalloped basins (the upper one smaller), a tall pointed crystal spire on top, thin streams of water falling from both basins into a wide low round pool",
  azure_waterfountain: 'a water fountain seen flat from the side at eye level: a wide white marble bowl with a blue band on a short white pillar, standing in a low round white marble base pool of blue water, and a tall blue crystal-shaped water jet rising from the middle of the bowl; the bowl and the pool show only a thin sliver of their water surface',
  town_fountain_small_east: 'two identical small cream sandstone fountains standing side by side, each seen flat from the side at eye level: a round bowl on a short pedestal with turquoise water showing only as a thin sliver at the rim, and a small turquoise water jet splashing up from the middle'
};
const CAMERA = 'CRITICAL CAMERA: a flat, straight-on FRONT view for a 2D side-scrolling platformer game - the camera looks at the object '
  + 'exactly from the front at eye level, like a theatre flat. NO 3/4 view, NO side face visible, NO isometric, no vanishing point, no '
  + 'perspective: every front edge is horizontal or vertical, the tops are at most a thin sliver, and the object is symmetric left to right '
  + 'wherever the object itself is symmetric.';
const CLEAN = 'Clean polished cartoon game-prop art: a clean black ink outline of MEDIUM weight - bold but clearly thinner than a chunky '
  + 'sticker border - around the silhouette and the main shapes, and NO white sticker border outside the black outline. Smooth flat colour '
  + 'fills with one soft shade and a small highlight, simple readable shapes, minimal texture (a few simple strokes for wood grain at most), '
  + 'no grain, no noise, no painterly brushwork.';
// v0.30.1352 outline wordings (per user, the Azure fountains: "good blackoutline like the old signpost"): a prop listed in OUTLINE takes
// its wording in place of CLEAN's MEDIUM line. BOLD measured 1.7-1.9% on the tall fountain, THICK 2.7-3.5% (see the header).
const BOLD = 'Clean polished cartoon game-prop art: a BOLD, clean, solid black ink outline of even thickness around the whole silhouette '
  + 'and around every part - thick and clearly readable like a classic cartoon game sticker, but not a chunky band - and NO white border '
  + 'outside the black outline. Smooth flat colour fills with one soft shade and a small highlight, simple readable shapes, minimal '
  + 'texture, no grain, no noise, no painterly brushwork.';
const THICK = 'Clean polished cartoon game-prop art, like a mobile game sticker: a thick, even, bold solid BLACK ink outline around the whole '
  + 'silhouette and around every part, including around the falling water streams, and NO white sticker border outside the black outline. '
  + 'Smooth flat colour fills with one soft shade and a small highlight, simple readable shapes, minimal texture, no grain, no noise, no '
  + 'painterly brushwork.';
const OUTLINE = { azure_large_waterfountain: BOLD, azure_waterfountain: THICK };
const STYLE = 'The object\'s own natural colours (no neon, no rainbow). A single object, centred, full object visible, transparent '
  + 'background, no ground, no floor, no cast shadow, no text.';
const argv = process.argv.slice(2);
if (argv[0] === 'pick') {
  for (const p of argv.slice(1)) {
    const [key, file] = p.split('='); if (!BOX[key] || !file || !fs.existsSync(file)) { console.error('bad pick ' + p); process.exit(1); }
    const [CW, CH, L, T, BW, BH] = BOX[key], M = 24, bottom = T + BH;
    const art = await sharp(await sharp(fs.readFileSync(file)).trim({ threshold: 10 }).toBuffer()).png().toBuffer();
    const am = await sharp(art).metadata();
    const s = Math.min(Math.sqrt((BW * BH) / (am.width * am.height)), (CW - 2 * M) / am.width, (bottom - M) / am.height);
    const w = Math.round(am.width * s), h = Math.round(am.height * s);
    const fit = await sharp(art).resize(w, h, { kernel: 'lanczos3' }).png().toBuffer();
    const left = Math.max(M, Math.min(CW - M - w, Math.round(L + (BW - w) / 2))), top = bottom - h;
    const out = await sharp({ create: { width: CW, height: CH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: fit, left, top }]).webp({ lossless: true, effort: 6 }).toBuffer();
    fs.mkdirSync(DEST, { recursive: true }); const dst = path.join(DEST, key + '.webp');
    fs.writeFileSync(dst + '.tmp', out); fs.renameSync(dst + '.tmp', dst);
    console.log('picked', key, '<-', path.basename(file), `${w}x${h} @ ${left},${top} on ${CW}x${CH}`);
  }
  process.exit(0);
}
if (argv[0] !== 'gen' || !argv[2]) { console.error('usage: gen <n> key... | pick key=png...'); process.exit(1); }
const N = Math.max(1, Math.min(4, +argv[1] || 2)), keys = argv.slice(2);
const KEY = process.env.LUDO_API_KEY; if (!KEY) { console.error('LUDO_API_KEY required'); process.exit(1); }
const API = 'https://api.ludo.ai/api'; const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function pollJob(job) {
  const t0 = Date.now(); let wait = 5000;
  for (;;) {
    if (Date.now() - t0 > 900000) throw new Error('job timeout');
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
for (const k of keys) {
  if (!DESC[k]) { console.log('skip unknown', k); continue; }
  const have = fs.readdirSync(RAW).filter((f) => f.startsWith(k + '_')).length;
  process.stdout.write(`${k} x${N} ... `);
  const bufs = await generate({ image_type: 'sprite', art_style: 'Cel-Shaded', perspective: 'Side-Scroll', aspect_ratio: (k === 'shadow_tatami' || k === 'town_fountain_small_east') ? 'ar_16_9' : 'ar_1_1',
    n: N, augment_prompt: false, prompt: `${DESC[k]}. ${CAMERA} ${OUTLINE[k] || CLEAN} ${STYLE}` });
  bufs.forEach((b, i) => fs.writeFileSync(path.join(RAW, `${k}_${have + i + 1}.png`), b));   // raw first, untouched
  console.log(bufs.length);
}
