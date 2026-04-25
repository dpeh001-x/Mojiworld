# Mobile proposed fixes — held back from `main` until collaborator-quiet

Two CSS fixes designed in plan round 3 but **not committed** to `maple_game.html`.
They override selectors (`.modal`, `.mobile-ctrl .mc-pots`, `#mp-btn`) that the collaborator
might also be editing on `main` as part of the v0.25.x Phaser migration / character
render rework. Holding the diffs here until the user confirms `main` is settled.

## Status

- Authored: 2026-04-26 on `mobile-ui-pass`.
- Apply target: inside the existing mobile media query in `maple_game.html`.
- Trigger to apply: user confirms `main` is quiet (no in-flight collaborator edits to
  `.modal` / `.mobile-ctrl` / `#mp-btn`).

---

## Fix 3a — pots row + Multi button hug the device viewport edge

### Problem

`.mobile-ctrl` lives inside `.game-wrapper`, which the runtime scales via
`transform: scale(--game-scale)`. On a phone-landscape viewport the wrapper renders
letterboxed inside the viewport — the `.mc-pots` row's `right: 12px` lands ~30–60px
inside the device's actual right edge, not flush with it. `#mp-btn` (Multiplayer)
sits at the wrapper's `right: 88px` so it can overlap the canvas content area.

User wants the top-right buttons to "float more right" — i.e. anchor to the device
viewport's right edge, using the black letterbox space.

### Proposed CSS

Append inside the existing `@media (pointer: coarse), (max-width: 900px)` block.
Suggested insertion point: just after the existing `.mobile-ctrl .mc-pots` rule
(around `maple_game.html:362`, inside the same `@media` block that starts near
line 84 / 444).

```css
  /* Take the pots row OUT of the scaled .game-wrapper on mobile so
     the buttons anchor to the device viewport edge (using the black
     letterbox space) instead of the canvas edge. The wrapper's
     transform: scale() doesn't apply once the parent is replaced
     with a fixed-position parent, so the row renders at full size
     against the device's right edge. */
  .mobile-ctrl .mc-pots {
    position: fixed !important;
    top: calc(12px + env(safe-area-inset-top)) !important;
    right: calc(12px + env(safe-area-inset-right)) !important;
    z-index: 70 !important;
  }
  /* Same treatment for the Multiplayer button. Pull it out of the
     wrapper so it sits next to the pots row at the device edge,
     not floating mid-canvas. */
  #mp-btn {
    position: fixed !important;
    top: calc(8px + env(safe-area-inset-top)) !important;
    right: calc(80px + env(safe-area-inset-right)) !important;
    z-index: 60 !important;
  }
```

### Risk note

`#mp-btn` and `.mobile-ctrl` are touched here. Both selectors have base styles
elsewhere in the file (line 811 + line 124 + line 913 + line 980). If the
collaborator changes those base rules during apply, expect a rebase conflict on
`maple_game.html` — easy to resolve since `!important` mobile overrides win
regardless. Conflict surface is pure CSS, no JS / no DOM.

### Verification

- Landscape phone: pots row sits flush against the device's right edge.
- `#mp-btn` (if present) sits just left of the pots row at the same vertical level,
  not floating in the canvas.
- Portrait phone: identical behaviour. Safe-area insets respected on devices with
  notches.
- Desktop unaffected (rules inside `@media (pointer: coarse), (max-width: 900px)`).

---

## Fix 3b — clamp `.modal` width on mobile

### Problem

`.modal` default at `maple_game.html:1077`:
```
padding: 18px 22px; min-width: 420px; max-width: 720px;
```

Inline overrides:
- `#multiplayer-modal .modal` — `min-width: 480px` at line ~1823.
- `#powerup-modal .modal` — `min-width: 620px` at line 1896.

On a 380px-wide portrait phone the modal's natural width exceeds the viewport.
On a 920×430 landscape phone, the powerup modal at 620px barely fits and any
inner content (3 powerup cards in a row) overflows the right edge.

### Proposed CSS

Append inside the existing `@media (pointer: coarse), (max-width: 900px)` block.
Suggested insertion point: anywhere convenient inside the mobile CSS block
(e.g. right after the `#help-btn-tr` rule, around line ~471).

```css
  /* Mobile modal width clamp — override the default 420/720 min/max
     and any inline min-width overrides (multiplayer 480, powerup
     620) so every modal fits on a narrow viewport. The 92vw cap
     leaves a small margin on each side for the dim backdrop to
     remain visible (which is the affordance for the new
     outside-click-to-close on mobile). */
  .modal-overlay .modal {
    min-width: 0 !important;
    max-width: 92vw !important;
    box-sizing: border-box !important;
  }
```

### Risk note

`.modal` is a global selector used by every modal. Override is mobile-scoped via
the parent media query, so desktop is unaffected. The `!important` flags ensure
mobile beats both the default rules AND the per-modal inline `min-width:480/620`
declarations (inline non-`!important` styles lose to stylesheet `!important`).

The collaborator could change `.modal` base styles during apply; in that case
expect a rebase conflict that's resolved by keeping both blocks
(theirs in the global rule + mine in the mobile media query).

### Verification

- Powerup modal (`#powerup-modal`, opens on Lv-up) on a 380px-wide portrait phone:
  modal fits within 92% of viewport; no horizontal scroll.
- Multiplayer modal on landscape phone: same.
- Inventory / Skills / Codex / Skill Tree / Attributes modals: same — all clamp
  to 92vw and remain readable.
- Desktop: unaffected. Default `min-width: 420px; max-width: 720px` still applies.

---

## How to apply both fixes

When the user gives the green light:

1. Verify `main` is up-to-date and the collaborator hasn't recently touched
   `.modal`, `.mobile-ctrl`, `#mp-btn`, or `.mc-pots`:
   ```
   git log --since="2 days ago" --oneline -- maple_game.html | grep -iE 'modal|mobile-ctrl|mp-btn|mc-pots'
   ```
   If empty: safe to apply.
2. Open `maple_game.html`. Insert the Fix 3a block inside the mobile media query
   that contains the existing `.mobile-ctrl .mc-pots` rule (search for that
   selector; insert just after the existing rule).
3. Insert the Fix 3b block inside the same media query, anywhere convenient.
4. `node --check` on extracted `<script>` — no JS changes, but worth a syntax
   sanity check.
5. Commit with messages mirroring the changelog entries (one entry per fix).
6. Add `MOBILE_CHANGELOG.html` entries (newest on top).
7. Push to `origin/mobile-ui-pass`. Fast-forward `main`.

After apply, this file can be deleted (or archived in a `docs/` folder if we
want a record).
