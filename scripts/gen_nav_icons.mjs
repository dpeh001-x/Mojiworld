#!/usr/bin/env node
// U-panel NAV icons for the jump row (ludo.ai text->sprite).
// Output -> Sprites/ui/nav/<key>.webp, drawn into the ~18px .u-jump <img>.
//   node scripts/gen_nav_icons.mjs            # dry-run (prints prompts)
//   node scripts/gen_nav_icons.mjs --generate # needs LUDO_API_KEY
//   flags: --force, --only=<key>
//
// v0.29.779 added the jump row (World Map / Quests / Codex / Mojidex) so a
// controller could reach those panels at all; it shipped with system emoji,
// which render in a different typeface on every OS and read as pasted-in
// against the painted UI — the same complaint that moved the mastery bar off
// emoji in v0.29.293. These are the authored replacements.
//
// Each prompt is written for an 18 px render: ONE silhouette, no fine detail.
// Output 256 px so 2x/3x displays stay crisp. Same PREFIX family as
// gen_quest_type_icons.mjs so the row sits beside the quest art without
// looking like a different game.
// =============================================================================
import sharp from 'sharp';
import { writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(repoRoot, 'Sprites', 'ui', 'nav');
const argv = process.argv.slice(2);
const has = f => argv.includes(f);
const only = (argv.find(a => a.startsWith('--only=')) || '').split('=')[1];

const PREFIX = 'Chibi anime game UI ICON in the Mojiworld aesthetic. ' +
  'Pure transparent background, alpha only — no scene, no ground, no text, no watermark, no border frame, no card. ' +
  '768x768 square canvas. Soft painterly cel-shaded anime style, bold black outlines, vibrant saturated colors, ' +
  'warm antique-gold and amber accents, cool violet shadows to match a fantasy character panel. ' +
  'ONE single centered object at ~66% scale with generous empty transparent margin on all sides — nothing cropped. ' +
  'Must stay readable shrunk to a TINY 18 pixel icon: one strong bold silhouette, chunky simple shapes, ' +
  'high contrast, NO fine detail, NO thin lines, NO small text, NO tick marks, NO clutter. ';

const ICONS = {
  // Deliberately four DISTINCT silhouettes — the row is read at a glance and
  // two book-shaped marks (codex + mojidex) would be indistinguishable at
  // 18 px, so the mojidex leads with the creature and the codex with the book.
  map:
    'a WORLD MAP mark: a single rolled-open parchment scroll-map, warm cream parchment with softly ' +
    'curled top and bottom edges, one bold amber-gold X marking a spot at its centre and a small ' +
    'violet mountain silhouette beside it. Heavy dark outline, no writing, no dotted trails.',
  quest:
    'a QUEST LOG mark: a chunky closed leather-bound journal standing upright, deep burgundy cover with ' +
    'a thick antique-gold corner bracket and a single amber gem stud at its centre, one warm cream ribbon ' +
    'bookmark hanging from the bottom. Heavy dark outline. One solid silhouette.',
  codex:
    'a CODEX mark: an open book with two facing cream pages fanned upward, deep violet-indigo cover, ' +
    'a bright amber-gold four-point sparkle floating just above the pages casting a warm glow. ' +
    'Blank pages, absolutely no writing. Chunky and bold.',
  mojidex:
    'a CREATURE COMPENDIUM mark: a cute chunky rounded monster head in profile — one big friendly eye, ' +
    'a small rounded horn, teal-and-violet fur — resting on top of a small closed amber-gold book that ' +
    'reads as a thick solid slab. Creature dominates, book is a simple base. Heavy dark outline.',
};

const exists = async p => { try { await access(p); return true; } catch { return false; } };
async function fetchBuf(url) { const r = await fetch(url, { signal: AbortSignal.timeout(90000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); }

if (!has('--generate')) {
  console.log('# U-panel nav icons -> Sprites/ui/nav/\n');
  for (const [k, d] of Object.entries(ICONS)) console.log(`## ${k}.webp\n${PREFIX}${d}\n`);
  console.log('# Re-run with --generate (needs LUDO_API_KEY). Flags: --force --only=<key>');
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
