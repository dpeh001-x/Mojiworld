#!/usr/bin/env node
// Pause/Settings panel background — MapleStory-cosy with a soft Persona
// accent (ludo.ai). Output -> Sprites/ui/panel_pause.webp, drawn UNDER the
// settings UI the way panel_p5.webp backs the four main windows: the art
// ships PRE-FADED (alpha baked to ~0.20) so live text stays readable.
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
  // v2 (per user: "redo the background again, make it cuter, less opacity") —
  // the jagged crimson shards leaned too hard Persona; this roll leans
  // MapleStory-cosy with only a soft golden comic accent.
  'Adorable cozy video-game PAUSE MENU panel background artwork, MapleStory storybook fantasy with a ' +
  'gentle Persona-style comic accent. FULL-BLEED painting filling the entire square canvas edge to edge — ' +
  'no transparent areas, no border frame, no text, no letters, no logo, no characters, no UI widgets. ' +
  'Dreamy deep-violet and plum night sky full of CUTE tiny things: soft twinkling star sparkles, small ' +
  'plump pastel clouds, gentle floating glow-motes and little bokeh fairy lights. Soft rounded GOLD ' +
  'ribbon swooshes with smooth comic outlines curling in from the TOP-LEFT and BOTTOM-RIGHT corners only ' +
  '— rounded and friendly, NOT jagged, with a light halftone dot texture. Along the very bottom a tiny ' +
  'darker-violet silhouette of cozy mushroom houses and floating islands. The CENTER stays clean, dark ' +
  'and calm — smooth dark-violet with a soft radial glow — because readable menu text sits on top of it. ' +
  'Warm, cute, inviting; pastel gold, lavender and plum palette.';

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
      // Pass 1: opaque portrait crop at the final size (RGB, no alpha).
      // v2 — 640x854 (was 720x960) and webp q66/effort 6 (was q84): the art
      // sits at 20% alpha behind a blur-free gradient, so fidelity headroom is
      // wasted bytes ("it still can be further compressed", per user).
      const W2 = 640, H2 = 854;
      const rgb = await sharp(raw)
        .flatten({ background: { r: 18, g: 10, b: 30 } })
        .resize(W2, H2, { fit: 'cover', position: 'centre' })
        .removeAlpha()
        .raw()
        .toBuffer();
      // Pass 2: join a constant alpha band (0.20 -> 51/255, was 0.34) — the
      // "less opacity" half of the ask. sharp cannot band-expand inside one
      // pipeline via linear(), hence the two passes.
      const out = await sharp(rgb, { raw: { width: W2, height: H2, channels: 3 } })
        .joinChannel(Buffer.alloc(W2 * H2, 51), { raw: { width: W2, height: H2, channels: 1 } })
        .webp({ quality: 66, effort: 6, smartSubsample: true })
        .toBuffer();
      await mkdir(DIR, { recursive: true });
      await writeFile(dest, out);
      return 'ok (' + Math.round(out.length / 1024) + ' KB)';
    } catch (e) { lastErr = e; if (attempt < 4) await sleep(4000 * attempt); }
  }
  throw lastErr;
}
console.log(await gen(), '->', dest);
