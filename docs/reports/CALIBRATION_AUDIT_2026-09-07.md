# Sprite calibration audit — 2026-09-07

Prompted by the Echo Knight sink (v0.30.419): his feet sat 12 px under the
floor because a hardcoded, post-clamp `+7` lived in the plant ladder in
`mojiworld_game.html` *and* in a hand-mirrored copy in `monster_animator.html`.
Fixing one number meant touching two files. This audit maps every place a
sprite's on-screen size and position can be adjusted, shows where the same
adjustment can be made in more than one place, and proposes consolidations in
order of safety. Nothing here is implemented yet except the Echo Knight fix.

## 1. The layers, in the order the engine applies them

### Ground mobs (`_drawMonsterSprite` → `_lxMobPlantDy`)

| # | Layer | Source of truth | Units | Authoring surface |
|---|-------|-----------------|-------|-------------------|
| 1 | Hitbox `w/h` | `monsterTypes` def in the game; regenerated copy in `data/monster_hitboxes.js` | px | code |
| 2 | Target height | `h × 1.5 × sizeFactor(canvas/768, clamped 0.85–1.20) × mobScale` | px | — |
| 3 | Mob scale | `data/mob_offsets.js` → `LX_MOB_SCALE_DATA`, live `localStorage lx_mob_scale` wins | × | R-key Monster Plant |
| 4 | Bbox-bottom anchor | `data/sprite_bbox.js` row for the static sprite (dimension-guarded), else runtime alpha scan | px of source | generated |
| 5 | Ground bury | `GROUND_BURY_FRAC = 0.02` (fliers: `FLOATING_GROUND_BLEED = 0.04` up) | fraction of targetH | code |
| 6 | Foot nudge | `_MOB_SPRITE_FOOT_NUDGE = { slime: 0.14 }` | fraction | code |
| 7 | Pre-clamp hardcodes | `boneGolem +5+5`, `seastar +5+5` (written as three lines) | px | code |
| 8 | Bury clamp | `_BURY_MAX_PX = 6` — bottom may not exceed 6 px under the foot line | px | code |
| 9 | Post-clamp hardcodes | `boneGolem +10`, `grumpsquid +4`, `future_lyra +9`, `seastar +6` (echoKnight +7 removed in v0.30.419) | px | code |
| 10 | Mob y-offset | `LX_MOB_OFFSET_DATA`, live `lx_mob_yoff` wins | px | R-key Monster Plant |
| 11 | Attack-frame blow-up | `_ATK_FRAME_SCALE` (fatDragon 1.199, tombKeeper 2.13, forgewight 2.327 …) scales `dy` for attack frames | × | code |
| 12 | Anim calib | `data/anim_calib.js` `{s, dx, dy, fs[], ft[]}` per (type, state) | s ×, dx/dy fraction of targetH | animator Copy-patch |

### Bosses (`_drawBossSprite`)

Same anchor idea, different chain: `BOSS_DRAW_SCALE` (gravitos 0.95) → content-normalisation
against the manifest's per-frame content boxes (`data/anim_calib_manifest.js`, threshold 8 %,
2 % for `_BOSS_SIZE_STRICT`) → `_BOSS_ATK_UNIFORM` / `_BOSS_ATK_NOSHRINK` / `_BOSS_ATK_SCALE`
(kingKrook 1.10) → per-sign push-down (v0.26.501) → bury clamp → anim calib `s/dx/dy`
(`translate(dx·targetH, dy·targetH); scale(s)`) → the calib `s` is folded into the stashed
`_visW/_visH` that the attack-hitbox fractions (`LX_ATK_HITBOX`) multiply.

### NPCs (`_drawNpcSprite`)

`_npcSpriteTargetHeight × npcScale` → bbox anchor `+ 2 %` → `LX_NPC_OFFSET_DATA` (`lx_npc_yoff`).
A third copy of the same ladder shape, with its own two tables.

### Player gear

`data/gear_calibration.js` (attach points) and `data/gear_erase.js` (4 MB of erase/paint
bitmaps) — a separate system; noted for completeness, not in scope for consolidation.

## 2. Findings

### F1 — The ladder exists three times

`_lxMobPlantDy` (game), the Monster Plant preview (`_lxMpDrawPreview`, game — re-implements
steps 2/4/5/10 inline and skips 6–9), and `monster_animator.html` (its own
`GROUND_BURY_FRAC / BURY_MAX_PX / FOOT_NUDGE_FRAC / PRE_CLAMP_PX / POST_CLAMP_PX /
ATK_FRAME_SCALE / SIZE_STRICT / ATK_NOSHRINK / BOSS_ATK_SCALE` constants, each marked
"verbatim from the game"). Three copies of the same numbers is how the Echo Knight +7
had to be removed twice, and how the preview can disagree with the wild draw (it already
omits the hardcodes, so a boneGolem previews 10–20 px higher than it stands in-game).

