// Column-strike TELEGRAPH sprites (ludo.ai text->sprite).
//
// Per user: "For boss column strikes, generate boss specific sprites to
// replace the generic markouts using ludo.ai." The v0.29.918 zone telegraph
// drew every boss pillar as the same procedural fill+rim; these are per-caster
// warning pillars for the zone itself — distinct from the fx_col_* STRIKE
// beams, which fire after the telegraph.
// v0.30.x - per user, "make the telegraph warning art for these columns match too" (after the ten fx_col_* strike
// beams were redrawn) and "Add warning pillars" for the non-boss column casters, which used to fire unmarked: six new
// warnings (Path's Bane, Archon, the Tomb Hexer, Blight Elder, the Ossuary Tyrant, the Tomb Wraith) and the
// Sovereign's and the zodiac fallback's rethemed to their new beams. Every theme is in SATURATED colour - the sprite
// matte keys pale white light out as background. Now async-job ludo, raws saved before fitting.
// v0.30.1387 - per user, "the bottom of the warning pillar can look more flat 2d": the rune ring ludo draws at the base is seen from
// above at 3/4, so the fit runs scripts/flatten_tg_col_base.mjs, which unrolls it into a flat side-view band. The
// prompt keeps asking for the ring - asking for a side-view base instead gave plain stripe pillars.
//
// A telegraph must read as a WARNING, not the attack: ghostly, translucent
// core, hard bright edges, a rune ring at the base where the pillar will land.
// The draw path alpha-ramps it with the windup and keeps the white rim flare,
// so the art carries theme while the timing read stays systemic.
//   node scripts/gen_col_telegraphs.mjs                      dry run: the plan
//   node scripts/gen_col_telegraphs.mjs --generate [--only a,b] [--candidates N --out <dir>]
//   node scripts/gen_col_telegraphs.mjs --from-raw <png> --only <key>   fit a saved raw and install it
import { mkdir, writeFile, rename, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { flatten } from './flatten_tg_col_base.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(repoRoot, 'Sprites', 'fx');
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const apiKey = process.env.LUDO_API_KEY;
const has = (f) => process.argv.includes(f);
const arg = (f) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : null; };

const BASE = 'game vfx sprite, tall vertical DANGER ZONE telegraph pillar, a ghostly translucent '
  + 'column of warning light rising the full height of the frame, hard bright glowing edge '
  + 'stripes down both sides, a glowing rune ring on the ground at the base, faint chevron '
  + 'arrows flowing upward inside the column, semi-transparent wispy core so the background '
  + 'shows through, ';
const TAIL = ', ominous but clearly a warning marker not an explosion, vibrant cartoon fantasy '
  + 'style, crisp thick outline, single centered vertical column, transparent background, no text';

const JOBS = [
  { key: 'legosaurus', file: 'tg_col_legosaurus.webp',
    theme: 'molten toy-brick theme: lava-orange and ember-red light, tumbling translucent toy blocks and brick studs caught inside the column, cracked magma seams in the base ring' },
  { key: 'barnaby', file: 'tg_col_young_confused_barnaby.webp',
    theme: 'lost-sentinel sandstone theme: dusty gold and warm amber light, drifting question-mark motes and crumbling watchtower brick fragments inside the column, worn stone sigil base ring' },
  { key: 'arbiter', file: 'tg_col_towerArbiter.webp',
    theme: 'judgment-of-the-tower theme: radiant gold and white light, floating scales-of-justice glints and gavel sparks inside the column, ornate golden law-sigil base ring' },
  // rethemed to the v0.30.x strike beams (was "pale cream and ice-white starlight" / "deep violet and indigo")
  { key: 'sovereign', file: 'tg_col_towerSovereign.webp',
    theme: 'Sovereign of the Spire theme: rich saturated ivory-gold (#f0c860) and warm amber light, tumbling golden crown shards and gilded filigree glints inside the column, regal golden crown-sigil base ring' },
  { key: 'zodiac', file: 'tg_col_zodiac.webp',
    theme: 'zodiac cosmic theme: deep blue (#3a6aff) cosmic starlight with violet (#8a5aff) nebula swirls, twinkling constellation lines and small zodiac glyphs inside the column, glowing astrological wheel base ring' },
  // the non-boss column casters (per user, "Add warning pillars")
  { key: 'pathsBane', file: 'tg_col_pathsBane.webp',
    theme: 'withered reaper tomb theme: sickly withered green (#88aa66) and jade light, falling hourglass sand and faint scythe-arc streaks inside the column, cracked gravestone rune base ring' },
  { key: 'archon', file: 'tg_col_archon.webp',
    theme: 'celestial judgement theme: rich saturated gold (#ffc233) and amber light, drifting white feathers and halo-ring glints inside the column, ornate winged halo sigil base ring' },
  { key: 'towerHexer', file: 'tg_col_towerHexer.webp',
    theme: 'tomb hex curse theme: violet (#c88aff) and deep purple light, floating curse runes and coiling purple smoke inside the column, hexagram curse-circle base ring' },
  { key: 'blightElder', file: 'tg_col_blightElder.webp',
    theme: 'blight crystal theme: jade-green (#88cc66) light with faceted crystal edges, drifting blight spores and glowing seed pods inside the column, mossy root-and-crystal base ring' },
  { key: 'ossuaryTyrant', file: 'tg_col_ossuaryTyrant.webp',
    theme: 'ossuary bone theme: warm saturated bone-amber (#d8b878) light, tumbling bone shards and small skulls inside the column, a ring of skulls and bones at the base' },
  // the Master Conductor is a boss but never had one - his windup drew the generic procedural pillar
  { key: 'pqConductor', file: 'tg_col_pqConductor.webp',
    theme: 'clockwork railway departure-signal theme: cold signal-lamp blue (#88aaee) and deep navy light, ghostly clock hands, brass gear outlines and punched ticket stubs inside the column, a brass railway-signal dial as the base ring' },
  { key: 'tombWraith', file: 'tg_col_tombWraith.webp',
    theme: 'tomb wraith theme: ghostly lime-green (#aaff77) spirit light, coiling wraith wisps and grave-dust motes inside the column, gravestone rune base ring' },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function fetchBuf(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(90000) });
  if (!r.ok) throw new Error('fetch ' + r.status);
  return Buffer.from(await r.arrayBuffer());
}
// ludo's image endpoint answers 202 + a job: poll GET /assets/jobs/{id}?wait=30 (a sync 200 is returned as-is)
async function ludoResult(res) {
  if (!res.ok) throw new Error(`image ${res.status}: ${(await res.text()).slice(0, 140)}`);
  const j = await res.json();
  if (res.status !== 202 || !j.id) return j;
  for (let i = 0; i < 40; i++) {
    const r = await fetch(`${API}/assets/jobs/${j.id}?wait=30`, { headers: { Authorization: `ApiKey ${apiKey}` }, signal: AbortSignal.timeout(60000) });
    if (!r.ok) throw new Error(`job HTTP ${r.status}`);
    const q = await r.json();
    if (q.status === 'succeeded') return q.result;
    if (q.status === 'failed' || q.status === 'cancelled') throw new Error('job ' + q.status + ': ' + JSON.stringify(q.error || '').slice(0, 120));
    await sleep(Math.max(1000, q.poll_after_ms || 2000));
  }
  throw new Error('job timed out');
}
// The zone is a stretched rect, so fill the frame: fit 'fill' on purpose - a pillar reads fine stretched, and the
// edge stripes must reach the rim.
async function fit(raw) {
  const W = 288, H = 512;
  let content; try { content = await sharp(raw).trim().toBuffer(); } catch { content = raw; }
  const inner = await sharp(content).resize(W, H, { fit: 'fill', withoutEnlargement: false }).png().toBuffer();
  let out = await sharp(inner).webp({ quality: 92 }).toBuffer();
  { const f = await flatten(out); if (!f.skipped) out = f.img; }   // the 3/4 base ring -> a flat side-view band
  const { data: px, info } = await sharp(out).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let clear = 0; for (let i = 3; i < px.length; i += 4) if (px[i] < 20) clear++;
  return { out, pct: 100 * clear / (info.width * info.height) };
}
async function writeAtomic(f, buf) { await mkdir(dirname(f), { recursive: true }); await writeFile(f + '.tmp', buf); await rename(f + '.tmp', f); }

