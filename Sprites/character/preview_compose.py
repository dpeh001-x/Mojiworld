#!/usr/bin/env python3
"""Preview-compose layered character sprites for visual verification.

Stacks layer images (in z-order) on top of the base mannequin and saves
the result. All inputs must share the same canvas size.

Usage:
  python preview_compose.py <output.webp> <base.webp> [layer1.webp] [layer2.webp] ...
"""
import sys
from PIL import Image


def compose_layers(output_path, base_path, *layer_paths):
    base = Image.open(base_path).convert("RGBA")
    canvas = base.copy()
    for layer_path in layer_paths:
        layer = Image.open(layer_path).convert("RGBA")
        if layer.size != canvas.size:
            layer = layer.resize(canvas.size, Image.LANCZOS)
        canvas = Image.alpha_composite(canvas, layer)
    canvas.save(output_path, "WEBP", lossless=True)
    print(f"  Composed {len(layer_paths)} layer(s) on {base_path} -> {output_path}")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    compose_layers(sys.argv[1], sys.argv[2], *sys.argv[3:])
