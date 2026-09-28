// Pop-punk TREASURE CHESTS, redesigned (per user: "work on the chest sprites open and unopened to make them look more pop and punk
// style", then of a sticker pass: "remove the stars and lightning, what i meant was the whole design of the chest and the outline,
// redo", and the chosen direction "C - chubby cartoon"). A new chest design - a puffy rounded lid wider than the body, a fat
// hand-inked black outline, bold simple shapes, flat cel colour and oversized glossy highlights, a big round keyhole - in three tiers
// and two states:
//   chest_wood        the pick of the design preview (--seed installs a text-to-image take as the wooden chest)
//   chest_silver/gold image-edit of the NEW wooden chest, materials only, so the family shares one design
//   chest_*_open      image-edit of the tier's new closed chest (straight-on, lid up, empty inside)
// --pick fits the chosen candidate back into the ORIGINAL art's content box on the 768 canvas: drawChests stretches the whole
// canvas into the chest's box and plants the shadow from the content bottom, so the box keeps every chest the same size and spot.
//   node scripts/gen_chest_pop.mjs --seed <png>                      the wooden chest from a design take
//   LUDO_API_KEY=... node scripts/gen_chest_pop.mjs [key ...]      two candidates each -> scripts/_tmp_chest_pop/
//   node scripts/gen_chest_pop.mjs --pick chest_silver=1,chest_gold_open=2 ...
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = require('sharp'); sharp.cache(false);
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
const ROOT = path.resolve(HERE, '..');
const OBJ = path.join(ROOT, 'Sprites', 'objects');
const OUT = process.env.CHEST_POP_OUT || path.join(HERE, '_tmp_chest_pop');
const DEST = process.env.CHEST_POP_DEST || OBJ;
// the content boxes (trim threshold 4) each sprite is fitted into on the 768 canvas: [left, top, width, height]. Wood keeps the
// pre-pop boxes. The GOLD boxes are larger - per user "for the gold chest can make it look more grand": a wider, taller box with
// the SAME bottom row, so the gold chest stands bigger and is still planted the same. SILVER sits between them - per user "silver
// one can be a little more embellished as well": a slightly taller box, same bottom row - so the size climbs with the value.
const BOX = { chest_wood: [75, 147, 616, 464], chest_wood_open: [48, 0, 673, 768], chest_silver: [40, 150, 688, 511],
  chest_silver_open: [0, 64, 768, 704], chest_gold: [24, 60, 720, 555], chest_gold_open: [0, 0, 768, 768] };
const MATERIAL = { wood: 'warm brown wooden planks with dark iron trim and a dark iron round keyhole lock',
  silver: 'an EMBELLISHED silver chest: polished silver metal with engraved silver scrollwork on the lid and front, rows of polished steel '
    + 'studs, decorative pointed silver corner guards, and a faceted blue sapphire set in the silver lock plate above the round keyhole - '
    + 'refined and valuable, but simpler than a royal chest (no crown)',
  gold: 'a GRAND royal treasure chest: the lid and body are rich shiny GOLD with ornate gold filigree scrollwork, rows of gold studs, a big '
    + 'faceted red ruby set in the gold lock plate above the round keyhole, a small gold crown crest rising from the top of the lid, and a few '
    + 'deep red velvet panels showing between the gold bands' };
const NOPE = 'NO stickers, NO stars, NO lightning bolts, NO decals, no neon, no rainbow. Transparent background, a single object, centred, '
  + 'no ground, no drop shadow, no text.';
