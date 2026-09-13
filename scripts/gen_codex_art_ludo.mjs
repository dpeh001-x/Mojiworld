#!/usr/bin/env node
// Art for the Codex (Y) overhaul, via ludo.ai.
//
// Per user: "this Y codex needs a major major major overhaul to make it AAA standard ... may take
// some inspiration from the world map UI, but this needs to be original and astounding. You can
// generate necessary images from higgsfield or ludo".
//
// Two kinds of asset, because the Codex needs two kinds of surface:
//
//   1. ONE backdrop plate (codex_plate.webp), the way the World Map stands on
//      backgrounds/worldmap_bg_v7.webp. Painted, dark, low-contrast in the middle so text set over
//      it stays readable - it is a surface, not a picture to look at.
//   2. FIVE faction sigils (Sprites/ui/codex/sigil_<id>.webp), transparent, one per standing. The
//      Factions tab currently labels each order with a system emoji; a crest is what an order has.
//
// The sigils are deliberately NOT five variations of one shape: each order's stance is the brief
// (Bastion stands, Academia reads, the Grove keeps time, the Hood leaves, the Lantern waits), so
// the silhouettes must read apart from each other at 44px.
//
//   node scripts/gen_codex_art_ludo.mjs                      # print the prompts, generate nothing
//   node scripts/gen_codex_art_ludo.mjs --generate           # needs LUDO_API_KEY; writes candidates
//   node scripts/gen_codex_art_ludo.mjs --generate --only plate
//   node scripts/gen_codex_art_ludo.mjs --install            # copy the picked rolls into the repo
//
// CODEX_OUT installs into a scratch dir instead of the shared checkout - parallel sessions edit
// this repo, so writing tracked art here is opt-in rather than automatic.
import sharp from 'sharp';
import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const KEEP = join(ROOT, 'scripts', '_tmp_codex_art');
const OUT = process.env.CODEX_OUT || ROOT;
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const KEY = process.env.LUDO_API_KEY;
const argv = process.argv.slice(2), has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

