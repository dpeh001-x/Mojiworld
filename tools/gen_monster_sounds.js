// Monster SFX prompt generator — authors the text descriptions fed to the
// Ludo /audio/sound-effect endpoint for per-monster hit/die clips.
// =============================================================================
// The game resolves a monster's SOUND FAMILY at runtime in mojiworld_game.html
// (_monsterSfxFamily, ~L86140): an explicit override table first, then a regex
// fallback. We mirror that EXACT logic here so the description we author for
// `mob_<id>_<kind>.mp3` matches how the engine would otherwise categorise it.
//
// A custom file at audio/monster/mob_<id>_<kind>.mp3 overrides the family clip
// for that one monster (see audio/monster/CUSTOM_SOUNDS.md). This module turns
// each monster id into a short, punchy SFX description; the runner
// (scripts/generate_monster_sounds.mjs) sends it to Ludo and saves the mp3.
// =============================================================================

// --- Full monster roster (from audio/monster/CUSTOM_SOUNDS.md §3) ------------
// `boss: true` → engine skips the generic die clip (mojiworld_game.html:49679
// guards _playMonsterSfx(...,'die') with !m.isBoss). Hit clips still play for
// bosses (L48757 has no boss guard), so a boss still gets a useful mob_<id>_hit.
const MONSTERS = [
  // Beginner / forest
  'snail','slime','mushroom','horny','orange','stump','frog','axolotl','gummy',
  'cookie','mushpup','petalfly','sproutle','cloudbun',
  // Undead / crypt
  'zombie','mummy','skeleton','wraith','boneWraith','tombWraith','tombKeeper',
  'sepulchreHound','graveReaver','lichkin','shardlich','mournshade','lanternWisp',
  'echoKnight','pathsBane','boneGolem','bonebosn','drownedCur','spectreCannoneer',
  // Critters / elemental
  'scorpion','honeyBuzz','nougatBear','voltipup','frostkin','emberling','skywisp',
  'sandhusk','stoneling','sparkling','sparkSprite','thunderMole','stormKitty',
  'glasswindHare','mirageStalker','cinderling','bellowsbat','razorgale','forgewight',
  'smithgolem',
  // Sea
  'coralImp','pearlSprite','tideling','tidefish','clownfish','pufferfish','jellyfish',
  'anglerfish','seahorse','seasponge','seastar','grumpsquid','tidepoolTurtle','brinekraken',
  // Celestial / cosmic
  'cherub','seraph','archon','nimbusFox','cosmicMochi',
  // Block-land
  'blockPopo','blockHupo','blockEle','blockRhirhi','blockGary','blockTigreal','blockRexy',
  // Mechanical (Ticket Rush)
  'ticketMech','conductorMech','expressTicketMech',
  // Octopus boss legs
  'octoLegPoison','octoLegFreeze','octoLegSkillLock','octoLegStun',
  // Bosses / named
  'king','mushmom','aetherion','gravitos','octobaby','koopaKing','mirrorSelf',
  'fatLizard','fatDragon','sundered_smith','goblinScout','goblinMauler','mayo',
  // Story / inner-dimension
  'deranged_kuro','future_lyra','potato_uncle','willeo','young_bloodthirsty_vermillion',
  'vigil_vermillion','young_confused_barnaby',
  // Tower of the Spire (endless tower — added after CUSTOM_SOUNDS.md v1).
  // towerArbiter + towerSovereign are bosses; the rest are normal mobs.
  'towerWisp','towerWarden','towerHexer','towerStalker','towerArbiter','towerSeer',
  'towerShardling','towerOssifer','towerStormcaller','towerSovereign',
  // v0.26.x — gap-fill: types in the game roster that lacked a unique hit clip
  // (fell back to a family sound). pqConductor + the 12 zodiac bosses. Each gets
  // a bespoke themed HIT prompt below (HIT_OVERRIDE), not a generic family clip.
  'pqConductor',
  'zodiac_aries','zodiac_taurus','zodiac_gemini','zodiac_cancer','zodiac_leo',
  'zodiac_virgo','zodiac_libra','zodiac_scorpio','zodiac_sagittarius',
  'zodiac_capricorn','zodiac_aquarius','zodiac_pisces',
];

// Bosses that skip the generic die clip. goblinScout/goblinMauler are normal
// mobs despite living under the "named" header, so they are NOT bosses here.
const BOSSES = new Set([
  'king','mushmom','aetherion','gravitos','octobaby','koopaKing','mirrorSelf',
  'fatLizard','fatDragon','sundered_smith','mayo','brinekraken',
  'deranged_kuro','future_lyra','potato_uncle','willeo',
  'young_bloodthirsty_vermillion','vigil_vermillion','young_confused_barnaby',
  'towerArbiter','towerSovereign',
  'pqConductor',
  'zodiac_aries','zodiac_taurus','zodiac_gemini','zodiac_cancer','zodiac_leo',
  'zodiac_virgo','zodiac_libra','zodiac_scorpio','zodiac_sagittarius',
  'zodiac_capricorn','zodiac_aquarius','zodiac_pisces',
]);

