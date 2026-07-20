#!/usr/bin/env node
// Monster idle + attack + walk animation runner — v0.26.330
// =============================================================================
// Same framework as the zodiac runner (eagle, frame_size:-9 True-Size, sliced
// from the spritesheet, resized to the EXACT base dimensions — no reframe/warp,
// so frames overlay the base sprite pixel-for-pixel). Output:
//   Sprites/monsters/{idle,attack,walk}/<type>_0..8.webp
//
//   node scripts/generate_monster_anim.mjs                          # dry-run
//   node scripts/generate_monster_anim.mjs --zone expedition --generate
//   node scripts/generate_monster_anim.mjs --zone all --generate
//   node scripts/generate_monster_anim.mjs --only ticketMech --mode walk --generate
// Needs LUDO_API_KEY. Resumable: skips a (type,mode) whose 9 frames exist.
// =============================================================================
import sharp from 'sharp';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const MON_DIR = join(repoRoot, 'Sprites', 'monsters');
const FRAMES = 9;
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

const ZONES = {
  wayfarer: ['forgewight','cinderling','bellowsbat','smithgolem','bonebosn','drownedCur','spectreCannoneer','brinekraken','razorgale','glasswindHare','mirageStalker','shardlich','lichkin','boneWraith','sepulchreHound','tombKeeper','mournshade','lanternWisp','echoKnight'],
  pq: ['ticketMech','conductorMech','expressTicketMech'],
  expedition: ['towerWisp','towerWarden','towerHexer','towerStalker','towerSeer','towerShardling','towerOssifer','towerStormcaller'],
};
// Full registered roster (MONSTER_SPRITE_TYPES). `--zone rest` = everything not
// already covered by wayfarer/pq/expedition; `--zone full` = all of them.
const ALL_TYPES = ['snail','slime','mushroom','gummy','cookie','frog','axolotl','horny','orange','stump','scorpion','nougatBear','honeyBuzz','skeleton','mummy','zombie','wraith','nimbusFox','cosmicMochi','coralImp','pearlSprite','sproutle','tideling','stoneling','voltipup','frostkin','emberling','skywisp','sandhusk','cherub','seraph','archon','clownfish','pufferfish','jellyfish','anglerfish','seahorse','seasponge','seastar','grumpsquid','mayo','fatLizard','fatDragon','octoLegPoison','octoLegFreeze','octoLegSkillLock','octoLegStun','forgewight','cinderling','bellowsbat','smithgolem','bonebosn','drownedCur','spectreCannoneer','brinekraken','razorgale','glasswindHare','mirageStalker','shardlich','lichkin','sepulchreHound','boneWraith','tombKeeper','mournshade','lanternWisp','echoKnight','pathsBane','petalfly','mushpup','tidefish','sparkling','cloudbun','deranged_kuro','future_lyra','potato_uncle','willeo','young_bloodthirsty_vermillion','vigil_vermillion','ticketMech','conductorMech','expressTicketMech','goblinScout','goblinMauler','boneGolem','tombWraith','graveReaver','stormKitty','sparkSprite','thunderMole','tidepoolTurtle','towerWisp','towerWarden','towerHexer','towerStalker','towerSeer','towerShardling','towerOssifer','towerStormcaller','blockPopo','blockHupo','blockEle','blockRhirhi','blockGary','blockTigreal','thornmaw','elderbark','pinechad','meloncholy'];
// On-disk filename differs from the in-game type key for these (mirrors
// MONSTER_SPRITE_ALIASES in the game). vigil_vermillion shares the young art.
const MONSTER_ALIASES = { pearlSprite: 'pearl', seasponge: 'reefmaw', seastar: 'tankstar', grumpsquid: 'sourpus', vigil_vermillion: 'young_bloodthirsty_vermillion' };   // v0.29.135 — seasponge alias ogsponge -> reefmaw (IP-safe redesign)

