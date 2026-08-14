#!/usr/bin/env node
// Pause/Settings panel background — MapleStory x Persona 5 fusion (ludo.ai).
// Output -> Sprites/ui/panel_pause.webp, drawn UNDER the settings UI the same
// way panel_p5.webp backs the four main windows: the art ships pre-faded
// (alpha baked to ~0.34) so live text stays readable on the dark base.
//   node scripts/gen_pause_panel_bg.mjs            # dry-run (prints prompt)
//   node scripts/gen_pause_panel_bg.mjs --generate # needs LUDO_API_KEY
//   flags: --force
import sharp from 'sharp';
import { writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(repoRoot, 'Sprites', 'ui');
const dest = join(DIR, 'panel_pause.webp');
const argv = process.argv.slice(2);
const has = f => argv.includes(f);

const PROMPT =
  'Painted video-game PAUSE MENU panel background artwork, a fusion of MapleStory cozy fantasy and ' +
  'Persona 5 graphic punk. FULL-BLEED painting filling the entire square canvas edge to edge — ' +
  'no transparent areas, no border frame, no text, no letters, no logo, no characters, no UI widgets. ' +
  'Deep royal violet and midnight purple night sky, soft scattered stars and tiny drifting motes. ' +
  'Bold jagged GOLD and crimson comic-style shards exploding from the TOP-LEFT corner and BOTTOM-RIGHT ' +
  'corner only, with black comic outlines and halftone dot texture inside the shards. A faint dreamy ' +
  'MapleStory-style fantasy skyline silhouette (mushroom trees, floating islands) along the very bottom in ' +
  'darker violet. The CENTER of the canvas stays clean, dark and calm — a smooth dark-violet glassy area ' +
  'with a soft radial glow — because readable menu text will sit on top of it. Elegant, stylish, ' +
  'high-contrast corners with a quiet center. Rich saturated purples and antique gold accents.';

const exists = async p => { try { await access(p); return true; } catch { return false; } };
const fetchBuf = async url => { const r = await fetch(url, { signal: AbortSignal.timeout(90000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); };

if (!has('--generate')) {
  console.log('# panel_pause.webp -> Sprites/ui/\n');
  console.log(PROMPT);
  console.log('\n# Re-run with --generate (needs LUDO_API_KEY). Flag: --force');
  process.exit(0);
}
const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const TIMEOUT = Number(process.env.LUDO_REQ_TIMEOUT_MS || 150000);
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function gen() {
  if (!has('--force') && await exists(dest)) return 'skip (exists — use --force)';
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(`${API}/assets/image`, {
        method: 'POST',
        headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT),
        body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt: PROMPT }),
      });
      if (!res.ok) throw new Error(`image ${res.status}: ${(await res.text()).slice(0, 140)}`);
      const data = await res.json();
      const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
      if (!url) throw new Error('no url');
      const raw = await fetchBuf(url);
      // Portrait 3:4 crop from the square (the panel is taller than wide),
      // flattened opaque on the panel's own base violet, then the WHOLE art
      // faded to alpha 0.34 — same pre-faded-art trick as panel_p5.webp, so
      // the CSS just stacks it over the dark gradient and text stays legible.
      // Pass 1: opaque portrait crop at the final size (RGB, no alpha).
      const rgb = await sharp(raw)
        .flatten({ background: { r: 18, g: 10, b: 30 } })
        .resize(720, 960, { fit: 'cover', position: 'centre' })
        .removeAlpha()
        .raw()
        .toBuffer();
      // Pass 2: join a constant alpha band (0.34 -> 87/255). sharp cannot
      // band-expand inside one pipeline via linear(), hence the two passes.
      const out = await sharp(rgb, { raw: { width: 720, height: 960, channels: 3 } })
        .joinChannel(Buffer.alloc(720 * 960, 87), { raw: { width: 720, height: 960, channels: 1 } })
        .webp({ quality: 84 })
        .toBuffer();
      await mkdir(DIR, { recursive: true });
      await writeFile(dest, out);
      return 'ok (' + Math.round(out.length / 1024) + ' KB)';
    } catch (e) { lastErr = e; if (attempt < 4) await sleep(4000 * attempt); }
  }
  throw lastErr;
}
console.log(await gen(), '->', dest);
