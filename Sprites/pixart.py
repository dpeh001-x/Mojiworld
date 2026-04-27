"""Shared pixel-art toolkit for LevelX sprites.

Design goals:
- Nearest-neighbor only — NO anti-aliasing ever.
- 2- or 3-tone cel shading per material.
- Key light from upper-left → highlights top/left, shadows bottom/right.
- 1-px dark outline around silhouettes.
- All draw ops work at 1:1 pixel scale. Scaling is applied at save time
  via nearest-neighbor for the game to load at its expected size.

Authoring convention: draw at the *native* sprite size (e.g. 32x48),
save as PNG with alpha. The game loads native-res.
"""

from PIL import Image, ImageDraw
import os

# ----------------------------------------------------------------------
# Palette — warm fantasy 32-color palette.
# Named so callers never hand-type hex.
# ----------------------------------------------------------------------
P = {
    # Neutrals
    'black':        (0, 0, 0, 255),
    'outline':      (24, 20, 35, 255),       # very dark navy — softer than pure black
    'shadow':       (48, 40, 60, 255),
    'white':        (255, 255, 255, 255),
    'eggshell':     (245, 238, 220, 255),
    'paper':        (235, 222, 188, 255),
    'parchment_dk': (170, 140, 95, 255),
    'grey_d':       (60, 60, 70, 255),
    'grey_m':       (110, 108, 120, 255),
    'grey_l':       (170, 170, 180, 255),

    # Skin
    'skin_l':   (255, 218, 185, 255),
    'skin_m':   (232, 178, 138, 255),
    'skin_d':   (166, 110, 80, 255),
    'blush':    (240, 140, 150, 255),

    # Reds
    'red_d':    (130, 30, 40, 255),
    'red_m':    (210, 45, 55, 255),
    'red_l':    (245, 105, 100, 255),
    'crimson':  (176, 26, 42, 255),
    'crimson_l':(226, 60, 80, 255),

    # Oranges / gold / yellows
    'orange_d': (175, 80, 25, 255),
    'orange_m': (235, 120, 40, 255),
    'orange_l': (255, 175, 75, 255),
    'gold_d':   (170, 120, 30, 255),
    'gold_m':   (230, 180, 55, 255),
    'gold_l':   (255, 225, 120, 255),
    'yellow':   (255, 240, 140, 255),

    # Greens
    'green_d':  (30, 100, 55, 255),
    'green_m':  (60, 160, 80, 255),
    'green_l':  (130, 215, 130, 255),
    'emerald':  (22, 140, 105, 255),
    'emerald_l':(90, 220, 160, 255),

    # Blues / cyans
    'blue_d':   (30, 55, 130, 255),
    'blue_m':   (60, 110, 200, 255),
    'blue_l':   (130, 185, 255, 255),
    'cyan_d':   (25, 120, 160, 255),
    'cyan_m':   (70, 190, 230, 255),
    'cyan_l':   (170, 240, 255, 255),
    'navy':     (20, 30, 80, 255),

    # Purples
    'purple_d': (70, 30, 110, 255),
    'purple_m': (130, 70, 180, 255),
    'purple_l': (200, 150, 240, 255),
    'magenta':  (200, 60, 160, 255),

    # Browns / woods / leathers
    'brown_d':  (70, 42, 26, 255),
    'brown_m':  (115, 75, 40, 255),
    'brown_l':  (175, 125, 75, 255),
    'tan_l':    (220, 180, 130, 255),
    'tan_m':    (180, 135, 90, 255),

    # Metallics
    'steel_d':  (80, 90, 105, 255),
    'steel_m':  (150, 160, 175, 255),
    'steel_l':  (225, 230, 238, 255),
    'iron_d':   (55, 55, 65, 255),
    'iron_m':   (100, 100, 110, 255),
    'iron_l':   (170, 170, 180, 255),

    # Accent gems
    'ruby':     (230, 50, 70, 255),
    'sapphire': (60, 120, 230, 255),
    'amethyst': (170, 90, 220, 255),
    'emerald_gem': (60, 210, 130, 255),
}

TRANSPARENT = (0, 0, 0, 0)


# ----------------------------------------------------------------------
# Canvas helpers
# ----------------------------------------------------------------------
def canvas(w, h, bg=TRANSPARENT):
    return Image.new('RGBA', (w, h), bg)

def px(img, x, y, color):
    """Set a single pixel, ignoring out-of-bounds writes."""
    if 0 <= x < img.width and 0 <= y < img.height:
        img.putpixel((x, y), color)