const fetchBuf = async (u) => { const r = await fetch(u, { signal: AbortSignal.timeout(180000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); };

async function poll(res) {
  if (res.status === 402) { console.error('OUT OF LUDO CREDITS'); process.exit(3); }
  if (!res.ok && res.status !== 202) throw new Error(res.status + ' ' + (await res.text()).slice(0, 160));
  let data = await res.json();
  const id = data && (data.job_id || data.jobId || data.id);
  if (res.status !== 202 && !(data && data.status && id && !data.url && !data.images)) return data;
  if (!id) return data;
  for (let i = 0; i < 120; i++) {
    await new Promise((s) => setTimeout(s, 5000));
    const r = await fetch(`${API}/assets/jobs/${id}`, { headers: { Authorization: `ApiKey ${KEY}` }, signal: AbortSignal.timeout(120000) });
    if (!r.ok) continue;
    data = await r.json();
    const st = String(data.status || data.state || '').toLowerCase();
    if (st === 'failed' || st === 'error') throw new Error('job failed: ' + JSON.stringify(data).slice(0, 160));
    if (st === 'completed' || st === 'succeeded' || st === 'done' || data.url || data.images) return data;
  }
  throw new Error('job did not finish');
}
// The finished job answers { status:'succeeded', result:[{url}] } - an ARRAY under result. The
// shardlich generator only ever read result.url, so this reads both shapes.
const urlOf = (d) => (Array.isArray(d) ? d[0]?.url
  : (d?.url || d?.images?.[0]?.url || d?.image_url
     || (Array.isArray(d?.result) ? d.result[0]?.url : d?.result?.url)));

// ---------------------------------------------------------------- the briefs
const PLATE = [
  'A dark illuminated-manuscript page spread, painted, seen flat from directly above, filling the whole frame.',
  'Aged indigo-black vellum with a faint violet and deep-blue bloom through it, gold leaf worn thin at the',
  'corners, a very faint embossed compass rose and constellation lines ghosted into the surface, scattered',
  'gold flecks and old ink stains near the edges.',
  'CRITICAL: the CENTRE of the image is nearly empty and almost flat - a calm dark field with no detail, no',
  'text, no letters, no writing, no figures - because text will be printed over it. All the detail, the gold',
  'and the ornament live in the outer fifth of the frame and fade out before they reach the middle.',
  'Deep navy #0d0a1c to violet-black, antique gold #c8a05a accents only. Moody, cold, expensive.',
  'No characters, no creatures, no book edges, no page curl, no borders drawn as a frame, no watermark, no text.',
].join(' ');

const SIGIL_BASE = [
  'Heraldic faction sigil for a dark-fantasy game UI. ONE emblem, centred, on a FULLY TRANSPARENT background -',
  'no scene, no shield backdrop unless described, no text, no letters, no watermark, no border.',
  'Struck-metal look: the emblem reads as a single cast medallion in antique gold and dark patina, flat',
  'graphic shapes with a thin dark outline, a clean bold silhouette that still reads at 44 pixels.',
  'Symmetrical, engraved, restrained - a crest, not an illustration.',
].join(' ');

const SIGILS = [
  { id: 'bastion', tint: '#ffcc66', brief: 'A tower merlon wall seen head-on with a straight sword standing point-down through it, two small oath-ribbons either side. The order that refused to drift: it STANDS. Warm antique gold on dark bronze.' },
  { id: 'academia', tint: '#88aaff', brief: 'An open book with a compass-star rising out of its pages and three small orbiting rings around the star. The order that tried to think a dream into being: it READS. Pale steel blue and silver on dark blue patina.' },
  { id: 'grove', tint: '#88dd88', brief: 'A ring of four leaves arranged as the four seasons around a small closed bud at the centre, one leaf bare, one budding, one full, one falling. The order that kept the seasons honest: it REHEARSES. Jade green and soft gold.' },
  { id: 'hood', tint: '#aa66cc', brief: 'An empty raised hood in profile dissolving on one side into three thin drifting ribbons, a single small dagger crossing behind it. The order that left the conversation: it MOVES. Dark violet and dull silver.' },
  { id: 'lantern', tint: '#ffaa44', brief: 'A hanging paper lantern with its flame shown as a small star, hung from a broken chain link whose far end is missing. Those who did not finish, lighting the way for those who might: it WAITS. Warm amber and old copper.' },
];

if (!has('--generate') && !has('--install')) {
  console.log('PLATE:\n' + PLATE + '\n');
  for (const s of SIGILS) console.log(`SIGIL ${s.id} (${s.tint}):\n${SIGIL_BASE} ${s.brief}\n`);
  console.log('--generate (LUDO_API_KEY) | --install');
  process.exit(0);
}

async function genImage(prompt, ar, style) {
  const img = await poll(await fetch(`${API}/assets/image`, {
    method: 'POST', signal: AbortSignal.timeout(600000),
    headers: { Authorization: `ApiKey ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: ar, n: 1, augment_prompt: false, prompt }),
  }));
  const u = urlOf(img);
  if (!u) throw new Error('no url in response');
  return await fetchBuf(u);
}

if (has('--generate')) {
  if (!KEY) { console.error('LUDO_API_KEY required'); process.exit(1); }
  await mkdir(KEEP, { recursive: true });
  const only = arg('--only');
  const rolls = Number(arg('--rolls') || 2);
  if (!only || only === 'plate') {
    for (let r = 1; r <= rolls; r++) {
      const f = join(KEEP, `plate_roll${r}.png`);
      if (existsSync(f)) { console.log('plate roll' + r + ' exists, skipping'); continue; }
      process.stdout.write(`plate roll ${r} ... `);
      try { await writeFile(f, await sharp(await genImage(PLATE, 'ar_16_9', 'concept_art')).png().toBuffer()); console.log('ok'); }
      catch (e) { console.log('FAILED ' + e.message); }
    }
  }
  for (const s of SIGILS) {
    if (only && only !== 'sigils' && only !== s.id) continue;
    for (let r = 1; r <= rolls; r++) {
      const f = join(KEEP, `sigil_${s.id}_roll${r}.png`);
      if (existsSync(f)) { console.log(`sigil ${s.id} roll${r} exists, skipping`); continue; }
      process.stdout.write(`sigil ${s.id} roll ${r} ... `);
      try { await writeFile(f, await sharp(await genImage(SIGIL_BASE + ' ' + s.brief, 'ar_1_1', 'sprite')).png().toBuffer()); console.log('ok'); }
      catch (e) { console.log('FAILED ' + e.message); }
    }
  }
  console.log('candidates in ' + KEEP);
}

if (has('--install')) {
  // --install --plate 2 --bastion 1 --academia 2 ...
  await mkdir(join(OUT, 'backgrounds'), { recursive: true });
  await mkdir(join(OUT, 'Sprites', 'ui', 'codex'), { recursive: true });
  const p = arg('--plate');
  if (p) {
    const src = join(KEEP, `plate_roll${p}.png`);
    await sharp(src).resize(2048, 1152, { fit: 'cover' }).webp({ quality: 86 }).toFile(join(OUT, 'backgrounds', 'codex_plate.webp'));
    console.log('installed backgrounds/codex_plate.webp from roll ' + p);
  }
  for (const s of SIGILS) {
    const n = arg('--' + s.id);
    if (!n) continue;
    const src = join(KEEP, `sigil_${s.id}_roll${n}.png`);
    await sharp(src).resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 92, alphaQuality: 100 }).toFile(join(OUT, 'Sprites', 'ui', 'codex', `sigil_${s.id}.webp`));
    console.log(`installed Sprites/ui/codex/sigil_${s.id}.webp from roll ${n}`);
  }
}
