#!/usr/bin/env node
// DJ Vinyl's console: one icon per BGM (46), plus the console's little drift-car badge.
// =============================================================================
// Per user: "make the jukebox design WAY more hip popular and stylish with drift phonk vibes, make sure that each BGM
// also has a unique icon, make it like DJ console concept where each button on the DJ console plays a specific music",
// then, on a photo of a pad controller: "Sort of this kind of interface: make it simple and cute, well mapped and
// organised". Each pad on the console carries its track's own icon - the place the theme plays, drawn as one object.
// Same recipe as scripts/gen_hud_stat_icons.mjs / gen_mobile_deck_icons.mjs: a short subject-first prompt + the HUD
// icon style tail, verbatim, so the pads sit in the game's own icon language. 256 px webp, trimmed and centred.
// Job API (POST -> id, poll /assets/jobs/<id>), job ids kept in a state file so a paid job is never re-posted.
//   node scripts/gen_jukebox_icons.mjs                           # dry-run: prints every prompt
//   node scripts/gen_jukebox_icons.mjs --generate [--out dir] [--only a,b] [--v 2]
// Needs LUDO_API_KEY from the environment (never committed).
// =============================================================================
import { createRequire } from 'node:module';
import { writeFileSync, readFileSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const sharp = require('sharp'); sharp.cache(false);
const argv = process.argv.slice(2);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const OUT = arg('--out') || path.join(process.env.TEMP || '.', 'jukebox_icons');
const V = Number(arg('--v') || 1);
// VERBATIM from gen_hud_stat_icons.mjs / gen_mobile_deck_icons.mjs - the tail keeps the set matched.
const SUFFIX = ' game UI icon for a 2D side-scroller, cel-shaded anime style with bold dark outlines, glossy highlights, vibrant saturated colors, single object icon only, centered, no character, no person, no creature, no hands, no text, fully inside the frame with empty margin on all sides, transparent background';
const SUFFIX_CUTE = SUFFIX.replace('no character, no person, no creature, no hands', 'no person, no hands');   // for the one pad whose subject IS a creature
export const SUBJECTS = {
  // HUB / TOWNS
  town:            'A cute fantasy town clock tower with a red roof and a golden clock face',
  shadowWovenHood: 'A dark purple paper lantern glowing softly in a shadowy alley doorway',
  emeraldVillage:  'A cozy cottage with a green roof and a big glowing emerald gem on top',
  glasswind:       'A small windmill with shining glass crystal blades on a grassy hill',   // v2 - the v1 wind chime read thin on a pad
  azureAcademia:   'A blue graduation cap resting on a stack of blue books',
  azureAbode:      'A cozy little blue house with a chimney and a warm lit window',
  megamall:        'A pink shopping bag with a gold star and a price tag',
  titleTheme:      'A golden hourglass with pink sand and sparkles around it',
  // WILDS / DUNGEONS
  honeycomb:       'A golden honeycomb dripping with honey and a wooden honey dipper',
  lavaCavern:      'An erupting volcano with bright orange lava',
  frozenPeak:      'A snowy mountain peak with a large ice-blue snowflake',
  tide:            'A curling blue ocean wave with white foam',
  dune:            'A green cactus standing on golden sand dunes',
  octopusGrotto:   'A cute round purple octopus',
  krookThrone:     'A crooked golden crown with red jewels',
  hollowSepulchre: 'A stone crypt door with glowing purple runes',
  jadeGrove:       'A small jade-green bonsai tree in a round pot',
  celestialSpire:  'A tall white tower spire rising through clouds with a star on top',
  stardustAtrium:  'A crescent moon wrapped in a swirl of sparkling stardust',
  magmaFoundry:    'An iron anvil with a glowing molten metal ingot',
  coralReef:       'A branch of pink coral with bubbles',
  pearlBathhouse:  'An open clam shell holding a shining white pearl with wisps of steam',
  bloomReaches:    'A big pink blooming flower with green leaves',
  blockland:       'A small stack of colorful toy building blocks',
  trainPQ:         'A little clockwork steam train engine with brass gears',
  expedition:      'A stone watchtower with a red flag on top',
  fungalHollow:    'A cute red mushroom with white spots',
  sunsetCoast:     'A big glowing orange and pink sun setting into calm sea waves',   // v2 - v1 drew only the palm, too close to the lagoon
  skyGarden:       'A floating grassy island with flowers and a tiny waterfall',
  stormCrest:      'A dark thundercloud with a bright yellow lightning bolt',
  candyCanyon:     'A big rainbow swirl lollipop',
  tidalLagoon:     'A tiny sandy island with one palm tree in a turquoise lagoon',
  distortedPortal: 'A swirling glitchy magenta and cyan portal ring',
  boneGraveyard:   'A white skull resting on crossed bones',
  // SACRED / COSMIC
  bastion:         'A stone fortress castle tower with a blue banner',
  bastionThrone:   'A royal golden throne with a red cushion',
  sanctum:         'A white marble temple with glowing golden pillars',
  wayfarer:        'A glowing brass travel lantern with a warm flame',
  void:            'A dark purple void rift tear crackling with violet energy',
  zodiacSanctum:   'A golden zodiac wheel with twelve star symbols',
  zodiacHall:      'A crystal ball on a golden stand with a constellation inside',
  // BOSS FIGHTS
  boss:            'Two crossed swords over a red shield',
  zodiacBoss:      'A glowing golden ram horn helmet with stars',
  ascension:       'A pair of white angel wings around a glowing golden gate',
  gravitosArena:   'A black singularity sphere with glowing blue gravity rings and tiny orbiting planets',
  echoArenas:      'A cracked hand mirror with rippling echo sound rings',
  // the console's badge (not a track)
  _badge:          'A cute little hot-pink sports car drifting sideways with a big puff of pink tire smoke',
};
const CREATURE = new Set(['octopusGrotto']);
const SIZE = 256;

const only = arg('--only') ? new Set(arg('--only').split(',')) : null;
const JOBS = Object.entries(SUBJECTS).filter(([k]) => !only || only.has(k)).map(([k, s]) => ({ key: k, v: V, prompt: s + (CREATURE.has(k) ? SUFFIX_CUTE : SUFFIX) }));
if (!argv.includes('--generate')) { for (const j of JOBS) console.log(`${j.key}_v${j.v}: ${j.prompt.slice(0, 120)}...`); console.log(`\n${JOBS.length} jobs (0.5 credit each). Re-run with --generate (needs LUDO_API_KEY).`); process.exit(0); }
const KEY = process.env.LUDO_API_KEY; if (!KEY) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
mkdirSync(path.join(OUT, 'raw'), { recursive: true });
const STATE_F = path.join(OUT, 'jobs_state.json');
const state = existsSync(STATE_F) ? JSON.parse(readFileSync(STATE_F, 'utf8')) : {};
const saveState = () => { writeFileSync(STATE_F + '.tmp', JSON.stringify(state, null, 1)); renameSync(STATE_F + '.tmp', STATE_F); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const urlOf = (d) => Array.isArray(d) ? (d[0] && d[0].url) : (d && (d.url || (d.images && d.images[0] && d.images[0].url) || (Array.isArray(d.result) && d.result[0] && d.result[0].url)));

async function submit(job) {
  for (let busy = 0; ; busy++) {
    const res = await fetch(`${API}/assets/image`, { method: 'POST', headers: { Authorization: `ApiKey ${KEY}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(120000),
      body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt: job.prompt }) });
    if (res.status === 402) throw new Error('OUT OF CREDITS (402)');
    if (res.status === 429) { await res.text().catch(() => ''); if (busy > 30) throw new Error('queue stayed full'); await sleep(15000); continue; }
    const txt = await res.text();
    if (!res.ok) throw new Error(`POST ${res.status}: ${txt.slice(0, 140)}`);
    return JSON.parse(txt);
  }
}
async function poll(id) {
  const t0 = Date.now(); let wait = 5000;
  for (;;) {
    await sleep(wait);
    const r = await fetch(`${API}/assets/jobs/${id}`, { headers: { Authorization: `ApiKey ${KEY}` }, signal: AbortSignal.timeout(30000) });
    if (r.status === 429) { await r.text().catch(() => ''); wait = Math.min(30000, wait * 2 + Math.random() * 3000); continue; }
    if (!r.ok) throw new Error(`job ${id}: ${r.status}`);
    const j = await r.json();
    if (j.status === 'succeeded') return j;
    if (j.status === 'failed' || j.status === 'cancelled') throw new Error(`job ${id} ${j.status}`);
    if (Date.now() - t0 > 900000) throw new Error(`job ${id} still ${j.status} after 900 s`);
    wait = Math.min(15000, Math.max(5000, Number(j.poll_after_ms) || 6000));
  }
}
async function run(job) {
  const name = `${job.key}_v${job.v}`, dst = path.join(OUT, name + '.webp');
  if (existsSync(dst)) return name + ': exists';
  let id = state[name] && state[name].id, data = null;
  if (!id) { const r = await submit(job); if (urlOf(r)) data = r; else if (r && r.id) { id = r.id; state[name] = { id, at: Date.now() }; saveState(); } else throw new Error('no job id'); }
  if (!data) data = await poll(id);
  const url = urlOf(data); if (!url) throw new Error('no url');
  const buf = Buffer.from(await (await fetch(url, { signal: AbortSignal.timeout(120000) })).arrayBuffer());
  writeFileSync(path.join(OUT, 'raw', name + '.png'), buf);
  const trimmed = await sharp(buf).ensureAlpha().trim({ threshold: 8 }).png().toBuffer();
  const inner = Math.round(SIZE * 0.88);
  const fitted = await sharp(trimmed).resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: fitted, gravity: 'center' }]).webp({ quality: 90, alphaQuality: 100 }).toFile(dst);
  return name + ': ok';
}
const results = await Promise.allSettled(JOBS.map((j, i) => sleep(i * 700).then(() => run(j))));
results.forEach((r, i) => console.log(r.status === 'fulfilled' ? r.value : `${JOBS[i].key}_v${JOBS[i].v}: FAIL ${r.reason && r.reason.message}`));
process.exit(results.some((r) => r.status === 'rejected') ? 2 : 0);
