#!/usr/bin/env python3
"""Face-specific layer extractor — handles eyes (black) + pupil highlights
(white) + mouth (black line) cleanly.

Why this exists vs the generic extract_layer.py:
  - Anime eyes have HARD CONTRAST. The naive diff captures the anti-aliased
    transition pixels with their gray RGB at full alpha → looks like a halo
    outline when composited over a tinted face.
  - White pupil highlights are too close to the cream-white face background
    to pass a diff threshold → they end up TRANSPARENT and the tinted skin
    shows through.

This script:
  1. Captures dark pixels in the face region as PURE BLACK with alpha ramped
     by darkness, so anti-aliased edges blend naturally over any background.
  2. Detects white pupil highlights INSIDE dark eye clusters via dilation,
     forces them fully opaque white.
  3. Outputs a clean transparent layer with no background noise.

Usage:
  python extract_face.py <composite.webp> <base.webp> <output.webp>
                         [y_start=0.20] [y_end=0.50]
"""
import sys
import numpy as np
from PIL import Image
from scipy.ndimage import binary_dilation


def extract_face(comp_path: str, base_path: str, out_path: str,
                 y_start: float = 0.20, y_end: float = 0.50,
                 diff_threshold: float = 50,
                 dark_max_rgb: int = 180,
                 white_min_rgb: int = 248,
                 pupil_erosion_px: int = 1,
                 pupil_dilation_px: int = 1) -> None:
    composite = Image.open(comp_path).convert("RGBA")
    base = Image.open(base_path).convert("RGBA")
    if base.size != composite.size:
        base = base.resize(composite.size, Image.LANCZOS)

    comp = np.array(composite, dtype=np.int32)
    base_arr = np.array(base, dtype=np.int32)
    H, W = comp.shape[:2]

    # Vertical face region mask
    region = np.zeros((H, W), dtype=bool)
    region[int(H * y_start): int(H * y_end), :] = True

    R, G, B = comp[..., 0], comp[..., 1], comp[..., 2]

    # Color distance from base reference
    diff = np.sqrt(
        (R - base_arr[..., 0]) ** 2
        + (G - base_arr[..., 1]) ** 2
        + (B - base_arr[..., 2]) ** 2
    )
    changed = (diff > diff_threshold) & region

    max_rgb = np.maximum.reduce([R, G, B])
    min_rgb = np.minimum.reduce([R, G, B])

    # Dark features (eyes + mouth ink): max channel below dark_max_rgb AND changed
    is_dark = changed & (max_rgb < dark_max_rgb)

    # Pupil whites: PURE white pixels (min > 248) that sit INSIDE a dark cluster.
    # Erode the dark mask first to find dark "centres", then dilate slightly to
    # reach the typical pupil position. This avoids grabbing the cream face
    # pixels just outside the eye edge (which created a white halo previously).
    from scipy.ndimage import binary_erosion
    dark_centres = binary_erosion(is_dark, iterations=pupil_erosion_px)
    pupil_zone = binary_dilation(dark_centres, iterations=pupil_dilation_px + pupil_erosion_px)
    is_white_pupil = (min_rgb > white_min_rgb) & pupil_zone

    # Build clean output:
    # - Dark pixels: pure black, alpha ramped by darkness so AA edges fade smoothly
    # - White pupils: pure white, fully opaque (override any dark beneath)
    out = np.zeros((H, W, 4), dtype=np.uint8)
    dark_alpha = np.clip(255 - max_rgb, 0, 255).astype(np.uint8)
    out[is_dark, 0] = 0
    out[is_dark, 1] = 0
    out[is_dark, 2] = 0
    out[is_dark, 3] = dark_alpha[is_dark]
    out[is_white_pupil, 0] = 255
    out[is_white_pupil, 1] = 255
    out[is_white_pupil, 2] = 255
    out[is_white_pupil, 3] = 255

    Image.fromarray(out).save(out_path, "WEBP", lossless=True)
    n_dark = int(is_dark.sum())
    n_white = int(is_white_pupil.sum())
    print(f"  {n_dark:,} dark feature pixels (eyes + mouth)")
    print(f"  {n_white:,} pupil-highlight pixels forced opaque white")
    print(f"  -> {out_path}")


if __name__ == "__main__":
    if len(sys.argv) < 4:
        print(__doc__)
        sys.exit(1)
    comp = sys.argv[1]
    base = sys.argv[2]
    out = sys.argv[3]
    y_s = float(sys.argv[4]) if len(sys.argv) > 4 else 0.20
    y_e = float(sys.argv[5]) if len(sys.argv) > 5 else 0.50
    extract_face(comp, base, out, y_s, y_e)
