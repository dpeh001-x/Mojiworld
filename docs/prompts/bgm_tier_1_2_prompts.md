# BGM Generation Prompts — Tier 1 (Critical) + Tier 2 (High-Value)

Detailed prompts for the 11 maps flagged as missing designated BGM in the
v0.25.813 audit. Format suited for **Suno / Udio / AIVA-style music
generators** or hand-off to a composer. Each entry includes:

- Target file path + intended loop length
- Genre / instrumentation / tempo / key
- Dynamics arc (how the track evolves over the loop)
- Reference comparisons (anchors the AI / composer)
- "NOT like" callouts so each track sits distinct from neighbors

The existing palette (53 tracks) skews painterly / pastel / contemplative
in towns, percussive / melodic in dungeons, and orchestral in the bosses.
Gravitos is intentionally written to **break that ceiling** — see §1.

---

## §1. CRITICAL — `gravitosArena` (Lv 100, final boss)

**File:** `audio/bgm_gravitos_arena.mp3` · **Length:** ~3:45 loop · **Genre:** Hybrid orchestral-electronic apocalypse · **BPM:** 72 (with double-time 144 BPM hit sections) · **Key:** D minor → modulates up to E♭ minor at the climax (Hans Zimmer "key-shift" trick) · **Time sig:** 4/4 with 6/4 breakdowns

```
A grand cinematic boss theme for the literal final encounter of the game.
The fight is against Gravitos, the Weight-Bearer — a gravity god holding
the universe's "pause." The player has spent ~100 hours to reach this
moment. The track MUST out-grand every other track in the game.

Section A (0:00–0:35) — INVOCATION
Open with a single sustained low D in 32-foot organ pipes, sub-bass
swelling underneath for 8 seconds. A solitary boy soprano sings a wordless
falling minor third (D → A). A massive Latin choir whispers in unison —
not Latin words, an invented dread-tongue that sounds like ancient names
being recalled. Granular synth particles drift over the top like floating
matter caught in slow gravity.

Section B (0:35–1:20) — CONVERGENCE
Build with stacked timpani entering on every 8th measure, each louder than
the last. Add layered cellos in a slow descending chromatic line (D → C♯ → C →
B), then violas, then violins doubling up two octaves. Electronic sidechain
pulse appears underneath, kicking on the downbeat, suggesting the universe's
heartbeat slowing. Brass enters in long held minor 6th chords. A distorted
modular synth bassline locks with the timpani.

Section C (1:20–2:00) — THE WEIGHT FALLS  (this is the "drop")
EVERYTHING locks into a hammered, double-time 144 BPM section. Full 80-piece
string section playing rapid 16th-note ostinato in D minor. Six taiko
drums + two timpani. Trumpets, trombones, French horns blasting on every
downbeat in stacked octaves. The choir is now full force, 60-voice mixed,
chanting in 4-bar phrases. A modulated synth screams like sheet metal
tearing. Sub-bass drops on every other downbeat like collapsing stars.

Section D (2:00–2:25) — STILLNESS
Everything cuts. A single piano plays a slow fragile 4-note melody in the
upper register — almost a music box. A solo cello answers, weeping. The
soprano returns, this time over the piano, singing the falling minor
third one more time. Distant thunder. A pulse.

Section E (2:25–3:25) — APOTHEOSIS  (key change up to E♭ minor)
Section C returns but transposed up a semitone and DOUBLED — eight taiko
drums, 100-piece string section, 80-voice choir, every brass player at
fortissimo, organ pedals at maximum. A male tenor enters singing a
defiant melodic line over the chaos in counterpoint to the choir. Add a
huge granular synth "gravity well" sweep that pulses underneath every two
bars. This is the section that makes players sit forward in their chair.

Section F (3:25–3:45) — LOOP POINT
The string ostinato continues into a sustained low D chord. The choir
holds a final dissonant cluster. A single deep bell tolls. Sub-bass thump.
Cuts cleanly back to the opening organ pedal so the loop seams invisibly.

Reference anchors: Hans Zimmer "Time" (Inception) for the slow build,
Nobuo Uematsu "One-Winged Angel" (FF7) for the choral attack, Yoko
Shimomura "Lord of the Castle" (KH3) for the choir-+-strings climax,
Ramin Djawadi "Light of the Seven" (Game of Thrones) for the pacing, and
Mick Gordon "BFG Division" (DOOM 2016) for the sub-bass weight.

NOT like: any pastel chiptune, any chord-progression-pop, anything that
sits at one dynamic level the whole time. This track has to make the
seventeen previous boss themes feel small in retrospect.
```

