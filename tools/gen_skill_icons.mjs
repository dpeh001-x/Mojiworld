#!/usr/bin/env node
// Skill-bar ICONS — one per skill, game-aesthetic with a 2-3px black outline,
// to replace the emoji icons. Parses the SKILLS defs straight out of
// mojiworld_game.html (id / name / icon-emoji / desc) and composes an icon
// prompt per skill, then generates via Ludo /assets/image (item-icon,
// Cel-Shaded) and re-encodes to a TRUE png at Sprites/skills/<id>.png.
//
//   node tools/gen_skill_icons.mjs                      # dry-run (list + prompts)
//   node tools/gen_skill_icons.mjs --only slash,fireball --generate
//   node tools/gen_skill_icons.mjs --generate           # all (skip-existing)
//   node tools/gen_skill_icons.mjs --generate --force
// Needs LUDO_API_KEY. Image endpoint — safe to run alongside an animate batch.
// =============================================================================
import sharp from 'sharp';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(repoRoot, 'Sprites', 'skills');
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

// Parse skill defs (single-line form) from the game source.
const src = await readFile(join(repoRoot, 'mojiworld_game.html'), 'utf8');
const RE = /(\b[a-zA-Z_][\w]*)\s*:\s*\{\s*name:'([^']+)',\s*icon:'([^']+)',[^\n}]*?\b(?:cls|job|master):'[^']*'[^\n}]*?\bdesc:'([^']*)'/g;
const SKILLS = {};
let m;
while ((m = RE.exec(src)) !== null) {
  const [, id, name, icon, desc] = m;
  if (!SKILLS[id]) SKILLS[id] = { id, name, icon, desc };
}
let ids = Object.keys(SKILLS);
const only = arg('--only'); if (only) ids = only.split(',').filter((k) => SKILLS[k]);
if (!ids.length) { console.error('No skills parsed/matched.'); process.exit(1); }

const STYLE = ' Bold cel-shaded fantasy video-game SKILL ICON, one clear central motif filling ~80% of the square, vibrant saturated colours with soft inner cel-shading and a crisp highlight, a thick uniform 2-3 pixel black outline (#0a0612) around the whole silhouette, fully transparent background, no text, no letters, no border frame, no UI chrome, no drop shadow. Reads clearly at 40x40.';
const buildPrompt = (s) => `A polished skill icon representing "${s.name}": ${s.desc}` + STYLE;

if (!has('--generate')) {
  console.log(`# ${ids.length} skill icons -> Sprites/skills/<id>.png\n`);
  for (const id of ids) console.log(`## ${id} (${SKILLS[id].icon} ${SKILLS[id].name})\n${buildPrompt(SKILLS[id])}\n`);
  console.log(`# ${ids.length} skills parsed. Re-run with --generate (needs LUDO_API_KEY).`);
  process.exit(0);
}

const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const BASE = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const force = has('--force');
const TIMEOUT = Number(process.env.LUDO_REQ_TIMEOUT_MS || 260000);
const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function fetchTimed(url, opts = {}) {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), TIMEOUT);
  try { return await fetch(url, { ...opts, signal: ac.signal }); }
  catch (e) { if (ac.signal.aborted) throw new Error('timeout'); throw e; } finally { clearTimeout(t); }
}
async function genOne(id) {
  const dest = join(OUT_DIR, id + '.png');
  if (!force && await exists(dest)) return 'skip';
  // 4 attempts with backoff — the image endpoint intermittently drops the
  // connection ("fetch failed") / runs slow; a single attempt loses too many.
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetchTimed(`${BASE}/assets/image`, {
        method: 'POST', headers: { 'Authorization': `ApiKey ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_type: 'item-icon', prompt: buildPrompt(SKILLS[id]), art_style: 'Cel-Shaded', perspective: 'Any perspective', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false }),
      });
      if (!res.ok) throw new Error(`Ludo ${res.status}: ${(await res.text()).slice(0, 140)}`);
      const data = await res.json();
      const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
      if (!url) throw new Error('no url');
      const imgRes = await fetchTimed(url); if (!imgRes.ok) throw new Error('img fetch ' + imgRes.status);
      const raw = Buffer.from(await imgRes.arrayBuffer()); if (!raw.length) throw new Error('empty');
      const png = await sharp(raw).ensureAlpha().resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
      await mkdir(OUT_DIR, { recursive: true });
      await writeFile(dest, png);
      return 'ok';
    } catch (e) { lastErr = e; if (attempt < 4) await sleep(2500 * attempt); }
  }
  throw lastErr;
}

console.log(`Generating ${ids.length} skill icons (skip-existing: ${!force})...`);
let made = 0, skipped = 0, failed = 0;
for (const id of ids) {
  process.stdout.write(`  ${id} ... `);
  try { const r = await genOne(id); if (r === 'skip') { skipped++; console.log('skip'); } else { made++; console.log('OK'); await sleep(600); } }
  catch (e) { failed++; console.log('FAIL: ' + e.message); }
}
console.log(`Done. ${made} made, ${skipped} skipped, ${failed} failed.`);
process.exit(failed ? 2 : 0);
