#!/usr/bin/env node
// Lich SOUL WARD orb (ludo.ai text->sprite).
// Output -> Sprites/projectiles/p_lich_soulorb.webp, drawn ~40px by
// drawLichOrbs (the Soul Vortex orbiting-orb renderer added v0.29.911).
//   node scripts/gen_lich_soulorb.mjs            # dry-run (prints prompt)
//   node scripts/gen_lich_soulorb.mjs --generate # needs LUDO_API_KEY
//   flags: --force
//
// Per user: "add 2 rotating blue-greenish orbs that attacks like paladin's
// 5 orb skill but a wider radius". The paladin's orbs draw p_ult_holyorb
// (gold, sapphire core); this is its necrotic counterpart — same silhouette
// language so the mechanic reads as the same KIND of thing, but spectral
// teal-green so it is unmistakably the lich's.
// =============================================================================
import sharp from 'sharp';
import { writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(repoRoot, 'Sprites', 'projectiles');
const argv = process.argv.slice(2);
const has = f => argv.includes(f);

// Same house style as gen_mage_orb.mjs (the projectile set these sit beside).
const STYLE =
  'Sprite for a 2D SIDE-SCROLLING platformer, drawn as a flat side-on silhouette (no perspective, ' +
  'no 3/4 view, no depth tilt) to match the existing projectile set. ' +
  'Flat 2D cartoon game sprite, bold clean vector shapes, thick even dark navy outline, ' +
  'crisp cel shading with 2-3 tones. Centred on a fully TRANSPARENT background (alpha only, ' +
  'nothing behind it), generous even margin on all four sides, the whole shape fits well inside ' +
  'the frame. CRITICAL: absolutely NO face, NO eyes, NO mouth, NO smile, NO creature, NO character — ' +
  'this is pure magical energy, an inanimate spell orb. NO text, NO logo, NO drop shadow, NO ground.';

const PROMPT =
  'A compact spectral SOUL ORB of necrotic magic: a brilliant pale-jade core wrapped in layered ' +
  'translucent teal and blue-green ghost-flame shells, thin wisps of cyan-green soulfire curling off ' +
  'the top like a will-o-wisp, a few tiny mint-green ember flecks orbiting tight around it. ' +
  'Cool blue-green palette only — teal, jade, seafoam, a touch of deep blue in the shadows. ' +
  'Symmetrical, dense, unmistakably eldritch. ' + STYLE;

const exists = async p => { try { await access(p); return true; } catch { return false; } };
async function fetchBuf(url) { const r = await fetch(url, { signal: AbortSignal.timeout(90000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); }

if (!has('--generate')) {
  console.log('# lich soul orb -> Sprites/projectiles/p_lich_soulorb.webp\n');
  console.log(PROMPT + '\n');
  console.log('# Re-run with --generate (needs LUDO_API_KEY). Flags: --force');
  process.exit(0);
}
const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const TIMEOUT = Number(process.env.LUDO_REQ_TIMEOUT_MS || 150000);
const sleep = ms => new Promise(r => setTimeout(r, ms));

const dest = join(DIR, 'p_lich_soulorb.webp');
if (!has('--force') && await exists(dest)) { console.log('skip (exists)'); process.exit(0); }
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
    let content; try { content = await sharp(raw).trim().toBuffer(); } catch { content = raw; }
    const CANVAS = 256, INNER = Math.round(CANVAS * 0.94);
    const inner = await sharp(content).resize(INNER, INNER, { fit: 'inside', withoutEnlargement: false }).png().toBuffer();
    const out = await sharp({ create: { width: CANVAS, height: CANVAS, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: inner, gravity: 'center' }]).webp({ quality: 92 }).toBuffer();
    await mkdir(DIR, { recursive: true });
    await writeFile(dest, out);
    console.log('ok -> ' + dest);
    process.exit(0);
  } catch (e) { lastErr = e; if (attempt < 4) await sleep(4000 * attempt); }
}
console.error('FAILED: ' + (lastErr && lastErr.message));
process.exit(1);
