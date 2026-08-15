// NPC dialog backdrop (ludo.ai) — same MapleStory x Persona family as the
// pause panel the user approved, but tuned for the dialog's shape: the panel
// is content-sized (360-640px wide, any height) and crops via center/cover,
// so all drama lives at the EDGES and the center stays calm for the text.
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';
const dest = process.argv[2];
if (!dest) { console.error('usage: node _tmp_npc_bg_gen.mjs <out.webp>'); process.exit(2); }
const key = process.env.LUDO_API_KEY;
if (!key) { console.error('LUDO_API_KEY required'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';

const PROMPT =
  'Painted video-game DIALOGUE BOX background artwork, a fusion of MapleStory cozy fantasy and ' +
  'Persona 5 stylish graphic punk. FULL-BLEED painting filling the entire square canvas edge to ' +
  'edge — no transparent areas, no border frame, no text, no letters, no logo, no characters, no ' +
  'UI widgets. Deep blackish-indigo and midnight violet velvet night sky with soft scattered ' +
  'stars, tiny golden dust motes and faint wisps of arcane smoke. Bold jagged ANTIQUE GOLD and ' +
  'deep crimson comic-style shards with black outlines and halftone dot texture sweeping in from ' +
  'the LEFT and RIGHT edges only, like theatre curtains of broken glass. A faint dreamy ' +
  'MapleStory fantasy silhouette (tiny floating islands, a crescent moon) tucked in the upper ' +
  'corners in darker violet. The CENTER of the canvas stays clean, dark, calm and smooth — a ' +
  'glassy dark-indigo area with a very soft radial glow — because readable dialogue text sits on ' +
  'top of it. Elegant, high-contrast edges with a quiet center. Rich saturated dark purples, ' +
  'antique gold and crimson accents.';

let lastErr;
for (let attempt = 1; attempt <= 3; attempt++) {
  try {
    const res = await fetch(`${API}/assets/image`, {
      method: 'POST', headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(150000),
      body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt: PROMPT }),
    });
    if (!res.ok) throw new Error(`image ${res.status}: ${(await res.text()).slice(0, 140)}`);
    const data = await res.json();
    const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
    if (!url) throw new Error('no url');
    const r = await fetch(url, { signal: AbortSignal.timeout(120000) });
    const raw = Buffer.from(await r.arrayBuffer());
    // Same pre-faded-art trick as panel_pause.webp: flatten opaque onto the
    // panel's own base violet, then bake the WHOLE art down to constant alpha
    // so the CSS just stacks it and the cream text stays legible. The dialog
    // shows more of its art than the settings panel (its gradient overlays are
    // lighter), so 0.46 here vs the pause panel's 0.34.
    const W = 768, H = 768, A = 117; // 0.46 * 255
    const rgb = await sharp(raw)
      .flatten({ background: { r: 16, g: 9, b: 28 } })
      .resize(W, H, { fit: 'cover', position: 'centre' })
      .removeAlpha().raw().toBuffer();
    const out = await sharp(rgb, { raw: { width: W, height: H, channels: 3 } })
      .joinChannel(Buffer.alloc(W * H, A), { raw: { width: W, height: H, channels: 1 } })
      .webp({ quality: 84 }).toBuffer();
    await writeFile(dest, out);
    console.log(`ok ${W}x${H} alpha=0.46 ${Math.round(out.length / 1024)} KB -> ${dest}`);
    process.exit(0);
  } catch (e) { lastErr = e; if (attempt < 3) await new Promise(r2 => setTimeout(r2, 4000 * attempt)); }
}
throw lastErr;