---

## §2. CRITICAL — `town` (Everdawn Central, main hub)

**File:** `audio/bgm_mojiworld.mp3` (already referenced by the jukebox as
the default hub track but the file may not exist on disk yet) · **Length:**
~2:30 loop · **Genre:** Warm pastel orchestral with light folk colors ·
**BPM:** 96 · **Key:** F major

```
The main central hub theme. Players return here between every adventure —
this is the "I'm home" feeling. Soft, optimistic, daytime, never gets old
on the 200th listen.

Lead: warm clarinet melody in F major, an 8-bar memorable phrase that
hooks like a Studio Ghibli main theme. Counter-melody: pizzicato strings
walking quarter-notes underneath. Add a soft acoustic guitar arpeggio
high in the mix for sparkle, brushed snare keeping a relaxed pulse,
upright bass holding the harmonic foundation. Occasional accordion
swells on the IV and vi chords for European-village warmth. Brief
celesta tinkle as a "magic still lives here" accent every 16 bars.

Dynamics: stays in a comfortable mezzo-forte. No big swells. Bridge at
1:00 modulates briefly to D minor (introspective) then back to F major
for the return.

Reference: Joe Hisaishi "One Summer's Day" (Spirited Away), Yasunori
Mitsuda "To Far Away Times" (Chrono Trigger), Koji Kondo "Mute City"-
slow-section warmth without the speed.

NOT like: any boss tension, any martial percussion, any modern dance pulse.
```

---

## §3. CRITICAL — `slimeCave` (Lv 10 King Slime arena)

**File:** `audio/bgm_slime_cave.mp3` · **Length:** ~2:15 loop · **Genre:**
Playful chibi boss · **BPM:** 132 · **Key:** A major

```
First boss the player ever fights. The theme should feel like a fun
threshold moment, not a grim trial.

Bouncy synth-orchestra hybrid. Lead: bubbly square-wave synth playing a
hummable 8-bar melody. Counter: brass stabs on the off-beats. Percussion:
big floor tom + tambourine + a wobbly "boing" sample on every other
downbeat (synced to the boss's jump animation). Bass: walking electric
bass octaves. A tiny choir of "ah-ah-ah" voices at the bridge.

Dynamics arc: A (intro, lighter) → B (groove) → C (huge brass-stab chorus
at 1:00, this is where the bounce hits hardest) → D (breakdown with just
bass + drums) → A (return). 8-bar loop point at 2:15 should feed cleanly.

Reference: David Wise "Boss Boogie" (DKC2) for the swing, Grant Kirkhope
"Mr. Patch" (Banjo-Tooie) for the absurd cheer, Yoko Shimomura "Vim and
Vigor" (KH) for the orchestral pop hooks.

NOT like: Gravitos. This is FUN, not dramatic. NOT like the Hollow
Sepulchre track either — completely different mood.
```

---

## §4. CRITICAL — `boss` (Queen's Hollow / Mushmom Lv 10)

**File:** `audio/bgm_queens_hollow.mp3` · **Length:** ~2:30 loop ·
**Genre:** Whimsical-menacing boss · **BPM:** 116 · **Key:** D minor

