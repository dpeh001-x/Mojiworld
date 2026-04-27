#!/usr/bin/env python3
"""Mirror the v0.25.83 idle-bbox-as-reference normalization to visually
confirm consistent character height + feet position across frames."""
import sys
import numpy as np
from PIL import Image


def find_bbox(img):
    arr = np.array(img.convert("RGBA"))
    mask = arr[..., 3] > 12
    if not mask.any():
        return None
    ys, xs = np.where(mask)
    return int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())


def normalize_to_reference(src, ref_bh, ref_foot_y, out_w, out_h):
    out = Image.new("RGBA", (out_w, out_h), (0, 0, 0, 0))
    bb = find_bbox(src)
    if not bb:
        return out
    minX, minY, maxX, maxY = bb
    bw = maxX - minX + 1
    bh = maxY - minY + 1
    fit = ref_bh / bh
    drawW = max(1, int(round(bw * fit)))
    drawH = ref_bh
    dx = (out_w - drawW) // 2
    dy = ref_foot_y - drawH
    cropped = src.crop((minX, minY, maxX + 1, maxY + 1))
    scaled = cropped.resize((drawW, drawH), Image.LANCZOS)
    out.paste(scaled, (dx, dy), scaled)
    return out


def render(out_path, sheet_path, frame_idx, grid_w=3, grid_h=3):
    idle = Image.open("Sprites/character/hero/teen_idle.webp").convert("RGBA")
    out_w, out_h = idle.size
    bb = find_bbox(idle)
    if not bb:
        raise RuntimeError("no bbox")
    minX, minY, maxX, maxY = bb
    ref_bh = maxY - minY + 1
    ref_foot_y = maxY + 1
    sheet = Image.open(sheet_path).convert("RGBA")
    cw = sheet.width // grid_w
    ch = sheet.height // grid_h
    col = frame_idx % grid_w
    row = frame_idx // grid_w
    cell = sheet.crop((col * cw, row * ch, (col + 1) * cw, (row + 1) * ch))
    norm = normalize_to_reference(cell, ref_bh, ref_foot_y, out_w, out_h)
    norm.save(out_path, "WEBP", lossless=True)
    print(f"  {sheet_path} frame {frame_idx} -> {out_path} (ref_bh={ref_bh}, foot_y={ref_foot_y})")


if __name__ == "__main__":
    out, sheet, idx = sys.argv[1], sys.argv[2], int(sys.argv[3])
    render(out, sheet, idx)
