# Big-melee swing/smash attack frames (ludo.ai)

How the weapon-swing attack animations for the large melee mobs are authored so
the **in-game character size is unchanged** while the **canvas is enlarged** to
fit the weapon arc (no cutoff). Covers fatDragon, smithgolem, tombKeeper,
forgewight, plus Path's Bane and Echo Knight (monsters) and the Sundered Smith
(boss) — all calibrated under v0.26.351.

## The problem

The monster renderer scales every per-state frame into a box derived from the
**base/idle** sprite (`_drawMonsterSprite`). A swing needs more canvas than the
tightly-framed base, so if you just pad the character smaller inside a bigger
frame, it renders *smaller* in game. Conversely, keeping the character at base
size in a base-size frame clips the weapon arc.

## The solution (two parts)

1. **Padded attack frames** — generate the swing with a large `margin_ratio`
   so the whole arc fits inside a 640 px frame (character ends up small, with
   transparent margin all around). Then a deterministic fit-pass re-anchors the
   feet to the frame bottom and centres the body. Frames stay 640 px (≈15 MB
   decoded / 9 frames — lazy-loaded per type).
2. **Per-type render scale** — `_ATK_FRAME_SCALE[type]` multiplies the draw box
   for the **attack state only** (`m._frameIsAttack`, set in
   `_monsterStateFrame`). It is calibrated so the attack-state body height ==
   the idle body height. Idle/walk frames and all other mobs are untouched.

   `S = (baseCharH / baseDimVert) × (OUT / attackFrameCharH)`

| Type | base char / dim | attack char (640) | `_ATK_FRAME_SCALE` |
| --- | --- | --- | --- |
| fatDragon | 1018 / 1077 | 310 | 1.951 |
| smithgolem | 596 / 768 | 264 | 1.881 |
| tombKeeper | 1472 / 1474 | 268 | 2.385 |
| forgewight | 628 / 708 (765×708 base) | 244 | 2.327 |
| pathsBane | 1332 / 1377 (1235×1377 base) | 386 | 1.604 |
| echoKnight | 828 / 850 (787×850 base) | 366 | 1.703 |

**Bosses** (`_drawBossSprite`) auto-normalise attack size *per frame* by content
height, which keeps the whole figure (body + weapon) a constant on-screen height
across the swing — exactly what's wanted for a dynamic ludo animation where the
body leans/crouches. The one requirement: **attack frames must be the same pixel
size as the idle frames**, otherwise the normaliser compares raw pixel heights
across mismatched canvases and clamps to a constant (which made the Sundered
Smith's body shrink/grow ~20% during its slam). Fix was to author the Smith's
attack frames at 992px (matching its idle) — then the per-frame norm adapts on
its own; no fixed override. `_BOSS_ATK_UNIFORM` (the fixed-override table) is now
empty but kept for any future boss that genuinely needs a constant multiplier.

Two refinements were still needed because ludo's swing animation physically
**leans/crouches** the body (a real pose change no scale can undo):
1. `_BOSS_ATK_NOSHRINK` (a Set) lets the content-norm scale a type's attack
   frames UP but never DOWN — so a reared-overhead pose keeps the body full size
   and just lets the weapon extend above, instead of shrinking the whole figure.
2. The Smith's loop was rebuilt from only the **upright** wind-up frames as a
   ping-pong (`[0,1,2,3,4,3,2,1]`, an 8-frame raise-and-lower), dropping the
   forward-leaning slam frames entirely. Final result: body height holds at
   **99% of idle with 0% variance** across the whole loop — no perceptible
   shrink. To rebuild: keep only frames whose rendered body height is ≥~95% of
   idle and arrange them into a smooth forward-looping ping-pong.

Verified in-engine: idle vs attack character height == **100 %** for all four;
no top/left/right cutoff (the bottom edge is the feet = ground contact).

## ludo.ai generation

`animateSprite` from the base sprite, `model:eagle`, `frames:9`,
`margin_ratio_mode:manual`, `margin_ratio:0.55–0.8` (bigger weapon ⇒ bigger
margin), `individual_frames:true`. Note: animateSprite always outputs 640 px and
may return only a spritesheet for **non-square** bases (forgewight) — slice the
3×3 sheet manually in that case.

## Re-deriving a scale

If you regenerate a type's frames, recompute `S` (the fit-pass prints it):
measure the base sprite's character height + the new frame-0 character height,
then `S = (baseCharH/baseDimVert) × (640/newCharH)`, and update
`_ATK_FRAME_SCALE` in `mojiworld_game.html`.