```
Second boss — Mushmom. A giant maternal mushroom, both cute and creepy.
Track sits between playful and dread.

Lead: oboe melody in D minor, slightly minor-key off-kilter waltz feel.
Underneath: pizzicato strings doing tip-toe steps. Add a children's choir
humming wordlessly far back in the mix (subtle but uncanny). Bass:
plucked double bass. Percussion: brushed snare + woodblock for the "tap
tap tap" of mushroom feet, plus a big concert bass drum hit on the
downbeat of every 4th bar — this is Mushmom slamming.

The chorus shifts to 6/8 briefly for a fairy-tale-waltz lift, then snaps
back to 4/4 minor for the second verse. Bridge has an unsettling
saw-wave synth pad swelling underneath while the oboe holds a long note.

Reference: Danny Elfman "Beetlejuice" main theme, Yoko Shimomura "Welcome
to Wonderland" (KH), Studio Ghibli's "Mei and the Catbus" with a darker
twist.

NOT like: slimeCave (this one is creepier), NOT like Gravitos (smaller
scale).
```

---

## §5. CRITICAL — `innerDimension` (Lv 20 Mirror Self trial)

**File:** `audio/bgm_inner_dimension.mp3` · **Length:** ~3:00 loop ·
**Genre:** Introspective electronic-orchestral · **BPM:** 88 · **Key:**
E minor with C minor modulation

```
This is the class-advancement trial — players fight their own mirror.
The track should feel like introspection at gunpoint. Tense but
reflective.

Open with a solo piano playing a 4-note motif in E minor, repeated and
gradually pitch-shifted by quarter-tones (subtle "wrong reflection"
detuning). A glassy bell synth answers an octave higher. Cellos enter at
0:40 holding long minor 7th drones. Add brushed cymbals and a slow
heartbeat kick at 0:50.

At 1:20 the heartbeat doubles in speed. A choir of WHISPERS (not sung
words, breath sounds with pitch) enters underneath. The piano motif now
appears in canon with itself at 4-bar offset — the mirror echo. Modulate
to C minor for tension.

At 2:00 the percussion hits hardest — a single deep tom strike on every
downbeat, no fills. The piano accelerates, the bell synth glitches into
fragmented retriggers. The whisper-choir crescendos into a single
sustained vowel held for 8 bars. Then resolves — back to E minor, piano
returns to opening motif, but transposed up a perfect fifth (it
"learned").

Reference: Trent Reznor & Atticus Ross "Almost Home" (Soul), Disasterpeace
"Hyper Light Drifter" main theme, Mick Gordon's quieter Doom Eternal
chapel sections.

NOT like: Sanctum (which is sacred-uplift), NOT like Hollow Sepulchre
(which is dread). This is INWARD.
```

---

## §6. CRITICAL — `sundered_forge` (Lv 45 Sundered Smith arena)

**File:** `audio/bgm_sundered_forge.mp3` · **Length:** ~2:45 loop ·
**Genre:** Industrial orchestral · **BPM:** 104 · **Key:** B minor

```
A half-melted blacksmith ghost mid-strike in his own molten chamber.
Track should feel like a hammer ringing on an anvil that broke its smith.

Lead motif: a single MASSIVE anvil-strike sample on every downbeat of
the first 8 bars. Underneath, a low cello + contrabass drone in B minor.
At 0:30 add a male baritone choir humming wordlessly. Brass enters at
0:50 — French horns holding open fifths.

At 1:10 the anvil strike pattern becomes syncopated — instead of every
downbeat, it hits on the "and-of-2" creating a limping rhythm. Industrial
percussion (chain rattles, metal scrapes, the squeal of bending iron)
fills the spaces. A distant bell tolls every 32 bars.

Climax at 1:50: orchestra hits full fortissimo, choir adds a sustained
chord, ALL percussion in synch on the downbeat for 4 bars, then a
slow-release reverb tail. The melody resolves on a Picardy third (B
minor → B major for the briefest moment, like the smith remembering who
he was before the forge took him), then collapses back to B minor for
the loop.

Reference: Jeremy Soule "From the Ashes" (Skyrim) for the industrial
gravitas, Akira Yamaoka's Silent Hill 2 industrial-sad blend, Mick
Gordon's slower Wolfenstein industrial sections.

NOT like: Lava Cavern (which is more action-paced). This is heavier and
sadder, less heroic-aggressive.
```

