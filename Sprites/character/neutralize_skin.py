#!/usr/bin/env python3
"""Convert a coloured mannequin's body fill into a luminance-only grayscale,
preserving the black manga-ink outline and the alpha channel.

The output is meant to be tinted at runtime via canvas multiply blending
(`ctx.globalCompositeOperation = 'multiply'`) with any target skin colour.
Black outline stays black under multiply; gray fill tints to the target.

Usage:
  python neutralize_skin.py <input.webp> <output.webp> [outline_rgb_max=60]
"""
import sys
import numpy as np
from PIL import Image


def neutralize(in_path: str, out_path: str, outline_rgb_max: int = 60) -> None:
    img = Image.open(in_path).convert("RGBA")
    arr = np.array(img)

    rgb = arr[..., :3].astype(np.int32)
    alpha = arr[..., 3]

    # Outline pixels: every channel below `outline_rgb_max` (ink black + faint anti-alias)
    is_outline = (
        (rgb[..., 0] < outline_rgb_max)
        & (rgb[..., 1] < outline_rgb_max)
        & (rgb[..., 2] < outline_rgb_max)
    )

    # Compute HSL lightness L = (max(r,g,b) + min(r,g,b)) / 2
    cmax = rgb.max(axis=-1)
    cmin = rgb.min(axis=-1)
    L = ((cmax + cmin) // 2).astype(np.uint8)  # 0-255

    # Fill mask: visible pixels that are NOT outline
    fill_mask = (~is_outline) & (alpha > 0)

    out = arr.copy()
    out[..., 0] = np.where(fill_mask, L, arr[..., 0])
    out[..., 1] = np.where(fill_mask, L, arr[..., 1])
    out[..., 2] = np.where(fill_mask, L, arr[..., 2])
    # alpha unchanged

    Image.fromarray(out).save(out_path, "WEBP", lossless=True)

    n_fill = int(fill_mask.sum())
    n_outline = int((is_outline & (alpha > 0)).sum())
    print(
        f"  neutralized: {n_fill:,} fill pixels -> grayscale, "
        f"{n_outline:,} outline pixels kept black "
        f"-> {out_path}"
    )


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    in_path = sys.argv[1]
    out_path = sys.argv[2]
    outline_max = int(sys.argv[3]) if len(sys.argv) > 3 else 60
    neutralize(in_path, out_path, outline_max)
