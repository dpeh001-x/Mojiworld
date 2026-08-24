#!/usr/bin/env node
// Regenerate animation sets from newly-dropped base sprites (ludo.ai
// /assets/sprite/animate). Per user: new art landed in Sprites/, and any of it
// that drives an animation sequence needs its frames rebuilt from the NEW base
// — otherwise the static sprite and its animation disagree.
//
// Candidates land in scripts/_style_pack/anim_regen/<key>/ ; install is a
// separate step, so a bad roll never overwrites shipped frames.
//   node scripts/regen_anim_from_base.mjs              # dry-run, lists targets
//   node scripts/regen_anim_from_base.mjs --generate   # needs LUDO_API_KEY
//   flags: --only=<key>
import sharp from 'sharp';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_ROOT = join(repoRoot, 'scripts', '_style_pack', 'anim_regen');
const argv = process.argv.slice(2);
const val = (f, d) => { const a = argv.find((x) => x.startsWith(f + '=')); return a ? a.split('=')[1] : d; };

const FRAMES = 9, SIZE = 768;
const HOLD = ' The effect stays CENTRED in frame throughout — no drifting, no camera move, no new objects entering, ' +
  'and nothing is cropped at the edges. Fully transparent background, consistent art style across every frame.';

const TARGETS = {
  comet: { base: 'Sprites/projectiles/p_comet.webp', dir: 'Sprites/projectiles/anim',
    motion: 'The comet hurtles forward: its burning tail streams and flickers behind it, the icy core pulses brighter and dimmer, ' +
      'small sparks and debris peel off the trail, and the whole rock rotates very slightly as it flies.' },
  goo: { base: 'Sprites/projectiles/p_goo.webp', dir: 'Sprites/projectiles/anim',
    motion: 'The blob of goo wobbles and jiggles like thick slime in flight: it squashes and stretches, its surface ripples, ' +
      'a few droplets bulge out and are reabsorbed, and highlights slide across the wet surface.' },
  octoHead: { base: 'Sprites/projectiles/p_octohead.webp', dir: 'Sprites/projectiles/anim',
    motion: 'The octopus head pulses as it flies: the bulbous head squashes and swells with each beat, ' +
      'its tentacles undulate and curl in rippling waves, and the eyes glint. A living, breathing creature in motion.' },
  // v0.29.x — the p_pincer base was restyled into the house look, so its
  // 9-frame set has to be rebuilt from the NEW base or the static sprite and
  // its animation disagree (the exact failure this script exists for).
  pincer: { base: 'Sprites/projectiles/p_pincer.webp', dir: 'Sprites/projectiles/anim',
    motion: 'The tentacle pincer snaps: the two thick curved tentacle arms open wide apart, then clamp shut fast ' +
      'and spring slightly open again, the rubbery segments squashing and flexing with the bite while the rows of ' +
      'suckers ripple along the inner edges and highlights slide across the glossy skin.' },
  // v0.30.x — King Gloopaloo's gel puddle. _VFX_ANIM_BASE already maps
  // gloopPuddle -> 'gloop_puddle', so dropping frames here animates it with no
  // code change; only the frame index has to learn the new set.
  gloop_puddle: { base: 'Sprites/vfx/gloop_puddle.webp', dir: 'Sprites/vfx/anim',
    motion: 'The puddle of thick cyan slime seethes in place: its surface undulates in slow gloopy waves, ' +
      'round bubbles swell up from inside, dome the surface and pop, the rim lobes bulge and settle, ' +
      'and highlights slide across the wet gel. The puddle stays flat on the ground and keeps its outline.' },
  // v0.30.x — Barnaby's ATTACK set (per user: "barnaby action animation
  // should also be a strong punch forward"). The shipped set has him charging
  // BLUE LIGHTNING in both fists and throwing a swirl — no punch in it at
  // all, and the lightning fights the bare-knuckle boxer he is everywhere
  // else. Rebuilt as one committed straight right with a flaming fist, to
  // match the projectile his charge now throws.
  barn_attack: { base: 'Sprites/bosses/young_confused_barnaby.webp', dir: 'Sprites/bosses/attack',
    motion: 'The bare-knuckle boxer throws ONE strong straight punch forward to the right: he loads his weight ' +
      'back and cocks the right fist by his chin, then drives it out in a full committed straight punch, arm ' +
      'extending all the way, shoulder rotating in behind it, and the punching fist ERUPTS IN ORANGE FLAME with ' +
      'embers trailing off the knuckles at full extension, then he recoils the fist back to guard. His other hand ' +
      'stays up guarding his face throughout. No lightning, no blue energy, no weapon.' },
  cloudburst: { base: 'Sprites/vfx/cloudburst.webp', dir: 'Sprites/vfx/anim',
    motion: 'The cloud burst blooms outward from nothing: it swells and billows rapidly, churning and rolling as it expands, ' +
      'then thins and dissipates into wisps that fade away at the edges.' },
  quake_ring: { base: 'Sprites/vfx/quake_ring.webp', dir: 'Sprites/vfx/anim',
    motion: 'The shockwave ring expands outward from the centre: the ring grows steadily wider and thinner as it travels, ' +
      'dust and debris kick up along its leading edge, and the whole ring fades as it spreads.' },
  // v0.30.x — Doombringer's homing doom-fire. The key IS the anim key: frames
  // land as Sprites/projectiles/anim/p_doom_fireball_0..8.webp, which is what
  // _projAnimFrame('p_doom_fireball') loads for the bult_doomfire sprite.
  // It must LOOP and must not drift: the engine rotates the sprite to its
  // velocity every frame, so any translation baked into the frames fights the
  // steering, and a burn-out ending would leave the fireball invisible for
  // most of its flight.
  p_doom_fireball: { base: 'Sprites/projectiles/p_doom_fireball.webp', dir: 'Sprites/projectiles/anim',
    motion: 'The fireball burns in place without moving across the frame, staying centred and still pointed to the ' +
      'right: the white-hot core pulses brighter and dimmer, the crimson flame layers churn and roll around it, the ' +
      'jagged black flame licks at the rim flicker and reshape, the trailing tail of fire behind it ripples and ' +
      'whips, and embers flick off it. A continuous seamless loop that ends exactly as it began — it never shrinks, ' +
      'never burns out, never flies away.' },
  // v0.30.x — the shared warrior shockwave crescent. The key IS the anim key:
  // frames land as Sprites/projectiles/anim/shockwave_0..8.webp, which is what
  // _projAnimFrame('shockwave') loads for the generic player-projectile branch
  // (both the three-way fan and the bloodwave rider resolve to it).
  // The engine rotates this sprite to its velocity every tick and draws it in a
  // SQUARE box, so the frames must not translate and must not change the
  // silhouette's proportions - only the layers inside may move.
  shockwave: { base: 'Sprites/projectiles/p_shockwave.webp', dir: 'Sprites/projectiles/anim',
    motion: 'Keep the crescent EXACTLY as it is drawn. Its outline must be identical in every frame: the same ' +
      'wide open C-shape with the same gap on the left, the same sharp sawtooth spikes along the inner edge, the ' +
      'same thick body on the right. Do NOT close the opening into a ring or a hole, do NOT round off the ' +
      'spikes, do NOT smooth it into a swirl, do NOT rotate it, do NOT resize it, do NOT move it. The ONLY thing ' +
      'that changes is the light on it: the pale highlight travels slowly along the thick outer edge, the deep ' +
      'maroon shadows between the layered blades drift and breathe, and a few tiny red motes flick off the sharp ' +
      'tips. A continuous seamless loop that ends exactly as it began.' },
  // Wrappy's toilet-roll ball. The engine draws this one in `spin` mode at
  // 0.16 rad/frame, so the frames must NOT rotate it themselves - the tumble
  // is already there, and baking a second rotation in would beat against it.
  // What moves is the loose sheet flapping; the ball itself stays put.
  mwrap: { base: 'Sprites/projectiles/mwrap.webp', dir: 'Sprites/projectiles/anim',
    motion: 'The ball of toilet paper stays exactly where it is in the frame, the same size, and does NOT rotate ' +
      'or spin at all. Nothing unfurls and nothing sticks out: keep the smooth round silhouette unchanged in ' +
      'every frame, with no loose sheet, no trailing streamer and no flapping tail appearing at any point. The ' +
      'only movement is ON the ball: the wound paper layers shift and settle against one another, the soft ' +
      'shadows in the creases breathe, the quilted dimples flex, and a few tiny tissue fibres drift off the ' +
      'surface. A continuous seamless loop that ends exactly as it began.' },
  // v0.30.x — TAUR'S CHARGE SET (per user: 'The Taur should have a charge sprite
  // generated as well by ludo.ai then wire it in'). Zodiac bosses carry their own
  // frame sets under Sprites/bosses/zodiac/<state>/<sign>_N.webp; this adds a
  // fourth state, 'charge', drawn while the brace-dash runs. Authored at the base
  // sprite's exact dimensions so it overlays the portrait pixel-for-pixel, like
  // the attack/idle/walk sets beside it.
  taurus: { base: 'Sprites/bosses/zodiac/taurus.webp', dir: 'Sprites/bosses/zodiac/charge',
    motion: 'The granite bull CHARGES: he drops his head and levels his horns straight forward, front hooves '
      + 'digging in and throwing chips of stone, body low and driving hard to one side, hind legs extending in a '
      + 'full committed gallop, dust and grit kicking up around the hooves and streaming behind him. He builds '
      + 'from a braced crouch into a full sprint and holds it. He stays the same size and stays centred in frame '
      + '— it is the POSE that changes, not his position. A continuous loop that ends ready to begin again.' },
};

