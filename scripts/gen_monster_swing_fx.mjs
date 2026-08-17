#!/usr/bin/env node
// PER-MONSTER HEAVY-SWING VFX (ludo.ai text->sprite) — replaces the one shared
// teal crescent (Sprites/fx/fx_heavyswing.webp) that all 23 `bigMelee.kind:
// 'swing'` monsters drew, hue-tinted to their body colour.
//
// Per user: "Quite a lot of monsters use the animation sprite of the crescent,
// for each of the monsters routing to it create a unique sprite animation that
// is related or appropriate to the character for it using ludo.ai instead."
//
// Output: Sprites/fx/swing_<type>.webp  (the renderer prefers it over
// fx_heavyswing and skips the hue tint, since these are authored in-colour).
//
//   node scripts/gen_monster_swing_fx.mjs                    # list the jobs
//   node scripts/gen_monster_swing_fx.mjs --only thornmaw --generate
//   node scripts/gen_monster_swing_fx.mjs --generate         # all missing
//   node scripts/gen_monster_swing_fx.mjs --generate --force # redo existing
// Needs LUDO_API_KEY.
import { mkdir, writeFile, rename, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(repoRoot, 'Sprites', 'fx');
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const apiKey = process.env.LUDO_API_KEY;
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

// Every sprite is drawn stretched across the swing hitbox, sweeping LEFT->RIGHT
// (the renderer mirrors it for a left-facing swing), so the art must read as a
// single horizontal arc with its leading edge on the right.
const TAIL = ' Single horizontal crescent sweep reading left to right, leading edge and brightest '
  + 'point on the RIGHT, tapering tail on the left, wide flat arc shape filling the frame '
  + 'corner to corner, thick crisp outline, vibrant cartoon fantasy game VFX, glowing, '
  + 'transparent background, one single connected effect, no character, no weapon, no text.';

// type -> the swing that monster would actually make
const JOBS = {
  scorpion:      'a curved amber-gold pincer slash — two hooked claw trails crossing in a fast scissor arc, sandy dust flecks',
  mummy:         'a sweep of tattered pale bandages whipping through the air, dry dust and linen shreds trailing behind the arc',
  nougatBear:    'a soft honey-gold claw swipe — three plump rounded claw trails through the air with warm caramel-nougat droplets and tiny sugar sparkles',
  thornmaw:      'a snapping bramble bite arc — green thorned vines and jagged wooden teeth lashing across, torn leaves and splinters',
  smithgolem:    'a heavy grey iron sweep — a blunt forge-steel arc with orange sparks showering off the leading edge and a shockwave of soot',
  shardlich:     'a pale blue glass-shard arc — dozens of sharp translucent ice-glass slivers fanned along the sweep, cold frost mist',
  ossuaryTyrant: 'a bone-white reaping arc built from interlocking rib bones and skull fragments, sickly pale grave-light along the edge',
  echoKnight:    'a violet-steel greatsword slash with a second GHOSTED echo arc trailing just behind it, pale afterimage doubling the sweep',
  pathsBane:     'a great scythe reap — a long dark amber curved blade trail with crimson-black energy bleeding along the cutting edge',
  blockPopo:     'a chunky bright-yellow toy-block sweep — square blocky segments arcing through the air like a builder-brick swipe, cheerful',
  blockHupo:     'a chunky warm-orange toy-block sweep — square blocky segments arcing through the air, small flame-lick accents, cheerful',
  blockRhirhi:   'a chunky plum-pink toy-block sweep — square blocky segments arcing through the air with sparkle accents, cheerful',
  blockGary:     'a chunky leaf-green toy-block sweep — square blocky segments arcing through the air with leaf accents, cheerful',
  deranged_kuro: 'an erratic purple shadow-claw slash — three ragged violet claw trails, frayed and jittering, wisps of dark smoke',
  willeo:        'a broad tan greatsword cleave — one heavy clean steel arc with a pale dust wake and a bright hard edge',
  young_confused_barnaby: 'TWO crossed golden sentinel slashes going opposite ways at once, an indecisive double sweep, warm gold with white-hot cores',
  fatDragon:     'a scorching red-orange dragon tail-whip arc wreathed in fire, embers and smoke curling off the trailing edge',
  sundered_smith:'a molten forge-hammer sweep — a dark cracked arc glowing with orange magma in its fissures, sparks and anvil-ring shockrings',
  goblinMauler:  'a crude green-brown wooden club swipe — a heavy blunt arc with chipped bark, dirt clods and a dusty impact wake',
  graveReaver:   'a charcoal-black cleaving sweep — a broad ragged dark arc edged in cold grey grave-light, shredded shadow tatters',
  // NOTE: these two declare bigMelee on a CONTINUATION line, so a naive
  // "type: { ... bigMelee" scan misses them. Any bigMelee whose kind is not
  // 'smash' routes to the crescent — that, not the presence of swingW, is the
  // test for whether a monster belongs in this table.
  pqConductor:   'a sweeping conductor\'s baton slash — a crisp pale-blue arc of musical energy with floating gold quaver notes and staff lines trailing along the sweep',
  legosaurus:    'a heavy green blocky tail-club sweep — a chunky toy-brick arc of interlocking green blocks, studs catching the light, dust and scattered bricks at the leading edge',
  towerWarden:   'a wide ceremonial lilac halberd sweep — a formal polished arc with pale violet ribbon streamers along the trail',
  towerArbiter:  'an immense golden judgement sweep — a vast radiant gold arc with sharp verdict-light rays and floating rune glyphs along it',
  towerSovereign:'a blinding ivory-white apex sweep — a colossal pale-gold arc collapsing into a bright singularity seam, cosmic dust',
};

const W = 512, H = 224;   // wide — matches how the renderer stretches it
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const exists = async (p) => { try { await access(p); return true; } catch { return false; } };

async function fetchBuf(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(90000) });
  if (!r.ok) throw new Error('fetch ' + r.status);
  return Buffer.from(await r.arrayBuffer());
}

