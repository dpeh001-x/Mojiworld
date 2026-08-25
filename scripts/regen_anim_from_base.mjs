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

// v0.30.x — framing stated in terms of the BODY, not "the effect". The shared
// HOLD line says the effect stays centred and uncropped, which the animator read
// as being about the flames while it pushed the camera into the character. This
// names the two extremes that must survive — the top of the head and the soles
// of the feet — and forbids the specific move that broke both Gravitos-3 sets.
const FULLBODY = ' FRAMING, and this matters more than anything else: the ENTIRE figure stays inside the frame in ' +
  'every single frame, from the tips of the horns down to the soles of the feet and out to both wingtips. The ' +
  'camera does NOT push in, zoom, crop or move closer across the sequence - it is locked off. The character ' +
  'occupies the same fraction of the frame in the last image as in the first, with the same empty margin around ' +
  'him. Never a close-up, never cropped at any edge.';

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
  // v0.30.x - REGULUS'S POUNCE (per user: "regulus when jumping should have a
  // jump sprite" ... "it should be like a pouncing action"). His gait leaps -
  // vy = -9.5 with a 700ms landing recovery - and the whole airborne arc drew
  // the walk loop, so the lion crossed the arena trotting through the air.
  // Frames land in Sprites/bosses/zodiac/pounce/ and drive a new zodiac state.
  //
  // The ENGINE owns his position for the whole jump, so the frames must not
  // move him: the body holds the extended airborne pounce and only the mane,
  // tail and claws live. Animating the coil-and-launch here would loop into a
  // flapping motion in mid-air, because the loop plays for the whole arc.
  leo: { base: 'Sprites/bosses/zodiac/leo.webp', dir: 'Sprites/bosses/zodiac/pounce',
    motion: 'The lion is caught MID-POUNCE in the air and stays there: body stretched out long and level, ' +
      'front legs reaching forward with the claws spread wide, back legs trailing extended behind him, head ' +
      'low and forward with the jaws open. He does NOT land, does NOT crouch, does NOT fold up and does NOT ' +
      'move across the frame - hold that extended leaping pose the whole way through. What moves is the mane ' +
      'streaming and rippling back, the tail lashing, the claws flexing, and a few sparks of sun-fire trailing ' +
      'off his mane. A continuous seamless loop that ends exactly as it began.' },
  // v0.30.x - THE FAILED FORGE, REBUILT FROM THE SUCCESS ANVIL (per user:
  // "when regenerating the ludo.ai for failure animation use the success sprite
  // anvil as the base sprite"). The shipped fail set was drawn from a different
  // anvil entirely - lighter, chunkier, wearing a big cartoon smoke face - so
  // the two outcomes of the same action did not look like the same forge, and
  // the smoke plume was tall enough to cover the modal's own title. Same anvil,
  // same framing, only the outcome differs.
  forge_fail: { base: 'Sprites/fx/forge_success.webp', dir: 'Sprites/fx/anim',
    motion: 'A hammer blow lands on this anvil and the work FAILS. The bright molten glow along the anvil\'s top ' +
      'face flares white-hot for an instant, then gutters down to a dull dying red and goes out. Hairline cracks ' +
      'spread across the anvil face and darken. A short plume of grey smoke rises straight up from the anvil top ' +
      'and thins away, and a scatter of orange embers is thrown out sideways and falls, fading as they drop. ' +
      'The anvil itself does NOT move, tip, break apart or change shape - it is the same anvil in the same ' +
      'position in every frame, seen from the same angle; only the glow, the cracks, the smoke and the embers ' +
      'change. Keep the smoke SMALL and close to the anvil - no towering plume, no face in the smoke.' },
  // v0.30.x - GRAVITOS FORM 3, both cast sets rebuilt from their own bases.
  // Two different faults. The punch set had drifted OFF-MODEL: the base is a
  // four-armed winged demon and the shipped frames show a TWO-armed figure with
  // one wing swung round - a different character mid-attack. The soul set is
  // on-model but barely moves across a 1,900 ms channel, so the boss reads as
  // frozen exactly when it is supposed to be drawing power out of you.
  //
  // Both prompts carry the same two hard constraints, because the engine owns
  // the boss's position and size: FOUR arms and BOTH wings in every frame, and
  // no drifting or rescaling - only the pose changes.
  gravitos3punch: { base: 'Sprites/bosses/gravitos3punch.webp', dir: 'Sprites/bosses/attack', pad: 0.35,
    motion: 'This four-armed winged demon throws a single colossal PUNCH, and the nine frames are one strike ' +
      'from beginning to end. Frames 1-3: he plants, hauls his upper fists back and low, shoulders coiling, ' +
      'the round golden core in his chest flaring brighter and the red lava veins running hotter. Frames 4-6: ' +
      'the strike is thrown - the upper fists drive FORWARD and DOWN toward the viewer, the body torquing behind ' +
      'them, flame tearing off the knuckles. Frames 7-9: the blow has landed and he HOLDS there, fists extended, ' +
      'chest core at its brightest, fire still streaming off him. He keeps ALL FOUR arms and BOTH wings in every ' +
      'single frame - the lower pair of arms stays braced at his sides, the wings stay spread behind him. He does ' +
      'NOT step, walk, turn around, shrink, grow or drift across the frame, and he never becomes a two-armed ' +
      'figure. Same demon, same size, same place - only the pose moves.' + FULLBODY },
  gravitos3soul: { base: 'Sprites/bosses/gravitos3soul.webp', dir: 'Sprites/bosses/attack',
    motion: 'This four-armed winged demon stands his ground and CHANNELS, dragging the life out of everything ' +
      'around him. He is rooted - both feet planted, never taking a step. What builds across the nine frames is ' +
      'power: the round golden core in his chest swells and burns from a dull ember to a blinding white-gold ' +
      'sun, the red lava veins across his armour brighten and pulse outward from it, and the white-and-red flame ' +
      'around his body grows taller and streams upward. His four arms spread wider and lift, clawed fists ' +
      'opening as if pulling something invisible toward him, and his wings flare open wider behind him. Thin ' +
      'ribbons of stolen red energy spiral inward toward the chest core. The LAST frame is the peak of the ' +
      'channel and must be a strong sustained pose, because it is held. He keeps ALL FOUR arms and BOTH wings ' +
      'in every frame, and does NOT step, walk, turn, shrink, grow or drift - same demon, same size, same ' +
      'place, only the pose and the light change.' + FULLBODY },
  // v0.30.x - AETHERION'S IDLE, REBUILT WITH FOUR LEGS (per user: "regenerate
  // aetherion idle sprite animations to make sure aetherion has 4 limbs with
  // reference to the walking sprite").
  //
  // Measured across all 18 frames: every one of the nine IDLE frames draws the
  // dragon with only the near foreleg and near hindleg - the far pair is simply
  // absent, so a quadruped reads as standing on two. The base sprite has the
  // same fault and the idle set faithfully inherited it. The WALK set is the
  // only art that gets it right, and only in its mid-stride frames, where the
  // legs separate enough to be drawn individually (walk_0 and walk_8 are
  // two-legged like the idle; walk_1..7 are not).
  //
  // So the anatomy reference is walk_2, the widest-stance frame at 905 px of
  // content, and the FRAMING reference is the canonical base - see fitBase.
  // Fitting to walk_2 instead would hand the idle a 905 px box in place of the
  // ~660 px one its calibration was tuned against, and quietly resize Aetherion
  // every time it stopped moving.
  aetherion: { base: 'Sprites/bosses/walk/aetherion_2.webp', dir: 'Sprites/bosses/idle',
    fitBase: 'Sprites/bosses/aetherion.webp', pad: 0.2,
    motion: 'This crystalline white-and-gold dragon stands STILL and breathes - a calm idle, not a walk. All FOUR ' +
      'of its legs stay planted flat on the ground and clearly visible for the whole loop: the two near legs and ' +
      'the two far legs on the other side of its body, four separate feet on the ground at all times. It does NOT ' +
      'take a step, lift a foot, walk or move from the spot. What moves is quiet and small: its ribcage swells and ' +
      'settles with slow breathing, its folded wings shift and resettle, its long tail sways gently and the glowing ' +
      'orb at the tail tip pulses softly brighter and dimmer, its head tilts a little and its jaw and horns catch ' +
      'the light. A calm creature at rest, holding its ground. A CONTINUOUS SEAMLESS LOOP - the last frame flows ' +
      'back into the first with no jump.' + FULLBODY },
  // v0.30.x - AETHERION'S WALK, made consistent (per user, straight after the
  // idle). The walk set was the anatomy reference for that idle rebuild, and
  // measuring it is what exposed its own fault: walk_1..7 draw all four legs,
  // but walk_0 and walk_8 drop back to the near foreleg and near hindleg only.
  // Those two are the FIRST and LAST frames, so the loop pops from four legs to
  // two exactly at its seam, every cycle.
  //
  // Fitted to walk_2 rather than the base: that is the framing the walk
  // calibration (s 1.0457, dx -0.02) is already tuned against, and the set's own
  // frames run 659-905 px of content with the bulk near 900, so walk_2's box is
  // the one the existing numbers expect.
  aetherion_walk: { base: 'Sprites/bosses/walk/aetherion_2.webp', dir: 'Sprites/bosses/walk',
    stem: 'aetherion', pad: 0.2,
    motion: 'This crystalline white-and-gold dragon WALKS on all four legs, seen from the side. All FOUR legs stay ' +
      'drawn and distinct in every single frame - the two near legs and the two far legs on the other side of its ' +
      'body - and they move in a proper four-legged walking gait, each foot lifting, swinging forward, planting and ' +
      'pushing off in turn, so at any moment some feet are down and others are mid-step. Its body rocks gently with ' +
      'the stride, its head bobs slightly, its folded wings shift with the motion, and its long tail sways behind it ' +
      'with the glowing orb at the tip trailing after. It walks IN PLACE - it does not travel across the frame, does ' +
      'not slide, and does not get closer or further away. A CONTINUOUS SEAMLESS LOOP: the last frame flows straight ' +
      'back into the first with no jump and no change in the number of legs.' + FULLBODY },
  // v0.30.x - AETHERION'S ASTRAL JUDGEMENT (per user: "give aetherion a new
  // attacking sprite sequence for its unique attack").
  //
  // The attack is named in the AI: ASTRAL JUDGEMENT, his signature - a 1500 ms
  // telegraph that drains 99% of MP and takes 59% of max HP. What the engine
  // actually draws during that telegraph is a VIOLET AND GOLD SPIRAL COLLAPSING
  // INWARD onto him: particles seeded at radius 520 and pulled to the centre,
  // alternating #c8a8ff violet and #ffe899 gold. The shipped set is a generic
  // gold roar with a breath-burst - a good drawing of a different attack. This
  // set is that spiral, so the sprite and the particle telegraph finally agree.
  //
  // Built from attack_4, the existing set's own rear-up: it is the widest frame
  // at 958x764, so fitting back to it keeps the union the attack calibration
  // (s 1.6) is already tuned against.
  // v0.30.x - retargeted: this set is Aetherion's ASTRAL JUDGEMENT, not his
  // generic attack. The generic set went back to the original art (per user: the
  // regenerated one varied too much), and this one is now wired to the special
  // attack alone, so the stem writes aetherionastral_0..8.
  aetherion_astral: { base: 'Sprites/bosses/attack/aetherion_4.webp', dir: 'Sprites/bosses/attack',
    stem: 'aetherionastral', pad: 0.2,
    motion: 'This crystalline white-and-gold dragon calls down a single devastating spell, and the nine frames are ' +
      'one cast from start to finish. Frames 1-3: he plants his hind legs and rears up, wings sweeping wide open, ' +
      'head lifting and jaws parting, while faint VIOLET and GOLD motes wink into being far out around him. ' +
      'Frames 4-6: those motes become a dense spiral of violet and gold energy rushing INWARD from every side and ' +
      'converging on his chest - the ribbons curve as they come, his scales light from within, and his eyes blaze ' +
      'white. Frames 7-9: the gathered power detonates outward from him in a blinding white-gold flare with violet ' +
      'shards riding it, wings at full spread, head thrown back, and he HOLDS that final pose. He is rooted the ' +
      'whole time - he does not walk, step or leave the spot, and all FOUR of his limbs stay drawn: both hind legs ' +
      'planted and both forelegs raised and clawing the air. Violet and gold only - no red, no orange fire.' + FULLBODY },

  // v0.30.x - ASTRAL JUDGEMENT, take 2, after the user rejected the composite
  // ("change it to a much nicer sprite with animation using ludo.ai").
  //
  // Three rolls of aetherion_astral failed the same way: they asked the animator
  // to rear him up, sweep the wings, converge a spiral AND detonate it across
  // nine frames. That much requested change licenses it to redraw the whole
  // composition - it re-posed him side-on to front-on and pushed the camera in.
  // The idle and walk regenerations succeeded on this same boss because they
  // asked for SMALL change.
  //
  // So the body no longer moves. attack_4 is ALREADY the cast pose - reared up,
  // wings at full spread, jaws open, all four limbs drawn - so the prompt freezes
  // it there and spends every frame of change on the SPELL instead. That is also
  // what the engine telegraphs, and it is still real animation: the spiral
  // travels, the light builds, the wings tremble. The base is gold only, so the
  // violet has to be introduced - a colour change, which does not move him.
  aetherion_astral2: { base: 'Sprites/bosses/attack/aetherion_4.webp', dir: 'Sprites/bosses/attack',
    stem: 'aetherionastral', pad: 0.35,
    motion: 'A crystalline white-and-gold dragon, reared up on his hind legs with both wings spread wide and his ' +
      'jaws open, is CASTING A SPELL and holding that pose. HIS BODY DOES NOT MOVE: identical stance in all nine ' +
      'frames, same angle, same size, same position, both hind legs planted, both forelegs raised, wings at the ' +
      'same full spread. Do not re-pose him, do not turn him, do not change his size. What CHANGES is the magic. ' +
      'Frames 1-3: sparse VIOLET and GOLD motes wink into being in the empty air far out around him. Frames 4-6: ' +
      'they thicken into ribbons of violet and gold light that curve INWARD from every side and converge on his ' +
      'chest, his scales lighting from within and his eyes brightening. Frames 7-9: the gathered light blazes at ' +
      'his chest and bursts outward in a violet-and-gold flare. Across all of it his wings only tremble slightly ' +
      'and the glow pulses - nothing else about him alters. Violet and gold only: no red, no orange, no fire.' + FULLBODY },
};