const prompt = (key) => {   // silver / gold from the wooden chest
  const tier = key.split('_')[1];
  if (tier === 'silver') return 'Edit THIS treasure chest into its EMBELLISHED silver version: keep the same chubby cartoon design family - the '
    + 'puffy rounded lid wider than the body, the fat black ink outline, glossy white highlight shapes, round keyhole and straight-on front view - '
    + 'and dress it up moderately: ' + MATERIAL.silver + '. It should look clearly finer than a plain wooden chest. ' + NOPE;
  if (tier === 'gold') return 'Edit THIS treasure chest into its GRAND royal version: keep the same chubby cartoon design family - the puffy '
    + 'rounded lid wider than the body, the fat black ink outline, glossy white highlight shapes, round keyhole and straight-on front view - but make '
    + 'it lavish and impressive: ' + MATERIAL.gold + '. It should clearly look like the most valuable chest. ' + NOPE;
  return 'Edit THIS treasure chest: keep EXACTLY the same design, shape, proportions, puffy rounded lid, fat black ink outline, glossy white '
    + 'highlight shapes, round keyhole lock and straight-on front view - change ONLY its materials and colours to ' + MATERIAL[tier] + '. ' + NOPE;
};
const promptOpen = (key) => {   // the open state from the tier's new closed chest
  const tier = key.split('_')[1];
  return 'Edit THIS treasure chest into its OPEN state. Keep the EXACT same art: ' + MATERIAL[tier] + ', the same chubby pop punk cartoon '
    + 'design, the same fat black ink outline, the same glossy highlights, the same colours. CRITICAL CAMERA: a perfectly STRAIGHT-ON FRONT '
    + 'view, symmetric left to right, exactly like the closed chest - no 3/4 view, no perspective. The puffy lid is HINGED AT THE BACK and swung '
    + 'UP and slightly back so it sits ABOVE the body; we see the inner face of the raised lid straight-on. CRITICAL: the chest is EMPTY inside - '
    + 'a plain dark hollow interior with a visible back inner wall; NO coins, NO gold, NO treasure, NO gems, NO glow, NO light rays, no items. '
    + 'The body stays the same size and shape as the closed chest in the lower part; the open lid adds height above. ' + NOPE;
};
const argv = process.argv.slice(2);
if (argv[0] === '--seed') {   // the wooden chest straight from a design take
  fs.mkdirSync(OUT, { recursive: true });
  fs.copyFileSync(argv[1], path.join(OUT, 'chest_wood_1.png'));
  argv.splice(0, argv.length, '--pick', 'chest_wood=1');
}
if (argv[0] === '--pick') {
  for (const p of argv.slice(1).join(',').split(',').filter(Boolean)) {
    const [key, n] = p.split('='); const src = path.join(OUT, `${key}_${n}.png`);
    if (!BOX[key] || !fs.existsSync(src)) { console.error('no candidate ' + src); process.exit(1); }
    const [L, T, BW, BH] = BOX[key];
    const art = await sharp(await sharp(fs.readFileSync(src)).trim({ threshold: 10 }).toBuffer()).resize(BW, BH, { fit: 'contain', position: 'bottom', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    const out = await sharp({ create: { width: 768, height: 768, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: art, left: L, top: T }]).webp({ quality: 92, alphaQuality: 100, effort: 6 }).toBuffer();
    const dst = path.join(DEST, key + '.webp'); fs.mkdirSync(DEST, { recursive: true });
    fs.writeFileSync(dst + '.tmp', out); fs.renameSync(dst + '.tmp', dst);
    console.log('picked', key, n, '->', dst);
  }
  process.exit(0);
}
const key = process.env.LUDO_API_KEY; if (!key) { console.error('LUDO_API_KEY required'); process.exit(1); }
const API = 'https://api.ludo.ai/api';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function pollJob(job) {
  const t0 = Date.now(); let wait = 5000;
  for (;;) {
    if (Date.now() - t0 > 900000) throw new Error('job timeout');
    await sleep(wait);
    let r; try { r = await fetch(`${API}/assets/jobs/${job.id}`, { headers: { Authorization: `ApiKey ${key}` }, signal: AbortSignal.timeout(30000) }); } catch (e) { wait = Math.min(30000, wait * 1.5); continue; }
    if (r.status === 429) { wait = Math.min(30000, wait * 1.7); continue; }
    if (!r.ok) throw new Error('job HTTP ' + r.status);
    const j = await r.json();
    if (j.status === 'succeeded' || j.status === 'completed') return j;
    if (['failed', 'error', 'cancelled'].includes(j.status)) throw new Error('job ' + j.status);
    wait = Math.min(15000, Math.max(5000, Number(j.poll_after_ms) || wait));
  }
}
async function edit(buf, text, n) {
  let last;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(`${API}/assets/image/edit`, { method: 'POST', signal: AbortSignal.timeout(180000),
        headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'data:image/webp;base64,' + buf.toString('base64'), prompt: text, n, augment_prompt: false }) });
      if (res.status === 402) throw Object.assign(new Error('out of credits'), { fatal: true });
      if (res.status === 429) { await sleep(20000 * attempt); continue; }
      if (!res.ok && res.status !== 202) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 160)}`);
      let j = await res.json();
      if (res.status === 202 || (j && j.id && j.status && !j.url && !Array.isArray(j))) j = await pollJob(j);
      const list = Array.isArray(j) ? j : Array.isArray(j.result) ? j.result : [j.result || j];
      const urls = list.map((x) => x && (x.url || (x.images && x.images[0] && x.images[0].url))).filter(Boolean);
      if (!urls.length) throw new Error('no url');
      return Promise.all(urls.map(async (u) => Buffer.from(await (await fetch(u, { signal: AbortSignal.timeout(150000) })).arrayBuffer())));
    } catch (e) { last = e; if (e.fatal) throw e; console.log('    attempt ' + attempt + ' failed: ' + e.message); await sleep(6000 * attempt); }
  }
  throw last;
}
fs.mkdirSync(OUT, { recursive: true });
for (const k of (argv.length ? argv : Object.keys(BOX))) {
  if (!BOX[k]) { console.log('skip unknown', k); continue; }
  if (fs.existsSync(path.join(OUT, `${k}_2.png`))) { console.log('have', k); continue; }
  process.stdout.write(k + ' ... ');
  const open = k.endsWith('_open');
  const src = fs.readFileSync(path.join(process.env.CHEST_OPEN_FROM || DEST, (open ? k.replace('_open', '') : 'chest_wood') + '.webp'));   // closed tiers edit the new wooden chest; opens edit their own closed chest
  const bufs = [];
  for (let i = 0; i < 2; i++) bufs.push(...(await edit(src, open ? promptOpen(k) : prompt(k), 1)));   // n=1 twice: two independent takes
  for (let i = 0; i < bufs.length; i++) fs.writeFileSync(path.join(OUT, `${k}_${i + 1}.png`), await sharp(bufs[i]).png().toBuffer());
  console.log(bufs.length + ' candidates');
}
