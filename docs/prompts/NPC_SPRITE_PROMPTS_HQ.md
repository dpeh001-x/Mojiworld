# Mojiworld — High-Quality NPC Sprite Prompts (v0.25.949)

A complete prompt re-pass for every named NPC currently in the game.
Designed for image-generation models capable of premium painterly
mobile-RPG character art (Midjourney v6+, SDXL with character LoRAs,
Ludo Premium, Flux Dev, etc.). Each prompt is composed from a shared
**[STYLE]** + **[QUALITY]** + **[FORMAT]** lock plus a per-NPC
**[CHARACTER]** block so all 30+ NPCs read as one coherent cast.

Pre-v0.25.949 the existing sprites were generated with the v0.25.809
512×512 pixel-art prompts. The user noted the results felt flat. This
doc upgrades the style language toward **hand-painted illustration**
(soft brush strokes, glossy cel-shading, dramatic lighting) rather than
pixel-art — closer to *Genshin Impact* / *Onmyoji* / *Hades* / *Cookie
Run Kingdom* promotional character art. Engine renders these as static
side-scroller NPCs, so a single keyframe pose is the only deliverable.

---

## Shared prompt template

Paste each NPC's prompt as a SINGLE paragraph (no line breaks inside
the prompt itself — line breaks below are for readability). Order
matters: STYLE → QUALITY → FORMAT → CHARACTER.

### [STYLE PREFIX] — paste verbatim every time

> Premium hand-painted character illustration in the style of modern
> mobile-RPG promotional art (Genshin Impact / Onmyoji / Cookie Run
> Kingdom character keyframes), single full-body character centred on
> a transparent background, three-quarter idle pose facing camera-left
> at 35 degrees with weight settled on the rear leg, head tilted
> slightly toward the viewer, gentle breathing stance, no environmental
> props beyond hand-held items, no speech bubbles, no text, no
> watermark, no ground shadow underneath the figure.

### [QUALITY PREFIX] — paste verbatim every time

> Crisp 2 px black ink outline around the entire silhouette plus
> selective inner outlines on hair tufts, gloves, and weapon edges.
> Painterly cel-shading with three tone bands per material — base,
> mid-shadow, deep-shadow — and a warm key light from upper-left at
> 45 degrees with cool rim light from upper-right separating the
> figure from the transparent background. Soft ambient occlusion under
> the chin, inside hair locks, and beneath any belt or sash. Eyes use
> glossy black pupils with double white catchlights for life. Hair
> highlights are sharp anime-style stripes with no gradient blur.
> Skin reads as smooth porcelain with a single rosy nose-cheek dab.
> No anti-aliased gradients on outlines; outlines must read crisp at
> in-game 128 px display size.

### [FORMAT PREFIX] — paste verbatim every time

> Output 768×1024 PNG with transparent alpha. Character occupies the
> central 70 % of the canvas, head at 12 % from top, feet at 92 % from
> top, breathing margin of 10-15 % on both sides. Body proportions:
> head height 1.2 × shoulder width, torso 2 × head height, total
> figure 5 × head height (slightly heroic; not full anime chibi).
> Save as `Sprites/npc/<filename>.webp` after generation.

### [CHARACTER BLOCK] — fill in per NPC (see catalogue below)

> A character named **<NAME>**, role <role>. <Age + build>.
> <Wearing>. <Holding/wearing>. Expression: <expression>.
> Hair: <hair>. Eyes: <eyes>. Skin: <skin>. Personality cue:
> <one-line personality>. Palette anchors: <2-3 colour names with
> approximate hex>. Lighting accent: <warm/cool, e.g. "evening
> hearth-glow on the left cheek and steel-blue rim on the right">.

---

## NPC catalogue — 20 priority characters

Each entry below is the **[CHARACTER BLOCK]** only — append the
three prefixes above to produce the full prompt. Listed in
order of player-visibility (town NPCs first, faction
instructors second, sub-faction NPCs third).

> **Filename convention:** lowercase + underscores for spaces, e.g.
> `taxi_uncle.webp`, `sage_mira.webp`, `master_kaze.webp`. The
> in-game NPC_SPRITE_FILES registry expects this casing. (Exception:
> `Guguma.webp` keeps its capital G per the registry override.)

