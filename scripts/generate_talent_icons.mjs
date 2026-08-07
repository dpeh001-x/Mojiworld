#!/usr/bin/env node
// Job-talent icons (ludo.ai) — the 27 JOB_TALENTS picks, 3 per advanced job.
// Output -> Sprites/talents/<id>.webp (256, lossless). Wired via _talentIconHtml().
//   node scripts/generate_talent_icons.mjs                 # dry-run, lists ids
//   node scripts/generate_talent_icons.mjs --generate      # all (skip-existing)
//   node scripts/generate_talent_icons.mjs --generate --only bulwark,crusade --force
// Needs LUDO_API_KEY.
//
// Writes .webp, NOT .png like generate_boon_icons.mjs: the v0.29.286 pass moved
// every sprite to WebP, and five separate icon families broke this year because
// code and disk disagreed on the extension. A generator that still emits PNG is
// how that gap reopens.
import sharp from 'sharp';
import { writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(repoRoot, 'Sprites', 'talents');
const SIZE = 256;
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

// Same house style as the boon icons (Sprites/boons) — these sit in the same
// UI at similar sizes, so a different look would read as a mismatch.
const PREFIX = 'A single physical die-cut VINYL STICKER, floating alone on a FULLY TRANSPARENT alpha background — ' +
  'like a sticker peeled off its sheet with nothing behind it. The ONLY thing in the image is the subject shape itself. ' +
  'CRITICAL: do NOT paint any square, rounded-square, circle, badge, tile, card, plaque, panel, medallion, button or coloured backdrop behind the subject. ' +
  'The area around the subject must be EMPTY / transparent — not dark blue, not navy, not teal, not white, not any colour. ' +
  'Style: clean chibi-anime game art, bold simple shapes, thin even ~2px solid black outline, vibrant flat colours, light cel shading, thin white sticker rim around the silhouette. ' +
  'Centered, about 82% of the frame. NO TEXT of any kind. The sticker subject is: ';

// id -> concrete subject. Each reads its TALENT'S EFFECT, not just its name, so
// the icon teaches what the pick does at a glance.
const TALENT = {
  // berserker
  // v0.29.x — this came back a CLEAN grey axe THREE times, including once with
  // the blood moved to the front of the sentence and capitalised. The tell is
  // vampedge: same lifesteal effect, renders its drain perfectly, and its
  // prompt never says "blood" — it says "red life-motes". The endpoint appears
  // to sanitise gore wording and hand back the un-bloodied subject. So the
  // drain is now described in energy vocabulary that is known to work here,
  // which reads as lifesteal anyway and survives the filter.
  bloodrush:  'a heavy notched war-axe with glowing crimson red life-energy streaming down its blade in thick luminous rivulets and spiralling back up the shaft as bright red life-motes being absorbed inward, the whole axe lit by an intense red drain glow',
  // v0.29.x — DESIGN REHAUL (user). The fist rendered flat and bare: no aura,
  // no anger marks, just a red hand, and it read as a generic "punch" icon
  // rather than berserker fury. Redesigned around a horned helm instead, which
  // carries the rage in its silhouette. Deliberately not an axe — warbreaker
  // (crossed axes) and bloodrush (single axe) already own that shape.
  // The redesign came back a BARE grey viking helm — no flames, no anger marks
  // — which is the identical failure the old fist had, and the same one
  // bloodrush had: this endpoint draws the noun it hits first and quietly drops
  // whatever the sentence adds afterwards. bloodrush was fixed by promoting the
  // effect to the front, so rampage is too. The fire is now the subject and the
  // helm is what the fire is wrapped around.
  rampage:    'a roaring blaze of red-orange fury fire completely engulfing and pouring off a dark iron horned war-helm, huge flames streaming upward from the eye slits and over the two curved horns, jagged bright yellow anger marks cracking outward through the fire, the flames dominate the image and the helm is silhouetted inside them',
  warbreaker: 'two crossed battle-axes with a bright white shockwave crack splitting the air between them, chips of shattered steel flying outward',
  // knight
  bulwark:    'a tall heavy tower shield seen head-on with a reinforced steel boss and a rivet border, a hard blue-white guard glow tracing its outline',
  crusade:    'a knight longsword pointing up wreathed in radiant golden holy light, a soft cross-shaped flare behind the crossguard, warm divine rays',
  // v0.29.x — "barrier shield" / "protective wall" kept producing a heart on a
  // flat rounded-square TILE, which the PREFIX explicitly forbids. Naming a
  // concrete heater-shield silhouette gives the model a shape to draw instead
  // of a pane, and the forbidden words are gone from the subject line.
  lifewall:   'a glossy red heart mounted on the front of a pointed medieval heater shield with a steel rim and rivets, the shield tapering to a point at the bottom, heart glowing warmly against the metal',
  // ninja
  shadowfeet: 'a black split-toe ninja tabi boot mid-stride at a dynamic angle, a swirling purple-grey smoke trail streaming off the heel, speed streaks',
  // v0.29.x — "kunai" produced a grey faceted GEM twice, which is a fair reading
  // (a kunai really is a diamond-shaped blade) but reads as a crystal, not a
  // weapon. Naming the handle, wrap and ring pommel forces a recognisable knife.
  keenedge:   'a ninja dagger held at a sharp diagonal, dark cloth-wrapped handle with a steel ring pommel at its base and a narrow polished steel blade, a brilliant white crit-glint flashing along the cutting edge, clearly a bladed weapon and NOT a gem or crystal',
  // v0.29.x — the "wooden target" put the shuriken on a round red BOARD, i.e.
  // the circular badge the PREFIX forbids. The target is dropped entirely; the
  // weak-point read now comes from the crack and the glint, not from a backing.
  exploit:    'a single black four-pointed shuriken at a dynamic angle with a bright yellow-white weak-point glint flashing at its centre and jagged impact cracks radiating outward from behind it, no target board and no backing disc of any kind',
  // assassin
  cutthroat:  'a curved assassin dagger held at a steep angle, a razor crit-gleam running the blade and a single crimson droplet at its tip',
  vampedge:   'a slim dagger with dark leathery bat wings unfurling from its guard, red life-motes spiralling up the blade toward the wings',
  executioner:'a bleached skull with two heavy executioner blades crossed behind it, a cold violet death-glow burning in the eye sockets',
  // archmage
  overflow:   'a faceted blue mana crystal cracked open and overflowing with luminous cyan energy spilling out and streaming back in as small orbs',
  archon:     'a swirling arcane vortex sigil of concentric violet and cyan runic rings spiralling into a brilliant white core, small glyphs orbiting it',
  mindspring: 'a glowing translucent brain formed of blue mana light with a bright fountain of arcane droplets springing upward out of it',
  // warlock
  soulfeast:  'a large sinister floating eye with a slit pupil, ghostly green soul-wisps being drawn into it from all sides, devouring theme',
  hexweaver:  'a taut purple spider-web with a glowing violet hex rune burning at its centre, dark energy crackling along the strands',
  darkpact:   'a black crescent moon eclipsed by a clawed demonic hand, thin crimson contract runes burning in an arc around it',
  // priest
  benediction:'an ornate golden chalice brimming with luminous white holy liquid, warm blessing light and small sparkles rising from the brim',
  sanctuary:  'a radiant translucent dome of golden holy light over a small stone chapel arch, protective rays fanning out from its apex',
  zeal:       'a fierce blazing sun emblem with sharp golden flame-rays, a bright white-hot core and radiant heat shimmer',
  // sniper
  deadeye:    'a precision rifle scope crosshair reticle seen head-on with a sharp focused eye visible through the glass, a bright targeting glint',
  // v0.29.x — DESIGN REHAUL (user). The old prompt named the plate before the
  // bullet and the model drew ONLY the plate — a grey slab with a hole in it,
  // indistinguishable from a cracked rock. Redesigned around PENETRATION DEPTH:
  // the round leads the sentence, and three plates in a row make "goes through
  // everything" the subject instead of "something was hit".
  // Second rehaul pass. The three-plate version was correct but unreadable: at
  // the 36px these icons actually render at, bullet and plates merged into one
  // gold-and-grey blob. Multi-object scenes do not survive the downscale — the
  // icons that read here are all ONE bold silhouette. So the plates are cut to
  // a single small shattering fragment at the tip, which sells penetration
  // without competing, and the round itself is the whole shape.
  piercing:   'ONE single large brass bullet flying at a steep diagonal and filling the frame, its pointed nose glowing white-hot, a bold bright cyan-white tracer streak trailing straight behind it, and one small steel plate fragment shattering into a few sharp pieces right at its tip, simple bold readable shapes and no other objects',
  swifthands: 'a pair of gloved hands snapping a rifle bolt back at a dynamic angle, sharp white speed streaks and a spent brass casing flying',
  // ranger
  // v0.29.x — DESIGN REHAUL (user). The literal stag was a pale, thin-lined
  // wildlife illustration that dissolved at the 36px the icon actually renders
  // at. Redesigned so the SPEED is the subject and the deer is only its shape:
  // the animal is made of wind, which reads at any size. Not a boot on purpose
  // — shadowfeet already is one, and two boots in one talent list is a miss.
  fleetfoot:  'a leaping stag formed entirely OUT OF streaming emerald-green wind currents and flying leaves, its body translucent and hollow like rushing air given the shape of a deer, bold sweeping motion trails curving off its back and antlers',
  // v0.29.x — DESIGN REHAUL (user). "A heart in its chest fur" came back as a
  // bear head with a heart floating BESIDE it — two objects sharing a sticker,
  // which is the one thing the house style avoids. Redesigned as a single
  // fused object. Kept green-and-bark dominant on purpose so it cannot be
  // confused with lifewall, the other heart icon, which is glossy red on steel.
  wildheart:  'a single large heart carved from dark weathered wood and bark, thick green moss and small leaves growing across its surface and short antler branches curling up from its top, a warm red inner light glowing out through the cracks in the bark',
  huntsmark:  'a fletched hunting arrow at a steep diagonal with a glowing emerald rune-mark blazing on its shaft, a soft tracking glow around the tip',
};

// The prompt asks for the subject to fill ~82% of the frame; measured output
// ranged 47-63%, which would render every icon visibly smaller than the emoji
// it replaces AND at inconsistent sizes next to each other. Asking the model
// again is a dice roll — trimming to the actual alpha bounds and re-padding to
// a fixed margin is deterministic and makes all 27 match exactly.
const FILL = 0.86;
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };
async function normalize(buf) {
  const inner = Math.round(SIZE * FILL);            // 220 of 256
  const pad = Math.round((SIZE - inner) / 2);       // 18 a side
  // trim to the real alpha bounds, letterbox to exactly `inner`, then pad out.
  // Finishing with a resize(SIZE, contain) instead would UPSCALE the letterbox
  // back to full width and destroy the margin this exists to create.
  const fitted = await sharp(await sharp(buf).trim({ threshold: 4 }).toBuffer())
    .resize(inner, inner, { fit: 'contain', background: CLEAR })
    .toBuffer();
  return await sharp(fitted)
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: CLEAR })
    .webp({ lossless: true, alphaQuality: 100, effort: 6 }).toBuffer();
}