const only = val('--only', null);
const keys = only ? [only] : Object.keys(TARGETS);
for (const k of keys) if (!TARGETS[k]) { console.error('unknown target: ' + k); process.exit(1); }

if (!argv.includes('--generate')) {
  console.log(`regen ${keys.length} animation set(s), ${FRAMES} frames @ ${SIZE}\n`);
  for (const k of keys) {
    const t = TARGETS[k];
    console.log(`=== ${k}  base ${t.base}  ->  ${t.dir}/${k}_0..8`);
    console.log(t.motion + HOLD + '\n');
  }
  console.log('Re-run with --generate. Writes candidates only; install is separate.');
  process.exit(0);
}
const key = process.env.LUDO_API_KEY;
if (!key) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';

async function fetchBuf(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!r.ok) throw new Error('fetch ' + r.status);
  return Buffer.from(await r.arrayBuffer());
}
// Spritesheet-first, exactly as gen_bolt_anim.mjs does it: the endpoint answers
// with {spritesheet_url, num_cols, num_rows} even when individual_frames is set.
async function framesFrom(data, n) {
  if (data.spritesheet_url && data.num_cols && data.num_rows) {
    const cols = data.num_cols, rows = data.num_rows;
    const sheet = await fetchBuf(data.spritesheet_url), meta = await sharp(sheet).metadata();
    const cw = Math.floor(meta.width / cols), ch = Math.floor(meta.height / rows), o = [];
    for (let r = 0; r < rows && o.length < n; r++) for (let c = 0; c < cols && o.length < n; c++)
      o.push(await sharp(sheet).extract({ left: c * cw, top: r * ch, width: cw, height: ch }).png().toBuffer());
    if (o.length >= n) return o;
  }
  const urls = data.individual_frame_urls || [];
  if (urls.length >= n) { const o = []; for (let i = 0; i < n; i++) o.push(await fetchBuf(urls[i])); return o; }
  throw new Error('no usable frames: ' + JSON.stringify(data).slice(0, 200));
}
// One shared box, no per-frame trim — trimming each frame independently
// re-centres them and makes the effect jitter through the loop.
const normalise = (buf, w, h) => sharp(buf)
  .resize(w || SIZE, h || SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .webp({ quality: 92 }).toBuffer();

for (const k of keys) {
  const t = TARGETS[k];
  const basePath = join(repoRoot, t.base);
  if (!existsSync(basePath)) { console.log('SKIP ' + k + ' — base missing: ' + t.base); continue; }
  const outDir = join(OUT_ROOT, k);
  await mkdir(outDir, { recursive: true });
  const uri = 'data:image/png;base64,' +
    (await sharp(await readFile(basePath)).resize(990, 990, { fit: 'inside', withoutEnlargement: true }).png().toBuffer()).toString('base64');
  let done = false, last;
  for (let attempt = 1; attempt <= 3 && !done; attempt++) {
    try {
      process.stdout.write(`animate ${k} attempt ${attempt} ... `);
      const res = await fetch(`${API}/assets/sprite/animate`, {
        method: 'POST',
        headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(600000),
        body: JSON.stringify({ initial_image: uri, motion_prompt: t.motion + HOLD, frames: FRAMES, frame_size: -9, model: 'eagle', individual_frames: true }),
      });
      if (!res.ok) throw new Error(res.status + ': ' + (await res.text()).slice(0, 140));
      const bufs = await framesFrom(await res.json(), FRAMES);
      // Match the BASE's geometry rather than a hardcoded square. gloop_puddle
      // is a 512x256 ground decal; letterboxed into 768x768 its frames would
      // render visibly smaller than the static sprite they replace — a size pop
      // the instant the animation takes over.
      const _bm = await sharp(basePath).metadata();
      const _written = [];
      for (let i = 0; i < FRAMES; i++) {
        const _f = join(outDir, `${k}_${i}.webp`);
        await writeFile(_f, await normalise(bufs[i], _bm.width, _bm.height));
        _written.push(_f);
      }
      console.log(`OK — ${FRAMES} frames`);
      // v0.30.x — FRAMING, automatically. The animator re-composes to fill the
      // canvas, so frames routinely come back edge-to-edge even when the base
      // was fitted, and anything drawn fitted to a box then shows a shaved
      // outline (see the mwrap "bit of cutoff"). match-base, NOT inset-to-
      // margin: the base here is shipped art that is usually already framed, so
      // insetting the whole set again would shrink it a second time. Mapping
      // the frames onto the base's own box leaves the base alone and keeps the
      // static sprite and its loop the same size.
      if (!argv.includes('--no-fit')) {
        try {
          const { fitFramesToBase } = await import('./fit_sprite_frames.mjs');
          await fitFramesToBase(basePath, _written, { write: true, log: (m) => console.log('  ' + m) });
        } catch (e) { console.log('  fit skipped: ' + String(e.message).slice(0, 100)); }
      }
      done = true;
    } catch (e) {
      last = e; console.log('fail: ' + String(e.message).slice(0, 120));
      if (attempt < 3) await new Promise((s) => setTimeout(s, 5000 * attempt));
    }
  }
  if (!done) console.log('FAILED ' + k + ': ' + (last && String(last.message).slice(0, 140)));
}
console.log('\ncandidates in scripts/_style_pack/anim_regen/ — shipped frames untouched');
