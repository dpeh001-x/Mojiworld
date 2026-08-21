#!/usr/bin/env node
// Tester sound-review pass 2 (ludo.ai /audio/sound-effect).
//
// The tester's full review (2026-08-22 paste) listed 117 NEEDS WORK + 18 NOT
// SURE. Cross-checked against history before generating anything:
//   * v0.29.940 already regenerated 23 of them (hit sounds 1-20, 22, 23 and
//     the snail death) — SKIPPED here; the tester should re-review those.
//   * Spireling / Aether Seer / Ossifer notes say "cannot find this monster";
//     all three exist in-game (tower mobs). Not sound critiques — SKIPPED.
//   * NOT SURE items whose note says "can be used" (Arbiter, Jelly, Archon)
//     are accepted as-is — SKIPPED.
// Everything else — 105 clips — is regenerated below, each prompt grounded in
// the monster's in-game signature text plus the tester's specific complaint.
//
// Mechanics inherited from gen_sfx_regen_pass.mjs: duration measured from the
// MP3's own frame headers (the API's word is not trusted), over-bar takes are
// retried shorter then frame-trimmed; existing clips are backed up to
// audio/_regen_backup/pre_tester_pass2/; writes are atomic (tmp + rename).
// Monster clips bar: < 1.0 s (sfx_duration_test.mjs). NPC babble: < 1.8 s.
//
//   node scripts/gen_tester_sfx_pass2.mjs                # dry-run (plan)
//   node scripts/gen_tester_sfx_pass2.mjs --generate     # 2 credits/clip
//   flags: --only=<substring>   --tag=<backup folder>
// =============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const only = (argv.find(a => a.startsWith('--only=')) || '').split('=')[1];
const TAG = (argv.find(a => a.startsWith('--tag=')) || '').split('=')[1] || 'pre_tester_pass2';

const SHORT = ' Very short one-shot, punchy, no tail, no music, no reverb wash, mono game SFX.';
// NPC clips are Animal-Crossing-style BABBLE (see gen_npc_voice.mjs): the
// endpoint is sound-effect, not TTS, so every voice prompt says so.
const BABBLE = 'Animal Crossing style character voice BABBLE for a video game: nonsense vocal '
  + 'syllables only, NOT real words, NOT speech, NOT singing. Single voice, clean dry studio '
  + 'recording, no music, no background noise. ';

const H = (file, desc) => ({ file, dur: 0.5, max: 1.0, desc: desc + SHORT });
const D = (file, desc) => ({ file, dur: 0.9, max: 1.0, desc: desc + SHORT });
const V = (file, desc) => ({ file, dur: 1.2, max: 1.8, desc: BABBLE + desc });