const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
async function fetchBuf(u) { const r = await fetch(u, { signal: AbortSignal.timeout(120000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); }

let keys = Object.keys(TALENT);
const only = arg('--only');
if (only) keys = keys.filter((k) => only.split(',').some((o) => (o.endsWith('*') ? k.startsWith(o.slice(0, -1)) : k === o)));
if (!keys.length) { console.error('No matching talents.'); process.exit(1); }
// `--normalize-only` is a real action, not a dry run — it must not fall into
// the listing branch below just because --generate is absent.
if (!has('--generate') && !has('--normalize-only')) {
  console.log(`# ${keys.length} talent icons -> Sprites/talents/<id>.webp (${SIZE}x${SIZE})\n`);
  for (const k of keys) console.log('  ' + k);
  console.log('\n# Re-run with --generate (needs LUDO_API_KEY). Flags: --force --only a,b');
  process.exit(0);
}

// --normalize-only re-frames icons already on disk. Generation and framing are
// separate concerns, and re-rolling the API to fix margins would burn credits
// on art that is already correct.
if (has('--normalize-only')) {
  const { readFile } = await import('node:fs/promises');
  let n = 0;
  for (const k of keys) {
    const bp = join(OUT_DIR, `${k}.webp`);
    if (!await exists(bp)) { console.log(`  ${k} ... absent`); continue; }
    await writeFile(bp, await normalize(await readFile(bp)));
    n++; console.log(`  ${k} ... reframed`);
  }
  console.log(`Done. ${n} normalized to ${Math.round(FILL * 100)}% fill.`);
  process.exit(0);
}

const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const TIMEOUT = Number(process.env.LUDO_REQ_TIMEOUT_MS || 180000);
const force = has('--force');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function gen(k) {
  const bp = join(OUT_DIR, `${k}.webp`);
  if (!force && await exists(bp)) return 'skip';
  let last;
  for (let a = 1; a <= 4; a++) {
    try {
      const res = await fetch(`${API}/assets/image`, {
        method: 'POST', headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(TIMEOUT),
        body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt: PREFIX + TALENT[k] + '.' }),
      });
      if (!res.ok) { const t = await res.text(); if (/\b402\b/.test(t)) throw new Error('402 OUT OF CREDITS'); throw new Error(res.status + ': ' + t.slice(0, 140)); }
      const data = await res.json();
      const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
      if (!url) throw new Error('no url');
      await mkdir(OUT_DIR, { recursive: true });
      await writeFile(bp, await normalize(await fetchBuf(url)));
      return 'OK';
    } catch (e) { last = e; if (/402/.test(e.message)) throw e; if (a < 4) await sleep(3000 * a); }
  }
  throw last;
}

console.log(`Generating ${keys.length} talent icons (force:${force})...`);
let made = 0, skipped = 0, failed = 0;
for (const k of keys) {
  process.stdout.write(`  ${k} ... `);
  try { const r = await gen(k); if (r === 'skip') { skipped++; console.log('skip'); } else { made++; console.log('OK'); await sleep(350); } }
  catch (e) { failed++; console.log('FAIL: ' + e.message); if (/402/.test(e.message)) { console.log('*** OUT OF CREDITS ***'); process.exit(3); } }
}
console.log(`Done. ${made} made, ${skipped} skipped, ${failed} failed.`);
process.exit(failed ? 2 : 0);