const FACING = ' Keep the EXACT same left/right facing and orientation as the source — never mirror or flip. Keep the EXACT same size, position and framing — do not zoom, pan, crop, or rescale.';
const MOTION = {
  idle:   'the creature idles in place — a subtle living loop: slow breathing, a slight sway and an occasional blink; only soft idle motion.' + FACING,
  attack: 'the creature performs its attack IN PLACE: it lunges/strikes or its weapon swings and bright energy charges at its body or weapon. Do NOT emit a long beam or projectile in any direction. ONE single connected body; do NOT duplicate or detach any limbs.' + FACING,
  walk:   'the creature performs a smooth looping WALK cycle IN PLACE (treadmill): its legs stride/step and its body bobs with each step, limbs swinging naturally. It does NOT travel or slide across the frame — it stays centered. ONE single connected body; do NOT duplicate or detach any limbs.' + FACING,
};
// Per-type WALK overrides — flying creatures should flap, not leg-walk.
const WALK_OVERRIDES = {
  // v0.29.137 — new-art authored walks.
  elderbark: 'elderbark the muscular treant warrior MARCHES in place (treadmill) — a heavy, weighty walk cycle: each thick wooden leg lifts and stomps down with clear knee bend, his broad shoulders and canopy crown rocking with each step, moss tufts and leaves bouncing, big fists swinging naturally in opposition to the legs. The steps must read HEAVY and clear — not a tiny sway. He does NOT travel or slide across the frame — he stays centered. CRITICAL: the BODY stays the EXACT same size and scale in EVERY frame — no zoom, no rescale. ONE single connected body; do NOT duplicate or detach any limbs.' + FACING,
  mournshade: 'the chibi gentleman vampire STROLLS in place (treadmill) — a composed, unhurried aristocratic walk cycle: his legs take small refined steps while his upper body stays poised and upright, the high-collared cape swaying and rippling gently with each step, arms swinging only slightly. He does NOT travel or slide across the frame — he stays centered. CRITICAL: the BODY stays the EXACT same size and scale in EVERY frame — no zoom, no rescale. ONE single connected body; do NOT duplicate or detach any limbs.' + FACING,
  // v0.29.137 — towerSeer is a legless floating ghost: drift, don't walk.
  towerSeer: 'a cute translucent pale-blue ghost DRIFTING in place (treadmill) — it glides with a smooth wave-like floating motion, the body swaying side to side while its wispy tail-wisps stream and undulate behind it as if moving through air. It has NO legs and NO feet — do NOT add, grow or animate any legs or walking steps; it floats. It does NOT travel or slide across the frame — it stays centered. CRITICAL: the BODY stays the EXACT same size and scale in EVERY frame — no zoom, no rescale. ONE single connected body; no detached parts.' + FACING,
  // v0.29.135 — IP-safe redesigns (new user-dropped art).
  seasponge: 'a cute lumpy yellow sponge creature WADDLING in place (treadmill) — its stubby little legs take small alternating steps while the soft porous body bobs and squishes gently with each step, stubby arms swinging slightly. It does NOT travel or slide across the frame — it stays centered. CRITICAL: the BODY stays the EXACT same size and scale in EVERY frame — no zoom, no rescale. ONE single connected body; do NOT duplicate or detach any limbs.' + FACING,
  grumpsquid: 'a grumpy pink tube-coral creature moving in place (treadmill) — it is LEGLESS: it scoots with small squishy HOPS, squashing down then boinging up in a bouncing loop, its coral tubes jiggling with each bounce and its grumpy frown unmoved. Do NOT add, grow or animate any legs, feet, arms or hands — the body has none. It does NOT travel or slide across the frame — it stays centered. CRITICAL: the BODY stays the EXACT same size and scale in EVERY frame — no zoom, no rescale. ONE single connected body; no detached parts.' + FACING,
  razorgale: 'razorgale is a BIRD — it hovers in place and FLAPS ITS WINGS in a looping flight cycle: the wings beat up and down and feathers ruffle. Do NOT add, grow, or animate legs, and do NOT walk or step — it is airborne. It stays centered; keep the wings within the frame. ONE connected body, no detached parts.' + FACING,
  honeyBuzz: 'honeyBuzz is a flying bee/insect — it hovers in place and BUZZES ITS WINGS rapidly in a flight cycle (fast wing-beat) while the body bobs gently. Do NOT add, grow, or animate legs, and do NOT walk or step — it is airborne. It stays centered; keep the wings within the frame. ONE connected body, no detached parts.' + FACING,
  petalfly:  'petalfly is a small flying creature — it hovers in place and FLAPS ITS WINGS in a gentle looping flight cycle (wings beat up and down). Do NOT add, grow, or animate legs, and do NOT walk or step — it is airborne. It stays centered; keep the wings within the frame. ONE connected body, no detached parts.' + FACING,
  // v0.26.x — Sparkling is a glowing fire-insect (sparks among flowers), NOT a walker.
  sparkling: 'sparkling is a small glowing amber fire-insect — it hovers in place and FLAPS/BUZZES ITS WINGS in a quick looping flight cycle while the body bobs gently and golden sparks/embers shimmer around it. Do NOT add, grow, or animate legs, and do NOT walk or step — it is airborne. It stays centered; keep the wings within the frame. ONE connected body, no detached parts.' + FACING,
  // v0.26.x — echoKnight: default walk read as stiff (tiny leg motion, unnatural arms).
  // Force a PRONOUNCED, natural marching gait with clear opposing arm swing.
  // v0.29.138 — strengthened again: the previous set still collapsed to a
  // near-standing pose. Demand a high-knee cartoon march with airborne feet.
  echoKnight: 'echoKnight the armoured knight MARCHES in place (treadmill) with an EXAGGERATED, clearly visible cartoon march: in every mid-stride frame ONE KNEE IS LIFTED HIGH with that foot fully OFF THE GROUND while the other leg plants, then they alternate through the loop; hips and torso bob up-down with each step, the blue helmet-flame streams with the motion, and the flaming sword stays held low at his side, swaying with the steps. The legs MUST visibly move in every frame — absolutely NOT a standing pose, NOT feet planted, NOT a subtle shuffle or twitch. He does NOT travel or slide across the frame — stays centered. CRITICAL: the BODY stays the EXACT same size and scale in EVERY frame — no zoom, no rescale. ONE single connected body; do NOT duplicate or detach any limbs or the sword.' + FACING,
  // v0.26.x — boneGolem: prior walk barely moved the legs (torso sway only).
  // Force a HEAVY, exaggerated lumbering stomp with big high knee-lifts.
  boneGolem: 'boneGolem is a heavy skeleton golem STOMPING forward in place (treadmill) — a big, exaggerated lumbering walk cycle: each leg lifts HIGH with a strongly bent knee and STOMPS down in a wide, weighty stride, clearly alternating left and right, the whole body rocking and bobbing heavily with every step. The arms swing in OPPOSITION to the legs (one arm forward while the opposite leg steps). The leg motion must be LARGE and obvious — NOT a tiny sway or twitch, NOT a stiff idle. It stays centered and does NOT travel or slide across the frame. ONE single connected body; do NOT duplicate, detach, or add extra limbs.' + FACING,
  // v0.26.x — Bloom Reaches plant chain.
  thornmaw: 'thornmaw is a squat legless bramble-jaw plant SHUFFLING in place (treadmill) — its round bramble body rocks side to side in a scooting waddle, root-base scrunching and pushing with each scoot, leaf-arms paddling, big flytrap jaw bobbing slightly with the rhythm. It does NOT grow legs. It stays centered and does NOT travel or slide across the frame. ONE single connected body; do NOT duplicate or detach any parts.' + FACING,
  elderbark: 'elderbark is a BIG ancient walking tree LUMBERING in place (treadmill) — a slow, heavy, deliberate walk cycle: each thick root-cluster foot lifts clearly off the ground and plants down in a weighty stride, clearly alternating, the whole trunk rocking and the mossy canopy swaying with every step, branch-arms swinging slowly in opposition. The step motion must be LARGE and obvious — NOT a tiny sway. It stays centered and does NOT travel or slide across the frame. ONE single connected body; do NOT duplicate, detach, or add extra limbs.' + FACING,
  pinechad: 'pinechad is a swaggering gigachad pineapple BOUNCING in place (treadmill) — a confident springy bounce-strut: it hops rhythmically on its root-feet, body squashing slightly on landing and stretching on the rise, tiny leaf-arms held in a permanent flex, leaf-crown bobbing, smug chin held high. It stays centered and does NOT travel or slide across the frame. ONE single connected body; do NOT duplicate or detach any limbs.' + FACING,
  meloncholy: 'meloncholy is a wide leering watermelon CREEPING in place (treadmill) — a slow, sneaky side-scoot: the oval body rolls/rocks a little with each creep, stubby nub-arms paddling stealthily, the creepy grin and half-lidded eyes holding their stare, the little stem-mustache quivering. It does NOT grow legs. It stays centered and does NOT travel or slide across the frame. ONE single connected body; do NOT duplicate or detach any parts.' + FACING,
  // v0.26.892 — L60-70 mid-boss elites (dedicated user-dropped art).
  blightElder: 'blightElder is a TOWERING rotten ancient treant LUMBERING in place (treadmill) — a slow, heavy, deliberate walk cycle: each thick root-cluster foot lifts clearly off the ground and plants down in a weighty stride, clearly alternating, the rotten trunk rocking and the blighted mossy canopy with its sickly flowers swaying with every step, gnarled branch-arms swinging slowly in opposition, a few spores drifting off. The step motion must be LARGE and obvious — NOT a tiny sway. It stays centered and does NOT travel or slide across the frame. ONE single connected body; do NOT duplicate, detach, or add extra limbs.' + FACING,
  ossuaryTyrant: 'ossuaryTyrant is a MASSIVE bone golem tyrant STOMPING in place (treadmill) — a big, exaggerated lumbering walk cycle: each bone leg lifts HIGH with a strongly bent knee and STOMPS down in a wide, weighty stride, clearly alternating left and right, the whole skull-crowned body rocking heavily with every step, the huge femur-club arm and free arm swinging in OPPOSITION to the legs, pale soul-light flickering between the ribs. The leg motion must be LARGE and obvious — NOT a tiny sway or stiff idle. It stays centered and does NOT travel or slide across the frame. ONE single connected body; do NOT duplicate, detach, or add extra limbs.' + FACING,
};
// Per-type IDLE overrides — for creatures whose generic idle reads flat.
const IDLE_OVERRIDES = {
  // v0.26.x — Bloom Reaches plant chain: idles that sell each one's personality.
  pinechad: 'pinechad the gigachad pineapple idles IN PLACE — it slowly pumps a tiny double-biceps FLEX with its little leaf-arms (flex up, hold, ease down, repeat), chest puffing with a proud breath, the smug smirk holding steady, a sparkle glinting off the jaw, leaf-crown bobbing subtly. CRITICAL: the BODY stays the EXACT same size, scale and position in EVERY frame — do NOT zoom, enlarge, grow, shrink or lean toward the camera; the silhouette outline must stay virtually identical with only tiny soft idle motion. It does NOT walk, hop, or attack.' + FACING,
  meloncholy: 'meloncholy the creepy watermelon idles IN PLACE — the half-lidded sleazy eyes slide side to side, ONE eyebrow waggles up and down, the too-wide seed-tooth grin widens slightly then settles, the bead of sweat trembles, and the tiny nub-arm gives a slow creepy finger-waggle wave. CRITICAL: the BODY stays the EXACT same size, scale and position in EVERY frame — do NOT zoom, enlarge, grow, shrink or lean toward the camera; the silhouette outline must stay virtually identical with only tiny soft idle motion. It does NOT move from its spot.' + FACING,
  // v0.29.137 — new art: muscular treant WARRIOR (bark muscles, glowing eyes, leafy canopy crown).
  elderbark: 'elderbark the muscular treant warrior idles IN PLACE — he breathes slow and heavy, his broad bark chest and shoulders rising and falling, the leafy canopy crown rustling gently, moss tufts swaying, his glowing yellow eyes narrowing in a slow menacing blink, thick wooden fists flexing subtly at his sides. CRITICAL: the BODY stays the EXACT same size, scale and position in EVERY frame — do NOT zoom, enlarge, grow, shrink or lean toward the camera; the silhouette outline stays virtually identical with only tiny soft idle motion. He does NOT walk, punch or attack.' + FACING,
  // v0.29.137 — new art: chibi gentleman vampire (slick black hair, fang, high-collar cape, ruby brooch).
  mournshade: 'a chibi gentleman vampire idling IN PLACE — he stands composed and aristocratic, chest rising with slow breaths, his high-collared black-and-red cape swaying gently at the hem, one eyebrow arching as he gives a slow smug blink and the faintest fanged smirk, gloved hands relaxed at his sides. CRITICAL: the BODY stays the EXACT same size, scale and position in EVERY frame — do NOT zoom, enlarge, shrink or lean toward the camera; the silhouette outline stays virtually identical with only tiny soft idle motion. He does NOT walk, lunge or attack.' + FACING,
  thornmaw: 'thornmaw the bramble-jaw plant idles IN PLACE — the big venus-flytrap jaw drifts open only a TINY sliver and eases shut as if breathing, thorn-teeth glinting, brambles and berries quivering gently, leaf-arms swaying softly, eyes blinking. CRITICAL: the BODY stays the EXACT same size, scale and position in EVERY frame — do NOT zoom, enlarge, grow, shrink, rear up or lean toward the camera; the silhouette outline must stay virtually identical across all frames with only tiny soft idle motion. It does NOT lunge, snap, or move from its spot.' + FACING,
  blightElder: 'blightElder the towering rotten treant idles IN PLACE — it breathes slowly and heavily, the blighted canopy and sickly gravebloom flowers swaying gently, hollow amber eyes blinking deep in the split trunk, a few pale spores drifting up off its shoulders, bark creaking subtly. CRITICAL: the TRUNK BODY stays the EXACT same size, scale and position in EVERY frame — do NOT zoom, enlarge, grow, shrink or lean toward the camera; the silhouette outline must stay virtually identical with only tiny soft idle motion. It does NOT walk or attack.' + FACING,
  ossuaryTyrant: 'ossuaryTyrant the massive bone golem idles IN PLACE — it breathes with a slow heavy heave, pale soul-light pulsing softly between its rib plates, the skull crown glinting, small bone shards drifting in a slow orbit around it, fingers flexing slightly on the femur club. CRITICAL: the BODY stays the EXACT same size, scale and position in EVERY frame — do NOT zoom, enlarge, grow, shrink or lean toward the camera; the silhouette outline must stay virtually identical with only tiny soft idle motion. It does NOT walk or attack.' + FACING,
  snail: 'a cute snail resting IN PLACE. The eyes stay ON ITS FACE exactly where they are and only blink gently — do NOT move the eyes onto the antennae, and do NOT turn the antennae into eye-stalks (the two antennae have NO eyes on them). The two plain antennae sway and wiggle softly, the shell bobs with gentle breathing, and the body squishes/pulses subtly. It does NOT slide or move forward and does NOT grow legs — a calm, lively resting idle. Stays centered at the EXACT same size and framing; nothing leaves the frame.' + FACING,
  // v0.29.137 — new user-dropped towerSeer art: cute translucent blue ghost.
  towerSeer: 'a cute translucent pale-blue ghost hovering IN PLACE — it bobs gently up and down as if floating on air, its wispy trailing tail-wisps swaying and curling softly, tiny bubbles/motes shimmering inside its translucent body, an occasional happy blink of its big dark eyes. It has NO legs and NO feet — do NOT add or grow any. CRITICAL: the BODY stays the EXACT same size, scale and position in EVERY frame (only the gentle hover-bob) — do NOT zoom, enlarge, shrink or lean toward the camera; the silhouette stays virtually identical. It does NOT dart, lunge or attack.' + FACING,
  // v0.29.135 — IP-safe redesigns (new user-dropped art) get authored idles.
  seasponge: 'a cute lumpy yellow sponge creature idling IN PLACE — its soft porous body breathes with a gentle squishy squash-and-stretch, the round pores dilating subtly, stubby little arms swaying at its sides, an occasional friendly blink of its round eyes. CRITICAL: the BODY stays the EXACT same size, scale and position in EVERY frame — do NOT zoom, enlarge, grow, shrink or lean toward the camera; the silhouette outline stays virtually identical with only tiny soft idle motion. It does NOT walk, hop or attack.' + FACING,
  grumpsquid: 'a grumpy pink tube-coral creature idling IN PLACE — its soft coral body breathes with a slow squishy pulse, the hollow coral tubes on its crown puff and relax subtly, its grumpy frown deepens then eases, and its half-lidded eyes blink slowly. It has NO arms and NO legs — do NOT add, grow or animate any limbs, hands or feet. CRITICAL: the BODY stays the EXACT same size, scale and position in EVERY frame — do NOT zoom, enlarge, grow, shrink or lean toward the camera; the silhouette outline stays virtually identical with only tiny soft idle motion. It does NOT hop, slide or attack.' + FACING,
};
// Per-type ATTACK overrides — for weapon-smashers whose generic attack zooms or
// clips. The key requirement is a CONSTANT body size across frames (no zoom).
const ATTACK_OVERRIDES = {
  // v0.26.x — Tomb Keeper SMASH. The old morph-swing zoomed the body 0.42→0.85
  // across the frames (size wobble) and clipped. This keeps the body locked.
  tombKeeper: 'a heavy armoured Tomb Keeper SMASHING its big funeral weapon DOWN in place — it raises the weapon overhead then slams it straight down in front in a heavy two-handed smash, then recovers to its ready stance, in a smooth even-spaced loop. CRITICAL: the CHARACTER BODY stays the EXACT same size, scale and centered position in EVERY frame — do NOT zoom in, scale up, enlarge, shrink or resize the character between frames. Keep the WHOLE character AND the full raised weapon INSIDE the frame at all times with clear margin — never clip the weapon or any body part at any edge. ONE single connected figure; do not duplicate or detach limbs.' + FACING,
  // v0.26.x — Echo Knight slash. Same body-lock requirement as tombKeeper.
  echoKnight: 'an armoured Echo Knight SLASHING its blue flaming sword in place — it winds the sword back to one side then sweeps it across and forward in a single powerful slash arc (a blue flame trail following the blade), then recovers to its ready guard, in a smooth even-spaced loop. CRITICAL: the CHARACTER BODY stays the EXACT same size, scale and centered position in EVERY frame — do NOT zoom in, scale up, enlarge, shrink or resize the character between frames. Keep the WHOLE knight AND the full sword + flame trail INSIDE the frame at all times with clear margin — never clip the blade or any body part at any edge. ONE single connected figure; do not duplicate or detach limbs.' + FACING,
  // v0.26.x — Conductor Mech is a RANGED ticket-launcher; attack is a firing
  // gesture, not a melee swing. Body must stay locked (old frames zoomed + clipped).
  conductorMech: 'a boxy ticket-punch Conductor Mech on wheels firing in place — ONLY its small ticket-launcher arm/cannon moves: the arm pumps a short distance forward and back to shoot, with a TINY muzzle spark right at the nozzle. The MECH BODY, head and wheels stay COMPLETELY STILL and the EXACT same size, scale and position in EVERY single frame — absolutely do NOT zoom, scale, enlarge, shrink, lean, rock or reposition the body; only the little arm animates. Keep the WHOLE mech well INSIDE the frame with generous margin on all sides — never clip any part at any edge, and the muzzle spark must stay tiny and close to the nozzle (NO beam, NO flame jet, NO projectile crossing the frame). ONE single connected mech; do not duplicate or detach parts.' + FACING,
  // v0.26.x — Bloom Reaches plant chain.
  blightElder: 'blightElder the towering rotten treant SMASHING in place — it raises one huge gnarled root-fist up high, then slams it straight DOWN in front in a weighty smash, spores and a few rotten leaves bursting loose from the canopy on impact, then slowly recovers to its stance, in a smooth even-spaced loop. CRITICAL: the TRUNK BODY stays the EXACT same size, scale and centered position in EVERY frame — do NOT zoom, enlarge, shrink or reposition it. Keep the WHOLE tree AND the full raised arm INSIDE the frame at all times with clear margin — never clip the arm or canopy at any edge. ONE single connected body; do not duplicate or detach limbs.' + FACING,
  ossuaryTyrant: 'ossuaryTyrant the massive bone golem SMASHING its huge femur club in place — it hoists the club overhead with both arms, soul-light flaring between its ribs, then slams it straight down in front in a heavy two-handed smash, then recovers to its ready stance, in a smooth even-spaced loop. CRITICAL: the BODY stays the EXACT same size, scale and centered position in EVERY frame — do NOT zoom, enlarge, shrink or resize the character between frames. Keep the WHOLE golem AND the full raised club INSIDE the frame at all times with clear margin — never clip the club or any body part at any edge. ONE single connected figure; do not duplicate or detach limbs.' + FACING,
  thornmaw: 'thornmaw the bramble-jaw plant SNAPPING in place — it rears its body back slightly, the huge venus-flytrap jaw gapes WIDE showing the pink inside, then CHOMPS shut in a fast snap with a small leafy shudder, then re-opens to its ready pose, in a smooth even-spaced loop. CRITICAL: the BODY stays the EXACT same size, scale and centered position in EVERY frame — do NOT zoom, enlarge, shrink or reposition it. Keep the WHOLE creature INSIDE the frame at all times with clear margin — never clip the jaw at any edge. ONE single connected body; do not duplicate or detach parts.' + FACING,
  // v0.29.137 — new art: muscular treant WARRIOR.
  elderbark: 'elderbark the muscular treant warrior SMASHING in place — he winds up by raising one huge knotted wooden fist high, canopy leaves shaking, then slams it straight DOWN in front in a weighty two-step smash (a few leaves and moss tufts bursting loose on impact), then recovers to his ready stance, in a smooth even-spaced loop. CRITICAL: the BODY stays the EXACT same size, scale and centered position in EVERY frame — do NOT zoom, enlarge, shrink or reposition it. Keep the WHOLE treant AND the full raised arm INSIDE the frame at all times with clear margin — never clip the fist or canopy at any edge. ONE single connected body; do not duplicate or detach limbs.' + FACING,
  // v0.29.137 — chibi gentleman vampire.
  mournshade: 'the chibi gentleman vampire attacks IN PLACE — he sweeps his high-collared cape across his face with one arm, eyes flashing red, then flings the cape open in a dramatic flare while baring his fangs in a sharp hiss (a couple of TINY bat silhouettes fluttering close around his shoulders), then composes himself back to his elegant stance, in a smooth even-spaced loop. The bats stay TINY and close to his body — NO projectiles, NO beams, nothing crossing the frame. CRITICAL: the BODY stays the EXACT same size, scale and centered position in EVERY frame — do NOT zoom, enlarge, shrink or reposition it; keep the WHOLE vampire and cape INSIDE the frame with clear margin. ONE single connected body; do not duplicate or detach limbs.' + FACING,
  pinechad: 'pinechad the gigachad pineapple striking in place — it winds up with an exaggerated bodybuilder FLEX, then throws a short confident leaf-arm punch forward with a tiny burst of sparkle at the fist, then recoils back to its smug double-biceps pose, in a smooth even-spaced loop. CRITICAL: the BODY stays the EXACT same size, scale and centered position in EVERY frame — do NOT zoom, enlarge, shrink or reposition it. Keep the WHOLE creature INSIDE the frame at all times with clear margin — never clip any part at any edge. ONE single connected body; do not duplicate or detach limbs.' + FACING,
  meloncholy: 'meloncholy the creepy watermelon SPITTING SEEDS in place — it leans back, cheeks puffing up huge, then snaps forward in a quick PFFT spit gesture with 2-3 TINY black seeds appearing right at its grinning mouth, then settles back to its leer, in a smooth even-spaced loop. The seeds stay TINY and right at the mouth (NO long projectile stream, NO beam, nothing crossing the frame). CRITICAL: the BODY stays the EXACT same size, scale and centered position in EVERY frame — do NOT zoom, enlarge, shrink or reposition it. Keep the WHOLE creature INSIDE the frame with clear margin — never clip any part at any edge. ONE single connected body; do not duplicate or detach parts.' + FACING,
  // v0.29.138 — seastar (Tankstar): the generic attack came back with an opaque
  // grey background wash + smeary energy streaks (drew as a square panel
  // in-game). Replaced per user with a clean HEADBUTT, background locked clear.
  seastar: 'the chubby pink starfish creature performs a clean HEADBUTT attack IN PLACE — he leans back winding up, then snaps his whole upper body and pointed head forward in a single decisive headbutt, wobbling back to his stance, in a smooth even-spaced loop. The background stays COMPLETELY EMPTY AND TRANSPARENT in every frame — absolutely NO background color, NO panel, NO glow wash, NO energy streaks, NO aura, NO speed-lines, NO particles; ONLY the character on pure transparency. CRITICAL: the BODY stays the EXACT same size, scale and centered position in EVERY frame — do NOT zoom, enlarge, shrink or reposition it; keep the WHOLE creature inside the frame with clear margin. ONE single connected body; do not duplicate or detach limbs.' + FACING,
  // v0.29.137 — towerSeer ghost attack: spooky flare, no limbs, no projectiles.
  towerSeer: 'a cute translucent pale-blue ghost attacking IN PLACE — it rears back and puffs up slightly, its big dark eyes narrowing and mouth opening in a tiny spooky "boo" wail as its inner glow flares brighter and its tail-wisps whip forward, then it settles back to its gentle hover, in a smooth even-spaced loop. It has NO legs, NO feet, NO arms beyond its two stubby nubs — do NOT add or grow limbs. NO projectiles, NO beams, nothing crossing the frame. CRITICAL: the BODY stays the EXACT same size, scale and centered position in EVERY frame — do NOT zoom, enlarge, shrink or reposition it; keep the WHOLE ghost inside the frame with clear margin. ONE single connected body; no detached parts.' + FACING,
  // v0.29.135 — IP-safe redesigns (new user-dropped art).
  seasponge: 'a cute lumpy yellow sponge creature attacking IN PLACE — it winds up by squashing down and back, then springs forward in a short squishy BODY-BONK lunge (a small soft impact squish at full extension), then wobbles back to its stance, in a smooth even-spaced loop. NO projectiles, NO beams, nothing crossing the frame. CRITICAL: the BODY stays the EXACT same size, scale and centered position in EVERY frame — do NOT zoom, enlarge, shrink or reposition it. Keep the WHOLE creature INSIDE the frame with clear margin — never clip any part at any edge. ONE single connected body; do not duplicate or detach limbs.' + FACING,
  grumpsquid: 'a grumpy pink tube-coral creature attacking IN PLACE — it rears back with an angrier scowl, its coral tubes puffing up, then lurches forward in a short heavy HEADBUTT squish (tubes whipping slightly with the motion), then settles back to its grumpy stance, in a smooth even-spaced loop. It has NO arms and NO legs — do NOT add, grow or animate any limbs, hands or feet. NO projectiles, NO beams, nothing crossing the frame. CRITICAL: the BODY stays the EXACT same size, scale and centered position in EVERY frame — do NOT zoom, enlarge, shrink or reposition it. Keep the WHOLE creature INSIDE the frame with clear margin — never clip any part at any edge. ONE single connected body; do not duplicate or detach parts.' + FACING,
};