const SOUNDS = [
  // ---- NEEDS WORK: hit sounds (21, 24-48) ----------------------------------
  H('audio/monster/mob_future_lyra_hit.mp3',   // "does not sound feminine"
    'A young WOMAN spellcaster struck in combat — a short sharp FEMALE pained gasp, light and clearly feminine, with a faint dark-arcane shimmer under it. NOT male, NOT deep, NOT gruff.'),
  H('audio/monster/mob_anglerfish_hit.mp3',    // "too violent of a splat"
    'A deep-sea anglerfish poked — a SOFT dull wet fish-flesh thud, blubbery and mild, gentle squish. NOT a violent splatter, NOT gory, NOT harsh.'),
  H('audio/monster/mob_spectreCannoneer_hit.mp3', // "does not sound spooky"
    'A floating GHOST gunner struck — a hollow airy spectral impact, wispy moan flaring briefly, cold and haunted, ectoplasmic puff. Spooky, breathy, otherworldly.'),
  H('audio/monster/mob_blockTigreal_hit.mp3',  // "does not sound like a tiger"
    'A toy-brick TIGER king struck — a muffled tiger growl-grunt of pain over a plastic building-brick knock. Feline snarl first, blocky clack second.'),
  H('audio/monster/mob_young_bloodthirsty_vermillion_hit.mp3', // "not like a person"
    'A young HUMAN warrior struck — a short male human grunt of pain, breathy and real, light armor rustle. Clearly a person, NOT a creature.'),
  H('audio/monster/mob_zombie_hit.mp3',        // "does not sound like an undead"
    'A rotting UNDEAD zombie struck — a wet decayed thud with a guttural undead groan, rasping dead throat, rotten and hollow. Unmistakably a zombie.'),
  H('audio/monster/mob_vigil_vermillion_hit.mp3', // "not like a person"
    'A crimson HUMAN archer struck — a short adult male grunt of pain, human breath knocked out, bowstring twang faint behind. Clearly a person, NOT a monster.'),
  H('audio/monster/mob_cherub_hit.mp3',        // "not an angelic being"
    'A tiny ANGELIC cherub struck — a soft heavenly chime ping with a small sweet celestial yelp, feathery flutter, light and holy. Angelic, NOT earthly.'),
  H('audio/monster/mob_octoLegFreeze_hit.mp3', // "does not sound like a tentacle"
    'A thick rubbery octopus TENTACLE slapped — a deep WET squelching smack into slick rubber flesh, sucker pops, with a light brittle frost crackle over it. Wet, rubbery, bassy. NO shrill squeal.'),
  H('audio/monster/mob_octobaby_hit.mp3',      // "does not sound like a tentacle"
    'A giant octopus struck — a heavy WET slap into thick rubbery tentacle flesh, deep squelch, sucker suction pop, dark and bassy. Unmistakably wet octopus rubber. NO shrill squeal.'),
  H('audio/monster/mob_seraph_hit.mp3',        // "weak for an angelic being"
    'A mighty SERAPH struck — a POWERFUL resonant holy impact, deep choral shimmer flaring, great wings booming, radiant and forceful. Grand, NOT weak, NOT timid.'),
  H('audio/monster/mob_thornmaw_hit.mp3',      // "too soft"
    'A snapping bramble jaw struck — a SHARP LOUD woody crack, thorns splintering and scraping, aggressive vegetal snap. Punchy and hard, NOT soft.'),
  H('audio/monster/mob_elderbark_hit.mp3',     // "no sound at all"
    'An ANCIENT WALKING TREE struck — a deep solid axe-on-old-oak THOCK, heavy bark crunching, trunk groan under it. Loud, woody, unmistakable.'),
  H('audio/monster/mob_cinderling_hit.mp3',    // "no fire sounds"
    'A little FIRE imp struck — a burst of ember crackle and fiery hiss, sparks spitting, flame whump. Clearly burning, fiery.'),
  H('audio/monster/mob_meloncholy_hit.mp3',    // "too soft"
    'A big WATERMELON thumped hard — a firm hollow melon THUNK, juicy and punchy, rind knock with wet pulp under it. Solid and loud, NOT soft.'),
  H('audio/monster/mob_aetherion_hit.mp3',     // "quite derpy for a dragon"
    'A majestic CRYSTAL DRAGON struck — a deep resonant draconic growl of pain with a crystalline ring, powerful and regal. Fearsome, NOT silly, NOT goofy, NOT cartoonish.'),
  H('audio/monster/mob_razorgale_hit.mp3',     // "organic for a non organic creature"
    'A hawk made of GLASS SHARDS struck — hard glass clink and crack, shards chiming and splintering, cold and mineral. NOT organic, NO animal cry, NO flesh sound.'),
  H('audio/monster/mob_glasswindHare_hit.mp3', // "too deep to be a rabbit"
    'A small glass RABBIT struck — a light HIGH-pitched quick bunny squeak with a delicate glassy tink. Small, high, fast. NOT deep, NOT heavy.'),
  H('audio/monster/mob_shardlich_hit.mp3',     // "too soft"
    'A glass-bone LICH struck — a SHARP cracking glass impact with a cold sinister hiss, hard and cutting. Loud and icy, NOT soft.'),
  H('audio/monster/mob_zodiac_taurus_hit.mp3', // "does not sound like a cow"
    'A great GRANITE BULL struck — a deep BOVINE bellow-grunt, unmistakably cattle, over a heavy stone thud. Bull first, rock second.'),
  H('audio/monster/mob_sepulchreHound_hit.mp3', // "does not sound like a hound"
    'A grave HOUND struck — a sharp canine YELP breaking into a snarl, clearly a dog, with a cold sepulchral undertone.'),
  H('audio/monster/mob_mournshade_hit.mp3',    // "does not sound like a vampire"
    'A VAMPIRIC spectre struck — a dark breathy vampire HISS, fanged and sibilant, recoiling with a cold undead rasp. Gothic and predatory.'),
  H('audio/monster/mob_lanternWisp_hit.mp3',   // "quite loud for a wisp"
    'A tiny serene WISP touched — a very SOFT airy chime, gentle glassy shimmer, quiet and delicate, barely-there. Hushed, NOT loud, NOT harsh.'),
  H('audio/monster/mob_ossuaryTyrant_hit.mp3', // "could sound heavier"
    'A COLOSSAL bone tyrant struck — a MASSIVE deep impact into ancient bone, heavy skeletal rattle rolling through a crown of skulls, weighty and dense. Very heavy, bassy.'),
  H('audio/monster/mob_zodiac_aquarius_hit.mp3', // "should have some aquatic noises"
    'A WATER-wreathed zodiac serpent struck — a wet aquatic splash impact, water sloshing and surging around the blow, liquid and flowing.'),
  H('audio/monster/mob_gravitos_hit.mp3',      // "no noise at all"
    'A COLOSSAL gravity titan struck — a deep booming stone impact, immense and heavy, low shockwave thump with grinding rock. Loud, seismic, unmissable.'),
  // ---- NOT SURE: hits with an actionable note -------------------------------
  H('audio/monster/mob_petalfly_hit.mp3',      // "sounds more like a wisp"
    'A soft flower-petal BUTTERFLY struck — a papery petal flutter-puff, organic and leafy, tiny natural rustle. Botanical, NOT a magical shimmer, NOT a wisp chime.'),
  H('audio/monster/mob_mirrorSelf_hit.mp3',    // "sounds very heavy"
    'A mirror reflection of a person struck — a LIGHT glassy crack with a short human gasp, quick and thin. Light and sharp, NOT heavy, NOT booming.'),
  H('audio/monster/mob_horny_hit.mp3',         // "sounds very sharp"
    'A little horned MUSHROOM cap bonked — a DULL soft fungal thud with a muted horn knock, rounded and spongy. Soft-edged, NOT sharp, NOT metallic.'),
  H('audio/monster/mob_potato_uncle_hit.mp3',  // "doesnt sound like potato"
    'A big old POTATO man struck — a dense STARCHY root-vegetable thud, earthy and dry with soil crumbs, plus a gruff old-uncle grunt. Vegetal and earthen.'),
  H('audio/monster/mob_willeo_hit.mp3',        // "does not sound like a Lion"
    'A LION warrior struck — a short leonine grunt-growl of pain, big-cat rumble, with a light sword clank. Unmistakably a lion.'),
  H('audio/monster/mob_sundered_smith_hit.mp3', // "could sound heavier"
    'A half-melted forge GOLEM struck — a HEAVY anvil ring, deep molten metal clang with slag hiss, massive and resonant. Very heavy, weighty, industrial.'),
  H('audio/monster/mob_kingKrook_hit.mp3',     // "heavier and more menacing"
    'A huge ember CROCODILE king struck — a deep MENACING reptilian snarl over a heavy scaled thud, ember crackle beneath, dangerous and regal. Heavy and dark.'),
  H('audio/monster/mob_octoLegStun_hit.mp3',   // tentacle consistency
    'A thick rubbery octopus TENTACLE slapped — a deep WET squelching smack into slick rubber flesh, sucker pops, with a short dry electrical crackle through it. Wet, rubbery, bassy. NO shrill squeal.'),
  H('audio/monster/mob_octoLegSkillLock_hit.mp3', // tentacle consistency
    'A thick rubbery octopus TENTACLE slapped — a deep WET squelching smack into slick rubber flesh, sucker pops, with a dull smothered muting as if sound is swallowed. Wet, rubbery, bassy. NO shrill squeal.'),
  H('audio/monster/mob_zodiac_aries_hit.mp3',  // "could be more like a goat"
    'A fiery zodiac RAM struck — a clear GOAT bleat-grunt of pain, caprine and throaty, with an ember hiss under it. Unmistakably a goat.'),
  H('audio/monster/mob_zodiac_libra_hit.mp3',  // "could have some goat noises"
    'A golden zodiac beast struck — a short GOAT bleat of pain, caprine and clear, with a bright metallic scale-chime ringing. Goat first, chime second.'),
  // ---- NEEDS WORK: death sounds (49-55, 57-74) — 56 Spireling skipped -------
  D('audio/monster/mob_king_die.mp3',          // "more jelly-ish, too sharp"
    'A giant JELLY slime king collapsing — a soft gloopy wet deflate, thick gel sloshing down, bubbly slime settling, rounded and gooey. NOT sharp, NO hard edges, NO metallic tone.'),
  D('audio/monster/mob_sproutle_die.mp3',      // "plants dont sound like that"
    'A small PLANT sprout wilting away — a soft leafy rustle, a gentle green stem snap, petals slumping with a tiny vegetal sigh. Botanical and gentle, NOT a creature roar.'),
  D('audio/monster/mob_mooma_die.mp3',         // "does not sound feminine"
    'A motherly MUSHROOM matriarch fading — a soft FEMININE womanly sigh drifting down, gentle and maternal, with a puff of spores settling. Clearly female, tender. NOT male, NOT deep.'),
  D('audio/monster/mob_cookie_die.mp3',        // "not a cookie crumbling"
    'A chocolate-chip COOKIE breaking apart — a dry biscuit SNAP and crumble, crumbs scattering and pattering down, crunchy and baked. Unmistakably a cookie crumbling.'),
  D('audio/monster/mob_mirrorSelf_die.mp3',    // "does not sound human"
    'A mirror reflection of a PERSON dying — a short HUMAN final gasp-cry, breathy and real, dissolving into a glassy shatter. Person first, glass second.'),
  D('audio/monster/mob_towerStalker_die.mp3',  // "not human or porcelain"
    'A PORCELAIN-masked stalker dying — a brittle porcelain CRACK and shatter with a breathy human exhale escaping through it, ceramic pieces tinkling down.'),
  D('audio/monster/mob_frog_die.mp3',          // "does not sound aquatic"
    'A pond FROG dying — a croak cut short with a WET watery PLOP, splashing into the pond, bubbles rising. Aquatic and amphibian.'),
  D('audio/monster/mob_towerStormcaller_die.mp3', // "no lightning noise"
    'A storm shaman dying — a sharp THUNDER crack with electric arcing fizzling out, static discharge sputtering to silence. Unmistakably lightning.'),
  D('audio/monster/mob_emberling_die.mp3',     // "does not sound fiery"
    'A small FIRE spirit dying — a flame WHOOSH snuffing out, embers scattering with a crackling hiss, last spark popping. Clearly fire being extinguished.'),
  D('audio/monster/mob_sandhusk_die.mp3',      // "does not sound like sand"
    'A SAND creature collapsing — dry sand pouring and cascading down, gritty granular hiss, husk crumbling to dust. Unmistakably sand.'),
  D('audio/monster/mob_voltipup_die.mp3',      // "does not sound like a pig"
    'A storm PIG dying — a clear porcine SQUEAL winding down into a grunt, unmistakably a pig, with a light electric crackle fizzling out.'),
  D('audio/monster/mob_orange_die.mp3',        // "does not sound like an orange"
    'A plump CITRUS fruit bursting — a juicy wet SQUISH, orange pulp splitting, peel tearing, juice spraying lightly. Unmistakably citrus fruit.'),
  D('audio/monster/mob_mummy_die.mp3',         // "does not sound like a Mummy"
    'A MUMMY unraveling — dry linen BANDAGES whipping loose and unspooling, dusty ancient rasp, bones settling into the wrappings. Cloth and dust, unmistakably a mummy.'),
  D('audio/monster/mob_axolotl_die.mp3',       // "cannot associate with candy"
    'A cute CANDY axolotl dying — a sweet little squeak deflating into a soft GUMMY squish, jelly-candy wobble settling, adorable and sugary.'),
  D('audio/monster/mob_pearlSprite_die.mp3',   // "does not sound like an animal"
    'A small pearl CREATURE dying — a soft organic animal chirp-whimper fading out, living and breathy, with a light pearl clink as it drops. Animal first, pearl second.'),
  D('audio/monster/mob_blockEle_die.mp3',      // "does not sound like an elephant"
    'A toy-brick ELEPHANT dying — a muffled elephant TRUMPET winding down, unmistakably pachyderm, ending in plastic building bricks clattering apart.'),
  D('audio/monster/mob_pqConductor_die.mp3',   // "not robotic enough"
    'A grand ROBOT conductor shutting down — servo motors whirring down in pitch, mechanical relays clicking off, sparks spitting, a metallic power-down whine to silence. Fully machine.'),
  D('audio/monster/mob_expressTicketMech_die.mp3', // "not a machine"
    'An express ticket MACHINE breaking down — clanking metal seizure, gears grinding to a halt, steam hiss venting, bolts rattling loose. Fully mechanical.'),
  D('audio/monster/mob_ticketMech_die.mp3',    // "does not sound robotic"
    'A small ticket ROBOT dying — electronic sputter and sparks, servo whine dropping, metal panels clattering, a last mechanical beep dying. Fully robotic.'),
  D('audio/monster/mob_stump_die.mp3',         // "dreadful for plants dying"
    'A tree STUMP creature dying — a gentle woody creak as it tips over, soft leafy rustle, a mild hollow log thump. Calm and natural, NOT dreadful, NOT a scream.'),
  D('audio/monster/mob_sparkSprite_die.mp3',   // "not electric enough"
    'An ELECTRIC sprite dying — a bright zappy DISCHARGE, static arcs sputtering and fizzling out, a final snap of current dying. Unmistakably electricity.'),
  D('audio/monster/mob_conductorMech_die.mp3', // "not robotic enough"
    'A conductor ROBOT dying — gears grinding, servo whine powering down, electrical sparks crackling, metal frame collapsing with a mechanical clunk. Fully machine.'),
  D('audio/monster/mob_jellyfish_die.mp3',     // "quite deep for a jellyfish"
    'A tiny JELLYFISH dying — a LIGHT high soft watery bloop, gentle gelatinous deflate, small bubbles drifting up. Delicate and light, NOT deep, NOT heavy.'),
  D('audio/monster/mob_deranged_kuro_die.mp3', // "does not sound human"
    'A deranged HUMAN swordsman dying — a ragged male death cry, breath collapsing, very human, a body slumping. Clearly a person, NOT a creature.'),
  D('audio/monster/mob_young_confused_barnaby_die.mp3', // "not human enough"
    'A young HUMAN knight falling — a clearly male human final grunt-cry, pained and breathy, armor clattering as he collapses. Unmistakably a man.'),
  D('audio/monster/mob_drownedCur_die.mp3',    // "sinking noises instead"
    'A drowned HOUND SINKING away — heavy waterlogged glug, bubbles streaming downward, a muffled underwater whimper receding into the deep, fading as it sinks. Sinking is the star.'),
  D('audio/monster/mob_bonebosn_die.mp3',      // "does not sound skeletal"
    'A pirate SKELETON falling apart — DRY BONES clattering and rattling down one by one, hollow skeletal knocking, a skull bouncing, with one cutlass clang. Bone rattle is the star.'),
  D('audio/monster/mob_zombie_die.mp3',        // "no sound"
    'A rotting UNDEAD zombie dying — a guttural undead death groan collapsing into a wet rotten slump, dead throat rasping empty. Loud enough to register, unmistakably zombie.'),
  D('audio/monster/mob_nimbusFox_die.mp3',     // "does not sound like a fox"
    'A cloud FOX dying — a vulpine whimper-YIP fading out, clearly a fox, drifting away on a soft airy puff of cloud.'),
  D('audio/monster/mob_goblinMauler_die.mp3',  // "too shrill for a goblin"
    'A brute GOBLIN dying — a LOW guttural goblin death groan, throaty and coarse, club thudding down. Deep and gravelly, NOT shrill, NOT high-pitched.'),
  D('audio/monster/mob_sundered_smith_die.mp3', // "does not sound like a golem"
    'A forge GOLEM dying — a MASSIVE stone-and-metal collapse, molten slag hissing, a final deep anvil ring tolling as the great body crashes down. Heavy mineral golem.'),
  D('audio/monster/mob_octoLegFreeze_die.mp3', // tentacle consistency
    'A severed octopus TENTACLE dying — a low WET squelchy flop going limp, rubbery slap into water, with a light brittle frost crackle fading. Wet and rubbery. NO shrill squeal.'),
  D('audio/monster/mob_octobaby_die.mp3',      // "not like an octopus"
    'A giant OCTOPUS dying — a big wet rubbery deflate, low gurgling collapse into water, tentacles slapping down limp, bubbling away soft. Unmistakably octopus. NO shrill squeal.'),
  D('audio/monster/mob_octoLegStun_die.mp3',   // tentacle consistency
    'A severed octopus TENTACLE dying — a low WET squelchy flop going limp, rubbery slap into water, with a short dry electrical crackle fading. Wet and rubbery. NO shrill squeal.'),
  D('audio/monster/mob_octoLegSkillLock_die.mp3', // tentacle consistency
    'A severed octopus TENTACLE dying — a low WET squelchy flop going limp, rubbery slap into water, sound swallowed into a muffled hush as it fades. Wet and rubbery. NO shrill squeal.'),
  D('audio/monster/mob_octoLegPoison_die.mp3', // tentacle consistency
    'A severed octopus TENTACLE dying — a low WET squelchy flop going limp, rubbery slap into water, with a soft acidic bubbling hiss fading. Wet and rubbery. NO shrill squeal.'),
  D('audio/monster/mob_graveReaver_die.mp3',   // "not like an undead"
    'An UNDEAD reaver dying — a hollow sepulchral groan from a dead chest, grave-cold rasp, rusted armor and bones clattering down. Unmistakably undead.'),
  D('audio/monster/mob_legosaurus_die.mp3',    // "not like a dinosaur"
    'A toy-brick DINOSAUR dying — a deep saurian ROAR cut short, unmistakably dinosaur, collapsing into plastic building bricks clattering apart.'),
  D('audio/monster/mob_cinderling_die.mp3',    // "does not sound fiery"
    'A FIRE imp dying — a burst of ember pops, flames guttering and snuffing out with a smoky hiss, one last spark crackle. Clearly fire dying.'),
  D('audio/monster/mob_meloncholy_die.mp3',    // "does not sound melancholy"
    'A gloomy WATERMELON dying — a long SAD descending sigh, mournful and dejected, ending in a soft wet melon split. Melancholy first, melon second.'),
  D('audio/monster/mob_pinechad_die.mp3',      // "too squeaky for a plant"
    'A musclebound PINEAPPLE bro dying — a LOW manly "hmph" grunt deflating with dignity, leafy crown crunching as it topples. Deep and vegetal, NOT squeaky, NOT high-pitched.'),
  D('audio/monster/mob_smithgolem_die.mp3',    // "not blocky enough"
    'A BLOCK-built forge golem dying — heavy square stone BLOCKS clunking and toppling one on another, rectangular and chunky collapse, deep masonry thuds with a metal ring.'),
  D('audio/monster/mob_zodiac_aries_die.mp3',  // "more like a goat dying"
    'A fiery zodiac RAM dying — a clear GOAT death bleat trailing off, caprine and throaty, embers hissing out around it. Unmistakably a goat.'),
  D('audio/monster/mob_shardlich_die.mp3',     // "more shattering"
    'A glass LICH dying — a big SHATTERING cascade, glass exploding and raining down in splinters, crystalline crash with a cold hiss dying under it. Shatter is the star.'),
  D('audio/monster/mob_tombKeeper_die.mp3',    // "really kiddy for undead"
    'An UNDEAD tomb warden dying — a GRAVE-DEEP hollow death rattle, solemn and chilling, funeral plate armor crashing down, dust of the crypt settling. Dark and adult, NOT cute, NOT kiddy.'),
  D('audio/monster/mob_echoKnight_die.mp3',    // "wimpy for the cool knight"
    'A great armored KNIGHT falling — a resonant powerful death cry with a ghostly echo repeating it, greatsword clanging down, heavy plate collapsing. Epic and weighty, NOT wimpy.'),
  D('audio/monster/mob_zodiac_leo_die.mp3',    // "more like a lion"
    'A sun LION king dying — a full leonine ROAR breaking down into a final big-cat growl, unmistakably a lion, fading with solar warmth.'),
  D('audio/monster/mob_zodiac_libra_die.mp3',  // "does not sound like a goat"
    'A golden zodiac beast dying — a GOAT death bleat trailing away, caprine and clear, balance scales chiming as they fall. Goat first, chime second.'),
  D('audio/monster/mob_zodiac_aquarius_die.mp3', // "more aquatic noises"
    'A tideborn zodiac serpent dying — a great WATERY collapse, wave surging and washing out, aquatic gurgle sinking away, foam hissing to stillness.'),
  D('audio/monster/mob_zodiac_pisces_die.mp3', // "more aquatic noises"
    'TWIN zodiac FISH dying — two quick wet splashes, aquatic flopping, bubbles spiraling up, a watery swirl draining away. Unmistakably aquatic.'),
  // ---- NEEDS WORK: NPC voices (100-117) — babble, per gen_npc_voice.mjs -----
  V('audio/npc/npc_mystery_sage.mp3',          // "sounds like a bored sigh"
    'A MYSTERIOUS OTHERWORLDLY SAGE: a low resonant arcane murmur, slow deliberate syllables that seem to come from everywhere, layered with a faint ethereal shimmer, ancient and knowing. Engaged and purposeful. NOT a sigh, NOT bored, NOT sleepy.'),
  V('audio/npc/npc_barnaby.mp3',               // "sounds goofy"
    'A SEASONED STALWART KNIGHT-SENTINEL: a firm warm male babble, steady and dutiful, measured cadence with quiet honor in it, chest-deep and dependable. Serious and noble. NOT goofy, NOT silly, NOT cartoonish.'),
  // plum is pinned under the 1.0s bar: sfx_duration_test.mjs guards this file
  // permanently (v0.29.65x pass), so it gets sfx timing, not the babble bar.
  // v1 roll measured f0 490 Hz — too high for an old salt. Register-led.
  { file: 'audio/npc/npc_captain_plum.mp3', dur: 0.8, max: 1.0, // "does not sound like a captain"
    desc: BABBLE + 'AN OLD SEA CAPTAIN with a VERY LOW GRAVELLY voice: deep bass-baritone register of an elderly weather-beaten skipper, salt-cracked rasp, one short commanding harbor bark in nonsense syllables, slow and authoritative. The pitch is LOW and rough. NOT cute, NOT high-pitched, NOT young, NOT a squeak.' },
  V('audio/npc/npc_coach_stride.mp3',          // "goofy, should be deeper"
    'A BOOMING ATHLETIC COACH: a DEEP male chest voice, energetic drill-sergeant pep in nonsense syllables, hearty and driving, whistle-sharp attack on each syllable. Deep and motivating. NOT goofy, NOT high-pitched.'),
  V('audio/npc/npc_dj_vinyl.mp3',              // "no wub wub or yo yo"
    'A HYPE CLUB DJ: rhythmic beatbox-flavored male babble riding a groove, "wub-wub" and "yo-yo" style nonsense syllables, record-scratch vocal flair, smooth turntablist swagger. Musical and rhythmic.'),
  V('audio/npc/npc_echo_keeper.mp3',           // "squeaky for intimidating"
    'A DEEP INTIMIDATING GUARDIAN OF ECHOES: a low cavernous voice with a haunting hollow echo trailing each syllable, stern and imposing, cold authority. Deep and menacing. NOT squeaky, NOT high, NOT cute.'),
  V('audio/npc/npc_felina.mp3',                // "not feminine enough"
    'A SULTRY FELINE WOMAN banker: a smooth unmistakably FEMALE voice, velvety mid-low purring lilt curling through the syllables, elegant and poised, a soft feline "mrr" under the vowels. Clearly a woman. NOT shrill, NOT squeaky.'),
  // v1 roll measured f0 613 Hz — a chirp, not a smith. Register-led rewrite.
  V('audio/npc/npc_furnax.mp3',                // "not a deep male"
    'A HUGE MAN with an EXTREMELY DEEP BASS voice, like a giant blacksmith: very low-pitched male chest rumble, baritone-bass register of a big heavy man, slow weighty syllables. The pitch is VERY LOW. NOT high-pitched, NOT squeaky, NOT a chirp, NOT childlike, no high tones at all.'),
  V('audio/npc/npc_kuro.mp3',                  // "not intimidating"
    'A COLD INTIMIDATING SWORDSMAN: a low sharp male voice, quiet menace in a calm measured babble, each syllable precise as a blade, dangerous restraint. Chilling, NOT friendly, NOT warm.'),
  V('audio/npc/npc_master_kaze.mp3',           // "not a cool lao ban niang"
    'A COOL COMMANDING MATURE WOMAN martial master: a confident smoky FEMALE voice, unhurried boss-lady authority, effortlessly cool with a knowing edge, low-mid feminine register. The coolest person in the room. NOT a man, NOT meek.'),
  V('audio/npc/npc_nurse_joyce.mp3',           // "a bit non-feminine"
    'A WARM CARING NURSE, clearly a WOMAN: a soft gentle feminine voice with open rounded vowels, kindly bedside warmth, light musical lilt, soothing and maternal. Unmistakably female. NOT deep, NOT masculine, NOT gruff.'),
  // v1 roll measured f0 131 Hz — a man's register. Pitch-led rewrite.
  V('audio/npc/npc_ren.mp3',                   // "needs to be more feminine"
    'A YOUNG WOMAN in her early twenties with a LIGHT HIGH feminine voice: bright soprano-leaning female register, soft sweet airy syllables with a graceful rising lilt, clearly a girl\'s voice. The pitch is high and light. NOT a man, NOT masculine, NOT deep, NOT low-pitched, NOT gravelly.'),
  V('audio/npc/npc_skirra.mp3',                // "sounds goofy"
    'A COMPOSED LENS-GRINDER ARTISAN of the frosted steppe: a calm precise voice, cool and focused, quiet craftsman\'s concentration, each syllable exact and unhurried with a wintry stillness. Serious and steady. NOT goofy, NOT silly, NOT bouncy.'),
  V('audio/npc/npc_stormbearer.mp3',           // "does not sound like a cat"
    'A GREAT LIGHTNING TIGER spirit: feline chuffs and a low big-cat "mrowl", rumbling electric purr crackling under tiger-cat meow-growl syllables, majestic and storm-charged. Unmistakably a big CAT.'),
  V('audio/npc/npc_taiga.mp3',                 // "not a cool hooded assassin"
    'A COOL HOODED ASSASSIN: a low hushed voice barely above a whisper, razor-calm and precise, shadowy composure with a blade\'s edge, quiet lethal confidence. Cold and cool. NOT loud, NOT goofy, NOT warm.'),
  // v1 roll measured f0 580 Hz — still cute-high, the exact complaint. Pitch-led.
  V('audio/npc/npc_the_amnesiac.mp3',          // "too cute for an important npc"
    'A GROWN MAN with a LOW QUIET voice, weary and haunted: deep hushed adult male baritone register, slow heavy searching syllables full of sorrow and lost memory, grave and serious. The pitch is LOW. NOT cute, NOT chirpy, NOT high-pitched, NOT childlike, NOT squeaky, no bright tones.'),
  V('audio/npc/npc_tincture_aunt.mp3',         // "goofy and not feminine"
    'A WARM MIDDLE-AGED AUNTIE alchemist, clearly a WOMAN: a rich feminine mid-register voice, kindly knowing chuckle woven through the syllables, homely herbal warmth, motherly confidence. Unmistakably female. NOT goofy, NOT masculine.'),
  V('audio/npc/npc_will.mp3',                  // "not a cool knight"
    'A NOBLE YOUNG CHAMPION KNIGHT: a steady confident male voice, bright heroic timbre with disciplined calm, chivalrous and assured, quiet steel behind each syllable. Cool and composed. NOT goofy, NOT meek.'),
];