const only = val('--only', null);
const keys = only ? [only] : Object.keys(TARGETS);
for (const k of keys) if (!TARGETS[k]) { console.error('unknown target: ' + k); process.exit(1); }

if (!argv.includes('--generate')) {
  console.log(`regen ${keys.length} animation set(s), ${FRAMES} frames @ ${SIZE}\n`);
  for (const k of keys) {
    const t = TARGETS[k];
    console.log(`=== ${k}  base ${t.base}  ->  ${t.dir}/${t.stem || k}_0..8`);
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
  // v0.30.x — HEADROOM AGAINST A CAMERA PUSH. `pad` extends the base canvas with
  // transparent margin on every side before it is sent. The animator has a habit
  // of drifting the camera IN across a sequence, and on a tall full-body
  // character that crops the legs and wingtips clean off — measured on both
  // Gravitos-3 cast sets, where frame 0 was perfect and frame 5 was a chest-up
  // close-up with the feet gone. Prompt wording alone did not hold it. Margin
  // does: a zoom of up to (1 + 2*pad) still lands inside the frame. It costs
  // nothing downstream because fitFramesToBase re-maps the finished frames onto
  // the base's own box, so the padding is normalised straight back out.
  const _padded = await (async () => {
    const raw = await readFile(basePath);
    const p = +t.pad || 0;
    if (!(p > 0)) return raw;
    const m = await sharp(raw).metadata();
    const dx = Math.round(m.width * p), dy = Math.round(m.height * p);
    return sharp(raw).extend({ top: dy, bottom: dy, left: dx, right: dx,
      background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  })();
  const uri = 'data:image/png;base64,' +
    (await sharp(_padded).resize(990, 990, { fit: 'inside', withoutEnlargement: true }).png().toBuffer()).toString('base64');
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
      // v0.30.x — UNDO THE PADDING. `pad` bought headroom against a camera push
      // by sending a base with transparent margin; the frames come back with the
      // character sitting in that same smaller fraction of the canvas. Cropping
      // the identical fraction back out restores the base's framing exactly, so
      // the margin never reaches the sprite sheet and fitFramesToBase downstream
      // sees inputs the size it has always seen.
      // v0.30.x — THE UN-PAD MAY NEVER REMOVE ART. Cropping a fixed central
      // fraction assumes the animator centred the subject in the padded canvas;
      // it does not. On Aetherion's Astral Judgement it drew the dragon low, and
      // the fixed crop sliced its legs off at a flat line 54 px up — identically
      // in all nine frames, which is what a straight cut looks like and what the
      // user saw. Worse, the numeric check missed it: faint particle motes drift
      // below the body, so the trimmed bbox still reported a healthy margin while
      // the legs were severed inside it.
      //
      // So the crop rectangle is now computed ONCE for the whole set: start from
      // the intended central window, then expand it until it contains the UNION
      // of every frame's content. One shared rectangle keeps the set's relative
      // motion intact (the reason this pipeline avoids per-frame trimming), and
      // the union guarantees the crop can only ever remove transparency.
      const _cropRect = await (async () => {
        const p = +t.pad || 0;
        if (!(p > 0)) return null;
        const m0 = await sharp(bufs[0]).metadata();
        const keep = 1 / (1 + 2 * p);
        const w = Math.round(m0.width * keep), h = Math.round(m0.height * keep);
        let L = Math.round((m0.width - w) / 2), T = Math.round((m0.height - h) / 2);
        let R = L + w, B = T + h;
        for (const buf of bufs) {
          const { info } = await sharp(buf).trim({ threshold: 10 }).toBuffer({ resolveWithObject: true });
          const cl = -info.trimOffsetLeft, ct = -info.trimOffsetTop;
          L = Math.min(L, cl); T = Math.min(T, ct);
          R = Math.max(R, cl + info.width); B = Math.max(B, ct + info.height);
        }
        L = Math.max(0, L); T = Math.max(0, T);
        R = Math.min(m0.width, R); B = Math.min(m0.height, B);
        return { left: L, top: T, width: R - L, height: B - T };
      })();
      if (_cropRect) console.log(`  unpad: shared crop ${_cropRect.width}x${_cropRect.height} at ${_cropRect.left},${_cropRect.top} (expanded to hold every frame)`);
      const _unpad = async (buf) => (_cropRect ? sharp(buf).extract(_cropRect).png().toBuffer() : buf);
      const _written = [];
      for (let i = 0; i < FRAMES; i++) {
        // v0.30.x — `stem` lets the TARGET KEY and the OUTPUT FILENAME differ.
        // Keys have to be unique, but one creature can own several sets that all
        // write <creature>_0..8 into different directories — Aetherion's idle and
        // walk are exactly that. Without this the second target would have to be
        // keyed 'aetherion_walk' and would write aetherion_walk_0.webp, which no
        // loader asks for. Defaults to the key, so every existing target is
        // untouched.
        const _f = join(outDir, `${t.stem || k}_${i}.webp`);
        await writeFile(_f, await normalise(await _unpad(bufs[i]), _bm.width, _bm.height));
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
          // v0.30.x — `fitBase` separates ANATOMY from FRAMING. A target can now
          // animate from one sprite and be fitted to the box of another, which is
          // what lets a set be rebuilt off a reference that draws the creature
          // correctly without inheriting that reference's framing — and so
          // without invalidating the calibration the game already holds for the
          // set being replaced. Defaults to the base, so every existing target
          // behaves exactly as before.
          const _fitTo = t.fitBase ? join(repoRoot, t.fitBase) : basePath;
          await fitFramesToBase(_fitTo, _written, { write: true, log: (m) => console.log('  ' + m) });
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
