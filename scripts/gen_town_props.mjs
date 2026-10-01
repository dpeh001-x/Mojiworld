// Town landmark props (v0.30.1510; flat front view, bold black outline, transparent bg) via ludo.ai - the gen_objects_flat.mjs recipe.
// Prompts live in scripts/town_props_desc.json ({ key: { d: description, ar: aspect } }): 28 map props and 15 Zodiac Sanctum pieces
// (twelve gold sign statues, two crests, the hanging armillary sphere). Two takes each; the picks are in town_props_picks.json.
//   LUDO_API_KEY=... node scripts/gen_town_props.mjs gen <n> key [key ...]  -> scripts/_tmp_town_props/raw/<key>_<i>.png (raw first, untouched)
//   node scripts/fit_town_props.mjs                                          -> scripts/_tmp_town_props/out/<key>.webp + meta.json
import fs from 'node:fs'; import path from 'node:path';
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
const RAW = path.join(HERE, '_tmp_town_props', 'raw'); fs.mkdirSync(RAW, { recursive: true });
const DESC = JSON.parse(fs.readFileSync(path.join(HERE, 'town_props_desc.json'), 'utf8'));
const CAMERA = 'CRITICAL CAMERA: a flat, straight-on FRONT view for a 2D side-scrolling platformer game - the camera looks at the object '
  + 'exactly from the front at eye level, like a theatre flat. NO 3/4 view, NO side face visible, NO isometric, no vanishing point, no '
  + 'perspective: every front edge is horizontal or vertical, the tops are at most a thin sliver, and the object is symmetric left to right '
  + 'wherever the object itself is symmetric.';
const BOLD = 'Clean polished cartoon game-prop art: a BOLD, clean, solid black ink outline of even thickness around the whole silhouette '
  + 'and around every part - thick and clearly readable like a classic cartoon game sticker, but not a chunky band - and NO white border '
  + 'outside the black outline. Smooth flat colour fills with one soft shade and a small highlight, simple readable shapes, minimal '
  + 'texture, no grain, no noise, no painterly brushwork.';
const STYLE = 'The object\'s own natural colours (no neon, no rainbow). A single object, centred, full object visible, transparent '
  + 'background, no ground, no floor, no cast shadow, no text.';
const argv = process.argv.slice(2);
if (argv[0] !== 'gen' || !argv[2]) { console.error('usage: gen <n> key...'); process.exit(1); }
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
const work = keys.map(async (k) => {
  if (!DESC[k]) { console.log('skip unknown', k); return; }
  const have = fs.readdirSync(RAW).filter((f) => f.startsWith(k + '_')).length;
  try {
    const bufs = await generate({ image_type: 'sprite', art_style: 'Cel-Shaded', perspective: 'Side-Scroll', aspect_ratio: DESC[k].ar || 'ar_1_1',
      n: N, augment_prompt: false, prompt: `${DESC[k].d}. ${CAMERA} ${BOLD} ${STYLE}` });
    bufs.forEach((b, i) => fs.writeFileSync(path.join(RAW, `${k}_${have + i + 1}.png`), b));
    console.log(k, bufs.length);
  } catch (e) { console.log(k, 'FAILED', e.message); }
});
await Promise.all(work);
