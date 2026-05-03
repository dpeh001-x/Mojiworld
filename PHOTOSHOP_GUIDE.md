# Sprite authoring guide — Photoshop workflow (v0.25.320)

How to author character / equipment sprites that drop into the layered
system without per-piece offset tuning. The big rule: **never resize
the canvas, always paint against the same anchor reference layer**.

## TL;DR

| Setting | Value | Why |
|---|---|---|
| Canvas size | **800 × 800 px** (locked) | matches existing flow.webp, ponytail.webp, every equipment piece. Renderer scales down to ~50–60 px logical with ~13× anti-aliasing headroom. |
| Resolution | **72 dpi** (web) | irrelevant to engine, just keep low so file size stays small. |
| Color mode | **RGB / 8-bit/channel** | sRGB. 16-bit doubles file size for no visual gain. |
| Background | **Transparent (alpha)** | the renderer composites over the chibi body — anything non-transparent will block layers below. |
| Export format | **PNG-24** primary, **WebP** preferred-final | PNG-24 has clean alpha + edge-perfect; WebP shrinks file size 50–70 % with the same fidelity. |
| Aliasing | **Anti-aliased** (default) | the chibi-style render benefits from soft edges. Don't disable AA — it'll look pixelated when scaled to 50 px. |

## File format — pick one

### PNG-24 with alpha (recommended for first-time authors)
- Universally supported, browser-decodes fast.
- Adobe Photoshop default export — `File → Export → Export As → PNG`.
- File size: ~150–400 KB per 800×800 sprite. Acceptable but bulky.
- **Use this if you don't have the WebP plugin and want the safest path.**

