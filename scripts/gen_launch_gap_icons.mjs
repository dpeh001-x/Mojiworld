// Art the launch checklist found missing: one world-map emblem, the five quest-type tiles the journal was written
// for, and the eight potion icons. Each group borrows the prompt style of the set it joins (gen_world_icons,
// gen_nav_icons, generate_boon_icons) and the same 256 px transparent WebP format.
//
//   node scripts/gen_launch_gap_icons.mjs                      # dry run: print the prompts
//   node scripts/gen_launch_gap_icons.mjs --generate           # needs LUDO_API_KEY; skips files that exist
//   node scripts/gen_launch_gap_icons.mjs --generate --only=hunt,hp_s --force
//   OUT_ROOT=<dir>  write under <dir>/Sprites/... instead of the repo (default: the repo root)
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const OUT_ROOT = process.env.OUT_ROOT || ROOT;
const arg = (k) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.split('=')[1] : ''; };
const ONLY = arg('only').split(',').filter(Boolean), FORCE = process.argv.includes('--force'), GENERATE = process.argv.includes('--generate');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const NO_BG = 'Pure transparent background — ALPHA CHANNEL ONLY, absolutely NOTHING behind the subject: no background, no scene, no sky, no ground, no cast shadow, no circle, no disc, no halo, no badge, no coin, no tile, no frame, no border, no card, no panel. ABSOLUTELY NO TEXT (no letters, numbers, runes, watermark). ';
const WORLD = { pre: 'A single cute standalone game sprite of: ', post: '. ' + NO_BG + 'Square canvas, subject centered and filling ~80% with a clean empty margin on every side. FLAT cute cel-shaded MapleStory style: only 2-3 HARD flat-color shade steps with crisp hard edges — NO soft gradients, NO airbrush, NO glossy 3D sheen, NOT pixel-art. BOLD clean dark outline about 2-3px thick with even weight all the way around (a die-cut sticker look). Vibrant saturated colors, adorable, chunky rounded friendly shapes. Simple and low-detail so it reads clearly at tiny 36px in-game size.', style: 'Illustration' };
const QUEST = { pre: 'Chibi anime game UI ICON in the Mojiworld aesthetic. ' + NO_BG + 'Soft painterly cel-shaded anime style, bold black outlines, vibrant saturated colors, warm antique-gold and amber accents, cool violet shadows to match a fantasy quest journal. ONE single centered object at ~70% scale with empty transparent margin on all sides — nothing cropped. Must stay readable shrunk to a TINY 30 pixel icon: one strong bold silhouette, chunky simple shapes, high contrast, NO fine detail, NO thin lines, NO clutter. Subject: ', post: '.', style: 'Anime/Manga' };
const POTION = { pre: 'A die-cut STICKER of the SUBJECT described below — the object ITSELF as a transparent-PNG game-icon sprite with a clean cutout edge and nothing behind it. This is NOT an app icon and NOT on a square tile or card. ' + NO_BG + 'Clean simple chibi-anime game-icon style: bold simple shapes with a thin EVEN ~2px solid BLACK outline (uniform weight, NOT thick or chunky), vibrant flat colors, light cel shading, a soft glow. Centered, about 82% of the square image. Subject: ', post: '.', style: 'Anime/Manga' };

const ICONS = {
  // Sprites/world/regions/<mapId>.webp - the W-map emblem (emoji fallback until now)
  verdantHaven: { dir: 'Sprites/world/regions', g: WORLD, s: 'a cozy mossy treehouse hut nestled in the crown of a big round green tree, a warm glowing lantern by its little round door, a safe haven' },
  // Sprites/ui/quest/<type>.webp - _questTypeOf() returns hunt | boss | talk | explore | bounty
  hunt:    { dir: 'Sprites/ui/quest', g: QUEST, s: 'a sturdy short sword crossed over a small round wooden target, a hunter\'s emblem' },
  boss:    { dir: 'Sprites/ui/quest', g: QUEST, s: 'a menacing horned golden crown with one glowing violet gem, a boss emblem' },
  talk:    { dir: 'Sprites/ui/quest', g: QUEST, s: 'a rounded cream speech bubble with three chunky dots inside' },
  explore: { dir: 'Sprites/ui/quest', g: QUEST, s: 'a chunky brass compass with a bold red needle, lid open' },
  bounty:  { dir: 'Sprites/ui/quest', g: QUEST, s: 'a rolled parchment wanted-poster scroll tied with a red ribbon and a gold wax seal' },
  // Sprites/boons/<id>.webp - the eight POWERUPS potions (boonIconHtml fell back to their emoji)
  hp_s: { dir: 'Sprites/boons', g: POTION, s: 'a SMALL round glass potion bottle with a cork, a little bright red healing liquid inside, one tiny heart bubble' },
  hp_m: { dir: 'Sprites/boons', g: POTION, s: 'a MEDIUM heart-shaped glass flask with a cork, filled with bright red healing potion' },
  hp_l: { dir: 'Sprites/boons', g: POTION, s: 'a LARGE ornate glass flask with gold bands and a jewelled stopper, brimming with glowing crimson healing potion' },
  mp_s: { dir: 'Sprites/boons', g: POTION, s: 'a SMALL teardrop-shaped glass potion bottle with a cork, a little bright blue mana liquid inside, one tiny star bubble' },
  mp_m: { dir: 'Sprites/boons', g: POTION, s: 'a MEDIUM round glass flask with a cork, filled with bright sapphire-blue mana potion, a small star on the glass' },
  mp_l: { dir: 'Sprites/boons', g: POTION, s: 'a LARGE ornate glass flask with silver bands and a crystal stopper, brimming with glowing deep-blue mana potion' },
  full: { dir: 'Sprites/boons', g: POTION, s: 'a radiant golden elixir bottle with a star-shaped stopper, shimmering gold-and-rainbow liquid, tiny sparkles around it' },
  cure: { dir: 'Sprites/boons', g: POTION, s: 'a slim green herbal remedy vial with a cork and a fresh leaf tied to its neck, soft mint-green liquid' },
};
const keys = Object.keys(ICONS).filter((k) => !ONLY.length || ONLY.includes(k));
const promptOf = (k) => ICONS[k].g.pre + ICONS[k].s + ICONS[k].g.post;
if (!GENERATE) { for (const k of keys) console.log(`## ${ICONS[k].dir}/${k}.webp\n${promptOf(k)}\n`); console.log('# Re-run with --generate (needs LUDO_API_KEY). Flags: --only=a,b --force; OUT_ROOT=<dir>.'); process.exit(0); }