async function gen(type, body) {
  const prompt = 'game vfx sprite, ' + body + '.' + TAIL;
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(`${API}/assets/image`, {
        method: 'POST',
        headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_type: 'sprite', art_style: 'Anime/Manga',
          aspect_ratio: attempt >= 3 ? 'ar_1_1' : 'ar_16_9',
          n: 1, augment_prompt: false, prompt,
        }),
        signal: AbortSignal.timeout(120000),
      });
      if (!res.ok) throw new Error(`image ${res.status}: ${(await res.text()).slice(0, 120)}`);
      const data = await res.json();
      const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
      if (!url) throw new Error('no url in response');
      const raw = await fetchBuf(url);
      let content; try { content = await sharp(raw).trim().toBuffer(); } catch { content = raw; }
      const inner = await sharp(content).resize(W, H, { fit: 'fill' }).png().toBuffer();
      const out = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite([{ input: inner, gravity: 'center' }]).webp({ quality: 92 }).toBuffer();
      await mkdir(DIR, { recursive: true });
      const dest = join(DIR, `swing_${type}.webp`);
      const tmp = dest + '.tmp';
      await writeFile(tmp, out);
      await rename(tmp, dest);
      return { type, bytes: out.length };
    } catch (e) { lastErr = e; await sleep(1500 * attempt); }
  }
  throw lastErr;
}

const only = arg('--only');
const list = Object.keys(JOBS).filter((t) => !only || t === only);
if (!has('--generate')) {
  console.log(`${list.length} swing FX jobs (dry run — pass --generate):`);
  for (const t of list) console.log('  swing_' + t + '.webp');
  process.exit(0);
}
if (!apiKey) { console.error('LUDO_API_KEY not set'); process.exit(1); }

let ok = 0, skip = 0, fail = 0;
for (const t of list) {
  const dest = join(DIR, `swing_${t}.webp`);
  if (!has('--force') && await exists(dest)) { console.log('skip (exists) ' + t); skip++; continue; }
  try {
    const r = await gen(t, JOBS[t]);
    console.log(`OK   swing_${t}.webp  ${Math.round(r.bytes / 1024)}KB`);
    ok++;
  } catch (e) { console.log(`FAIL ${t}: ${String(e.message).slice(0, 110)}`); fail++; }
}
console.log(`\n${ok} generated, ${skip} skipped, ${fail} failed`);
process.exit(fail ? 1 : 0);
