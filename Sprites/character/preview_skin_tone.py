#!/usr/bin/env python3
"""Mimic the runtime CharacterCompositor exactly so we can verify visual
output offline (the in-browser canvas screenshot keeps timing out on the
heavy game page).

Pipeline (matches maple_game.html's renderCharStudio):
  1. Load neutralized base → preserve full RGBA including anti-aliased edges.
  2. Per-pixel: multiply RGB by skin tone (skip fully transparent pixels).
  3. Stack the face overlay on top via alpha compositing.

Usage:
  python preview_skin_tone.py <output.webp> <skin_hex> [face.webp]
  python preview_skin_tone.py /tmp/preview.webp #F5C9A8
"""
import sys
import numpy as np
from PIL import Image


def hex_to_rgb(hex_str: str) -> tuple[int, int, int]:
    s = hex_str.lstrip("#")
    return int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16)


def render(out_path: str, skin_hex: str, face_path: str | None = None) -> None:
    base_path = "Sprites/character/layers/base/mannequin_base_neutral.webp"
    base = Image.open(base_path).convert("RGBA")
    arr = np.array(base, dtype=np.int32)  # int32 to avoid uint8 overflow during multiply

    sR, sG, sB = hex_to_rgb(skin_hex)

    rgb = arr[..., :3]
    alpha = arr[..., 3]

    # Per-pixel multiply, only where alpha > 0
    mask = alpha > 0
    rgb[mask, 0] = (rgb[mask, 0] * sR) // 255
    rgb[mask, 1] = (rgb[mask, 1] * sG) // 255
    rgb[mask, 2] = (rgb[mask, 2] * sB) // 255

    arr[..., :3] = rgb
    tinted = Image.fromarray(arr.astype(np.uint8), "RGBA")

    # Stack face overlay (eyes + mouth) on top
    face_path = face_path or "Sprites/character/layers/eyes/anime_classic.webp"
    face = Image.open(face_path).convert("RGBA")
    if face.size != tinted.size:
        face = face.resize(tinted.size, Image.LANCZOS)
    final = Image.alpha_composite(tinted, face)

    final.save(out_path, "WEBP", lossless=True)
    print(f"  rendered {skin_hex} -> {out_path}")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    out = sys.argv[1]
    skin = sys.argv[2]
    face = sys.argv[3] if len(sys.argv) > 3 else None
    render(out, skin, face)