---

### 1 · The Amnesiac — `amnesiac.webp`

A character named **The Amnesiac**, role: cosmic shard-bearer who has
forgotten their name. Adult of indeterminate gender, willowy build,
mid-thirties appearance. Wearing a long off-shoulder pilgrim's robe in
dusty sand-and-ochre layered with a thin sash of faded indigo, sleeves
rolled to the elbow. Holding nothing but their own left wrist as if
checking a pulse that isn't there. Expression: distant, quietly
melancholy, eyes half-lowered as if remembering. Hair: shoulder-length
ash-blonde with two strands fallen across the eyes; one streak of
silver at the temple. Eyes: pale moonstone grey with a faint lavender
inner ring. Skin: porcelain with violet undertones at the temples.
Personality cue: a person who is gentler than the universe deserves;
speaks like they're reading from someone else's letter. Palette
anchors: dusty sand `#cc9944`, faded indigo `#5a4a78`, ash silver
`#c8c0b0`. Lighting accent: cool dawn-blue rim from the right, warm
ember tone from the left — half the figure feels remembered, half
forgotten.

---

### 2 · ??? (Sage Mira) — `sage_mira.webp`

A character named **???** (known to those who knew her before she lost
her name as **Sage Mira**), role: silver-haired sentinel of the
Wayfarer's Lantern Gate. Elderly but not frail, tall, late seventies,
with the spine of someone who never stopped walking. Wearing a
weather-stained pilgrim's surcoat over dark wool trousers, a long
muffler of pale violet wrapped loosely around the throat, leather
boots scuffed at the toe. Holding a tall walking-staff topped with a
small unlit brass lantern. Expression: serene and heavy — the kind of
half-smile someone wears when they've been waiting a very long time
for one specific guest. Hair: silver-white waist-length, loosely
braided over one shoulder. Eyes: the colour of an unfinished sky —
pale grey with a hint of violet, slightly tired. Skin: warm porcelain
with sun-lines at the corners of the eyes. Personality cue: stood at
the gate for three hundred years; speaks in slow complete sentences;
has never once raised her voice. Palette anchors: silver `#d8d4e8`,
faded violet `#aa66cc`, lantern-brass `#c69540`. Lighting accent: cool
dawn-blue rim from the right; the lantern is unlit, so no warm glow
from it — instead a soft warm key from the unseen east horizon.

---

### 3 · Old Bartel (Taxi Uncle) — `taxi_uncle.webp`

A character named **Taxi Uncle** (real name **Old Bartel**), role:
caravan driver who has hitched two doomed expeditions and is still
hitching. Sixty-five, weathered and broad-shouldered, slight pot belly
under the apron, calloused hands. Wearing a brown leather caravaneer's
coat over a striped beige-and-cream tunic, wide cargo trousers tucked
into knee-high boots, brass buckles all over. A grey driver's cap
pushed back on his head; a rolled-up map tucked into his belt. Holding
a long camel-driver's switch loosely in his right hand. Expression: a
wry half-smile, eyes crinkled, like a man who's heard every excuse and
finds most of them funny. Hair: thinning white-grey, long white
mustache. Eyes: hazel with the deep crows-feet of decades of squinting
at horizons. Skin: tanned terracotta with sun-burnished cheeks.
Personality cue: cheerful, fatalistic, owes nobody anything and knows
it. Palette anchors: warm leather `#8a5a30`, cream stripe `#e8d4a4`,
brass buckle `#c69540`. Lighting accent: golden-hour afternoon light
washing the left side of the figure; soft dust motes implied around
him.

---

### 4 · Brok the Blacksmith — `brok.webp`