const targets = SOUNDS.filter(s => !only || s.file.includes(only));

// ---- MP3 duration straight from the frame headers ---------------------------
const RATES = [0,32,40,48,56,64,80,96,112,128,160,192,224,256,320,0];
const SR = [44100, 48000, 32000, 0];
function frames(buf) {
  let p = 0;
  if (buf.subarray(0, 3).toString('latin1') === 'ID3') {
    const sz = ((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) | ((buf[8] & 0x7f) << 7) | (buf[9] & 0x7f);
    p = 10 + sz;
  }
  const out = [];
  let dur = 0;
  while (p + 4 < buf.length) {
    if (buf[p] !== 0xff || (buf[p + 1] & 0xe0) !== 0xe0) { p++; continue; }
    const br = RATES[(buf[p + 2] >> 4) & 0x0f] * 1000;
    const sr = SR[(buf[p + 2] >> 2) & 0x03];
    if (!br || !sr) { p++; continue; }
    const len = Math.floor(144 * br / sr) + ((buf[p + 2] >> 1) & 1);
    dur += 1152 / sr;
    out.push({ off: p, end: p + len, at: dur });
    p += len;
  }
  return { list: out, dur };
}
const durationOf = (buf) => frames(buf).dur;
function trimTo(buf, maxSec) {
  const f = frames(buf);
  if (f.dur <= maxSec || !f.list.length) return buf;
  let cut = f.list[f.list.length - 1].end;
  for (const fr of f.list) if (fr.at > maxSec) { cut = fr.off; break; }
  return buf.subarray(0, cut);
}

if (!has('--generate')) {
  console.log(`DRY RUN — ${targets.length} clips (2 credits each = ${targets.length * 2}cr)\n`);
  for (const s of targets) {
    const abs = path.join(ROOT, s.file);
    const cur = fs.existsSync(abs) ? durationOf(fs.readFileSync(abs)) : null;
    console.log(`  ${(cur == null ? '(new)' : cur.toFixed(2) + 's').padStart(7)} -> req ${s.dur}s (bar ${s.max}s)  ${s.file}`);
  }
  console.log('\n# Re-run with --generate (needs LUDO_API_KEY).');
  process.exit(0);
}

const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const TIMEOUT = Number(process.env.LUDO_REQ_TIMEOUT_MS || 150000);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const BACKUP = path.join(ROOT, 'audio', '_regen_backup', TAG);
fs.mkdirSync(BACKUP, { recursive: true });

let failures = 0, done_n = 0;
for (const s of targets) {
  const abs = path.join(ROOT, s.file);
  let done = false, last;
  for (let a = 1; a <= 3 && !done; a++) {
    const req = Math.max(0.35, s.dur - (a - 1) * 0.2);
    try {
      process.stdout.write(`[${done_n + 1}/${targets.length}] ${s.file} attempt ${a} (req ${req}s) ... `);
      const res = await fetch(`${API}/audio/sound-effect`, {
        method: 'POST',
        headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT),
        body: JSON.stringify({ description: s.desc, duration: req, loop: false }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text().catch(() => '')).slice(0, 120)}`);
      const j = await res.json();
      const url = j.url || (j.result && j.result.url);
      if (!url) throw new Error('no url in response');
      const dl = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT) });
      if (!dl.ok) throw new Error(`download HTTP ${dl.status}`);
      let buf = Buffer.from(await dl.arrayBuffer());
      if (buf.length < 1000) throw new Error(`suspiciously small (${buf.length}B)`);
      let dur = durationOf(buf);
      if (!dur) throw new Error('not a decodable MP3');
      if (dur >= s.max && a < 3) throw new Error(`${dur.toFixed(2)}s — over the ${s.max}s bar, retrying shorter`);
      if (dur >= s.max) { buf = trimTo(buf, s.max - 0.05); dur = durationOf(buf); process.stdout.write('(trimmed) '); }
      if (dur >= s.max) throw new Error(`still ${dur.toFixed(2)}s after trim`);
      if (fs.existsSync(abs)) fs.copyFileSync(abs, path.join(BACKUP, path.basename(abs)));
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      const tmp = abs + '.tmp';
      fs.writeFileSync(tmp, buf);
      fs.renameSync(tmp, abs);
      console.log(`OK ${dur.toFixed(2)}s, ${(buf.length / 1024).toFixed(0)} KB`);
      done = true;
    } catch (e) {
      last = e; console.log('FAIL: ' + e.message);
      if (/\b402\b|credits/i.test(e.message)) { console.error('OUT OF CREDITS'); process.exit(3); }
      if (a < 3) await sleep(1500 * a);
    }
  }
  if (!done) { failures++; console.error(`giving up on ${s.file}: ${last?.message}`); }
  done_n++;
  await sleep(1200);
}
console.log(failures ? `DONE with ${failures} failure(s)` : 'ALL DONE');
process.exit(failures ? 1 : 0);
