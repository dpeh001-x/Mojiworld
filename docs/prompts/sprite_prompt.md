# Skill FX Sprite Sheet — Generation Prompt (LevelX actual skills)

These prompts match the **5 basic-class skills actually in the game** for each class, mapped to the real D/S/A/E/W keybinds. Drop the four PNGs into `skills/` and the loader picks them up.

---

## Technical Specifications — MUST match exactly

| Param | Value | Why |
|---|---|---|
| Canvas | **2048 × 1280 px** | 4:2.5 so 8×5 grid lands on tidy pixel boundaries |
| Grid | **8 columns × 5 rows** | 8 animation frames per skill, 5 basic skills per class |
| Cell | **256 × 256 px** each, **zero** gutter between cells | Loader slices on exact 256 px steps |
| Background | Pure green `#00FF00` | Chroma-keyed to transparent at load time |
| Anchor | Effect visually centered inside its 256×256 cell | Engine draws on any actor without offset math |
| Style | 16-bit pixel art, soft glow, 1–2 px dark outlines, **no anti-alias** | AA greens partially survive chroma key → halos |
| Hard rule | **Zero pure-green pixels inside any sprite** | Green = transparent, ANY in-sprite green gets masked |

## 8-Frame Template (every row)

1. Windup / charge
2. Release / cast
3. Full power
4. Travel / sustain
5. Impact / climax
6. Shockwave / debris
7. Dissipation
8. Echo / final wisp

---

## WARRIOR → `warrior_fx.png`

```
A 2048×1280 px sprite sheet on pure #00FF00 green background. 8 columns × 5
rows of 256×256 cells with zero gutter. 16-bit pixel-art, vibrant palette, no
anti-aliasing, 1-2 px dark outlines, each frame centered in its cell.

Row 1 — SLASH (basic attack, heavy wide crescent sweep, 160 px reach):
horizontal silver sword-arc with golden crescent glow. F1 raised blade with
tiny wind-up spark → F2 swing-start quarter-crescent → F3 peak wide crescent
with bright gold inner edge → F4 extended slash wave carrying past blade → F5
impact sparks bursting outward → F6 widening semicircle shockwave → F7 fading
arc of pale gold → F8 last single glint.

Row 2 — POWER STRIKE (two-hit combo, quick jab then heavy overhead cleave
with stun): F1 forward jab flash with peach highlight → F2 jab extending with
impact flecks → F3 jab recovery / blade pulled back overhead → F4 overhead
wind-up with gold aura on blade → F5 heavy downward cleave at peak, arc of
orange-gold flame → F6 impact white-hot flash with stun starburst → F7 tan
dust billow with cracking ground → F8 fading dust, tiny stun stars.

Row 3 — GROUND SLAM (overhead smash: leap, apex hang with charge, crash-down,
wide front-facing impact with 3 shockwave rings): F1 crouch with ground dust
→ F2 leap with upward streaks → F3 apex hang with swirling peach charge
rings around caster → F4 dive trail, blade pointed down, ember particles →
F5 impact flash (white core, 220 px front-facing smash frame) → F6 3 concentric
expanding rings (white → peach → orange) + debris pillars erupting forward →
F7 tall tan dust cloud with rubble → F8 settling rocks and haze.

Row 4 — RUSH (short 300ms forward dash, fire-trail DoT, afterimage contrail):
F1 caster crouched, orange foot-dust burst → F2 blade-forward dash pose with
orange streak tail → F3 full-motion blur, trailing flame line → F4 fire trail
at peak with ember spray → F5 impact into target, small shoulder-charge flash
→ F6 trailing orange afterimages behind caster silhouette → F7 fading fire
trail embers → F8 last orange spark.

Row 5 — WAR CRY (roar buff: +55% ATK, +25% DEF, 7s; taunts mobs in 340 px
and damages foes within 180 px; gold expanding ring): F1 caster with hands
raised, tiny gold halo → F2 small gold sunburst core at chest → F3 forming
sunburst rays around caster → F4 full gold radial burst at max intensity →
F5 expanding translucent ring pushing outward → F6 second ring trailing, halo
sparkles → F7 fading ring, lingering aura glow → F8 faint gold motes.

Zero pure-green pixels inside any sprite. Every frame anchored at cell center.
```

---

## THIEF / ROGUE → `thief_fx.png`