A character named **Brok**, role: enhancement / crafting blacksmith at
Everdawn Central's forge. Late forties, mountainous build, biceps the
size of a normal man's thighs, leather apron stretched across a barrel
chest. Wearing a sleeveless black tunic under a heavy soot-stained
brown leather apron, fingerless leather gauntlets reinforced with iron
studs, dark trousers, heavy steel-toed boots. Holding a long-handled
forge-hammer across his shoulder. Expression: stern + focused, the
intense calm of a man mid-strike — head down, eyes on the viewer like
he's appraising what you brought him. Hair: full red-orange beard
braided in two thick strands, head shaved smooth, single small gold
hoop in the left ear. Eyes: pale steel-blue, intense. Skin: ruddy tan
with darker forearms, soot streaks on the knuckles. Personality cue:
speaks in short complete sentences; respects materials more than
people, but respects competent people very much. Palette anchors:
soot-brown apron `#5a3a20`, red-orange beard `#cc5522`, hammer-steel
`#88aabb`. Lighting accent: warm forge-glow from below-right (his fire
is off-canvas); cool tungsten daylight from upper-left.

---

### 5 · Fashionista — `fashionista.webp`

A character named **Fashionista**, role: cosmetic wardrobe vendor in
the bazaar. Young adult, glamorous and theatrical, presents femme,
mid-twenties. Wearing an asymmetric off-shoulder dress in deep magenta
and gold with a sweeping side-slit skirt; one elbow-length glove of
black velvet, the other arm bare with a stack of gold bangles; tall
strappy heels in matching magenta; a sheer chiffon sash trailing
behind. Holding a brass-handled folding hand mirror angled so we just
catch a reflection of bright eye glitter. Expression: confident, one
eyebrow lifted, the air of someone about to give very honest fashion
advice. Hair: hot-pink platinum-blonde ombré in voluminous beach
waves, swept dramatically to one side. Eyes: bright emerald with
glossy eyeshadow in champagne gold and heavy mascara. Skin: porcelain
with rose blush. Personality cue: addresses everyone as "darling";
genuinely cares about how you look but pretends not to. Palette
anchors: magenta `#ff66cc`, gold `#ffd166`, black velvet `#1a0a18`.
Lighting accent: hot-pink stage-light kicker from the right, warm
gold key from upper-left — a runway-photoshoot vibe.

---

### 6 · Milo the Rusted Usher — `milo_usher.webp`