def rect(img, x0, y0, x1, y1, color):
    """Filled rectangle — inclusive coords, clipped."""
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            px(img, x, y, color)

def hline(img, x0, x1, y, color):
    if x0 > x1: x0, x1 = x1, x0
    for x in range(x0, x1 + 1):
        px(img, x, y, color)

def vline(img, x, y0, y1, color):
    if y0 > y1: y0, y1 = y1, y0
    for y in range(y0, y1 + 1):
        px(img, x, y, color)

def line(img, x0, y0, x1, y1, color):
    """Bresenham, no anti-aliasing."""
    dx = abs(x1 - x0); dy = -abs(y1 - y0)
    sx = 1 if x0 < x1 else -1
    sy = 1 if y0 < y1 else -1
    err = dx + dy
    while True:
        px(img, x0, y0, color)
        if x0 == x1 and y0 == y1: break
        e2 = 2 * err
        if e2 >= dy:
            err += dy; x0 += sx
        if e2 <= dx:
            err += dx; y0 += sy

def circle_fill(img, cx, cy, r, color):
    """Solid disc, no AA."""
    r2 = r * r
    for y in range(-r, r + 1):
        for x in range(-r, r + 1):
            if x*x + y*y <= r2:
                px(img, cx + x, cy + y, color)

def circle_outline(img, cx, cy, r, color):
    r2 = r * r
    r2i = (r - 1) * (r - 1)
    for y in range(-r, r + 1):
        for x in range(-r, r + 1):
            d = x*x + y*y
            if r2i < d <= r2:
                px(img, cx + x, cy + y, color)

def ellipse_fill(img, cx, cy, rx, ry, color):
    if rx <= 0 or ry <= 0: return
    rx2 = rx * rx; ry2 = ry * ry
    for y in range(-ry, ry + 1):
        for x in range(-rx, rx + 1):
            if x*x*ry2 + y*y*rx2 <= rx2 * ry2:
                px(img, cx + x, cy + y, color)

def ellipse_outline(img, cx, cy, rx, ry, color):
    """1-pixel-wide outline (approx)."""
    if rx <= 0 or ry <= 0: return
    rx2 = rx * rx; ry2 = ry * ry
    inner_rx2 = (rx - 1) * (rx - 1)
    inner_ry2 = (ry - 1) * (ry - 1)
    for y in range(-ry, ry + 1):
        for x in range(-rx, rx + 1):
            outside_inner = (x*x * inner_ry2 + y*y * inner_rx2) > inner_rx2 * inner_ry2
            inside_outer  = (x*x * ry2 + y*y * rx2) <= rx2 * ry2
            if outside_inner and inside_outer:
                px(img, cx + x, cy + y, color)

def outline_silhouette(img, color=None):
    """Draw a 1-px outline around every non-transparent pixel.

    Any transparent pixel that has an opaque 4-neighbor gets set to `color`
    (defaults to P['outline']). Run this AFTER filling a shape.
    """
    if color is None:
        color = P['outline']
    src = img.load()
    w, h = img.size
    # Collect writes first, then apply (so we don't expand outline repeatedly)
    writes = []
    for y in range(h):
        for x in range(w):
            if src[x, y][3] == 0:  # transparent
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h and src[nx, ny][3] > 0 and src[nx, ny] != color:
                        writes.append((x, y))
                        break
    for (x, y) in writes:
        px(img, x, y, color)

def darken(color, amount=40):
    r, g, b, a = color
    return (max(0, r - amount), max(0, g - amount), max(0, b - amount), a)

def lighten(color, amount=40):
    r, g, b, a = color
    return (min(255, r + amount), min(255, g + amount), min(255, b + amount), a)


# ----------------------------------------------------------------------
# Composition helpers
# ----------------------------------------------------------------------
def save(img, path, scale=1):
    """Save with optional nearest-neighbor upscale (use scale=1 for game use)."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if scale != 1:
        img = img.resize((img.width * scale, img.height * scale), Image.NEAREST)
    img.save(path)

def sheet(frames, frame_w, frame_h, gap=0):
    """Stitch a list of frame images horizontally into a single PNG."""
    n = len(frames)
    out_w = n * frame_w + (n - 1) * gap
    out = canvas(out_w, frame_h)
    for i, f in enumerate(frames):
        out.paste(f, (i * (frame_w + gap), 0), f)
    return out
