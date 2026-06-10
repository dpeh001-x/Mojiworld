# Known Bugs — Mojiworld

This file tracks RECURRING bugs that have been fixed multiple times and keep coming back. Each entry has a permanent stable identifier (e.g. `BUG-001`) so future audits, tests, and in-code comments can reference it consistently. **Do NOT remove entries from this file** even after a bug is "fixed" — leave the history visible so the next regression is recognised faster.

When adding a new fix attempt, add a new sub-entry under the bug heading with the version + date + approach. When the bug is verified gone for ≥3 user sessions across all the listed reproduction paths, mark the bug `[RESOLVED-PROBABLY]` (never `[CLOSED]` — recurring bugs earn the right to be paranoid about).

---

## BUG-001 — Q Wardrobe broken on open / "design does not show up after Use in game"

**Status:** RECURRENT (6 fix attempts) → re-opened at **R6 (v0.26.820)** — the LIMB paint half regressed after the v0.26 posture editor landed. Fix shipped v0.26.820. Not `[RESOLVED-PROBABLY]` — needs ≥ 3 stable sessions across all reproduction paths.

**Affected component:** Char Studio entirely — `openCharStudio`, the builder chain (`buildCharStudio*`), `buildWardrobeGrid`, `buildCharStudioPaint`, `applyCharStudioToPlayer`, the `CHAR_STUDIO.customPaintLayers` pipeline, the legacy head-circle scrub path.

**Symptoms:**
- Original (R1, R2): paint a design on a body part, click "Use in game", in-game character doesn't show the design.
- Mid-thread (R3): user paints during the async base-image load window, strokes get overwritten when the image finishes loading.
- v0.25.617 regression (R4): saved layers got wiped on Apply because the over-aggressive multi-route apply pipeline committed empty pre-load canvases.
- v0.25.628 / v0.25.629 (R5): the entire wardrobe rendered as a blank shell (no slot grid, no character preview, only the title + Apply / Revert buttons) because a throw in the pre-builder seeding section short-circuited the whole `openCharStudio` flow.

**Why it kept recurring:** the wardrobe is a 200-line side-effect-heavy initialisation chain that touches save data, image loaders, async timers, closures, and DOM in a specific order. Each fix plugged ONE leak; the next regression came from a layer that wasn't yet defended.

### Reproduction paths (all known)

- **R1** — (pre-v0.25.570) Paint a single layer, click Use in game within ~120 ms of the last stroke. The 120 ms debounce timer hadn't fired so the stroke was canvas-only. Fixed v0.25.570 with `_activePaintCommitNow` flush in apply.
- **R2** — (pre-v0.25.603) Paint LEFT ARM, switch to RIGHT ARM tab, paint, click Use in game. The second `buildCharStudioPaint` overwrote the single-slot `_activePaintCommitNow`, so LEFT ARM's pending stroke was lost. Fixed v0.25.603 with a per-layer `_activePaintCommitFns` registry.
- **R3** — (pre-v0.25.617) Async base-image race in `_csLoadPaintCanvas`: deferred `img.onload → _lxDrawPaintImage` overwrote user strokes drawn during the load window. Fixed in v0.25.617 via a `_canvasHasInk(cv)` guard. KEPT.
- **R4** — (v0.25.617 regression, fixed in v0.25.627) "Wardrobe completely ruined" — v0.25.617 added two extra "redundant" apply routes (persistent `_paintCanvasMap` + DOM sweep over `.char-paint-canvas`). Both committed EVERY tracked / mounted paint canvas, including ones whose async load hadn't completed yet. Empty pre-load canvases got persisted as empty data URLs via `_csCommitPaintCanvas`'s `keepEmptyReplacement` branch, overwriting the player's saved design. Reverted in v0.25.627; `paint._userDirty` flag added to gate `commitNow` so any future apply mechanism still can't commit untouched canvases.
- **R6** — (regression after the v0.26 posture editor, fixed v0.26.820) **LIMB paint never shows in-game.** Symptom (user, localhost, current build): paint a design on a RIGHT/LEFT ARM or LEG slot, click "Use in game", the design never appears on the character — even though the commit → apply → save → load → decode pipeline is all verified-correct (it was the RENDER that failed). Root cause: limb paint was drawn via `_drawCustomPaintLayerPinned(layer, bone)`, i.e. the full body-sized paint image drawn INSIDE the limb bone's LIVE transform. The paint editor's guide + the studio preview both draw the hero at `paint_pose_rest` (every bone at zero rotation), so the user paints onto a rest-pose silhouette in body-root space — but in-game the bone carries the idle breathing wobble AND, since the v0.26 posture editor, arm/leg angles up to ±90°. `_heroVecRestPos` only cancels the bone's TRANSLATION, never its ROTATION, so any rotation swung the body-sized painting clean off the limb. Combined with the base limb being hidden whenever its paint layer is set (`_lxPaintLayerReplacesBase`), the design vanished. **Fix:** render the four limb layers (legL/legR/armR/armL) at BODY-ROOT, on top of the body, just before the ALL PAINT layer (search `LIMB PAINT (body-root)` in `_drawVectorHero`) — exactly how the ALL PAINT layer (which never had this bug) already renders. Now pixel-for-pixel WYSIWYG with the guide. Trade-off: limb paint no longer swings with the limb during walk/attack (a cosmetic loss, vastly preferable to invisibility). Verified in-engine: a localized blob painted on armR rendered as a proportional, correctly-placed blob on the player's right-arm side in `drawPlayer()` (283 px, up from a 48 px misplaced sliver pre-fix), matching the studio preview. The spine/head-pinned layers (cape / body_top / body_bottom / skin / hair / helmet) were left pinned — those bones barely rotate, so they don't exhibit R6; migrate them the same way if a report surfaces.
- **R5** — (regression after R4 fix, surfaced v0.25.628 / fixed v0.25.629) The whole wardrobe panel rendered blank (no slots, no preview). Root cause: a throw in the **pre-builder seeding** section of `openCharStudio` (lookCustom / customPaint / `_csScrubLegacyHeadCircleFromStudioLayers` / equip seeding) short-circuited everything below, including `buildWardrobeGrid` and `renderCharStudio`. v0.25.628's `_safeBuild` only protected the BUILDER calls, not the seeding above them. v0.25.629 wraps each pre-builder step in its own try/catch + `console.error`. User confirmed working.

