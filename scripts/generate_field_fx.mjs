#!/usr/bin/env node
// Ground-field + beam VFX sprites — ludo.ai text→sprite (static)
// =============================================================================
// Authored art for effects that would otherwise render as raw canvas shapes.
// Each entry carries its OWN target dir, aspect and canvas, because these are
// two different shapes of art:
//   • wide ground bands  (aurora_field, void_tear)      -> Sprites/vfx/*.webp
//   • tall beam columns  (fx_col_*, drain pillar)       -> Sprites/fx/*.webp
// Column canvases match the existing fx_col_archon (552×1206) so the new ones
// drop into the same render path with no scaling surprises.
//
//   node scripts/generate_field_fx.mjs                 # dry-run list
//   node scripts/generate_field_fx.mjs --generate
//   flags: --force --only a,b
// Needs LUDO_API_KEY. Resumable: skips a file that already exists.
//
// ASPECT NOTE: art that gets stretched to a hazard box must have NO central
// focal emblem — a centred motif smears. Bands are specified as soft repeated
// structure; columns as vertical banding that survives a height change.
// =============================================================================
import sharp from 'sharp';
import { writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

// Shared style tail. Cel-shaded with banded light rather than smooth gradients
// — that is what makes a glow read as hand-painted game art instead of a CSS
// gradient, and it matches the existing fx_col_* set.
const STYLE = ' for a 2D side-scroller RPG, high quality cel-shaded anime game art, crisp banded light with clean hard-edged colour steps, glowing but not blurry, bold confident shapes, no character, no person, no creature, no weapon, no text, no UI frame, effect only, fades out softly before the image border, nothing clipped by the frame edge, transparent background';

const FX = {
  // ---- wide ground bands (Sprites/vfx) ------------------------------------
  aurora_field: {
    dir: 'vfx', ar: 'ar_16_9', cw: 1024, ch: 512, fill: 0.96,
    prompt: 'A soft golden-white holy light field lying flat on the ground, gentle vertical light rays rising from a bright horizontal base line, a few small four-pointed sparkles floating above it, warm gold and cream colors,',
  },
  void_tear: {
    dir: 'vfx', ar: 'ar_16_9', cw: 1024, ch: 512, fill: 0.94,
    // Drawn as a wide flat rift near the top of its box; the Spire seeds these
    // as permanent obstacles, so it must read as "hole in space", not a puddle.
    prompt: 'A horizontal tear ripped open in space, a long thin jagged slit with a pitch-black void core, glowing violet and magenta energy along the torn edges, a few small purple shards and wisps drifting out of the rip, the slit stretches horizontally and tapers to sharp points at both ends,',
  },
  gloop_puddle: {
    dir: 'vfx', ar: 'ar_16_9', cw: 512, ch: 256, fill: 0.94,
    // King Gloopaloo is the GEL WATER grotto boss — the puddle is cyan/blue,
    // not green slime (body rgba(102,200,255), sheen rgba(180,235,255)).
    // 60×18 on screen, so the shape has to read at a glance: one clean blob.
    prompt: 'A small glossy cyan-blue gel puddle seen from a low angle, one smooth rounded blob shape with a bright white highlight near the top left, darker blue rim, a couple of tiny droplets beside it, wet jelly-like surface,',
  },
  beam_core: {
    dir: 'vfx', ar: 'ar_16_9', cw: 1024, ch: 256, fill: 0.98,
    // NEUTRAL WHITE ON PURPOSE. The renderer tints this per caller (the same
    // beam is fired in yellow / cyan / white / pale blue and layered at three
    // widths for the marksman railshot), so the art must carry SHAPE only and
    // let the colour come from code — a coloured sprite would break the
    // parametric callers this effect exists to serve.
    prompt: 'A horizontal beam of pure white energy, a bright solid white core line running left to right with soft feathered edges above and below, tapering to fine points at both the left and right ends, a few faint white speed streaks along it, pure white and pale grey only, no colour tint,',
  },
  // ---- tall beam columns (Sprites/fx, matching fx_col_archon) --------------
  fx_col_arbiter: {
    dir: 'fx', ar: 'ar_9_16', cw: 552, ch: 1206, fill: 0.92,
    // The Arbiter — the Spire's judge. Warm amber-gold (#ffd870), 120 px wide.
    prompt: 'A tall narrow vertical beam of amber-gold judgement light striking down from above, bright white-hot core with layered gold edges, small glowing motes and thin sparks drifting beside the beam, the column runs the full height of the image,',
  },
  fx_col_sovereign: {
    dir: 'fx', ar: 'ar_9_16', cw: 552, ch: 1206, fill: 0.92,
    // The Sovereign — the Spire's ruler. Pale cream-white (#fff5d0), 140 px —
    // wider and brighter than the Arbiter's so it reads as the bigger threat.
    // v2: the words "pillar", "regal" and "crown-like" made ludo draw a literal
    // stone column with a metal crown on it — scenery, not an attack, and the
    // exact confusion that got a drain-pillar sprite reverted in v0.26.340.
    // Beam/light vocabulary only, with architecture explicitly negated.
    prompt: 'A tall wide vertical shaft of brilliant pale cream-white light blasting straight down from the sky, blinding white core with ivory and pale gold banded edges, thin light streaks and drifting golden motes along its length, pure energy beam, no stone, no marble, no architecture, no pillar structure, no crown, no jewellery, no metal object,',
  },
  sovereign_drain_pillar: {
    dir: 'vfx', ar: 'ar_9_16', cw: 512, ch: 1152, fill: 0.92,
    // Drains HP/MP to 1 — should read as siphoning UPWARD, not just a beam.
    prompt: 'A tall vertical column of draining golden energy, glowing amber light being pulled upward in thin ribbons and rising motes, brighter at the top where it is siphoned away, hollow darker centre, thin gold edges framing the column, the column runs the full height of the image,',
  },
  // ---- v0.29.351 — action-boon combat FX (Flame Dash / Nova Step / Death
  // Bloom / Phantom Echo). First shipped v0.29.347 via the Higgsfield
  // fallback; regenerated here through the canonical pipeline per user
  // "redo using ludo.ai, high quality cel-shaded 2d sidescroller artwork".
  flame_patch: {
    dir: 'vfx', ar: 'ar_16_9', cw: 512, ch: 256, fill: 0.96,
    // Drawn bottom-anchored by drawFlameTrail and tiled along the dash path,
    // so like the other bands it must be repeated structure with NO central
    // emblem — a focal flame would read as a row of identical torches.
    prompt: 'A low wide band of fierce orange and gold fire burning along the ground, many small licking flame tongues of varied heights rising from a white-hot molten base line, deep red undertones at the roots and bright yellow-white tips, a few glowing embers drifting above, painted with dramatic layered flame shapes,',
  },
  nova_ring: {
    dir: 'fx', ar: 'ar_1_1', cw: 768, ch: 768, fill: 0.94,
    // spawnSpriteBurst scales it uniformly from the dash end-point; the ring
    // must be a complete circle so the burst reads centred at any size.
    prompt: 'A complete circular shockwave ring of orange and white energy viewed straight on, a full unbroken blazing circle with a white-hot inner edge, sharp triangular energy spikes radiating outward from the entire circumference, small glowing shards and speed-line sparks flying away from the ring, hollow transparent centre, dramatic explosive impact frame,',
  },
  bloom_burst: {
    dir: 'fx', ar: 'ar_1_1', cw: 768, ch: 768, fill: 0.94,
    // v2 — the first ludo pass drew whole five-petal FLOWERS on branching
    // stems, a wreath rather than a detonation. Detached single petals only,
    // flowers and stems explicitly negated.
    prompt: 'A violent radial explosion of loose single flower petals bursting outward from one brilliant white-pink flash at the centre, dozens of individual detached pink petals of varied sizes tumbling and spinning away in every direction with curved motion streaks, denser near the centre and sparser at the edge, deep magenta petal shadows and pale highlights, individual petals only, no whole flowers, no blossoms, no stems, no branches, no leaves,',
  },
  echo_slash: {
    dir: 'fx', ar: 'ar_1_1', cw: 768, ch: 768, fill: 0.94,
    // Mirrored via flipX at the spawn site, so the sweep direction just needs
    // to be consistent; drawn over the struck monster at ~its height.
    // v2 — "crescent sword slash" made ludo paint an actual ornate SWORD with
    // a trail; this overlay lands ON the struck monster, so it must be the
    // energy arc alone. Weapon vocabulary removed and explicitly negated.
    prompt: 'A single huge ghostly crescent arc of pure spectral energy sweeping diagonally, a sharp curved streak of glowing violet and white light with a crisp bright leading edge tapering to fine points, two fainter translucent purple afterimage arcs trailing behind it, small spirit wisps and speed lines along the sweep, energy trail only, no sword, no blade, no hilt, no handle, no weapon, no object,',
  },
};

const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
async function fetchBuf(url) { const r = await fetch(url, { signal: AbortSignal.timeout(90000) }); if (!r.ok) throw new Error(`fetch ${r.status}`); return Buffer.from(await r.arrayBuffer()); }

let keys = Object.keys(FX);
const only = arg('--only'); if (only) keys = keys.filter((k) => only.split(',').some((o) => k === o || k.startsWith(o)));
if (!keys.length) { console.error('No matching FX.'); process.exit(1); }

const destOf = (k) => join(repoRoot, 'Sprites', FX[k].dir, `${k}.webp`);

if (!has('--generate')) {
  console.log(`# ${keys.length} VFX:\n`);
  for (const k of keys) console.log(`  Sprites/${FX[k].dir}/${k}.webp   (${FX[k].cw}x${FX[k].ch}, ${FX[k].ar})`);
  console.log('\n# Re-run with --generate (needs LUDO_API_KEY). Flags: --force --only a,b');
  process.exit(0);
}

const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const force = has('--force');
const TIMEOUT = Number(process.env.LUDO_REQ_TIMEOUT_MS || 150000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function askLudo(prompt, ar) {
  const res = await fetch(`${API}/assets/image`, {
    method: 'POST', headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(TIMEOUT),
    body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: ar, n: 1, augment_prompt: false, prompt }),
  });
  if (!res.ok) throw new Error(`image ${res.status}: ${(await res.text()).slice(0, 120)}`);
  const data = await res.json();
  const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
  if (!url) throw new Error(`no url: ${JSON.stringify(data).slice(0, 120)}`);
  return url;
}