---

## §7. TIER 2 — `forest` (Emerald Thicket, Lv 1 starter)

**File:** `audio/bgm_forest.mp3` · **Length:** ~2:20 loop · **Genre:**
Pastoral folk-orchestral · **BPM:** 104 · **Key:** G major

```
The first map every new player walks into. Should feel like "the
adventure begins" without being grand — small-scale wonder.

Lead: alto recorder playing a 16-bar memorable folk-melody in G major.
Counter: acoustic nylon-string guitar playing a fingerpicked 6/8-feel
pattern underneath. Pizzicato strings on the off-beats. Light shaker +
brushed snare keeping a relaxed gallop. A solo violin enters at the
bridge for warmth.

Dynamics: stays light throughout. No drops, no big swells. Bridge at
1:00 modulates briefly to E minor (the dappled-shade-under-trees feel)
then back to G major for the return.

Reference: Koji Kondo "Lost Woods" (Ocarina of Time), Joe Hisaishi
"Princess Mononoke" lighter sections, Grant Kirkhope "Spiral Mountain"
(Banjo-Kazooie) without the bombast.

NOT like: any combat tension, any modern percussion. NOT like Jade
Grove (which is more meditative/Eastern) — this is open-meadow warmth.
```

---

## §8. TIER 2 — `magmaFoundry` & `magmaFoundry2` (Lv 53 / 55)

**File:** `audio/bgm_magma_foundry.mp3` (shared by both maps) ·
**Length:** ~2:50 loop · **Genre:** Industrial percussive ·
**BPM:** 128 · **Key:** F minor

```
The Wayfarer's Gauntlet's lava station. Should pulse with the rhythm of
working industry without losing biome identity (this is fire territory,
not a steel mill).

Lead: low brass (trombones + tubas) playing a chugging 4-note ostinato
in F minor. Layered on top: anvil-strike sample on every other downbeat
(echo of Sundered Forge, but lighter — the Foundry is the working
foundation, the Forge is the haunted grave). Percussion: gamelan-style
metal-on-metal pings + low taiko + industrial chain rattles.

At 1:00 a high distorted electric guitar enters playing a power-chord
counter-melody. At 1:30 strings layer in with sustained minor chords.
Synth bass drives underneath. Brief breakdown at 2:00 with just the
anvil-strikes + taiko, then full ensemble returns.

Reference: Mick Gordon "Mick's Garage" (Doom) for industrial percussion,
Inon Zur "Fallout 4" forge-cave themes, Akira Yamaoka's Silent Hill
mechanical sections.

NOT like: Lava Cavern (which is more melodic-fire) — this is INDUSTRIAL
fire, machines + heat. NOT like Sundered Forge (which is mournful) —
this is alive and working.
```

---

## §9. TIER 2 — `mushroom` (Fungal Hollow, Lv 9)

**File:** `audio/bgm_mushroom.mp3` · **Length:** ~2:30 loop · **Genre:**
Whimsical chiptune-orchestral hybrid · **BPM:** 124 · **Key:** C major

```
Starter zone, players spend Lv 3–9 here. Bouncy, mushroom-y, cute.

Lead: pulse-wave synth (NES-style) playing a 16-bar bouncy melody in C
major. Counter: pizzicato strings + xylophone doubling the lead an
octave below. Bass: square-wave bass holding a walking pattern.
Percussion: light hi-hat + a "spore-pop" sound on every 8th bar
(plucked balloon, rubber band, something quirky). Bridge adds a marimba
solo for 8 bars.

Dynamics: light, bouncy throughout. One small lift at 1:30 where strings
swell briefly.

Reference: Koji Kondo "Athletic Theme" (Super Mario World), David Wise
"Cranky's Theme" (DKC), Yoko Shimomura "Dive Into the Heart" (KH).

NOT like: Honeycomb Hollow (which is its own bouncy-hive theme). This
should feel SPONGY, not BUZZING.
```