const KEY = process.env.LUDO_API_KEY; if (!KEY) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const sharp = require('sharp');
// ludo.ai answers 202 + a job id; poll /assets/jobs/<id> (same helper as scripts/gen_aetherion_evolve.mjs)
async function ludo(route, body, timeout = 240000) {
  const res = await fetch(`${API}/${route}`, { method: 'POST', headers: { Authorization: `ApiKey ${KEY}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(timeout), body: JSON.stringify(body) });
  if (res.status === 402) throw new Error('402 OUT OF CREDITS');
  const txt = await res.text(); if (!res.ok) throw new Error(`HTTP ${res.status} ${txt.slice(0, 140)}`);
  let j = JSON.parse(txt);
  if (res.status === 202 && j.id) {
    const id = j.id;
    for (let i = 0; ; i++) {
      if (i > 80) throw new Error('job timed out');
      await sleep(Math.max(4000, Number(j.poll_after_ms) || 5000));
      const r = await fetch(`${API}/assets/jobs/${id}`, { headers: { Authorization: `ApiKey ${KEY}` }, signal: AbortSignal.timeout(45000) });
      if (r.status === 429) { await r.text().catch(() => {}); continue; }
      j = await r.json();
      if (j.status === 'succeeded') { j = j.result; break; }
      if (j.status === 'failed' || j.status === 'cancelled') throw new Error('job ' + j.status);
    }
  }
  return j;
}
const urlOf = (d) => Array.isArray(d) ? (d[0] && d[0].url) : (d && (d.url || (d.images && d.images[0] && d.images[0].url) || (Array.isArray(d.result) && d.result[0] && d.result[0].url)));
async function fetchBuf(url) { const r = await fetch(url, { signal: AbortSignal.timeout(180000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); }
const CANVAS = 256, INNER = Math.round(CANVAS * 0.92);
let made = 0, failed = 0;
for (const k of keys) {
  const dest = path.join(OUT_ROOT, ICONS[k].dir, k + '.webp');
  if (existsSync(dest) && !FORCE) { console.log('skip (exists) ' + dest); continue; }
  try {
    const d = await ludo('assets/image', { image_type: 'sprite', art_style: ICONS[k].g.style, aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt: promptOf(k) });
    const url = urlOf(d); if (!url) throw new Error('no image url in ' + JSON.stringify(d).slice(0, 160));
    const raw = await fetchBuf(url);
    let content; try { content = await sharp(raw).trim({ threshold: 10 }).toBuffer(); } catch { content = raw; }
    const inner = await sharp(content).resize(INNER, INNER, { fit: 'inside', withoutEnlargement: false }).png().toBuffer();
    const out = await sharp({ create: { width: CANVAS, height: CANVAS, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: inner, gravity: 'center' }]).webp({ quality: 92, alphaQuality: 100 }).toBuffer();
    const meta = await sharp(out).stats(); const alphaMin = meta.channels[3] ? meta.channels[3].min : 255;
    await mkdir(path.dirname(dest), { recursive: true }); await writeFile(dest, out); made++;
    console.log(`ok ${ICONS[k].dir}/${k}.webp  ${out.length} bytes${alphaMin > 0 ? '  WARNING: no transparent pixels (opaque background?)' : ''}`);
  } catch (e) { failed++; console.error(`FAIL ${k}: ${e.message}`); }
}
console.log(`\n${made} generated, ${failed} failed`);
process.exit(failed ? 1 : 0);
