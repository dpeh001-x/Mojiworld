#!/usr/bin/env python3
"""Extract a feature layer (e.g. eyes, hair, armor) from a 'mannequin + feature'
composite by diffing against the bare mannequin reference.

Both inputs should be the same canvas size and pose. The script identifies
pixels that differ significantly between the two images and keeps ONLY those
pixels in the output, with everything else fully transparent.

Usage:
  python extract_layer.py <composite.webp> <reference.webp> <output.webp>
                          [threshold] [region_y_start] [region_y_end]

Defaults:
  threshold       = 35  (color distance, 0-441)
  region_y_start  = 0   (full canvas)
  region_y_end    = 1.0 (1.0 = full height)
"""
import sys
from PIL import Image
import numpy as np


def extract_layer(composite_path, reference_path, output_path,
                  threshold=35, y_start_frac=0.0, y_end_frac=1.0,
                  soft_alpha=True, soft_alpha_ramp=80):
    """Extract a feature layer by diffing composite vs reference.

    soft_alpha=True (default): alpha ramps from 0 at threshold to 255 at
    threshold+soft_alpha_ramp, so anti-aliased edges fade naturally instead
    of being captured at full alpha with a hard cut.
    """
    composite = Image.open(composite_path).convert("RGBA")
    reference = Image.open(reference_path).convert("RGBA")

    if composite.size != reference.size:
        reference = reference.resize(composite.size, Image.LANCZOS)

    comp = np.array(composite)
    ref = np.array(reference)

    H, W = comp.shape[:2]

    # Compute Euclidean color distance per pixel (RGB only)
    diff = np.sqrt(np.sum(
        (comp[:, :, :3].astype(np.int32) - ref[:, :, :3].astype(np.int32)) ** 2,
        axis=2,
    ))

    # Restrict to region of interest (vertical band)
    y0 = int(H * y_start_frac)
    y1 = int(H * y_end_frac)
    region = np.zeros((H, W), dtype=bool)
    region[y0:y1, :] = True

    if soft_alpha:
        # Alpha ramps: 0 below threshold, full at threshold+ramp.
        # Edges that are barely-different fade to transparent; clear feature
        # pixels stay fully opaque.
        alpha = np.clip((diff - threshold) * 255.0 / soft_alpha_ramp, 0, 255)
        alpha = alpha * region
        mask_u8 = alpha.astype(np.uint8)
    else:
        mask_u8 = ((diff > threshold) & region).astype(np.uint8) * 255

    output = comp.copy()
    output[:, :, 3] = mask_u8

    Image.fromarray(output).save(output_path, "WEBP", lossless=True)

    n_kept = int(np.count_nonzero(mask_u8))
    pct = n_kept / (H * W) * 100
    mode = "soft-alpha" if soft_alpha else "hard"
    print(f"  Extracted {n_kept:,} feature pixels ({pct:.2f}% of canvas, {mode}) "
          f"-> {output_path}")


if __name__ == "__main__":
    if len(sys.argv) < 4:
        print(__doc__)
        sys.exit(1)
    args = sys.argv[1:]
    composite_path = args[0]
    reference_path = args[1]
    output_path = args[2]
    threshold = int(args[3]) if len(args) > 3 else 35
    y_start = float(args[4]) if len(args) > 4 else 0.0
    y_end = float(args[5]) if len(args) > 5 else 1.0
    extract_layer(composite_path, reference_path, output_path,
                  threshold, y_start, y_end)
