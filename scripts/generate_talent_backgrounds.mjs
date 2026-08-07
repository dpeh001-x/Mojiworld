#!/usr/bin/env node
// Per-talent CARD BACKGROUNDS (ludo.ai) — one atmospheric scene per talent,
// painted behind its card in the Choose Your Talent picker.
// Output -> Sprites/talents/bg/<id>.webp (512x384).
//   node scripts/generate_talent_backgrounds.mjs                # dry-run
//   node scripts/generate_talent_backgrounds.mjs --generate     # all (skip-existing)
//   node scripts/generate_talent_backgrounds.mjs --generate --only bulwark --force
// Needs LUDO_API_KEY.
import sharp from 'sharp';
import { writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(repoRoot, 'Sprites', 'talents', 'bg');
const W = 512, H = 384;
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

// These sit BEHIND white body text and a bright gold title, with a dark scrim
// over them. So: no subject in the centre, low contrast, deep values, and
// nothing that reads as a character or a UI element.
// The API only accepts image_type 'sprite' (every other value 400s), and that
// biases hard toward a cut-out object floating on white — the first attempt came
// back as a castle rampart on a blank field. The prompt therefore has to fight
// that bias explicitly and repeatedly: full-bleed, every pixel painted, no
// cutout, no white.
// Two failed calibrations got us here. image_type 'sprite' (the only value the
// API accepts) biases toward a cut-out object on white — attempt 1 returned a
// rampart floating on a blank field. Piling on "NO white, NO cutout" plus
// "deep dark, low contrast, quiet centre" then produced a featureless near-black
// slab: the model obeyed the darkness instructions and had nothing left to draw.
//
// So: ask for the rich, well-lit environment illustration the model is good at,
// say "landscape" rather than negating "sprite", and do the darkening in CSS
// where it belongs. The card scrim is what makes text readable — the art does
// not need to be dim, it needs to be interesting.
const PREFIX = 'A detailed painterly fantasy ENVIRONMENT ILLUSTRATION — a wide landscape scene viewed from a distance, like a game concept-art background plate. ' +
  'The scenery fills the whole rectangular image and continues past all four edges. ' +
  'Rich atmospheric depth with layered foreground, midground and far distance; cinematic lighting; visible brushwork. ' +
  'NO people, NO characters, NO creatures, NO faces, NO close-up objects in front of the camera, NO frames, NO borders, NO UI, NO logo. ' +
  'NO TEXT of any kind: no letters, numbers, words or watermark. ' +
  'The scene is: ';

const BG = {
  // berserker — blood, fury, ruin
  bloodrush:  'a rain-soaked battlefield at dusk, dark crimson pools between broken stones, red mist low to the ground',
  rampage:    'a burning warcamp seen from far off at night, orange embers rising through thick black smoke',
  warbreaker: 'a shattered fortress wall under a bruised storm sky, dust and splintered timber drifting',
  // knight — stone, gold, sanctity
  bulwark:    'a vast dim castle rampart of wet grey stone, cold blue dawn light raking across the battlements',
  crusade:    'a cathedral nave in deep shadow, a single shaft of warm gold light falling through high windows',
  lifewall:   'a quiet keep courtyard at blue hour, soft warm lantern glow from distant windows, gentle mist',
  // ninja — night, smoke, bamboo
  shadowfeet: 'a moonlit bamboo forest at night, pale silver light between dark stalks, drifting ground fog',
  keenedge:   'a dim stone dojo interior at night, faint moonlight on a polished dark floor, deep shadows',
  exploit:    'a shadowed rooftop skyline of tiled pagoda roofs under a cold indigo night sky',
  // assassin — dark alleys, crypt, violet
  cutthroat:  'a narrow rain-slick alley at midnight, deep violet shadows, one distant guttering lamp',
  vampedge:   'a crumbling crypt corridor lit by faint red-violet glow from far below, cobwebs and old stone',
  executioner:'a fog-drowned graveyard at night, leaning headstones fading into cold grey murk',
  // archmage — arcane observatory, void
  overflow:   'a dim arcane observatory, faint cyan glow pooling on dark marble, drifting motes of light',
  archon:     'a deep starfield void with slow violet nebula clouds, dark and vast, sparse distant stars',
  mindspring: 'a still underground lake of luminous blue water in a dark cavern, soft reflected glow',
  // warlock — corruption, hex, eclipse
  soulfeast:  'a dead marsh at night under a sickly green haze, black water and skeletal bare trees far off',
  hexweaver:  'a derelict ritual chamber in deep purple gloom, faint arcane residue glowing on dark walls',
  darkpact:   'a blood-red eclipse hanging over a black barren waste, thin crimson light on distant rock',
  // priest — light, chapel, dawn
  benediction:'a serene chapel interior at dawn, soft warm gold light diffusing through pale mist',
  sanctuary:  'a mountaintop temple silhouette at first light, calm golden haze and layered distant peaks',
  zeal:       'a blazing sunrise over high cloud, deep amber and orange sky, sun low and diffuse',
  // sniper — long range, cold, height
  deadeye:    'a cold misty valley seen from a high ridge at dawn, layered blue-grey distance, very quiet',
  piercing:   'a bleak windswept firing range at overcast dusk, distant dark targets, flat grey light',
  swifthands: 'a dim armoury interior at night, racks of dark shapes out of focus, one weak warm lamp far off',
  // ranger — forest, wild, green
  fleetfoot:  'a deep pine forest at dawn, cool green shafts of light between tall trunks, drifting mist',
  wildheart:  'a dark mossy old-growth grove, heavy green shadow, faint dappled light on wet stone',
  huntsmark:  'a misty forest clearing at blue hour, silhouetted trees fading into cold pale fog',
};

const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
async function fetchBuf(u) { const r = await fetch(u, { signal: AbortSignal.timeout(120000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); }

let keys = Object.keys(BG);
const only = arg('--only');
if (only) keys = keys.filter((k) => only.split(',').some((o) => (o.endsWith('*') ? k.startsWith(o.slice(0, -1)) : k === o)));
if (!keys.length) { console.error('No matching talents.'); process.exit(1); }
if (!has('--generate')) {
  console.log(`# ${keys.length} talent card backgrounds -> Sprites/talents/bg/<id>.webp (${W}x${H})\n`);
  for (const k of keys) console.log('  ' + k);
  console.log('\n# Re-run with --generate (needs LUDO_API_KEY). Flags: --force --only a,b');
  process.exit(0);
}

const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const TIMEOUT = Number(process.env.LUDO_REQ_TIMEOUT_MS || 180000);
const force = has('--force');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Every other generator here uses ar_1_1 because that is what sprites want.
// A card is landscape, so ask for 4:3 and fall back to square (cover-cropped)
// if the API rejects the ratio rather than failing the whole run.
const RATIOS = ['ar_4_3', 'ar_1_1'];

async function gen(k) {
  const bp = join(OUT_DIR, `${k}.webp`);
  if (!force && await exists(bp)) return 'skip';
  let last;
  for (let a = 0; a < 4; a++) {
    const ratio = RATIOS[Math.min(a, RATIOS.length - 1)];
    try {
      const res = await fetch(`${API}/assets/image`, {
        method: 'POST', headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(TIMEOUT),
        body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: ratio, n: 1, augment_prompt: false, prompt: PREFIX + BG[k] + '.' }),
      });
      if (!res.ok) { const t = await res.text(); if (/\b402\b/.test(t)) throw new Error('402 OUT OF CREDITS'); throw new Error(res.status + ': ' + t.slice(0, 140)); }
      const data = await res.json();
      const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
      if (!url) throw new Error('no url');
      await mkdir(OUT_DIR, { recursive: true });
      // The returned plate is letterboxed — the scene sits inside white bands,
      // a leftover of image_type 'sprite'. Trim the uniform border FIRST (it is
      // keyed off the corner pixel), then cover-crop to the card ratio.
      // Skipping the trim bakes white bars across the top and bottom of the card.
      let img = sharp(await fetchBuf(url));
      try { img = sharp(await img.trim({ threshold: 12 }).toBuffer()); } catch (e) { /* nothing to trim */ }
      await writeFile(bp, await img
        .resize(W, H, { fit: 'cover', position: 'centre' })
        .webp({ quality: 82, effort: 5 }).toBuffer());
      return 'OK';
    } catch (e) { last = e; if (/402/.test(e.message)) throw e; if (a < 3) await sleep(3000 * (a + 1)); }
  }
  throw last;
}

console.log(`Generating ${keys.length} talent card backgrounds (force:${force})...`);
let made = 0, skipped = 0, failed = 0;
for (const k of keys) {
  process.stdout.write(`  ${k} ... `);
  try { const r = await gen(k); if (r === 'skip') { skipped++; console.log('skip'); } else { made++; console.log('OK'); await sleep(350); } }
  catch (e) { failed++; console.log('FAIL: ' + e.message); if (/402/.test(e.message)) { console.log('*** OUT OF CREDITS ***'); process.exit(3); } }
}
console.log(`Done. ${made} made, ${skipped} skipped, ${failed} failed.`);
process.exit(failed ? 2 : 0);