const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
const basePath = async (type) => {
  // Try the in-game type key first, then the on-disk filename alias.
  for (const base of [type, MONSTER_ALIASES[type]]) {
    if (!base) continue;
    for (const ext of ['.png', '.webp']) { const p = join(MON_DIR, base + ext); if (await exists(p)) return p; }
  }
  return null;
};
const smallBaseUri = async (buf) => 'data:image/png;base64,' + (await sharp(buf).resize(990, 990, { fit: 'inside', withoutEnlargement: true }).png().toBuffer()).toString('base64');
async function fetchBuf(url) { const r = await fetch(url, { signal: AbortSignal.timeout(90000) }); if (!r.ok) throw new Error(`fetch ${r.status}`); return Buffer.from(await r.arrayBuffer()); }
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
  throw new Error('no usable frames');
}

// target monster list
let types = [];
const zone = arg('--zone'), only = arg('--only');
const DONE = new Set([...ZONES.wayfarer, ...ZONES.pq, ...ZONES.expedition]);
if (only) types = only.split(',');
else if (zone === 'all' || (!zone && !only)) types = [...DONE];
else if (zone === 'full') types = ALL_TYPES.slice();
else if (zone === 'rest') types = ALL_TYPES.filter((t) => !DONE.has(t));
else if (zone && ZONES[zone]) types = ZONES[zone];
else { console.error(`Unknown --zone "${zone}". Use: ${Object.keys(ZONES).join(' | ')} | all | rest | full`); process.exit(1); }
const modes = (arg('--mode') && arg('--mode') !== 'all') ? [arg('--mode')] : ['idle', 'attack', 'walk'];