A character named **Milo the Rusted Usher**, role: gatekeeper of the
Clockwork Underpass solo party-quest. Sixty, gaunt, **missing his
right arm above the elbow** (the empty sleeve pinned with a brass
turnstile-token), short stooped posture. Wearing a faded conductor's
uniform in deep burgundy with tarnished brass buttons, a railway-
peaked cap with the lettering UP rubbed off, oil-stained white gloves
on the remaining hand, an unevenly polished brass nameplate on the
chest reading "MILO". Holding a clipboard tucked under the stump-arm
with a thick stack of yellowed ticket-stubs. Expression: half-bored
half-warm — the slight twinkle of someone who used to love this job
and remembers loving it. Hair: thin grey side-parted, neatly combed
despite the dust. Eyes: cataract-pale blue with one eye slightly
lazy. Skin: lined parchment, deep crow's-feet. Personality cue:
speaks in clipped transit-employee cadence ("Mind the gap. And the
rust. And the ghosts."); has been at this turnstile longer than the
route has existed. Palette anchors: faded burgundy `#7a3a3a`,
tarnished brass `#aa8866`, rust orange `#cc6633`. Lighting accent:
dim subway-neon flicker from below-left (cool teal); dusty
incandescent bulb warm yellow from upper-right.

---

### 7 · Guguma (the canary mascot) — `Guguma.webp`

A character named **Guguma the canary**, role: cosmic-mascot guide,
sent by the Above-the-Sky watcher. A small (about knee-height of an
adult) chibi chick: round egg-shaped body, fluffy white belly, short
stubby orange legs, tiny wing-tufts at the side, a single sproutling
feather curl on top of the head, big glossy black bead-eyes with
prominent white catchlights, a small orange triangular beak parted in
mid-cheep. Holding nothing — both wing-tufts at his sides. Expression:
enthusiastic + curious, beak slightly open as if mid-chirp, head
tilted toward the viewer. Plumage: vivid lemon yellow `#ffd84a` with
paler primrose `#ffe89a` highlights and a single warm cream `#fff8d6`
belly patch. Beak + feet: warm pumpkin orange `#ff9933`. Body
outline: 3 px solid black for that sticker / mascot look — slightly
thicker than the rest of the cast since Guguma is a small chibi. No
shading on the white belly (single flat tone). Personality cue: the
only creature in Moji openly delighted to see the Outsider; speaks in
chirps that resolve into actual words. Palette anchors: lemon
`#ffd84a`, pumpkin `#ff9933`, cream `#fff8d6`. Lighting accent: soft
warm-gold morning halo behind the head; no ground shadow.

---

### 8 · Postal Wisp — `postal_wisp.webp`

A character named **Postal Wisp**, role: floating town courier.
Spectral / faerie design — a tiny luminous wisp humanoid about the
size of a tall lantern, hovering 30 cm off the ground. Wearing a
crisp navy-blue postal cap (oversized — almost a third of their
height), a small navy collared cape with a brass mail-horn pin, no
visible legs (lower body fades into glowing pale-blue mist). Carrying
an oversized canvas mail-satchel — fabric beige with the brass clasp
larger than the wisp's head — slung across one shoulder, multiple
sealed letters poking out. Expression: cheery, slightly distracted, a
small open-mouth smile as if mid-sentence ("Delivery!"). Hair: none —
instead a soft luminous tuft of pale-blue spirit-light where the head
crown would be. Eyes: huge round glossy ink-black with prominent
catchlights. Skin: translucent pale cyan with a faint inner glow.
Personality cue: polite, schedule-obsessed, slightly anxious about
running late. Palette anchors: spirit-blue `#aaccff`, navy uniform
`#2a4a8a`, canvas satchel `#d8c8a0`. Lighting accent: a soft inner
glow from the wisp itself plus a complementary warm lantern-orange
key on the satchel.

---

### 9 · Old Arlen — `old_arlen.webp`

A character named **Old Arlen**, role: lore-keeper and historian.
Eighty, frail but spry, professorial. Wearing a long olive-green
scholar's robe with copper-thread embroidery at the cuffs, a brass
buckle at the chest, fingerless reading-gloves, soft slippers visible
under the hem. Holding a leather-bound book under one arm and a brass
half-moon spectacle in the other hand mid-clean. Expression: gently
amused, eyes crinkled, mouth in the small private smile of someone
remembering a story. Hair: long white wispy, parted in the centre;
matching long white beard tied with a small leather cord; both
slightly windblown. Eyes: pale grey-blue, magnified slightly by
spectacles. Skin: parchment-pale with deep age lines and liver spots
on the cheekbones. Personality cue: trusts you only after his third
favourite anecdote; will tell you that anecdote first. Palette
anchors: olive robe `#5a6a44`, copper thread `#c8884a`, parchment
`#e8d8b8`. Lighting accent: warm reading-lamp yellow from below-left
(implied bookshelves off-canvas); cool window-light cyan from
upper-right.

---

### 10 · DJ Vinyl — `dj_vinyl.webp`

A character named **DJ Vinyl**, role: nightclub jukebox operator.
Mid-twenties, androgynous, slim build, full of motion. Wearing
oversized retro headphones in glossy black with a neon-pink LED ring
around each ear cup, a cropped black bomber jacket with iridescent
holographic patches on both sleeves, a magenta crop-top, baggy
black-and-purple striped trousers with a chain belt, chunky neon-pink
high-top sneakers. Both hands on an oversized levitating vinyl
turntable (mid-mix, one hand on a disc, one on a slider). Expression:
ecstatic mid-drop grin, mouth open in delight, eyes closed in the
beat. Hair: short undercut in vibrant lilac with neon-cyan tips,
swept upward as if blown by sub-bass. Eyes: closed in mid-mix with a
faint pink heart-shaped highlight on the eyelid. Skin: deep plum-brown
with iridescent highlight. Glow: the LED ring on the headphones casts
soft pink under-light onto the cheek. Personality cue: dialled to
maximum energy at all times; speaks in DJ vocab ("set", "drop",
"vinyl"); deeply gentle underneath. Palette anchors: neon magenta
`#ff44aa`, lilac hair `#cc99ee`, holographic patch (rainbow
iridescence). Lighting accent: nightclub under-light from below (UV
violet), pink LED side-light from the headphones, soft cool moon-blue
rim from above-right.

---

### 11 · Will the Steadfast — `will.webp`

A character named **Will the Steadfast**, role: Bastion Throne knight
captain — the Warrior class instructor for the Inner Dimension trial.
Late thirties, broad-shouldered, weathered handsome, military bearing.
Wearing full Bastion plate armour in burnished gold and white enamel
with a deep crimson tabard, an enormous two-handed greatsword strapped
across his back (visible hilt rising above the right shoulder), a
white wolf-pelt cloak pinned at one shoulder by a sun-shaped brooch.
Holding nothing in his hands — they rest on a sword pommel hilt at his
waist as if at parade rest. Expression: stoic and measured, level
gaze, the small flicker of a smile reserved for those who survive
their first real fight. Hair: short military auburn, neat side-part,
a thin scar across the right eyebrow. Eyes: amber-gold, intense.
Skin: tanned with a few faint scars on the jawline. Personality cue:
speaks in oaths and slow declarations; means every word; the kind of
captain who memorises every recruit's name within a week. Palette
anchors: burnished gold `#d4a04d`, white enamel `#f0e8d8`, crimson
tabard `#a82820`. Lighting accent: noon parade-ground light from
upper-left (golden), cool dusk-blue rim from upper-right — the man
exists at the crossroads of duty and the next watch.

---

### 12 · Hera the Empyrean — `hera.webp`

A character named **Hera the Empyrean**, role: Azure Academia
archmage — the Mage class instructor for the Inner Dimension trial.
Forties, tall + regal, the bearing of someone who has been the
smartest person in every room for decades. Wearing an intricate
floor-length sapphire-blue mage robe with gold celestial embroidery
(constellations stitched along the hem), a high stiff collar trimmed
with silver moon-charms, an inner robe of pale-cream silk, gold
slipper-shoes peeking from under the hem. A floating tome (the
*Empyrean Codex*) hovers open at her elbow, pages turning by
themselves. Holding a long crystal-tipped staff in her right hand —
the crystal a single carved sapphire pulsing soft blue. Expression:
serenely amused, one corner of the mouth lifted, the look of a
teacher who already knows your answer is wrong. Hair: long platinum
silver, tied at the nape in a loose low chignon with one strand
falling over the shoulder; a small silver circlet with a single
sapphire at the brow. Eyes: pale ice-blue with vertical-slit pupil
faintly glowing. Skin: porcelain with a cool undertone. Personality
cue: speaks slowly, treats every conversation as a teaching moment;
secretly worried she has not yet found the student who can finish
what she could not. Palette anchors: sapphire blue `#3a4a8a`, gold
embroidery `#ccaa55`, silver `#d8d4e8`. Lighting accent: cool moonlit
key from above-right (her tower is exposed to sky), warm interior
candlelight from below-left.

---

### 13 · Lady Hong — `lady_hongyu.webp`

A character named **Lady Hong**, role: Jade Grove sanctuary
matriarch — the Archer class instructor for the Inner Dimension
trial. Mid-fifties, elegant, the matriarch of a tea-and-archery
school. Wearing a flowing emerald-green hanfu silk robe layered over a
crisp white inner garment, gold-embroidered crane motifs sweeping
across the shoulders and down the sleeves, a wide gold-and-jade obi
sash, jade hair-pins. A finely-curved horn-and-jade longbow rests at
her hip, unstrung but visibly hers. Holding a steaming teacup in her
right hand at chest height, the steam curled artfully toward the
viewer. Expression: warm + appraising, soft smile, eyes narrowed
slightly in welcome — the kind of greeting that comes with a question
inside it. Hair: long jet-black with two streaks of silver at the
temples, swept up into an elaborate jade-pinned topknot. Eyes: warm
dark amber. Skin: porcelain with a healthy peach undertone.
Personality cue: speaks softly, her tea is older than your
grandmother; will know more about you after one cup than your closest
friends. Palette anchors: emerald silk `#2a8a5a`, gold crane
`#ccaa55`, jade `#88ccaa`. Lighting accent: golden-hour tea-pavilion
warmth from below-left, cool morning shade from upper-right; gentle
particles of incense smoke implied behind her.

---

### 14 · Taiga — `taiga.webp`

A character named **Taiga**, role: Shadow-Woven Hood master assassin —
the Rogue class instructor for the Inner Dimension trial. Late
twenties, athletic + lean, the silent posture of someone who never
makes a sound when they don't mean to. Wearing dark-charcoal layered
shinobi garb: a high-collared sleeveless ninja vest, tight wrappings
on both forearms and shins, a half-mask of dark-violet silk pulled
down at the moment (so the lower face is visible — a small wry smile
showing), dark hakama trousers, soft black tabi boots. A pair of
matching short swords (kodachi) crossed on the back, hilts wrapped in
violet leather. One hand resting casually on a hilt, the other
loosely on the hip. Expression: cool + faintly amused, eyebrow lifted
the moment of testing whether you're interesting enough to bother
with. Hair: shaggy chin-length jet-black, swept across one eye, with
two purple-streak highlights. Eyes: violet, half-lidded. Skin: pale
moonlight. Personality cue: speaks in three-word sentences when four
would do; respects skill but trusts ego less; the actual warmest
member of the Hood underneath. Palette anchors: charcoal `#2a2030`,
violet silk `#7a4aaa`, moonlight skin `#e8d8e0`. Lighting accent:
moonlit cool blue rim from upper-right (the Hood's home is
night-side), violet under-glow from the half-mask's silk; minimal warm
fill to keep the silhouette mysterious.

---

### 15 · Auntie Innie — `madame_cresco.webp`

A character named **Auntie Innie**, role: town perfumer and
romance-letter writer. Late thirties, bohemian-elegant, the air of a
woman who has had three great loves and one or two minor regrets.
Wearing a flowing wine-red wrap dress with a plunging V-neck, long
sleeves with lace cuffs, a black velvet ribbon choker with a tiny
gold key charm, gold earrings shaped like miniature perfume bottles,
red leather slip-on shoes. Holding a small ornate perfume-bottle in
her left hand, a quill in her right, a long peacock-feather pen
behind her ear. Expression: a knowing half-smile, head tilted just
enough to imply she's already composing your epitaph as a poem. Hair:
long wavy auburn red, parted in the centre, falling past the
shoulders; loose curls escaping a casual updo. Eyes: warm hazel-green
with smoky kohl liner. Skin: warm ivory with rose blush. Personality
cue: writes love letters to nobody in particular every Wednesday;
asks nosy questions and remembers every answer. Palette anchors: wine
red `#8a2a3a`, auburn hair `#a04020`, gold key `#c69540`. Lighting
accent: candlelit warm key from below-left, soft cool window dusk
from upper-right.

---

### 16 · Captain Plum — `captain_plum.webp`

A character named **Captain Plum**, role: shore-bound fisherman, ex-
deep-sea captain whose ship was lost to the abyss. Late fifties, sun-
weathered, lean from grief, sea-eyed. Wearing a faded navy peacoat
with tarnished brass buttons over a soft-grey roll-neck sweater, dark
canvas trousers, sturdy fisherman's boots, a knit cap in muted plum-
purple pulled low; a worn leather belt with a small captain's whistle
hanging. Holding a long fishing rod over one shoulder with line
trailing off-canvas; a small wooden tackle box in the other hand.
Expression: quiet + ironic, mouth in a faint slant of habitual
sadness, gaze slightly off into the middle distance like he's
checking the tide-line. Hair: salt-and-pepper short, prominent
mutton-chop sideburns + thick well-groomed beard. Eyes: pale stormy
grey-blue. Skin: weathered tan with deep crow's-feet, a faded anchor
tattoo just visible at the throat. Personality cue: speaks in
fragments, repeats himself when the sea's bored him, would absolutely
go back if a ship asked nicely. Palette anchors: navy peacoat
`#1a2a44`, plum knit cap `#4a2a4a`, grey sweater `#aaaaa8`. Lighting
accent: low-angle late-afternoon sun from the left (the colour of
amber + brass), cool sea-mist from the right.

---

### 17 · Tincture Aunt — `tincture_aunt.webp`

A character named **Tincture Aunt**, role: alchemy / herbalism stall
keeper at Azure Abode. Mid-fifties, wiry + nimble, a witch energy
without the witch hat. Wearing a long deep-forest-green apron over a
sage-grey blouse and faded brown skirt, sleeves rolled past the
elbow, a leather utility-belt slung diagonally across the chest
holding miniature vials in copper holsters, sturdy ankle boots. Both
hands holding a small bubbling glass beaker of glowing teal liquid up
to the light. Expression: focused + delighted, mouth slightly parted
in mid-discovery, eyes bright. Hair: bushy curly grey-streaked
chestnut, tied with a faded green ribbon into a high messy bun, two
ringlets escaping. Eyes: jade green, magnified slightly by small
half-moon brass spectacles perched on the nose-tip. Skin: weathered
peach, freckles across the bridge of the nose. Personality cue:
addresses you as "dear"; smells faintly of mint + sulfur; will absolutely
give you a free sample if you look interesting. Palette anchors:
forest apron `#2a5a3a`, teal liquid `#44cccc`, copper vial holster
`#c8884a`. Lighting accent: cool fluorescent teal glow from the
beaker itself (left side of the face), warm window-light yellow from
upper-right.

---

### 18 · Master Kaze — `master_kaze.webp`

A character named **Master Kaze**, role: martial arts instructor at
the Hidden Pagoda. Sixties but the body of a forty-year-old, lean +
sinewy, perfect posture. Wearing a traditional martial-arts gi: a
short-sleeved indigo-blue training top with a black sash, loose
black hakama trousers, simple sandals over white tabi socks. Holding
a long carved wooden staff (bo) angled across the body in a relaxed
ready-position; a small flat black tea-tin clipped to the sash.
Expression: focused stillness, eyes half-closed in meditation-stance,
a faint quarter-smile at the corner of the mouth — the kind of
expression that doesn't change when you yell at it. Hair: silver-grey
long, tied in a high samurai-style topknot with a black cord; a thin
long mustache and small Fu-Manchu-style beard. Eyes: ink-black,
serene. Skin: warm tan with the faint white scars of a thousand
training bouts on the forearms. Personality cue: speaks in zen koans
and one-syllable approvals; will not teach you anything until you
ask the same question three times. Palette anchors: indigo top
`#2a4a78`, black sash `#1a1a22`, tea-tin gold `#aa8844`. Lighting
accent: pagoda mountain-mist cool from above, soft amber meditation-
candle warm from below.

---

### 19 · Whisper — `whisper.webp`

A character named **Whisper**, role: keeper of the Wayfarer's Lantern
chain (the Doomed Expedition's last named survivor). Late forties,
gaunt + tall, the bearing of someone who has been waiting at the same
spot for a long time without losing dignity. Wearing a long
expedition-coat in faded cobalt blue and gold trim (the colours of
the Doomed Expedition), a wide-brimmed weather-cap with a small brass
compass pin, expedition belt with two empty lantern-hooks, leather
gloves with the index fingers cut off. Holding a single small lit
brass lantern at chest height — the only one of the chain's lanterns
that's currently visibly lit in the prompt. Expression: solemn +
welcoming, the small uncomplicated smile of someone who finally has
a guest. Hair: short straight black-brown with grey at the temples,
clean-shaven. Eyes: warm chestnut, slightly tired. Skin: weathered
olive. Personality cue: a person who knows they will not finish the
road but has chosen to make it easier for whoever does; speaks in
single complete thoughts. Palette anchors: cobalt expedition coat
`#3a5aaa`, gold trim `#c8aa44`, lantern-brass `#d8a04a`. Lighting
accent: the lit lantern in his hand throws a soft warm gold glow
upward onto his chin + cheek; cool dusk-blue rim from the right.

---

### 20 · High Marshal Vermillion — `high_marshal_vermillion.webp`

A character named **High Marshal Vermillion**, role: commander of
the Reach of Vermillion outpost. Late forties, imposing, full
military bearing — every inch a battlefield general. Wearing dark
vermillion-red lacquered plate armour with black-iron trim, a heavy
black-fur mantle across the shoulders, a long crimson cape lined in
gold trailing behind, a high gold-spike collar. A long cavalry sabre
sheathed at the left hip in a black-and-gold scabbard. Holding a
long-handled commander's halberd planted point-down in front of him,
both hands resting on the haft. Expression: severe + uncompromising,
eyebrows drawn, the small flicker of contempt for those who haven't
proven themselves yet. Hair: short ash-grey military cut with thin
sideburns; a fierce vertical scar running from the right eyebrow down
through the corner of the eye to the cheekbone. Eyes: bright crimson
(elemental marker for the Vermillion bloodline). Skin: pale war-room
tan. Personality cue: speaks in commands disguised as observations;
respects only victories, but respects them deeply. Palette anchors:
vermillion plate `#a82820`, black-iron trim `#1a1818`, gold collar
`#c8aa44`. Lighting accent: harsh dramatic crimson under-light from
below (war-banner red), cold steel-blue from above-left — the man
exists between the war he wants and the war he has.

---

## Notes on iteration

Each prompt above produces ONE keyframe. For animation-ready cycles
(idle bob, talk bob, attention pose) you'd run the same prompt with
modifier tags appended, e.g.:

- `, slight upper-body lean forward, head tipped 5° lower` → talk pose
- `, weight shifted onto front foot, hand half-raised in greeting` → attention pose
- `, hair and clothing shifted slightly by a gust from the right` → idle wind

For consistency across the whole cast, **use the same seed** within a
single image-gen session and only swap the `[CHARACTER]` block — this
locks the style + palette + lighting language so all 20 NPCs read as
one painterly cast rather than 20 independent portraits.

## Filename + path table

| NPC | Filename | Map(s) |
| --- | --- | --- |
| The Amnesiac | `amnesiac.webp` | Town (Everdawn Central) |
| ??? / Sage Mira | `sage_mira.webp` | The Gate (wayfarersLantern2) |
| Taxi Uncle | `taxi_uncle.webp` | Town |
| Brok | `brok.webp` | Town (forge) |
| Fashionista | `fashionista.webp` | Bazaar / Megamall |
| Milo the Usher | `milo_usher.webp` | Town (west gate) |
| Guguma | `Guguma.webp` | Town (R-awning) + chip mascot |
| Postal Wisp | `postal_wisp.webp` | Town |
| Old Arlen | `old_arlen.webp` | Town |
| DJ Vinyl | `dj_vinyl.webp` | Town (L-awning) |
| Will the Steadfast | `will.webp` | Bastion Throne |
| Hera the Empyrean | `hera.webp` | Hera's Floating Abode |
| Lady Hong | `lady_hongyu.webp` | Emerald Village |
| Taiga | `taiga.webp` | Shadow-Woven Hood |
| Auntie Innie | `madame_cresco.webp` | Town |
| Captain Plum | `captain_plum.webp` | Sunset Coast |
| Tincture Aunt | `tincture_aunt.webp` | Azure Abode |
| Master Kaze | `master_kaze.webp` | Hidden Pagoda |
| Whisper | `whisper.webp` | Wayfarer's Lantern |
| High Marshal Vermillion | `high_marshal_vermillion.webp` | Reach of Vermillion |

All files drop into `Sprites/npc/<filename>` — the in-game
`NPC_SPRITE_FILES` registry already maps NPC display names to these
filenames, so no code changes are needed when the new sprites arrive.

## Style anchor reference (paste alongside if your model needs more)

> Reference art style: "promotional character art for premium mobile
> RPGs circa 2020-2024 — Genshin Impact / Onmyoji / Honkai Star Rail
> / Cookie Run Kingdom / Hades portrait card art." Painterly +
> illustrative, NOT photorealistic, NOT pixel-art, NOT anime
> screenshot. Single character keyframe on transparent background.
> Outlines visible at small size. Three-tone cel-shading. Warm-cool
> contrast lighting. Personality-forward over generic-attractive.

---

*Generated v0.25.949 — paired with the existing NPC_SPRITE_FILES
registry at L56156. When a new sprite is dropped into `Sprites/npc/`,
no code change is needed; the registry already references the
canonical filename for each NPC above.*