async function gen(job, k, outDir) {
  const dest = outDir ? join(outDir, `${job.key}_${k}.webp`) : join(DIR, job.file);
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      // tall ratio first; some image_types reject it - square fallback, and the fit re-imposes the pillar shape
      const ratio = attempt >= 3 ? 'ar_1_1' : 'ar_9_16';
      const res = await fetch(`${API}/assets/image`, {
        method: 'POST',
        headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: ratio, n: 1, augment_prompt: false, prompt: BASE + job.theme + TAIL }),
        signal: AbortSignal.timeout(120000),
      });
      const data = await ludoResult(res);
      const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
      if (!url) throw new Error('no url in result');
      const raw = await fetchBuf(url);
      await writeAtomic(join(outDir || join(repoRoot, 'scripts', '_tmp_tg_raw'), 'raw', `${job.key}_${k}_a${attempt}.png`), raw);   // raw first
      const r = await fit(raw);
      await writeAtomic(dest, r.out);
      console.log(`ok -> ${dest} 288x512 ${r.out.length}b, transparent ${r.pct.toFixed(1)}% (ratio ${ratio})`);
      if (r.pct < 8) console.warn(`   WARNING: ${job.key} is nearly opaque - likely a solid backdrop, inspect it`);
      return;
    } catch (e) {
      lastErr = e; console.error(`${job.key} #${k} attempt ${attempt}: ${e.message}`);
      if (/ 402/.test(e.message)) break;
      if (attempt < 4) await sleep(4000 * attempt);
    }
  }
  console.error(`FAIL ${job.key} #${k}: ${lastErr && lastErr.message}`); process.exitCode = 2;
}

const only = arg('--only');
const jobs = JOBS.filter((j) => !only || only.split(',').includes(j.key));
if (arg('--from-raw')) {
  if (jobs.length !== 1) { console.error('--from-raw needs exactly one --only key'); process.exit(1); }
  const r = await fit(await readFile(arg('--from-raw')));
  await writeAtomic(join(DIR, jobs[0].file), r.out);
  console.log(`installed ${jobs[0].file}: transparent ${r.pct.toFixed(1)}%`); process.exit(0);
}
if (!has('--generate')) {
  console.log('# column-strike telegraph pillars (ludo.ai)\n');
  for (const j of jobs) console.log(`  ${j.key.padEnd(14)} -> Sprites/fx/${j.file}`);
  console.log('\n# --generate [--only a,b] [--candidates N --out <dir>] | --from-raw <png> --only <key>');
  process.exit(0);
}
if (!apiKey) { console.error('LUDO_API_KEY not set'); process.exit(1); }
const outDir = arg('--out'), N = Math.max(1, +(arg('--candidates') || 1));
for (const j of jobs) for (let k = 1; k <= (outDir ? N : 1); k++) { await gen(j, k, outDir); await sleep(800); }
console.log('done.');