```
Same format: 2048×1280, 8×5 grid, 256 px cells, #00FF00 background, zero
gutter, 16-bit pixel art, no anti-aliasing, centered in cell.

Row 1 — STAB (basic: quick violet streak with brief afterimage, cd 170 ms):
F1 hand with dagger at hip, tiny violet glint → F2 thrust start with short
pink streak → F3 full forward thrust, violet lightning slash line → F4 peak
extension with pink flare at tip → F5 recovery pull-back with trailing
afterimage ghost → F6 fading violet dots → F7 faint pink mist → F8 single
star pixel.

Row 2 — BACKSTAB (blink-teleport to enemy's back + 2.1x crit slash, 780 ms
cd): F1 caster at origin with pink flash → F2 dark purple blur streak toward
target → F3 mid-transit multi-shadow afterimage trail (8-step diminishing
ghosts) → F4 caster materializing behind target with violet glow → F5 crimson-
pink double-slash X at peak → F6 blood burst radial with 20 red-pink particles
→ F7 fading pink arcs and blood motes → F8 faint violet star, target stagger.

Row 3 — THROW DAGGER (big upward leap + 45° downward fan of 3 short-range
pink daggers, 800 ms cd): F1 crouch charge, fan of 3 daggers in hand, small
pink puff → F2 leap upward with dust kick, daggers gathered → F3 apex, daggers
released at 45° down in a spread fan → F4 three pink daggers mid-flight with
motion blur tails → F5 daggers at peak descent → F6 daggers embedding /
striking with pink spark flare → F7 small pink-violet scatter cloud → F8
drifting pink wisp.

Row 4 — SMOKE DASH (220 px horizontal blink, shadow trail, lands with 100 ms
immobile smoke-cloud hazard): F1 caster with crouch puff at origin → F2
smoke-purple shadow silhouette streaking across frame → F3 mid-dash blur, 10-
step gray trail behind → F4 landing with smoke puff at destination → F5
expanding dark purple smoke cloud → F6 cloud at full billow, caster visible
inside haze → F7 smoke thinning, drifting tendrils → F8 nearly clear, single
dark curl.

Row 5 — FLURRY (airborne-only lightning V-slash: dive down-forward then snap
up-forward with 6 diagonal cuts, ~220 ms total; rainbow hit bursts, jagged
lightning bolts, double afterimages): F1 launch fanfare — 28-piece rainbow
star burst radial → F2 descending-leg slash frame (down-forward diagonal pink
slash) → F3 descending deeper, jagged white lightning line along slash path →
F4 pivot explosion at V's bottom — two concentric rings (white core, pink and
cyan outer) + gold ground sparks → F5 ascending-leg slash frame (up-forward
diagonal pink slash) → F6 ascending with double afterimage (violet + white) →
F7 V-path trailing rainbow afterglow → F8 empty with 3 faint stars.

No pure-green pixels inside any sprite. Every frame centered in cell.
```

---

## MAGE → `mage_fx.png`

```
Same format: 2048×1280, 8×5 grid, 256 px cells, #00FF00 background, zero
gutter, 16-bit pixel art, no anti-aliasing, centered in cell.

Row 1 — MAGIC BOLT (basic: small arcane projectile, cd 230 ms): F1 hand with
tiny violet orb forming → F2 orb compressing with arcane rings → F3 bolt
released with short pink-violet tail → F4 bolt mid-flight with trailing glow
→ F5 bolt at peak with brighter core → F6 impact flash (white + violet burst)
→ F7 fading arcane sparkles → F8 single dim star.

Row 2 — FIREBALL (horizontal, mild gravity, travels ~250 px then self-
detonates in a 90-radius AoE): F1 hand-ember, small orange spark → F2
swirling flame disc gathering → F3 compressed fireball with trailing sparks →
F4 flaming comet mid-flight with dark smoke tail → F5 comet peak with full
flame aura → F6 detonation bright white-yellow core flash → F7 full orange
explosion cloud with expanding ring → F8 thinning smoke with drifting embers.

Row 3 — ICE SPIKE (3-spike piercing fan with 90 px frost splash on impact,
1.5 s freeze): F1 hand frost puff, tiny ice flecks → F2 forming 3-shard
triangle formation → F3 3 cyan ice spikes fanning outward → F4 spikes mid-
flight in vertical spread, pierce trails → F5 impact frost-burst flash
(white-cyan core) → F6 shattering spike with radial cyan splash ring → F7
expanding ice dust and freezing particles → F8 settling frost mist.

Row 4 — BLINK (short teleport 180 px in facing direction, mage only): F1
caster with purple gather-puff at origin → F2 dark arcane swirl forming
around caster → F3 caster dissolving into purple sparkle cloud → F4 empty
mid-transit with drifting purple dust → F5 destination sparkle cloud forming
→ F6 caster rematerializing with violet aura → F7 stable caster, fading
arcane glow → F8 last purple spark dot.

Row 5 — ARCANE BURST (AoE explosion around caster, 120 px radius, 2× ATK):
F1 small violet core at chest → F2 4 small magic circles forming around
caster → F3 circles connecting into arcane dome → F4 dome expanding with
inward arrows → F5 full radial burst at max (white-violet sunburst) → F6
trailing ring bands pushing outward → F7 dissipating arcane petals → F8 faint
violet motes.

Zero pure-green pixels inside any sprite.
```

---

## ARCHER → `archer_fx.png`