// --- Family resolution — mirrors mojiworld_game.html _monsterSfxFamily -------
// Keep this in sync with _MONSTER_SFX_FAMILY_OVERRIDE (game ~L86110) and the
// regex set (~L86147). 12 families total: the 6 shipped fallbacks plus the 6
// remapped (mechanical/goblin/fairy/fish/golem/insect).
const FAMILY_OVERRIDE = {
  ticketMech:'mechanical', conductorMech:'mechanical', expressTicketMech:'mechanical',
  smithgolem:'mechanical', forgewight:'mechanical',
  goblinScout:'goblin', goblinMauler:'goblin',
  petalfly:'fairy', sproutle:'fairy', pearlSprite:'fairy', sparkSprite:'fairy',
  nimbusFox:'fairy', cosmicMochi:'fairy', cloudbun:'fairy', skywisp:'fairy',
  clownfish:'fish', pufferfish:'fish', anglerfish:'fish', seahorse:'fish',
  jellyfish:'fish', tidefish:'fish', tidepoolTurtle:'fish', coralImp:'fish',
  brinekraken:'fish', tideling:'fish',
  boneGolem:'golem', stoneling:'golem',
  honeyBuzz:'insect', sparkling:'insect', scorpion:'insect',
  seasponge:'fish', seastar:'fish', grumpsquid:'fish',
  tombWraith:'ghost', mournshade:'ghost', shardlich:'ghost',
  bellowsbat:'bat', razorgale:'bat',
  fatDragon:'dragon', fatLizard:'dragon',
  // Tower of the Spire — chosen for sound character (per-monster custom files
  // play regardless of family; family only shapes the authored description).
  // towerWisp falls through to the regex (→ghost) already.
  towerWarden:'golem', towerHexer:'ghost', towerStalker:'ghost', towerSeer:'ghost',
  towerShardling:'golem', towerOssifer:'skeleton',
};

function familyFor(id) {
  if (FAMILY_OVERRIDE[id]) return FAMILY_OVERRIDE[id];
  const t = String(id || '').toLowerCase();
  if (/slime|gloop|blob|gel/.test(t)) return 'slime';
  if (/ghost|wraith|spectre|spirit|phantom|wisp|specter|lich/.test(t)) return 'ghost';
  if (/bat|flier|moth|wing|hawk|gale|razor/.test(t)) return 'bat';
  if (/skel|undead|crypt|sepulchre|ribcage/.test(t)) return 'skeleton';
  if (/dragon|wyrm|drake|saur|tyranno|godzilla|sauro/.test(t)) return 'dragon';
  return 'beast';
}

// --- Per-family sonic profiles -----------------------------------------------
// Short, concrete descriptions. `die` = death/defeat one-shot; `hit` = brief
// "took damage" reaction. Kept punchy so Ludo's auto-duration stays tight
// (clips play at 45% vol, target ~0.3–1.0s per CUSTOM_SOUNDS.md).
const FAMILY_PROFILE = {
  slime:     { die:'a wet gelatinous splat as a slime bursts, a soft squelchy plop and dribble',
               hit:'a short wet squish, a jiggly gooey impact' },
  ghost:     { die:'a hollow ethereal wail fading into a ghostly whoosh as a spirit dissipates',
               hit:'a brief eerie spectral flinch, a cold airy whoosh' },
  bat:       { die:'a high screechy squeak and a flurry of leathery wing-flaps cutting off abruptly',
               hit:'a quick shrill squeak and a single sharp wing-flap' },
  skeleton:  { die:'a clattering collapse of dry bones tumbling into a heap, hollow bony rattle',
               hit:'a sharp dry bone clack, a brittle skeletal knock' },
  dragon:    { die:'a guttural roaring death-bellow trailing into a low rumbling growl as a dragon falls',
               hit:'a short angry guttural snarl, a deep reptilian grunt' },
  beast:     { die:'a feral animal yelp ending in a growling whimper as a beast is felled',
               hit:'a quick gruff animal grunt, a meaty thud' },
  mechanical:{ die:'metal grinding to a halt, gears seizing with a clank and a dying electrical whine',
               hit:'a hard metallic clank, a sharp clang of struck metal' },
  goblin:    { die:'a shrill goblin shriek cut short by a guttural choking grunt',
               hit:'a quick raspy goblin grunt, a guttural yelp' },
  fairy:     { die:'a delicate magical chime shattering into a soft sparkly twinkle that fades',
               hit:'a light airy shimmer, a tiny bright magical ding' },
  fish:      { die:'a wet flopping slap and a bubbly gurgle as a sea creature is splattered',
               hit:'a quick wet slap, a watery bloop' },
  golem:     { die:'heavy stone cracking apart and crumbling into a rockslide of rubble',
               hit:'a dull stone crack, a heavy rocky thud' },
  insect:    { die:'a crunchy chitin snap and a buzzing rattle cutting off as an insect is squashed',
               hit:'a short chitinous crackle, a buzzing flinch' },
};

