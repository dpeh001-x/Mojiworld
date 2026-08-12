#!/usr/bin/env node
// Quest-TYPE icons for the Quest Journal card slot (ludo.ai text->sprite).
// Output -> Sprites/ui/quest/<type>.webp, drawn into the 36x36 .qj-icon tile.
//   node scripts/gen_quest_type_icons.mjs            # dry-run (prints prompts)
//   node scripts/gen_quest_type_icons.mjs --generate # needs LUDO_API_KEY
//   flags: --force, --only=<type>
//
// Five types, chosen from the MEASURED distribution rather than from the three
// obvious verbs. A talking/exploration/hunting split alone puts 251 of 269
// quests in "hunting" and leaves 4 quests across the other two, so it is a
// default with decorations. The counts that actually exist are:
//   bestiary bounties 122 · class quests 108 · story 21 · boss 14 · talk 3 · visit 1
// so `bounty` earns its own mark and `talk` is widened to include the 20
// hand-in quests that send you back to a person.
//
// Every prompt is written for a 28 px render: ONE silhouette, no fine detail.
// Output 256 px so 2x/3x displays stay crisp.
// =============================================================================
import sharp from 'sharp';
import { writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(repoRoot, 'Sprites', 'ui', 'quest');
const argv = process.argv.slice(2);
const has = f => argv.includes(f);
const only = (argv.find(a => a.startsWith('--only=')) || '').split('=')[1];

const PREFIX = 'Chibi anime game UI ICON in the Mojiworld aesthetic. ' +
  'Pure transparent background, alpha only — no scene, no ground, no text, no watermark, no border frame, no card. ' +
  '768x768 square canvas. Soft painterly cel-shaded anime style, bold black outlines, vibrant saturated colors, ' +
  'warm antique-gold and amber accents to match a fantasy quest journal. ' +
  'ONE single centered object at ~66% scale with generous empty transparent margin on all sides — nothing cropped. ' +
  'Must stay readable shrunk to a TINY 28 pixel icon: one strong bold silhouette, chunky simple shapes, ' +
  'high contrast, NO fine detail, NO thin lines, NO small text, NO tick marks, NO clutter. ';

const ICONS = {
  // v2 — the crossed sword+claw and the dashed treasure map both turned to
  // mush at 28 px: two overlapping objects and a dotted line are exactly the
  // detail the prompt tells the model to avoid. Both are now ONE solid shape.
  hunt:
    'a MONSTER HUNTING mark: a single bold three-toed monster PAW PRINT, one big rounded pad and three ' +
    'chunky claw-tipped toes, deep violet-grey with a warm amber inner glow and a heavy dark outline. ' +
    'One solid silhouette, nothing overlapping it.',
  boss:
    'a BOSS FIGHT mark: a fierce horned monster skull wearing a small crooked gold crown, glowing ' +
    'crimson-red eye sockets, heavy dark outline. Dangerous and imposing, but cute-chunky not gruesome.',
  talk:
    'a CONVERSATION mark: a plump rounded speech bubble in warm cream-parchment with a soft gold rim, ' +
    'a single bright amber sparkle at its top-right corner. Friendly, cozy, inviting.',
  explore:
    'an EXPLORATION mark: a chunky wooden SIGNPOST — one thick upright post with two bold arrow-shaped ' +
    'direction boards pointing opposite ways, warm honey-brown wood with gold nail studs and a heavy dark ' +
    'outline. Blank boards, absolutely no writing. One solid silhouette.',
  bounty:
    'a BOUNTY mark: a hanging wooden bounty tag / wanted plaque with a bold dark monster silhouette on it ' +
    'and a single gold coin resting at its lower corner, a short rope loop at the top. Sturdy and chunky.',
};

const exists = async p => { try { await access(p); return true; } catch { return false; } };
async function fetchBuf(url) { const r = await fetch(url, { signal: AbortSignal.timeout(90000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); }

if (!has('--generate')) {
  console.log('# quest type icons -> Sprites/ui/quest/\n');
  for (const [k, d] of Object.entries(ICONS)) console.log(`## ${k}.webp\n${PREFIX}${d}\n`);
  console.log('# Re-run with --generate (needs LUDO_API_KEY). Flags: --force --only=<type>');
  process.exit(0);
}
const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const force = has('--force');
const TIMEOUT = Number(process.env.LUDO_REQ_TIMEOUT_MS || 150000);
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function genOne(key, desc) {
  const dest = join(DIR, `${key}.webp`);
  if (!force && await exists(dest)) return 'skip';
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(`${API}/assets/image`, {
        method: 'POST',
        headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT),
        body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt: PREFIX + desc }),
      });
      if (!res.ok) throw new Error(`image ${res.status}: ${(await res.text()).slice(0, 140)}`);
      const data = await res.json();
      const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
      if (!url) throw new Error('no url');
      const raw = await fetchBuf(url);
      let content; try { content = await sharp(raw).trim().toBuffer(); } catch { content = raw; }
      const CANVAS = 256, INNER = Math.round(CANVAS * 0.94);
      const inner = await sharp(content).resize(INNER, INNER, { fit: 'inside', withoutEnlargement: false }).png().toBuffer();
      const out = await sharp({ create: { width: CANVAS, height: CANVAS, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite([{ input: inner, gravity: 'center' }]).webp({ quality: 92 }).toBuffer();
      await mkdir(DIR, { recursive: true });
      await writeFile(dest, out);
      return 'ok';
    } catch (e) { lastErr = e; if (attempt < 4) await sleep(4000 * attempt); }
  }
  throw new Error(`${key}: ${lastErr && lastErr.message}`);
}

for (const [k, d] of Object.entries(ICONS)) {
  if (only && k !== only) continue;
  process.stdout.write(`${k} ... `);
  console.log(await genOne(k, d));
}