```
Same format: 2048×1280, 8×5 grid, 256 px cells, #00FF00 background, zero
gutter, 16-bit pixel art, no anti-aliasing, centered in cell.

Row 1 — ARROW SHOT (basic horizontal arrow, short trail; affected by
Up/Down aim tilt ~28°): F1 bow drawn with tiny yellow nock glow → F2 arrow
released with short orange streak → F3 arrow mid-flight with brown fletching
and golden trail → F4 arrow at peak brightness → F5 impact flash on target →
F6 small orange spark burst → F7 fading streak → F8 empty with single spark.

Row 2 — MULTI SHOT (3+ arrow spread fan, Up/Down aim tilts the whole fan):
F1 bow drawn with 3 nocked arrows, pre-release tension → F2 release with 3-
arrow fan spreading outward → F3 3 arrows in tight fan mid-flight → F4 fan
widening with individual arrow trails → F5 arrows at peak, streak tails → F6
3 impact sparks cascading → F7 fading streaks → F8 drifting sparkle.

Row 3 — CHARGED SHOT (big piercing arrow, 3.5× ATK, sprite tracks the
projectile): F1 small aiming reticle dot → F2 blue targeting ring expanding
→ F3 golden reticle with arrowhead forming → F4 full charged arrow with fire
aura and blue-gold rays → F5 massive arrow mid-flight with streak tail → F6
arrow at peak power, radiating gold + blue plasma → F7 impact with burst
shockwave, pierce streak continuing through target → F8 lingering trail.

Row 4 — EVADE ROLL (back-flip + 2 flat horizontal arrows with mild gravity
that self-detonate after ~100 px causing knockback): F1 crouch with green
dust puff → F2 back-flip mid-rotation with dust trail → F3 apex of flip,
bow-drawn with 2 arrows → F4 2 arrows released flat horizontal at 0°  → F5
arrows mid-flight with tan-gold streaks → F6 arrows detonating mid-air with
70-radius orange explosion → F7 knockback shockwave pushing debris outward →
F8 fading smoke cloud.

Row 5 — EAGLE EYE (+40% Crit 8 s buff AND 120 px forward melee knockback
burst with 200 ms stun on cast): F1 gold feather circle forming on ground →
F2 small phoenix silhouette rising from golden light → F3 phoenix wings
spreading wide with radiant halo → F4 full phoenix aura around caster → F5
forward knockback shockwave pulse (gold + yellow, 120 px reach) → F6 radial
gold feather burst with stun stars → F7 buff settling as golden aura around
caster → F8 faint floating feathers, single sparkle.

Zero pure-green pixels inside any sprite. Every frame centered in cell.
```

---

## After Generation — Update the Loader

The current `FX_CATALOG` uses generic row keys (e.g. `powerSlash`, `auraBurst`). Replace it with the **actual skill IDs** so the hookups don't need remapping:

```js
const FX_CATALOG = {
  warrior: {
    path: 'skills/warrior_fx.png',
    rows: [
      { key:'slash',       frames: 8 },
      { key:'powerStrike', frames: 8 },
      { key:'groundSlam',  frames: 8 },
      { key:'rush',        frames: 8 },
      { key:'warCry',      frames: 8 },
    ],
  },
  rogue: {
    path: 'skills/thief_fx.png',
    rows: [
      { key:'stab',        frames: 8 },
      { key:'backstab',    frames: 8 },
      { key:'throwDagger', frames: 8 },
      { key:'smokeDash',   frames: 8 },
      { key:'flurry',      frames: 8 },
    ],
  },
  mage: {
    path: 'skills/mage_fx.png',
    rows: [
      { key:'magicBolt',   frames: 8 },
      { key:'fireball',    frames: 8 },
      { key:'iceSpike',    frames: 8 },
      { key:'blink',       frames: 8 },
      { key:'arcaneBurst', frames: 8 },
    ],
  },
  archer: {
    path: 'skills/archer_fx.png',
    rows: [
      { key:'arrowShot',   frames: 8 },
      { key:'multiShot',   frames: 8 },
      { key:'chargedShot', frames: 8 },
      { key:'evadeRoll',   frames: 8 },
      { key:'eagleEye',    frames: 8 },
    ],
  },
};
```

Then simplify every `spawnFx('warrior','powerSlash', ...)` call to `spawnFx('warrior','powerStrike', ...)` — the row key now matches the SKILL ID directly.

## Delivery Checklist

- [ ] Exactly 2048 × 1280 px
- [ ] Filenames lowercase: `warrior_fx.png`, `thief_fx.png`, `mage_fx.png`, `archer_fx.png`
- [ ] Pure `#00FF00` fills every non-sprite pixel
- [ ] No green (dark green, teal, lime) inside any sprite
- [ ] Every row has exactly 8 frames, every frame anchored at cell center
- [ ] Drop into `LevelX/skills/` and push