### Architecture (v0.25.629 — current, working)

The wardrobe init flow has FOUR protected zones, all wrapped in their own try/catch with diagnostic console markers:

```
openCharStudio() {
  classList.add('open');         ← can't fail (DOM ready)
  game.paused = true;            ← can't fail
  
  ┌─ ZONE A — pre-builder seeding (v0.25.629) ──────────────┐
  │ try { lookCustom seed }       catch [wardrobe seed:lookCustom] │
  │ try { paint / paintLayers }   catch [wardrobe seed:paint]      │
  │ try { headCircleScrub() }     catch [wardrobe seed:headScrub]  │
  │ try { equip seed loop }       catch [wardrobe seed:equip]      │
  └──────────────────────────────────────────────────────────┘
  
  ┌─ ZONE B — builder chain (v0.25.628) ────────────────────┐
  │ _safeBuild('swatches',     ...)                                │
  │ _safeBuild('faceStyles',   ...)                                │
  │ _safeBuild('eyeStyles',    ...)                                │
  │ _safeBuild('mouthStyles',  ...)                                │
  │ _safeBuild('hairStyles',   ...)                                │
  │ _safeBuild('msxStyles',    ...)                                │
  │ for slot of equip slots:                                       │
  │   _safeBuild('equipPicker:'+slot, ...)                         │
  │ _safeBuild('paint',         ...)                               │
  │ _safeBuild('wardrobeGrid',  ...)  ← THE CRITICAL ONE           │
  │ _safeBuild('actionButtons', ...)                               │
  │ _safeBuild('initialRender', ...)                               │
  └──────────────────────────────────────────────────────────┘
  
  ┌─ ZONE C — slot tile build (v0.25.628) ──────────────────┐
  │ Inside buildWardrobeGrid's WARDROBE_SLOTS.forEach:             │
  │ try { tile = ... real tile build ... }                         │
  │ catch [wardrobe slot] {                                        │
  │   tile = fallback "!" tile                                     │
  │ }                                                              │
  │ tile.onclick = () => {                                         │
  │   try { _wardrobeMountPicker(entry) }                          │
  │   catch [wardrobe picker] { ... }                              │
  │ }                                                              │
  └──────────────────────────────────────────────────────────┘
  
  ┌─ ZONE D — paint commit pipeline (v0.25.603 + v0.25.627) ┐
  │ commitNow gates on paint._userDirty                            │
  │ Apply iterates _activePaintCommitFns ONLY                      │
  │ closeCharStudio clears registry + map state                    │
  └──────────────────────────────────────────────────────────┘
}
```

Plus the **paint commit pipeline** (Zone D, paint-specific) keeps the v0.25.603/627 design:

1. `CHAR_STUDIO._activePaintCommitFns[layerId] = commitNow` — closure registry, written when each layer's `buildCharStudioPaint` runs.
2. `paint._userDirty` flag — gates `commitNow`. Set `true` only on real user input:
   - `pointerdown` (stroke OR move-tool drag)
   - `setEditableUploadImage` (image upload)
   - `flattenEditableUpload` (paste-down)
3. `_canvasHasInk(cv)` async-load race guard in `_csLoadPaintCanvas`'s deferred `img.onload`.
4. `closeCharStudio` clears `_activePaintCommitFns` + `_paintCanvasMap` + `_active*` refs so detached-canvas closures don't leak to the next session.

### Architectural rules to prevent recurrence

These rules apply to ANY future code that touches the wardrobe init chain or paint commit pipeline. Violating them risks reintroducing a BUG-001 variant.

**Rule 1 — Every step in `openCharStudio` MUST be wrapped in try/catch.**
- Seeding code (Zone A) — direct `try { ... } catch (e) { console.error('[wardrobe seed:LABEL]', e); }`.
- Builder calls (Zone B) — use the existing `_safeBuild('label', () => fn())` helper.
- Slot construction (Zone C) — wrap each iteration of `WARDROBE_SLOTS.forEach` and provide a fallback tile.
- The `console.error` MUST include a clear `[wardrobe ...]` marker so future audits can grep the console for failures.