// --- Per-monster flavor — element/size keyword tweaks ------------------------
// Layered onto the family base so siblings in a family still differ. Purely
// additive descriptive clauses; order = first match wins per group.
const ELEMENT_FLAVOR = [
  [/frost|froze|ice|frozen|snow/i,        'with an icy crackle and a frosty shimmer'],
  [/ember|cinder|magma|forge|flame|fire|smith/i, 'with a fiery crackle and a hot ember hiss'],
  [/volt|spark|thunder|storm|lightning/i, 'with a crackling electric zap'],
  [/poison|venom|toxic|drowned/i,         'with a bubbling toxic gurgle'],
  [/sand|dune|dust|husk/i,                'with a dry gritty sandy rasp'],
  [/cosmic|stardust|astral|nimbus|cloud|sky|gale|wind/i, 'with an airy celestial whoosh'],
  [/coral|tide|pearl|sea|brine|ocean|wave/i, 'with a watery splash undertone'],
];
const SIZE_FLAVOR = [
  [/king|boss|mom|titan|kraken|rexy|tigreal|ele\b|fat|archon|seraph/i, 'deep, large and weighty'],
  [/baby|pup|kin|ling|fly|bun|sprite|cherub|snail|mochi/i, 'small, light and high-pitched'],
];

function flavorFor(id) {
  const clauses = [];
  for (const [re, txt] of ELEMENT_FLAVOR) if (re.test(id)) { clauses.push(txt); break; }
  for (const [re, txt] of SIZE_FLAVOR)    if (re.test(id)) { clauses.push(txt); break; }
  return clauses;
}

// --- Per-monster bespoke HIT descriptions ------------------------------------
// For highly-themed bosses the generic family clip reads wrong, so author a
// unique "took damage" reaction per id. When present, this REPLACES the family
// base AND the element/size flavor (the override is already fully themed).
const HIT_OVERRIDE = {
  // Party-Quest clockwork train conductor.
  pqConductor: 'a sharp metallic train-whistle toot and a hard steam-piston clank as a clockwork train conductor is struck, a quick hiss of escaping steam',
  // 12 zodiac bosses — each by its sign element/beast.
  zodiac_aries:       'a celestial fire-ram struck — a hard horn-crack and an angry flaring flame whoosh, a fiery grunt',
  zodiac_taurus:      'a massive celestial earth-bull struck — a deep snorting bellow and a heavy stone-stomp thud with a gritty rumble',
  zodiac_gemini:      'a twin celestial spirit struck — a doubled echoing cosmic chime and an airy twin-toned whoosh',
  zodiac_cancer:      'a celestial crab struck — a wet hard shell-clack and a splashing bubble burst',
  zodiac_leo:         'a celestial sun-lion struck — a regal roaring grunt with a bright solar-flare crackle',
  zodiac_virgo:       'a serene celestial maiden struck — a soft crystalline chime and a gentle rustle of leaves, a nature shimmer',
  zodiac_libra:       'a celestial arbiter struck — a clear balanced metallic chime-ring like struck brass scales',
  zodiac_scorpio:     'a celestial scorpion struck — a venomous chitinous sting-snap and a dark toxic hiss',
  zodiac_sagittarius: 'a celestial centaur-archer struck — a sharp bowstring twang and a fiery grunt',
  zodiac_capricorn:   'a celestial sea-goat struck — a gruff bleating grunt and an icy rock-crack',
  zodiac_aquarius:    'a celestial water-bearer struck — a surging splash of water and an airy gasp, a watery whoosh',
  zodiac_pisces:      'a celestial twin-fish struck — an ethereal watery bubble-burst and a soft shimmering flinch',
};

// Compose the final SFX description for one (monster, kind).
function buildSoundPrompt(id, kind) {
  const override = (kind === 'hit') ? HIT_OVERRIDE[id] : null;
  let base, tail;
  if (override) {
    base = override;
    tail = '';                       // override is already fully themed
  } else {
    const fam = familyFor(id);
    const prof = FAMILY_PROFILE[fam] || FAMILY_PROFILE.beast;
    base = prof[kind] || prof.die;
    const extra = flavorFor(id);
    tail = extra.length ? `, ${extra.join(', ')}` : '';
  }
  // Trailing constraints keep clips game-ready: dry, mono-ish, no music/tail.
  return `Video game monster ${kind === 'die' ? 'death' : 'hit'} sound effect: ${base}${tail}. ` +
         `Short, dry, punchy, no music, no reverb tail, retro arcade game SFX.`;
}

module.exports = {
  MONSTERS, BOSSES, FAMILY_OVERRIDE, FAMILY_PROFILE,
  familyFor, flavorFor, buildSoundPrompt,
};