async function genOne(k) {
  const cfg = FX[k];
  const dest = destOf(k);
  if (!force && await exists(dest)) return 'skip';
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      let url;
      try { url = await askLudo(cfg.prompt + STYLE, cfg.ar); }
      catch (e) {
        // not every account/model exposes every aspect — fall back to square
        // and let the compose step letterbox it into the real canvas.
        if (!/aspect|ar_/i.test(String(e.message))) throw e;
        url = await askLudo(cfg.prompt + STYLE, 'ar_1_1');
      }
      await mkdir(dirname(dest), { recursive: true });
      const raw = await fetchBuf(url);
      let content; try { content = await sharp(raw).trim().toBuffer(); } catch { content = raw; }
      const inner = await sharp(content)
        .resize(Math.round(cfg.cw * cfg.fill), Math.round(cfg.ch * cfg.fill), { fit: 'inside' })
        .png().toBuffer();
      const out = await sharp({ create: { width: cfg.cw, height: cfg.ch, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite([{ input: inner, gravity: 'center' }])
        .webp({ quality: 90 }).toBuffer();
      await writeFile(dest, out);
      return 'ok';
    } catch (e) { lastErr = e; if (attempt < 4) await sleep(4000 * attempt); }
  }
  throw lastErr;
}

console.log(`Generating ${keys.length} VFX (force:${force})...`);
let made = 0, skipped = 0, failed = 0;
for (const k of keys) {
  process.stdout.write(`  ${k} ... `);
  try { const r = await genOne(k); if (r === 'skip') { skipped++; console.log('skip'); } else { made++; console.log('OK'); await sleep(800); } }
  catch (e) { failed++; console.log(`FAIL: ${e.message}`); }
}
console.log(`Done. ${made} made, ${skipped} skipped, ${failed} failed.`);
process.exit(failed ? 2 : 0);
