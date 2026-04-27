#!/usr/bin/env python3
"""Mimic the v0.25.82 hero walk-frame normalization so we can verify quality
offline. Crops cell from teen_walk_sheet.webp, bbox-normalizes to teen_idle's
640×864 dimensions, saves a single frame.

Usage:
  python preview_hero_walk.py <output.webp> <frame_index_0_to_8>
"""
import sys
import numpy as np
from PIL import Image


def normalize_chibi_frame(src: Image.Image, out_w: int, out_h: int) -> Image.Image:
    arr = np.array(src.convert("RGBA"))
    alpha = arr[..., 3]
    mask = alpha > 12
    if not mask.any():
        return Image.new("RGBA", (out_w, out_h), (0, 0, 0, 0))
    ys, xs = np.where(mask)
    minX, maxX = int(xs.min()), int(xs.max())
    minY, maxY = int(ys.min()), int(ys.max())
    bw = maxX - minX + 1
    bh = maxY - minY + 1
    fit_scale = min((out_w * 0.88) / bw, (out_h * 0.92) / bh)
    drawW = int(round(bw * fit_scale))
    drawH = int(round(bh * fit_scale))
    dx = (out_w - drawW) // 2
    dy = int(round(out_h * 0.96)) - drawH
    cropped = src.crop((minX, minY, maxX + 1, maxY + 1))
    scaled = cropped.resize((drawW, drawH), Image.LANCZOS)
    out = Image.new("RGBA", (out_w, out_h), (0, 0, 0, 0))
    out.paste(scaled, (dx, dy), scaled)
    return out


def render(out_path: str, frame_idx: int = 0) -> None:
    sheet = Image.open("Sprites/character/hero/teen_walk_sheet.webp").convert("RGBA")
    idle = Image.open("Sprites/character/hero/teen_idle.webp").convert("RGBA")
    out_w, out_h = idle.size
    grid_w, grid_h = 3, 3
    cw = sheet.width // grid_w
    ch = sheet.height // grid_h
    col = frame_idx % grid_w
    row = frame_idx // grid_w
    cell = sheet.crop((col * cw, row * ch, (col + 1) * cw, (row + 1) * ch))
    norm = normalize_chibi_frame(cell, out_w, out_h)
    norm.save(out_path, "WEBP", lossless=True)
    print(f"  rendered hero walk frame {frame_idx} ({out_w}×{out_h}) -> {out_path}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    out = sys.argv[1]
    idx = int(sys.argv[2]) if len(sys.argv) > 2 else 0
    render(out, idx)
