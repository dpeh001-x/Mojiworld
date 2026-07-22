#!/usr/bin/env node
// IP-SAFE REPLACEMENT SPRITES (ludo.ai text->sprite).
// Replaces two monster designs that read as protected characters:
//   seasponge  (alias 'ogsponge') — the old art is a yellow rectangular sponge
//                                   with lashed eyes: reads as SpongeBob.
//   kingKrook  (King Koopaloo)    — the old art is a green shell-backed tyrant
//                                   with a red mohawk: reads as Bowser.
// Both replacements are designed from scratch to share NO signature element
// with those characters (form, palette and silhouette all deliberately differ)
// while still reading as "sea sponge monster" and "ember desert tyrant".
//
//   node scripts/gen_ip_safe_sprites.mjs             # dry-run (prints prompts)
//   node scripts/gen_ip_safe_sprites.mjs --generate  # needs LUDO_API_KEY
//   flags: --only <key>   --n <candidates, default 3>
// Output -> scripts/_ipsafe_review/<key>_v<i>.webp  (review, then install)
// =============================================================================
import sharp from 'sharp';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(repoRoot, 'scripts', '_ipsafe_review');
const argv = process.argv.slice(2);
const has = f => argv.includes(f);
const arg = f => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

const PREFIX =
  'Chibi anime MONSTER sprite for a 2D platformer in the Mojiworld aesthetic, shown in full, SIDE-ON three-quarter ' +
  'view facing RIGHT. Pure transparent background, alpha only — no scene, no ground, no shadow, no text, no watermark. ' +
  '768x768 square canvas. Soft painterly cel-shaded anime style, bold black outlines, vibrant saturated colors. ' +
  'The WHOLE creature sits fully inside the frame, centered, at ~72% scale with a generous empty transparent margin ' +
  'on all sides — nothing cropped. Reads clearly at small in-game size. ';

const SPECS = {
  // --- replaces the SpongeBob-like 'ogsponge' -------------------------------
  ogsponge: {
    dir: 'monsters',
    desc:
      'an ORIGINAL cute REEF CORAL MONSTER — a living lump of deep-sea tube coral with a face. ' +
      'SHAPE: a soft rounded organic MOUND, a little taller than it is wide, with a knobbly uneven outline; the top ' +
      'is crowned with a cluster of three short hollow coral tubes with soft rolled rims. Its whole surface is ' +
      'riddled with round pits and pores of many sizes, like porous pumice rock. ' +
      'FACE: two plain ROUND monster eyes with big black pupils and small white highlights set into the front of the ' +
      'mound, and one small simple curved frowning mouth below them. Grumpy sleepy expression. ' +
      'COLORS: deep coral-orange and rose-magenta with teal-green algae creeping up from the base. ' +
      'STRICTLY AVOID: no yellow, no square or rectangular or boxy body, no wooden barrel, no cask, no metal hoops, ' +
      'no wooden planks, no eyelashes, no long lashes, no buck teeth, no shirt, no collar, no necktie, no shorts, ' +
      'no trousers, no shoes, no arms, no hands, no legs, no feet. Just a knobbly porous coral mound with a face and ' +
      'a few short stubby coral nubs around its base.',
  },
  // --- replaces the Bowser-like 'kingKrook' ---------------------------------
  kingKrook: {
    dir: 'bosses',
    desc:
      'an ORIGINAL colossal EMBER DESERT TORTOISE TYRANT boss — a hulking armored reptile colossus standing heavy on ' +
      'four thick pillar legs with a low broad stance. Its back carries a cracked BLACK OBSIDIAN and charcoal-basalt ' +
      'rock dome riven with glowing molten ember-orange fissures that pour heat-shimmer and sparks — rough natural ' +
      'volcanic ROCK plating, blunt and jagged, NOT a smooth round turtle shell, NOT an orange shell, NOT white spikes. ' +
      'Skin is dark charcoal-grey and ash, cracked like drought earth with ember-orange light glowing from within the ' +
      'cracks, dusted with pale sandstone sand. Broad blunt beaked reptilian jaw, heavy brow, molten ember-glowing ' +
      'eyes. It is COMPLETELY BALD — no hair, no mane, no mohawk, NO horns; instead a rough crown of jagged black ' +
      'basalt shards juts from its skull and along its spine. Palette strictly charcoal-black, ash-grey, sandstone ' +
      'tan and molten ember orange — absolutely NO green skin, NO red hair, NO cream belly plates, NO spiked collar. ' +
      'Ancient, immovable, furnace-hot desert warlord.',
  },
};

const only = arg('--only');
const N = Number(arg('--n') || 3);
const keys = Object.keys(SPECS).filter(k => !only || k === only);

if (!has('--generate')) {
  for (const k of keys) { console.log(`## ${k} -> ${SPECS[k].dir}\n`); console.log(PREFIX + SPECS[k].desc); console.log(''); }
  console.log(`# ${keys.length * N} images (~${keys.length * N * 0.5} credits). Re-run with --generate.`);
  process.exit(0);
}
const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const TIMEOUT = Number(process.env.LUDO_REQ_TIMEOUT_MS || 150000);
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function fetchBuf(url) { const r = await fetch(url, { signal: AbortSignal.timeout(90000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); }

async function genOne(key, idx) {
  const prompt = PREFIX + SPECS[key].desc;
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`${API}/assets/image`, {
        method: 'POST', headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT),
        body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt }),
      });
      if (!res.ok) throw new Error(`image ${res.status}: ${(await res.text()).slice(0, 140)}`);
      const data = await res.json();
      const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
      if (!url) throw new Error('no url');
      const raw = await fetchBuf(url);
      let content; try { content = await sharp(raw).trim().toBuffer(); } catch { content = raw; }
      const CANVAS = 768, INNER = Math.round(CANVAS * 0.82);
      const inner = await sharp(content).resize(INNER, INNER, { fit: 'inside', withoutEnlargement: false }).png().toBuffer();
      const out = await sharp({ create: { width: CANVAS, height: CANVAS, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite([{ input: inner, gravity: 'center' }]).webp({ quality: 92 }).toBuffer();
      await mkdir(OUT, { recursive: true });
      await writeFile(join(OUT, `${key}_v${idx}.webp`), out);
      return 'ok';
    } catch (e) { lastErr = e; if (attempt < 3) await sleep(4000 * attempt); }
  }
  throw lastErr;
}

for (const k of keys) {
  for (let i = 0; i < N; i++) {
    process.stdout.write(`${k}_v${i} ... `);
    try { await genOne(k, i); console.log('OK'); }
    catch (e) { console.log('FAIL: ' + (e && e.message)); }
    await sleep(600);
  }
}
console.log('\nDone -> scripts/_ipsafe_review/');