if (!has('--generate')) {
  console.log(`# ${types.length} monsters x ${modes.length} modes (${modes.join(',')}) @ ${FRAMES} frames:\n`);
  for (const t of types) console.log(`  ${t}`);
  console.log('\n# Re-run with --generate (needs LUDO_API_KEY).');
  process.exit(0);
}

const key = process.env.LUDO_API_KEY;
if (!key) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const force = has('--force');
// v0.26.x — LUDO_ANIM_PAD: transparent border (fraction per side) added to the
// animate INPUT for headroom, so a big swing/smash can't clip. Output frames are
// resized back to the ORIGINAL base dims, so the canvas matches idle/walk and the
// body lands at a CONSTANT smaller fraction (paired with _ATK_FRAME_SCALE in-game).
const PAD = Number(process.env.LUDO_ANIM_PAD || 0);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function genMode(type, mode, buf, W, H) {
  const outDir = join(MON_DIR, mode);
  const done = (await Promise.all(Array.from({ length: FRAMES }, (_, i) => exists(join(outDir, `${type}_${i}.webp`))))).every(Boolean);
  if (!force && done) return 'skip';
  // Optional transparent-pad headroom on the INPUT (anti-cutoff for big swings).
  let inBuf = buf;
  if (PAD > 0) {
    const px = Math.round(W * PAD), py = Math.round(H * PAD);
    inBuf = await sharp(buf).extend({ top: py, bottom: py, left: px, right: px, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  }
  const uri = await smallBaseUri(inBuf);
  // Retry transient network failures ("fetch failed") with backoff so a blip
  // doesn't burn through the whole batch.
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(`${API}/assets/sprite/animate`, {
        method: 'POST', headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(280000),
        body: JSON.stringify({ initial_image: uri, motion_prompt: (mode === 'attack' && ATTACK_OVERRIDES[type]) || (mode === 'walk' && WALK_OVERRIDES[type]) || (mode === 'idle' && IDLE_OVERRIDES[type]) || MOTION[mode],
          frames: FRAMES, frame_size: -9, model: 'eagle', individual_frames: true, loop: mode !== 'attack', image_type: 'sprite' }),
      });
      if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 140)}`);
      const bufs = await framesFrom(await res.json(), FRAMES);
      await mkdir(outDir, { recursive: true });
      for (let i = 0; i < bufs.length; i++)
        await writeFile(join(outDir, `${type}_${i}.webp`), await sharp(bufs[i]).resize(W, H, { fit: 'fill' }).webp({ quality: 92 }).toBuffer());
      return 'ok';
    } catch (e) { lastErr = e; if (/\b402\b/.test(e.message)) throw e; if (attempt < 4) await sleep(3000 * attempt); }
  }
  throw lastErr;
}

console.log(`Generating ${types.length} monsters x [${modes.join(', ')}] (skip-existing: ${!force})...`);
let made = 0, skipped = 0, failed = 0;
for (const type of types) {
  const bp = await basePath(type);
  if (!bp) { console.log(`  ${type}: NO BASE SPRITE — skip`); continue; }
  const buf = await readFile(bp);
  const { width: W, height: H } = await sharp(buf).metadata();
  for (const mode of modes) {
    process.stdout.write(`  ${type}/${mode} ... `);
    try { const r = await genMode(type, mode, buf, W, H); if (r === 'skip') { skipped++; console.log('skip'); } else { made++; console.log(`OK ${W}x${H}`); await sleep(800); } }
    catch (e) { failed++; console.log(`FAIL: ${e.message}`); if (/\b402\b/.test(e.message)) { console.log('\n*** OUT OF LUDO CREDITS (402) — stopping. Re-run --zone rest once credits renew. ***'); process.exit(3); } }
  }
}
console.log(`Done. ${made} made, ${skipped} skipped, ${failed} failed.`);
process.exit(failed ? 2 : 0);