---

## §10. TIER 2 — `cryptHollow` (Crypt of Whispers, Lv 26)

**File:** `audio/bgm_crypt_hollow.mp3` · **Length:** ~2:50 loop ·
**Genre:** Gothic-ambient · **BPM:** 84 · **Key:** A minor

```
A mid-game crypt zone. Has its own authored backdrop — deserves its own
sound instead of borrowing Hollow Sepulchre's track.

Lead: bowed double bass playing slow long notes in A minor (drone-like).
Layered on top: a solo bass clarinet playing a slow 8-note descending
phrase. A choir of female voices (mezzo-sopranos + altos) sing wordless
sustained "oo" chords very far back in the mix. Add subtle whisper
samples panning slowly left-to-right (the "whispers" of the crypt name).

Percussion: a single timpani roll every 16 bars, sub-bass thump on every
8th bar. A church bell tolls once at 1:30 and once at 2:30.

Dynamics: stays at mezzo-piano throughout, never swells. The whispers
get slightly louder at 2:00 then recede.

Reference: Akira Yamaoka "Promise Reprise" (Silent Hill 2), Trent Reznor
"Hand Covers Bruise" (Social Network), the quieter Lord of the Rings
"Mines of Moria" ambient sections.

NOT like: Hollow Sepulchre (which has more melodic darkness). This is
QUIETER and more atmospheric — the dread is in what you DON'T hear.
```

---

## §11. TIER 2 — `sunsetBeach` (Lv 5 coast)

**File:** `audio/bgm_sunset_beach.mp3` · **Length:** ~2:15 loop ·
**Genre:** Tropical-pastel folk · **BPM:** 96 · **Key:** D major

```
A sunset beach zone, players around Lv 5. Should feel like a long warm
evening that never quite ends.

Lead: ukulele playing a fingerpicked 8-bar melody in D major. Counter:
soft electric piano (Rhodes) playing block chords. Steel-string acoustic
guitar adds a 12-bar shuffle pattern. Brushed snare, shaker, hi-hat keep
a relaxed beach-bar pulse. Bass: upright bass walking. Add a solo
saxophone (alto) at the bridge for 8 bars — slow blues phrasing, evening
warmth.

Faint waves crashing in the deep background of the mix (very low,
barely audible — atmospheric not literal).

Reference: Joe Hisaishi "Summer" (Kikujiro), Yasunori Mitsuda "Beach"
(Chrono Cross), Toby Fox "Heartache" without the tension.

NOT like: Tide/Reef/Trench (which is deeper underwater). This is the
SURFACE in golden hour.
```

---

## Implementation notes

- **Suno / Udio prompts:** copy each track's first paragraph + the
  reference line at the end. Most generators handle 400-word prompts well;
  trim the section-by-section breakdown if needed.
- **AIVA / orchestral-only:** the section-by-section structure maps
  almost 1:1 to AIVA's chapter-based composition interface.
- **Hand-off to composer:** ship the full prompt as a brief — every
  field (BPM, key, time signature, dynamics arc, reference anchors,
  "NOT like" callouts) is the composer's working spec.

**Credit / cost estimate (AI music generators):**
- Suno (~2-credit per 4-min track) → ~22 credits for all 11
- Udio (~3 credits/track) → ~33 credits
- Budget +30% for re-rolls on Gravitos (it's the most ambitious
  prompt; first render rarely lands a 5-section structure that long)

**Once tracks land**, drop into `audio/` with the listed filenames and
add one-line entries to `_BGM_MAP_FILES` (~L60785) and the jukebox
catalog (~L14438) — both are the same dispatch pattern documented in
the v0.25.813 audit lesson.
