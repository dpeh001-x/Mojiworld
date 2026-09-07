#!/usr/bin/env node
// Persona-5 panel plates for the UI windows that still sit on the bare dark
// gradient (ludo.ai). One plate per window, the panel_p5_shop / _enhance /
// _reforge recipe: 1200x670, full-colour, baked to a flat 20% alpha so the CSS
// stacks it over the dark radial base and the text keeps its contrast. Every
// roll is gated on a calm centre (corners busy, middle quiet) before it is kept.
//   node scripts/gen_panel_plates_ludo.mjs                 # list panels + prompts
//   node scripts/gen_panel_plates_ludo.mjs --generate [names...]   # needs LUDO_API_KEY
//   flags: --force  --tries N  --parallel N
import sharp from 'sharp';
import { writeFile, mkdir, access, rename, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(repoRoot, 'Sprites', 'ui');
const STAGE = join(repoRoot, 'scripts', '_tmp_panel_plates');
const argv = process.argv.slice(2); const has = f => argv.includes(f);
const TRIES = Number(argv[argv.indexOf('--tries') + 1]) || 4; const PAR = Number(argv[argv.indexOf('--parallel') + 1]) || 3;
const W = 1200, H = 670, ALPHA = 0.20;

const BASE = 'Painted video-game menu panel background artwork in PERSONA 5 graphic punk style, for ';
const TAIL = '. FULL-BLEED painting filling the entire canvas edge to edge - no transparent areas, no border frame, no text, no letters, no logo, no characters, no UI widgets. ' +
  'Deep royal violet and midnight purple base. Bold jagged GOLD and CRIMSON comic-style shards and speed-lines exploding inward from the TOP-LEFT and BOTTOM-RIGHT corners only, ' +
  'with thick black comic outlines and halftone dot texture inside the shards. Tucked into the corners among the shards: ';
const END = '. The CENTER of the canvas stays clean, dark and calm - a smooth dark-violet glassy area with a soft radial glow - because readable menu text will sit on top of it. ' +
  'Stylish, high-contrast corners, quiet center. Rich saturated purples, antique gold and crimson accents.';
export const PANELS = {
  inventory:   { what: 'an INVENTORY bag window', motifs: 'a leather adventurer satchel spilling gold coins, cut gemstones, a coiled rope, a brass key, a rolled map and a small glowing potion vial' },
  codex:       { what: 'a CODEX of world knowledge', motifs: 'an open leather-bound tome with a quill, a brass compass rose, wax seals, ink splashes and old map fragments' },
  mojidex:     { what: 'a MONSTER COMPENDIUM (bestiary) window', motifs: 'a magnifying glass over a creature silhouette, cute monster paw prints, a pinned specimen card, feathers and a small horn' },
  taxi:        { what: 'a TAXI travel service window', motifs: 'a vintage carriage wheel, a road milestone signpost with arrows, a glowing lantern, a ticket stub and swirling travel dust' },
  craft:       { what: 'a CRAFTING BENCH window', motifs: 'a wooden workbench with a hammer, iron nails, a saw, brass cogs, a spool of thread and a glowing crafted gem' },
  advancement: { what: 'a CLASS ADVANCEMENT ceremony window', motifs: 'a golden laurel crown, rising star bursts, a heraldic banner, an ornate medal and radiant ascending light rays' },
  tutorial:    { what: 'a TUTORIAL guide window', motifs: 'a wooden signpost with pointing arrows, a lit lantern, an unrolled parchment with simple diagram sketches and a friendly compass' },
  help:        { what: 'a CONTROLS and key bindings window', motifs: 'stylised keyboard keycaps, a game controller silhouette, arrow glyphs and small lightning bolts' },
  jukebox:     { what: 'a JUKEBOX music window', motifs: 'a spinning vinyl record, floating musical notes, neon sound-wave bars, a microphone and a retro speaker cone' },
  backup:      { what: 'a SAVE BACKUPS archive window', motifs: 'stacked archive boxes, a brass padlock and key, sealed scrolls, a sand hourglass and a wax-sealed envelope' },
  powerup:     { what: 'a POWER-UP reveal window', motifs: 'glowing energy orbs, lightning bolts, a bursting treasure chest lid, floating gem shards and radiant sparkles' },
  sage:        { what: 'a SAGE BLESSING window', motifs: 'lit candles, a floating halo ring, incense smoke curls, a crystal ball and drifting golden petals' },
};
const prompt = (p) => BASE + p.what + TAIL + p.motifs + END;
const dest = (n) => join(DIR, `panel_p5_${n}.webp`);
const exists = async p => { try { await access(p); return true; } catch { return false; } };
const fetchBuf = async url => { const r = await fetch(url, { signal: AbortSignal.timeout(90000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); };
const atomicWrite = async (p, buf) => { await writeFile(p + '.tmp', buf); await rename(p + '.tmp', p); };
const busy = async (buf, left, top, width, height) => { const { data } = await sharp(buf).extract({ left, top, width, height }).removeAlpha().greyscale().raw().toBuffer({ resolveWithObject: true }); let s = 0, s2 = 0; const n = data.length; for (let i = 0; i < n; i++) { s += data[i]; s2 += data[i] * data[i]; } const mean = s / n; return Math.sqrt(Math.max(0, s2 / n - mean * mean)); };
const calm = async (buf) => { const cw = Math.round(W * 0.56), ch = Math.round(H * 0.50); const centre = await busy(buf, Math.round((W - cw) / 2), Math.round((H - ch) / 2), cw, ch); const k = Math.round(W * 0.28), kh = Math.round(H * 0.34); const corners = (await busy(buf, 0, 0, k, kh) + await busy(buf, W - k, H - kh, k, kh)) / 2; return { centre, corners, ratio: corners > 0 ? centre / corners : 9 }; };

const names = argv.filter((a) => !a.startsWith('--') && PANELS[a] && argv[argv.indexOf(a) - 1] !== '--tries' && argv[argv.indexOf(a) - 1] !== '--parallel');
const todo = names.length ? names : Object.keys(PANELS);
if (!has('--generate')) { for (const n of todo) console.log(`# panel_p5_${n}.webp\n${prompt(PANELS[n])}\n`); console.log('# Re-run with --generate [names] (needs LUDO_API_KEY). Flags: --force --tries N --parallel N'); process.exit(0); }
const apiKey = process.env.LUDO_API_KEY; if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api'; const TIMEOUT = Number(process.env.LUDO_REQ_TIMEOUT_MS || 150000);
await mkdir(STAGE, { recursive: true }); await mkdir(DIR, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function one(n) {
  const out = dest(n); if (!has('--force') && await exists(out)) return `${n}: skip (exists)`;
  let best = null; const log = [];
  for (let attempt = 1; attempt <= TRIES; attempt++) {
    let raw;
    try {
      const res = await fetch(`${API}/assets/image`, { method: 'POST', headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(TIMEOUT), body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_16_9', n: 1, augment_prompt: false, prompt: prompt(PANELS[n]) }) });
      if (!res.ok) throw new Error(`image ${res.status}: ${(await res.text()).slice(0, 120)}`);
      const data = await res.json(); const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url); if (!url) throw new Error('no url');
      raw = await fetchBuf(url);
    } catch (e) { log.push(`roll ${attempt}: ${e.message}`); await sleep(3000 * attempt); continue; }
    const rgb = await sharp(raw).flatten({ background: { r: 18, g: 10, b: 30 } }).resize(W, H, { fit: 'cover', position: 'centre' }).removeAlpha().png().toBuffer();
    const c = await calm(rgb); const ok = c.ratio <= 0.55;
    log.push(`roll ${attempt}: ${ok ? 'OK' : 'reject'} calm ${c.ratio.toFixed(2)}`);
    await atomicWrite(join(STAGE, `${n}_roll_${attempt}.png`), rgb);
    if (ok && (!best || c.ratio < best.ratio)) best = { rgb, ratio: c.ratio, attempt };
    if (ok && c.ratio <= 0.40) break;
  }
  if (!best) return `${n}: FAILED (no calm roll) - ${log.join('; ')}`;
  const webp = await sharp(best.rgb).ensureAlpha(ALPHA).webp({ quality: 90 }).toBuffer();
  const m = await sharp(webp).metadata(); const a = (await sharp(webp).stats()).channels[3];
  if (m.width !== W || m.height !== H || !m.hasAlpha || Math.round(a.mean) !== Math.round(ALPHA * 255)) return `${n}: BAKE CHECK FAILED ${m.width}x${m.height} alpha ${a.mean}`;
  await atomicWrite(out, webp);
  return `${n}: ok roll ${best.attempt} calm ${best.ratio.toFixed(2)} (${Math.round(webp.length / 1024)} KB) - ${log.join('; ')}`;
}
const queue = todo.slice(); const results = [];
await Promise.all(Array.from({ length: Math.min(PAR, queue.length) }, async () => { while (queue.length) { const n = queue.shift(); const r = await one(n); console.log(r); results.push(r); } }));
console.log(`done ${results.filter((r) => / ok /.test(r) || /skip/.test(r)).length}/${todo.length}`);
