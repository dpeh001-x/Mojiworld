#!/usr/bin/env node
// NPC dialogue backdrop — Sprites/ui/npc_dialog_bg.webp (ludo.ai).
//
// Drawn UNDER the dialogue UI and STRETCHED 100% x 100% to the frame, so the
// composition must satisfy two hard constraints:
//   1. warm artwork ON the extreme left and right edges — the panel border
//      cuts exactly there, and inset artwork leaves a dead violet margin;
//   2. a calm, dark MIDDLE THIRD — that is where the dialogue text sits.
// Authored wide (16:9) because the panel is far wider than tall; a square
// plate stretched to that shape smears the ornament.
//
// The art ships PRE-FADED (constant alpha 0.32, the panel_pause.webp trick),
// so the CSS just stacks it over the dark gradient and the cream text keeps
// its contrast without a second overlay. 0.32 is deliberately low: at 0.55
// the curtains competed with the dialogue for attention, which is backwards
// for a panel whose whole job is to be read.
//   node scripts/gen_npc_dialog_bg.mjs            # dry-run (prints prompt)
//   node scripts/gen_npc_dialog_bg.mjs --generate # needs LUDO_API_KEY
//   flags: --force
import sharp from 'sharp';
import { writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(repoRoot, 'Sprites', 'ui');
const dest = join(DIR, 'npc_dialog_bg.webp');
const argv = process.argv.slice(2);
const has = f => argv.includes(f);

// Winning variant of three measured candidates (gilded curtains beat stained
// glass and comic shards): the curtains read as neutral staging, where the
// stained-glass arches read as a specific PLACE — wrong for a panel that backs
// every NPC in the game.
const PROMPT =
  'Wide ornate video-game DIALOGUE BOX background banner, MapleStory cozy fantasy fused with ' +
  'Persona 5 pop-art graphic punk. ' +
  'FULL-BLEED painting filling the entire wide canvas edge to edge — no transparent areas, no ' +
  'border frame, no text, no letters, no logo, no characters, no UI widgets. The MIDDLE THIRD of ' +
  'the canvas stays calm, dark and smooth — a deep glassy indigo area — because readable dialogue ' +
  'text sits on top of it. Strong symmetric left-right composition. ' +
  'ANTIQUE GOLD IS THE DOMINANT COLOR — far more gold than red, rich warm gold everywhere at the ' +
  'edges, with crimson red only as a secondary accent. ' +
  'Bold POP-ART POLKA DOTS are a major feature: large clearly-visible round Ben-Day halftone dots ' +
  'in gold and cream, in graduated sizes, scattered generously across the edge artwork and ' +
  'drifting inward toward the middle. Retro comic-book pop-art energy. ' +
  'Draped GOLDEN theatre curtains with deep crimson lining, anchored hard to the EXTREME LEFT ' +
  'EDGE and EXTREME RIGHT EDGE, bleeding off both edges and reaching every corner, edged with ' +
  'thick ornate antique-gold filigree trim and gold tassels. Big gold polka dots scatter across ' +
  'the curtains and out into the dark middle. Ornate gold baroque flourishes in all four ' +
  'corners. Behind it a deep violet nebula with bright stars and golden dust. Luxurious, ' +
  'high-detail, gold-dominant.';

const W = 1024, H = 576, ALPHA = 82;   // 0.32 * 255
const exists = async p => { try { await access(p); return true; } catch { return false; } };

if (!has('--generate')) {
  console.log('# npc_dialog_bg.webp -> Sprites/ui/\n');
  console.log(PROMPT);
  console.log('\n# Re-run with --generate (needs LUDO_API_KEY). Flag: --force');
  process.exit(0);
}
const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function gen() {
  if (!has('--force') && await exists(dest)) return 'skip (exists — use --force)';
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(`${API}/assets/image`, {
        method: 'POST',
        headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(Number(process.env.LUDO_REQ_TIMEOUT_MS || 150000)),
        body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_16_9', n: 1, augment_prompt: false, prompt: PROMPT }),
      });
      if (!res.ok) throw new Error(`image ${res.status}: ${(await res.text()).slice(0, 140)}`);
      const data = await res.json();
      const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
      if (!url) throw new Error('no url');
      const r = await fetch(url, { signal: AbortSignal.timeout(120000) });
      const raw = Buffer.from(await r.arrayBuffer());
      // Pass 1: opaque wide crop on the panel's own base violet.
      const rgb = await sharp(raw)
        .flatten({ background: { r: 16, g: 9, b: 28 } })
        .resize(W, H, { fit: 'cover', position: 'centre' })
        .removeAlpha().raw().toBuffer();
      // Pass 2: join a constant alpha band (sharp cannot band-expand in one pipeline).
      const out = await sharp(rgb, { raw: { width: W, height: H, channels: 3 } })
        .joinChannel(Buffer.alloc(W * H, ALPHA), { raw: { width: W, height: H, channels: 1 } })
        .webp({ quality: 86 }).toBuffer();
      await mkdir(DIR, { recursive: true });
      await writeFile(dest, out);
      // Report the two constraints so a bad roll is obvious without opening it.
      const warmCol = (col) => { let h = 0; for (let y = 0; y < H; y++) { const i = (y * W + col) * 3;
        if (rgb[i] > 70 && rgb[i] > rgb[i + 2] * 1.25) h++; } return Math.round(h / H * 100); };
      console.log(`edge warmth: left ${warmCol(2)}%  right ${warmCol(W - 3)}%  centre ${warmCol(W >> 1)}%`);
      console.log('(want: both edges >= 35%, centre <= 12% — see scripts/npc_dialog_style_test.mjs)');
      return 'ok (' + Math.round(out.length / 1024) + ' KB)';
    } catch (e) { lastErr = e; if (attempt < 4) await sleep(4000 * attempt); }
  }
  throw lastErr;
}
console.log(await gen(), '->', dest);
