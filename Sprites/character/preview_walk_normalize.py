#!/usr/bin/env python3
"""Mimic the runtime _normalizeChibiFrame + face/hair overlay so we can see
what the in-game walk frames look like, since the in-browser canvas screenshot
times out on the heavy game page.

Usage:
  python preview_walk_normalize.py <output.webp> <frame_index_0_to_3>
"""
import sys
import numpy as np
from PIL import Image


def normalize_chibi_frame(src: Image.Image, out_size: int = 384) -> Image.Image:
    """Crop to bounding box of non-trivial alpha, scale + center to out_size."""
    arr = np.array(src.convert("RGBA"))
    alpha = arr[..., 3]
    mask = alpha > 12
    if not mask.any():
        return Image.new("RGBA", (out_size, out_size), (0, 0, 0, 0))
    ys, xs = np.where(mask)
    minX, maxX = int(xs.min()), int(xs.max())
    minY, maxY = int(ys.min()), int(ys.max())
    bw = maxX - minX + 1
    bh = maxY - minY + 1
    fit_scale = min((out_size * 0.62) / bw, (out_size * 0.92) / bh)
    drawW = int(round(bw * fit_scale))
    drawH = int(round(bh * fit_scale))
    dx = (out_size - drawW) // 2
    dy = int(round(out_size * 0.96)) - drawH
    cropped = src.crop((minX, minY, maxX + 1, maxY + 1))
    scaled = cropped.resize((drawW, drawH), Image.LANCZOS)
    out = Image.new("RGBA", (out_size, out_size), (0, 0, 0, 0))
    out.paste(scaled, (dx, dy), scaled)
    return out


def render(out_path: str, frame_idx: int = 0) -> None:
    sheet = Image.open("Sprites/character/layers/base/mannequin_walk_sheet.webp").convert("RGBA")
    grid_w, grid_h = 2, 2
    cw = sheet.width // grid_w
    ch = sheet.height // grid_h
    col = frame_idx % grid_w
    row = frame_idx // grid_w
    cell = sheet.crop((col * cw, row * ch, (col + 1) * cw, (row + 1) * ch))
    norm = normalize_chibi_frame(cell, 384)
    # Overlay face + hair (using the defaults that match the studio's first load)
    face = Image.open("Sprites/character/layers/eyes/anime_classic.webp").convert("RGBA")
    hair = Image.open("Sprites/character/layers/hair/blonde_shaggy.webp").convert("RGBA")
    if face.size != (384, 384):
        face = face.resize((384, 384), Image.LANCZOS)
    if hair.size != (384, 384):
        hair = hair.resize((384, 384), Image.LANCZOS)
    composed = Image.alpha_composite(norm, face)
    composed = Image.alpha_composite(composed, hair)
    composed.save(out_path, "WEBP", lossless=True)
    print(f"  rendered walk frame {frame_idx} -> {out_path}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    out = sys.argv[1]
    idx = int(sys.argv[2]) if len(sys.argv) > 2 else 0
    render(out, idx)
