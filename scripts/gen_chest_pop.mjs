// Pop-punk TREASURE CHESTS (per user: "work on the chest sprites open and unopened to make them look more pop and punk
// style"). Each of the six Sprites/objects/chest_<tier>[_open].webp is restyled with ludo.ai image-edit from ITSELF, so the
// shape, the straight-on front view and the open / closed state carry over; only the rendering changes (thick black ink,
// flat glossy cel colour, the chest's own materials). --pick fits the chosen candidate back into the ORIGINAL art's content
// box on the 768 canvas: drawChests stretches the whole canvas into the chest's box and plants the shadow from the content
// bottom, so the box is what keeps every chest the same size and on the same spot.
//   LUDO_API_KEY=... node scripts/gen_chest_pop.mjs [key ...]      two candidates each -> scripts/_tmp_chest_pop/
//   node scripts/gen_chest_pop.mjs --pick chest_wood=1,chest_gold_open=2 ...
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
// the pre-pop art's content boxes (trim threshold 4) on the 768 canvas: [left, top, width, height]
const BOX = { chest_wood: [75, 147, 616, 464], chest_wood_open: [48, 0, 673, 768], chest_silver: [51, 180, 663, 481],
  chest_silver_open: [0, 124, 768, 644], chest_gold: [76, 189, 615, 426], chest_gold_open: [0, 102, 768, 666] };
const MATERIAL = { wood: 'a brown wooden chest with dark-wood corner trim and a grey iron round clasp plate',
  silver: 'an all-silver polished metal chest with riveted metal bands and an oval metal clasp',
  gold: 'a wooden chest with bright gold metal trim, gold corner bands and a gold lock plate' };
const prompt = (key) => {
  const tier = key.split('_')[1];
  return 'Redraw THIS treasure chest as a bold POP PUNK cartoon game sprite. Keep the same object, the same shape and proportions, the '
    + 'same straight-on front view and the same CLOSED state, and its materials - ' + MATERIAL[tier] + '. Make it clearly more graphic and '
    + 'punchy: a MUCH thicker bold black ink outline (about three times thicker) around the whole chest and every plank, band and plate, '
    + 'flat saturated cel colours with hard-edged shading, big crisp graphic white highlight shapes, a little Ben-Day halftone dot shading '
    + 'in the darkest shadows, and two or three small sticker decals slapped on the front - a hot pink star and a yellow lightning bolt. '
    + 'Keep the chest\'s own colours for its materials; no neon glow, no rainbow. Transparent background, a single object, centred, no '
    + 'ground, no drop shadow, no text.';
};

// The OPEN chests are made from the NEW closed ones (so the decals, ink and colours match between the two states), with
// gen_chest_open.mjs's camera and emptiness rules.
const promptOpen = (key) => {
  const tier = key.split('_')[1];
  return 'Edit THIS treasure chest into its OPEN state. Keep the EXACT same art: ' + MATERIAL[tier] + ', the same pop punk sticker style, '
    + 'the same thick black ink outline, the same hot pink star and yellow lightning bolt sticker decals on the front, the same colours and '
    + 'shading, transparent background. CRITICAL CAMERA: a perfectly STRAIGHT-ON FRONT view, symmetric left to right, exactly like the closed '
    + 'chest - no 3/4 view, no perspective. The lid is HINGED AT THE BACK and swung UP and slightly back so it sits ABOVE the body; we see the '
    + 'flat inner face of the raised lid straight-on. CRITICAL: the chest is EMPTY inside - a plain dark hollow interior with a visible back '
    + 'inner wall and floor; NO coins, NO gold, NO treasure, NO gems, NO glow, NO light rays, no items of any kind. The body stays the same '
    + 'size and shape as the closed chest in the lower part; the open lid adds height above. Single object, centred, no ground, no shadow, no text.';
};
const argv = process.argv.slice(2);
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
  const src = fs.readFileSync(open ? path.join(process.env.CHEST_OPEN_FROM || DEST, k.replace('_open', '') + '.webp') : path.join(process.env.CHEST_SRC || OBJ, k + '.webp'));
  const bufs = [];
  for (let i = 0; i < 2; i++) bufs.push(...(await edit(src, open ? promptOpen(k) : prompt(k), 1)));   // n=1 twice: two independent takes
  for (let i = 0; i < bufs.length; i++) fs.writeFileSync(path.join(OUT, `${k}_${i + 1}.png`), await sharp(bufs[i]).png().toBuffer());
  console.log(bufs.length + ' candidates');
}