### F2 — Four independent knobs move a ground mob vertically

Layers 6, 7, 9 and 10 are all "add px/fraction down after the anchor"; 12's `dy` is a fifth
for animated states. They differ only in *where they sit relative to the clamp*. Nothing
tells an author which one to reach for, so the answer over time has been "a new hardcode".

### F3 — Five independent knobs scale a sprite

Layer 2's `sizeFactor` (canvas size heuristic), layer 3's mob scale, layer 11's attack blow-up,
the calib `s`, and for bosses `BOSS_DRAW_SCALE` + `_BOSS_ATK_SCALE` + `monster_hitboxes.mul`.
The hitbox generator reads two of them back out of the runtime to produce `mul`, i.e. a
derived table that exists because the primary ones are scattered.

### F4 — Three sources describe "where the content bottom is"

`data/sprite_bbox.js` (static sprite, per file), the manifest's per-frame content boxes
(`cb`, `botFrac`), and the runtime alpha scan fallback. The mob path anchors on the *static*
sprite's bbox and draws *frames* against it — correct only while every frame shares the
static's canvas and padding, which the generators enforce today but nothing asserts at draw
time. The boss path anchors per frame via the manifest. Two definitions of the same fact.

### F5 — Pre-clamp hardcodes are partly dead

`boneGolem +5+5` before a 6 px clamp, then `+10` after it: whenever the clamp binds, the
pre-clamp 10 px vanishes and only the post-clamp 10 survives. Golden values captured today
(`echoknight_plant_test.mjs`): boneGolem 2.99, seastar 6.93, grumpsquid 9.4, future_lyra 2.24.
Any rewrite must reproduce those numbers, not the code.

### F6 — The live-edit layers are real, and shadow the baked tables

`lx_mob_yoff`, `lx_mob_scale`, `lx_npc_yoff`, `lx_npc_scale`, `lx_atk_hitbox`, `lx_anim_calib`
in `localStorage` override the shipped tables on the machine that set them. A tester who
tuned a mob months ago sees a different plant from everyone else; the bake scripts read
those keys to promote them. Keep the mechanism, but it should be one mechanism.

## 3. Consolidation plan (safest first)

1. **Fold every per-type px hardcode into `LX_MOB_OFFSET_DATA`** (layers 7 + 9 → 10).
   Post-clamp hardcodes are additive px after the clamp — exactly what `yOff` is — so
   `boneGolem: 10 → yOff`, `grumpsquid: 4 → yOff+4 (=7)`, `future_lyra: 9`, `seastar: 6 → yOff+6 (=13)`
   reproduce the golden values by construction; the pre-clamp `+5`s are re-derived per type
   against the goldens. Delete the code lines in the game **and** the animator. One table,
   editable in the R-key tool, no mirror. Gate: golden test extended to all five types +
   the Monster Plant preview, which then becomes exact for the first time.
2. **Make the animator read the game's constants instead of mirroring them.** The animator
   already loads `data/*.js`; move `GROUND_BURY_FRAC`, `FLOATING_GROUND_BLEED`, `_BURY_MAX_PX`,
   `_MOB_SPRITE_FOOT_NUDGE`, `_ATK_FRAME_SCALE`, the boss norm sets and `BOSS_DRAW_SCALE` into
   one small `data/draw_constants.js` that both pages include. Parity by construction; the
   parity check gains a "constants file is the only source" assertion.
3. **Retire `data/sprite_bbox.js` for animated sets** in favour of the manifest's per-frame
   boxes (F4), keeping the bbox table only for statics with no manifest entry. One definition
   of "content bottom", and the mob path anchors each frame on its own box like the boss path.
4. **Collapse the scale knobs to two**: an authored per-type scale (mob/boss/NPC in one table)
   and the anim-calib `s`. `sizeFactor` becomes a bake-time constant per sprite (it only depends
   on canvas size), `_ATK_FRAME_SCALE` becomes a per-state calib `s`, `_BOSS_ATK_SCALE` likewise.
   `monster_hitboxes.mul` is then derived from one number instead of three.
5. **Document the one remaining vertical knob per path** in the tables' headers and in
   STEAM.md's animator section; the R-key tool and the animator Copy-patch become the only
   two authoring surfaces, both writing baked data.

Steps 1–2 are mechanical and provable with the golden test; 3–4 change numbers for real
entities and want per-type before/after measurement like the Echo Knight pass.