**Rule 2 — Apply MUST only commit `_userDirty` canvases.**
- Never re-introduce a "DOM sweep" or "canvas map iteration" that commits untouched canvases. Saved data must NEVER be overwritten by an empty pre-load canvas. (R4 cause.)
- Adding any new commit route requires the `_userDirty` gate AND a confirmation from a real user-input handler (not just from data load).

**Rule 3 — `_csLoadPaintCanvas`'s deferred draw MUST check `_canvasHasInk(cv)` before drawing.**
- (R3 cause.) The deferred `img.onload` runs ASYNC; if the user has already painted in the meantime, the loaded base image must NOT overlay their strokes.

**Rule 4 — Per-layer paint state goes in `_activePaintCommitFns[layerId]`, never in a single global slot.**
- (R2 cause.) Multiple layer tabs each register their own `commitNow`; apply iterates the entire map.
- Single-slot fallback `_activePaintCommitNow` is for back-compat only — never use it as the primary mechanism.

**Rule 5 — `closeCharStudio` MUST clear all paint commit state.**
- (R4 contributing factor.) Detached-canvas closures from a previous session must not survive into the next session.

**Rule 6 — Any throw inside a single iteration of `WARDROBE_SLOTS.forEach` must NOT block subsequent slots.**
- (R5 cause class.) A bad LX_HAIR sprite, missing `LX_EQ_REGISTRIES` entry, or NaN math in one slot's thumb must produce a fallback tile, not a blank grid.

### Verification checklist (run after any wardrobe-touching change)

Before shipping any change that touches `openCharStudio`, `buildWardrobeGrid`, `buildCharStudioPaint`, `applyCharStudioToPlayer`, or any builder in the wardrobe chain, run all 8 of these:

| # | Test | Expected outcome |
|---|------|------------------|
| 1 | Press Q. Wardrobe opens. | Title shows version label. Slot grid + character preview both render. |
| 2 | Open browser console. | Zero `[wardrobe ...]` error markers. |
| 3 | Click each of the 14 slot tiles. | Each opens its picker without console errors. |
| 4 | On any paint slot (arm/leg), draw a stroke. Click Use in game IMMEDIATELY. | In-game character shows the design. |
| 5 | Paint LEFT ARM. Switch to RIGHT ARM. Paint. Click Use in game. | BOTH designs appear in-game. |
| 6 | Paint a layer. Close wardrobe. Reopen. Paint a DIFFERENT layer. Click Use in game. | Both layers' designs survive. |
| 7 | Open a layer that already has saved paint. Click Use in game IMMEDIATELY without painting. | Saved design preserved (NOT wiped — this is the v0.25.617 R4 regression check). |
| 8 | Open a fresh save with no wardrobe data. Press Q. | Wardrobe opens cleanly with default look. |

If any test fails, add a new R-entry above with the new repro and bump status to RECURRENT.

### Code anchors (search these to find the relevant code)

- `// BUG-001` — every fix-related code site carries this marker. Grep is the canonical entry point.
- `_safeBuild` — defensive wrapper for builder calls (v0.25.628+)
- `_activePaintCommitFns` — closure registry (v0.25.603+, kept)
- `paint._userDirty` — per-canvas dirty flag (v0.25.627+, gates commitNow)
- `_csCommitPaintCanvas` — the actual commit-to-state function
- `applyCharStudioToPlayer` — the apply path that iterates the registry
- `_canvasHasInk` — async-race guard helper (v0.25.617+, kept)
- `[wardrobe seed:` / `[wardrobe build]` / `[wardrobe slot]` / `[wardrobe picker]` — devtools console markers for runtime diagnostics
- REMOVED in v0.25.627: `_paintCanvasMap` iteration in apply, DOM sweep in apply (caused R4)

### Fix history (chronological)

| Version | What was added | Result |
|---|---|---|
| v0.25.570 | `_activePaintCommitNow` flush in apply | Fixed R1 |
| v0.25.603 | `_activePaintCommitFns` per-layer registry | Fixed R2 |
| v0.25.617 (regression) | Routes 2 + 3 in apply, async-load race guard, registry cleanup on close | Caused R4. Async-load + cleanup kept. |
| v0.25.627 | Reverted v0.25.617 routes 2+3. Added `paint._userDirty` flag. | Fixed R4. |
| v0.25.628 | Wrapped builder chain (Zone B) in `_safeBuild` try/catch | Partial — exposed R5 by surfacing the failure mode. |
| v0.25.629 | Wrapped pre-builder seeding (Zone A) + slot construction (Zone C) in try/catch. Added version label to wardrobe header. | Fixed R5. **User confirmed working.** |
| v0.26.820 | Limb paint (legL/legR/armR/armL) rendered at BODY-ROOT before the ALL PAINT layer instead of bone-pinned. | Fixed R6 (limb paint invisible after posture editor). |