### WebP (recommended once your workflow is stable)
- 50–70 % smaller than PNG with the same alpha + visual fidelity.
- Photoshop 23.2+ has a native WebP exporter (`File → Save As → WebP`).
- For older Photoshop versions, install the [WebPShop plugin](https://github.com/webmproject/WebPShop) (free, official Google).
- File size: ~50–200 KB per 800×800 sprite.
- **All existing in-engine sprites are already .webp — match them and the import script auto-detects either.**

### Avoid

- **JPEG** — no alpha channel, lossy edges. Will smudge onto the chibi body.
- **GIF** — 256-color palette destroys the painterly look. Acceptable only for FX bursts where banding doesn't matter.
- **SVG** — engine doesn't support vector layers (the existing path-based hair was retired in v0.25.190 specifically because sprite hair looks better).

## Pixel size — why 800 × 800 (and never anything else)

The canvas size is a contract between the artist and the renderer. The
renderer scales whatever you give it down to ~50–60 logical pixels at
the chibi character's body size. To keep that downscale clean:

| Source size | Downscale ratio | Result |
|---|---|---|
| 256 × 256 | ~5×  | jaggy edges, single-pixel detail visible |
| 512 × 512 | ~10× | acceptable, but tight on detail headroom |
| **800 × 800** | **~14×** | **sweet spot — matches every existing layer** |
| 1024 × 1024 | ~17× | fine, but 60 % more file size for no visual gain |
| 2048 × 2048 | ~34× | wasteful, big files, no visual gain |

**Sticking to 800 × 800 also guarantees the anchor map below works without
arithmetic** — the renderer's destination rect is calibrated against
800. Any other size means the artist has to math the anchors.

## Anchor map — paint against these, never guess

The chibi character's body parts always land at these pixel positions
inside the 800 × 800 canvas. Your sprite should put its content in the
right place RELATIVE to these anchors. The renderer just blits the
whole 800 × 800; alignment comes purely from where you painted.

```
   x →    0       400       800
   ↓
   0    ┏━━━━━━━━━━━━━━━━━━━━━━━┓
        ┃                       ┃
  130   ┃           ✦           ┃  ← top of head
        ┃          ███          ┃
  250   ┃         █████         ┃  ← head centre  (eyes here)
        ┃          ███          ┃
  350   ┃           |           ┃  ← chin / neckline (cape clasps here)
        ┃         /─|─\         ┃
  400   ┃        /  |  \        ┃  ← shoulders (320, 400) and (480, 400)
        ┃       /   |   \       ┃
  440   ┃           ●           ┃  ← chest centre
        ┃           |           ┃
  460   ┃     ◉─────|─────◉     ┃  ← hand grips (260, 460) and (540, 460)
        ┃           |           ┃
  520   ┃          ▓▓▓          ┃  ← hips / waist
        ┃          ▓▓▓          ┃
        ┃          | |          ┃
  600   ┃          | |          ┃  ← knees (380, 600) and (420, 600)
        ┃          | |          ┃
  720   ┃         ▼ ▼           ┃  ← feet (380, 720) and (420, 720)
        ┃                       ┃
  800   ┗━━━━━━━━━━━━━━━━━━━━━━━┛
```

### Per-slot guidance — where your content goes

| Slot | Top of content (y) | Bottom of content (y) | Width budget |
|---|---|---|---|
| `helmet` | 130 (top of head) | 240 (just above eye line — DON'T cover face) | 200–280 px wide |
| `hair` (front + back) | 130 | 380 (jaw line) | 280–400 px wide |
| `cape` | 350 (neckline) | 650 (just past hips) | 400–500 px wide |
| `body_top` | 350 (neckline) | 520 (hips) | 280–360 px wide |
| `body_bottom` | 520 (hips) | 700 (above ankles) | 240–320 px wide |
| `boots` | 620 (mid-shin) | 720 (feet) | 240 px wide (both feet) |
| `gloves` | 440 (just above hands) | 480 (just below hands) | 360 px wide (both hands) |
| `weapon` | 80 (above head if blade up) | 720 (feet if staff down) | spans grip (540, 460) outward |
| `eyes` | 230 | 280 | 220 px wide (both eyes) |
| `mouth` | 290 | 330 | 60 px wide |

## Photoshop step-by-step

### 1. One-time setup: build the master template PSD

You'll reuse this PSD for every new sprite. Build it once.

1. **New document** → 800 × 800 px, 72 dpi, RGB / 8-bit, transparent.
2. **Layer 1 — "ANCHOR REFERENCE"**: paste a low-opacity reference image of an existing chibi (e.g. screenshot of the in-game character). Resize so:
   - Top of head sits at y = 130
   - Feet sit at y = 720
   - Centred horizontally at x = 400
   - Set this layer's opacity to **15 %**
   - Lock it (the lock icon at top of the Layers panel)
3. **Layer 2 — "GRID GUIDES"**: use `View → New Guide` to drop guides at:
   - Vertical: 260, 320, 380, 400, 420, 480, 540
   - Horizontal: 130, 250, 350, 400, 460, 520, 600, 720
4. **Save As**: `LX_chibi_template.psd`. Don't paint on this — it's a starting point only.

### 2. Authoring a new piece

1. **Open** `LX_chibi_template.psd`. Immediately `Save As <slot>_<id>.psd` (e.g. `cape_royal.psd`) so the template stays clean.
2. **Create a new group** named after the slot (`cape`, `body_top`, etc.).
3. **Paint inside that group** using the anchor reference + guides as alignment cues. Constraints:
   - Don't extend content beyond the slot's bottom y (e.g. a cape ends at y ≈ 650, never lower).
   - Don't cover anchors of other slots (a helmet must not cover y > 240 — that would block the face).
   - Centre the silhouette horizontally on x = 400 unless the piece is asymmetric (e.g. emo hair).
4. **For tint-friendly clothing**: paint in a NEUTRAL light grey (`#c8c8d0`) or warm cream (`#e8d8b8`) base color. Multiply-blend tint at runtime then recolours your sprite cleanly. Pure white sprites multiply CLEANEST — use white for plate armor especially.
5. **For shape-identity items** (weapons): paint at full saturation. The shape IS the identity, no tinting needed.

### 3. Pre-export checklist

Before exporting, verify:

- [ ] Canvas is still 800 × 800 (`Image → Image Size` to confirm)
- [ ] `ANCHOR REFERENCE` and `GRID GUIDES` layers are **HIDDEN**
- [ ] Background is fully transparent (no white fill snuck in via flatten)
- [ ] Your content sits within the slot's allowed Y range (see table above)
- [ ] No stray pixels outside the silhouette (use `Layer → Trim → Transparent Pixels` to verify, then UNDO — only verify, don't actually trim, the canvas must stay 800 × 800)
- [ ] Anti-aliasing on edges (don't use `Filter → Other → Threshold` to crisp them — looks pixelated when scaled)

### 4. Export

**For PNG**:
1. `File → Export → Export As`
2. Format: **PNG**
3. Transparency: **ON**
4. Smaller File / Smallest File: **smaller** is fine (no visual diff at 800 px)
5. Save to `Sprites/character/<slot>/<id>.png`

**For WebP** (recommended):
1. `File → Save As`
2. Format: **WebP**
3. Quality: **90** (lossless mode loses 30 % compression for negligible visual gain)
4. Image Settings: **None** (no metadata)
5. Save to `Sprites/character/<slot>/<id>.webp`

If your Photoshop version doesn't support WebP, export PNG and convert
on the command line:

```bash
# Install cwebp once: https://developers.google.com/speed/webp/download
cwebp -q 90 input.png -o output.webp
```

### 5. Wire into the game

1. Drop the file into `Sprites/character/<slot>/<id>.webp`.
2. Run the import script from the repo root:
   ```bash
   node scripts/import_equipment_sprites.mjs <slot>
   ```
3. Paste the printed `_lxEqRegistry(...)` block into `maple_game.html`,
   replacing the existing `LX_<SLOT>` declaration.
4. Reload the game. Press <kbd>Q</kbd> — your new piece appears in the
   wardrobe grid for that slot.

## Common pixel-misalignment causes

If a piece looks "off by a few pixels" in-game, check in this order:

1. **Canvas was resized** (artist saved at 768 × 768 or 1024 × 1024) — the renderer's anchor map assumes 800 × 800, so a different size shifts every anchor proportionally. Fix: resize back to 800 × 800 with content re-centered.
2. **Content drawn relative to the visible artwork rather than the anchor map** — e.g. cape painted from an arbitrary "top" rather than y = 350. Fix: pull up the `ANCHOR REFERENCE` layer, eyeball the chibi character's neckline, paint from there.
3. **Trim cropped the canvas** — `Layer → Trim → Transparent Pixels` permanently shrinks the canvas. Fix: undo the trim. If saved, redo the piece from the template.
4. **Layer effects baked in extra padding** — e.g. drop shadow extending beyond the silhouette. Fix: rasterize the layer effect, or shrink the effect spread.
5. **Different export DPI** — irrelevant, ignore unless your file size is huge.

## When in doubt

The existing `Sprites/character/hair/flow.webp` and
`Sprites/character/eyes/default.webp` are the gold standard. Open them
in Photoshop, eyeball where the content sits within the 800 × 800
canvas, match that placement for new pieces. The renderer is
calibrated against those exact files.
